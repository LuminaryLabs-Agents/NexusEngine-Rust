use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::env;
use std::ffi::OsStr;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

const MANIFEST_FILE: &str = "nexus-package-manifest.json";
const EXCLUDED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "target",
    "output",
    ".playwright-cli",
];

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackConfig {
    name: Option<String>,
    app_id: Option<String>,
    entry: Option<String>,
    kind: Option<String>,
    build_command: Option<String>,
    web_out_dir: Option<String>,
    targets: Option<Vec<String>>,
    asset_base: Option<String>,
    kit_files: Option<Vec<KitFileConfig>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KitFileConfig {
    source: String,
    dest: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Inspection {
    source_path: String,
    source_name: String,
    app_name: String,
    slug: String,
    app_id: String,
    detected_kind: String,
    entry: Option<String>,
    build_command: Option<String>,
    web_out_dir: Option<String>,
    targets: Vec<String>,
    asset_base: String,
    has_package_json: bool,
    has_vite_config: bool,
    has_index_html: bool,
    has_dist_index: bool,
    has_build_json: bool,
    has_nexus_project_json: bool,
    has_nexus_pack_json: bool,
    has_cargo_toml: bool,
    package_dependencies: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TargetOutput {
    target: String,
    path: String,
    bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageManifest {
    schema: String,
    source_path: String,
    source_name: String,
    app_name: String,
    slug: String,
    app_id: String,
    detected_kind: String,
    entry: Option<String>,
    build_command: Option<String>,
    asset_base: String,
    staged_source: String,
    web_dir: String,
    created_unix_timestamp: u64,
    requested_targets: Vec<String>,
    target_outputs: Vec<TargetOutput>,
    web_hashes: BTreeMap<String, String>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BuildResult {
    source_path: String,
    package_dir: String,
    web_dir: String,
    manifest_path: String,
    slug: String,
    app_name: String,
    warnings: Vec<String>,
}

#[derive(Debug, Clone)]
struct BuildContext {
    inspection: Inspection,
    work_dir: PathBuf,
    source_dir: PathBuf,
    web_dir: PathBuf,
    package_dir: PathBuf,
    package_web_dir: PathBuf,
}

fn main() -> Result<()> {
    let mut args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() || args[0] == "-h" || args[0] == "--help" {
        print_help();
        return Ok(());
    }

    let command = args.remove(0);
    match command.as_str() {
        "inspect" => cmd_inspect(&args),
        "build" => cmd_build(&args),
        "package" => cmd_package(&args),
        other => bail!("unknown command: {other}"),
    }
}

fn print_help() {
    println!(
        "nexus-packager inspect <path> --json\n\
         nexus-packager build <path> --target web-static --out dist/packager\n\
         nexus-packager package <path> --targets macos-app,android-apk,ios-sim,windows-exe,electron,web-static --out dist/packager"
    );
}

fn cmd_inspect(args: &[String]) -> Result<()> {
    let (path, json_output, _) = parse_path_options(args, true)?;
    let inspection = inspect_project(&path)?;
    if json_output {
        print_json(&inspection)?;
    } else {
        println!(
            "{} ({}) -> {}",
            inspection.source_name, inspection.detected_kind, inspection.slug
        );
    }
    Ok(())
}

fn cmd_build(args: &[String]) -> Result<()> {
    let (path, _, options) = parse_path_options(args, false)?;
    let out = options
        .get("out")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("dist/packager"));
    let target = options
        .get("target")
        .cloned()
        .unwrap_or_else(|| String::from("web-static"));
    if target != "web-static" {
        bail!("build currently normalizes the web-static bundle; use package for target wrappers");
    }
    let result = build_project(&path, &out, vec![target])?;
    print_json(&result)?;
    Ok(())
}

fn cmd_package(args: &[String]) -> Result<()> {
    let (path, _, options) = parse_path_options(args, false)?;
    let out = options
        .get("out")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("dist/packager"));
    let targets = options
        .get("targets")
        .map(|value| split_csv(value))
        .unwrap_or_else(|| vec![String::from("web-static")]);
    let result = build_project(&path, &out, targets.clone())?;
    let mut manifest = read_manifest(Path::new(&result.manifest_path))?;
    let mut warnings = result.warnings.clone();

    if targets.iter().any(|target| target == "web-static") {
        let artifact_dir = out.join("artifacts").join("web-static");
        fs::create_dir_all(&artifact_dir)?;
        let zip_path = artifact_dir.join(format!("{}-web-static.zip", result.slug));
        zip_directory(Path::new(&result.web_dir), &zip_path)
            .with_context(|| format!("failed to zip {}", result.web_dir))?;
        manifest
            .target_outputs
            .push(output_for("web-static", &zip_path, &out)?);
    }

    let native_targets: Vec<String> = targets
        .iter()
        .filter(|target| target.as_str() != "web-static")
        .cloned()
        .collect();
    if !native_targets.is_empty() {
        warnings.push(format!(
            "native targets prepared for wrapper scripts: {}",
            native_targets.join(",")
        ));
    }
    manifest.warnings = merge_warnings(manifest.warnings, warnings.clone());
    write_manifest(Path::new(&result.manifest_path), &manifest)?;
    write_manifest(&Path::new(&result.web_dir).join(MANIFEST_FILE), &manifest)?;
    print_json(&json!({
        "sourcePath": result.source_path,
        "packageDir": result.package_dir,
        "webDir": result.web_dir,
        "manifestPath": result.manifest_path,
        "slug": result.slug,
        "appName": result.app_name,
        "requestedTargets": targets,
        "warnings": warnings,
        "targetOutputs": manifest.target_outputs,
    }))?;
    Ok(())
}

fn parse_path_options(
    args: &[String],
    json_default: bool,
) -> Result<(PathBuf, bool, BTreeMap<String, String>)> {
    if args.is_empty() {
        bail!("path is required");
    }
    let path = PathBuf::from(&args[0]);
    let mut json_output = json_default;
    let mut options = BTreeMap::new();
    let mut index = 1;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => {
                json_output = true;
                index += 1;
            }
            "--out" | "--target" | "--targets" => {
                let key = args[index].trim_start_matches("--").to_string();
                let value = args
                    .get(index + 1)
                    .cloned()
                    .ok_or_else(|| anyhow!("{} requires a value", args[index]))?;
                options.insert(key, value);
                index += 2;
            }
            other => bail!("unknown option: {other}"),
        }
    }
    Ok((path, json_output, options))
}

fn inspect_project(path: &Path) -> Result<Inspection> {
    let source_path = fs::canonicalize(path)
        .with_context(|| format!("failed to resolve source path {}", path.display()))?;
    if !source_path.is_dir() {
        bail!("source path is not a directory: {}", source_path.display());
    }

    let pack_config = read_pack_config(&source_path)?;
    let package_json = read_json_optional(&source_path.join("package.json"))?;
    let has_package_json = package_json.is_some();
    let has_vite_config = has_any(
        &source_path,
        &["vite.config.js", "vite.config.mjs", "vite.config.ts"],
    );
    let has_index_html = source_path.join("index.html").is_file();
    let has_dist_index = source_path.join("dist/index.html").is_file();
    let has_build_json = source_path.join("build.json").is_file();
    let has_nexus_project_json = source_path.join("nexus.project.json").is_file();
    let has_nexus_pack_json = source_path.join("nexus.pack.json").is_file();
    let has_cargo_toml = source_path.join("Cargo.toml").is_file();

    let source_name = source_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("nexus-project")
        .to_string();
    let package_name = package_json
        .as_ref()
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let name = pack_config
        .name
        .clone()
        .or(package_name.clone())
        .unwrap_or_else(|| source_name.clone());
    let slug = slugify(&name);
    let display_source = pack_config
        .name
        .clone()
        .unwrap_or_else(|| source_name.clone());
    let app_name = display_name(&display_source);
    let app_id = pack_config
        .app_id
        .clone()
        .unwrap_or_else(|| format!("dev.luminarylabs.nexuspackaged.{}", slug.replace('-', ".")));
    let package_dependencies = collect_package_dependencies(package_json.as_ref());
    let has_nexus_dependency = package_dependencies.iter().any(|name| {
        name == "nexusrealtime" || name.starts_with("@luminarylabs/") || name.contains("nexus")
    });
    let has_vite_dependency = package_dependencies.iter().any(|name| name == "vite");
    let has_three_dependency = package_dependencies.iter().any(|name| name == "three");

    let detected_kind = pack_config.kind.clone().unwrap_or_else(|| {
        if has_nexus_pack_json {
            String::from("nexus-pack")
        } else if has_package_json
            && (has_nexus_dependency || has_vite_config || has_vite_dependency)
        {
            String::from("nexusrealtime-vite")
        } else if has_package_json && has_three_dependency {
            String::from("three-web")
        } else if has_package_json {
            String::from("node-web")
        } else if has_dist_index {
            String::from("prebuilt-static")
        } else if has_index_html {
            String::from("static-html")
        } else if has_cargo_toml {
            String::from("rust-workspace")
        } else {
            String::from("unknown")
        }
    });

    let build_command = pack_config.build_command.clone().or_else(|| {
        if has_package_json && !(has_vite_config || has_vite_dependency) {
            Some(String::from("npm run build"))
        } else if has_cargo_toml && !has_package_json {
            Some(String::from("cargo build"))
        } else {
            None
        }
    });
    let web_out_dir = pack_config
        .web_out_dir
        .clone()
        .or_else(|| has_dist_index.then(|| String::from("dist")));
    let entry = pack_config.entry.clone().or_else(|| {
        if has_dist_index {
            Some(String::from("dist/index.html"))
        } else if has_index_html {
            Some(String::from("index.html"))
        } else {
            None
        }
    });
    let targets = pack_config.targets.clone().unwrap_or_else(|| {
        vec![
            String::from("web-static"),
            String::from("macos-app"),
            String::from("android-apk"),
            String::from("ios-sim"),
            String::from("electron"),
            String::from("windows-exe"),
        ]
    });
    let asset_base = pack_config
        .asset_base
        .clone()
        .unwrap_or_else(|| String::from("./"));

    let mut warnings = Vec::new();
    if detected_kind == "unknown" {
        warnings.push(String::from(
            "project shape was not recognized as NexusRealtime, Vite, static HTML, or Rust",
        ));
    }
    if has_package_json && !has_vite_config && !has_vite_dependency {
        warnings.push(String::from(
            "package.json detected without Vite; configured buildCommand or npm run build will be used",
        ));
    }

    Ok(Inspection {
        source_path: source_path.display().to_string(),
        source_name,
        app_name,
        slug,
        app_id,
        detected_kind,
        entry,
        build_command,
        web_out_dir,
        targets,
        asset_base,
        has_package_json,
        has_vite_config,
        has_index_html,
        has_dist_index,
        has_build_json,
        has_nexus_project_json,
        has_nexus_pack_json,
        has_cargo_toml,
        package_dependencies,
        warnings,
    })
}

fn build_project(path: &Path, out: &Path, requested_targets: Vec<String>) -> Result<BuildResult> {
    let inspection = inspect_project(path)?;
    let out_root = absolutize(out)?;
    let work_dir = out_root.join("work").join(&inspection.slug);
    let source_dir = work_dir.join("source");
    let web_dir = work_dir.join("web");
    let package_dir = out_root.join("packages").join(&inspection.slug);
    let package_web_dir = package_dir.join("web");
    let context = BuildContext {
        inspection,
        work_dir,
        source_dir,
        web_dir,
        package_dir,
        package_web_dir,
    };

    fs::remove_dir_all(&context.work_dir).ok();
    fs::remove_dir_all(&context.package_dir).ok();
    fs::create_dir_all(&context.source_dir)?;
    fs::create_dir_all(&context.web_dir)?;
    fs::create_dir_all(&context.package_dir)?;

    copy_dir_filtered(
        Path::new(&context.inspection.source_path),
        &context.source_dir,
        EXCLUDED_DIRS,
    )
    .with_context(|| {
        format!(
            "failed to stage source from {}",
            context.inspection.source_path
        )
    })?;

    let mut warnings = context.inspection.warnings.clone();
    let build_command = normalize_web_bundle(&context, &mut warnings)?;
    copy_configured_kit_files(&context, &mut warnings)?;
    if !context.web_dir.join("index.html").is_file() {
        bail!(
            "normalized web bundle is missing index.html: {}",
            context.web_dir.display()
        );
    }

    fs::create_dir_all(&context.package_web_dir)?;
    copy_dir_clean(&context.web_dir, &context.package_web_dir)?;

    let web_hashes = hash_tree(&context.package_web_dir, Some(MANIFEST_FILE))?;
    let manifest = PackageManifest {
        schema: String::from("nexus-package-manifest.v1"),
        source_path: context.inspection.source_path.clone(),
        source_name: context.inspection.source_name.clone(),
        app_name: context.inspection.app_name.clone(),
        slug: context.inspection.slug.clone(),
        app_id: context.inspection.app_id.clone(),
        detected_kind: context.inspection.detected_kind.clone(),
        entry: context.inspection.entry.clone(),
        build_command,
        asset_base: context.inspection.asset_base.clone(),
        staged_source: context.source_dir.display().to_string(),
        web_dir: context.package_web_dir.display().to_string(),
        created_unix_timestamp: now_unix(),
        requested_targets,
        target_outputs: Vec::new(),
        web_hashes,
        warnings: warnings.clone(),
    };
    let manifest_path = context.package_dir.join(MANIFEST_FILE);
    write_manifest(&manifest_path, &manifest)?;
    write_manifest(&context.package_web_dir.join(MANIFEST_FILE), &manifest)?;

    Ok(BuildResult {
        source_path: context.inspection.source_path.clone(),
        package_dir: context.package_dir.display().to_string(),
        web_dir: context.package_web_dir.display().to_string(),
        manifest_path: manifest_path.display().to_string(),
        slug: context.inspection.slug.clone(),
        app_name: context.inspection.app_name.clone(),
        warnings,
    })
}

fn normalize_web_bundle(
    context: &BuildContext,
    warnings: &mut Vec<String>,
) -> Result<Option<String>> {
    let source_path = Path::new(&context.inspection.source_path);
    if context.inspection.has_package_json {
        let is_vite = context.inspection.has_vite_config
            || context
                .inspection
                .package_dependencies
                .iter()
                .any(|name| name == "vite");
        let installed = run_npm_install(&context.source_dir, warnings)?;
        if !installed && context.inspection.has_dist_index {
            warnings.push(String::from(
                "npm install failed; using prebuilt dist/index.html from source",
            ));
            copy_dir_clean(&source_path.join("dist"), &context.web_dir)?;
            return Ok(None);
        }

        if is_vite {
            let out_dir = context.web_dir.display().to_string();
            let mut command = Command::new(npx_bin());
            command
                .arg("vite")
                .arg("build")
                .arg("--base")
                .arg("./")
                .arg("--outDir")
                .arg(&out_dir)
                .current_dir(&context.source_dir);
            let status =
                run_command_to_stderr(&mut command).context("failed to start npx vite build")?;
            if status.success() {
                return Ok(Some(format!("npx vite build --base ./ --outDir {out_dir}")));
            }
            if context.inspection.has_dist_index {
                warnings.push(String::from(
                    "Vite build failed; using prebuilt dist/index.html from source",
                ));
                copy_dir_clean(&source_path.join("dist"), &context.web_dir)?;
                return Ok(Some(format!(
                    "npx vite build --base ./ --outDir {out_dir} (failed; prebuilt dist fallback)"
                )));
            }
            bail!("npx vite build failed");
        }

        let command = context
            .inspection
            .build_command
            .clone()
            .unwrap_or_else(|| String::from("npm run build"));
        run_shell_command(&command, &context.source_dir)
            .with_context(|| format!("buildCommand failed: {command}"))?;
        let build_out = context
            .inspection
            .web_out_dir
            .as_ref()
            .map(|value| context.source_dir.join(value))
            .unwrap_or_else(|| context.source_dir.join("dist"));
        if !build_out.join("index.html").is_file() {
            bail!(
                "build output is missing index.html: {}",
                build_out.display()
            );
        }
        copy_dir_clean(&build_out, &context.web_dir)?;
        return Ok(Some(command));
    }

    if context.inspection.has_dist_index {
        copy_dir_clean(&source_path.join("dist"), &context.web_dir)?;
        return Ok(None);
    }

    if context.inspection.has_index_html {
        copy_dir_filtered(source_path, &context.web_dir, EXCLUDED_DIRS)?;
        return Ok(None);
    }

    if context.inspection.has_cargo_toml {
        let command = context
            .inspection
            .build_command
            .clone()
            .unwrap_or_else(|| String::from("cargo build"));
        run_shell_command(&command, &context.source_dir)
            .with_context(|| format!("Rust build failed: {command}"))?;
        warnings.push(String::from(
            "Rust workspace built, but no web bundle was detected for native web packaging",
        ));
        return Ok(Some(command));
    }

    bail!("could not produce a web bundle from the input project")
}

fn copy_configured_kit_files(context: &BuildContext, warnings: &mut Vec<String>) -> Result<()> {
    let config = read_pack_config(Path::new(&context.inspection.source_path))?;
    let Some(kit_files) = config.kit_files else {
        return Ok(());
    };

    let project_root = Path::new(&context.inspection.source_path);
    let repo_root = env::current_dir()?;
    for kit_file in kit_files {
        let source = resolve_kit_source(project_root, &repo_root, &kit_file.source)?;
        let dest = safe_bundle_dest(&context.web_dir, &kit_file.dest)?;
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source, &dest).with_context(|| {
            format!(
                "failed to copy kit file {} to {}",
                source.display(),
                dest.display()
            )
        })?;
        warnings.push(format!(
            "copied kit file {} into {}",
            Path::new(&kit_file.source)
                .file_name()
                .and_then(OsStr::to_str)
                .unwrap_or("kit-file"),
            kit_file.dest
        ));
    }
    Ok(())
}

fn resolve_kit_source(project_root: &Path, repo_root: &Path, source: &str) -> Result<PathBuf> {
    let raw = Path::new(source);
    let candidates = if raw.is_absolute() {
        vec![raw.to_path_buf()]
    } else {
        vec![project_root.join(raw), repo_root.join(raw)]
    };

    for candidate in candidates {
        if candidate.is_file() {
            return fs::canonicalize(&candidate)
                .with_context(|| format!("failed to resolve kit file {}", candidate.display()));
        }
    }

    bail!(
        "kitFiles source was not found from project root or repo root: {}",
        source
    )
}

fn safe_bundle_dest(web_dir: &Path, dest: &str) -> Result<PathBuf> {
    if dest.trim().is_empty() {
        bail!("kitFiles dest must not be empty");
    }
    let raw = Path::new(dest);
    if raw.is_absolute() {
        bail!("kitFiles dest must be relative: {dest}");
    }
    for component in raw.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => bail!("kitFiles dest must stay inside the web bundle: {dest}"),
        }
    }
    Ok(web_dir.join(raw))
}

fn run_npm_install(dir: &Path, warnings: &mut Vec<String>) -> Result<bool> {
    if dir.join("node_modules").exists() {
        return Ok(true);
    }
    let mut command = Command::new(npm_bin());
    command
        .arg("install")
        .arg("--ignore-scripts")
        .current_dir(dir);
    let status = run_command_to_stderr(&mut command).context("failed to start npm install")?;
    if status.success() {
        Ok(true)
    } else {
        warnings.push(format!("npm install failed with status {status}"));
        Ok(false)
    }
}

fn run_shell_command(command: &str, dir: &Path) -> Result<()> {
    let status = if cfg!(windows) {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C")
            .arg(command)
            .current_dir(dir)
            .stdin(Stdio::null());
        run_command_to_stderr(&mut cmd)?
    } else {
        let mut cmd = Command::new("sh");
        cmd.arg("-c")
            .arg(command)
            .current_dir(dir)
            .stdin(Stdio::null());
        run_command_to_stderr(&mut cmd)?
    };
    if !status.success() {
        bail!("command exited with {status}");
    }
    Ok(())
}

fn run_command_to_stderr(command: &mut Command) -> Result<ExitStatus> {
    let output = command.output()?;
    if !output.stdout.is_empty() {
        std::io::stderr().write_all(&output.stdout)?;
    }
    if !output.stderr.is_empty() {
        std::io::stderr().write_all(&output.stderr)?;
    }
    Ok(output.status)
}

fn npm_bin() -> &'static str {
    if cfg!(windows) {
        "npm.cmd"
    } else {
        "npm"
    }
}

fn npx_bin() -> &'static str {
    if cfg!(windows) {
        "npx.cmd"
    } else {
        "npx"
    }
}

fn read_pack_config(root: &Path) -> Result<PackConfig> {
    let path = root.join("nexus.pack.json");
    if !path.is_file() {
        return Ok(PackConfig::default());
    }
    let value =
        fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    serde_json::from_str(&value).with_context(|| format!("failed to parse {}", path.display()))
}

fn read_json_optional(path: &Path) -> Result<Option<Value>> {
    if !path.is_file() {
        return Ok(None);
    }
    let value =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    Ok(Some(serde_json::from_str(&value).with_context(|| {
        format!("failed to parse {}", path.display())
    })?))
}

fn collect_package_dependencies(package_json: Option<&Value>) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(package_json) = package_json {
        for field in ["dependencies", "devDependencies", "peerDependencies"] {
            if let Some(object) = package_json.get(field).and_then(Value::as_object) {
                out.extend(object.keys().cloned());
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

fn has_any(root: &Path, names: &[&str]) -> bool {
    names.iter().any(|name| root.join(name).is_file())
}

fn copy_dir_clean(from: &Path, to: &Path) -> Result<()> {
    fs::remove_dir_all(to).ok();
    fs::create_dir_all(to)?;
    copy_dir_filtered(from, to, &[])
}

fn copy_dir_filtered(from: &Path, to: &Path, excluded: &[&str]) -> Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from).with_context(|| format!("read_dir {}", from.display()))? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if excluded
            .iter()
            .any(|excluded_name| excluded_name == &name_str)
        {
            continue;
        }
        let dest = to.join(&name);
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_filtered(&path, &dest, excluded)?;
        } else if file_type.is_file() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&path, &dest)
                .with_context(|| format!("copy {} to {}", path.display(), dest.display()))?;
        }
    }
    Ok(())
}

fn hash_tree(root: &Path, skip_file_name: Option<&str>) -> Result<BTreeMap<String, String>> {
    let mut out = BTreeMap::new();
    for file in collect_files(root)? {
        if skip_file_name
            .map(|name| file.file_name().and_then(OsStr::to_str) == Some(name))
            .unwrap_or(false)
        {
            continue;
        }
        let relative = file
            .strip_prefix(root)
            .unwrap_or(&file)
            .to_string_lossy()
            .replace('\\', "/");
        out.insert(relative, sha256_file(&file)?);
    }
    Ok(out)
}

fn collect_files(root: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_files_inner(root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_files_inner(root: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    if !root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_files_inner(&path, files)?;
        } else if file_type.is_file() {
            files.push(path);
        }
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn zip_directory(root: &Path, zip_path: &Path) -> Result<()> {
    if let Some(parent) = zip_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = File::create(zip_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for path in collect_files(root)? {
        let relative = path
            .strip_prefix(root)?
            .to_string_lossy()
            .replace('\\', "/");
        zip.start_file(relative, options)?;
        let mut input = File::open(&path)?;
        std::io::copy(&mut input, &mut zip)?;
    }
    zip.finish()?;
    Ok(())
}

fn output_for(target: &str, path: &Path, out_root: &Path) -> Result<TargetOutput> {
    let bytes = fs::metadata(path)?.len();
    let display_path = path
        .strip_prefix(out_root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(TargetOutput {
        target: target.to_string(),
        path: display_path,
        bytes,
        sha256: sha256_file(path)?,
    })
}

fn read_manifest(path: &Path) -> Result<PackageManifest> {
    let value = fs::read_to_string(path)?;
    serde_json::from_str(&value).with_context(|| format!("failed to parse {}", path.display()))
}

fn write_manifest(path: &Path, manifest: &PackageManifest) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(manifest)?;
    fs::write(path, format!("{json}\n"))?;
    Ok(())
}

fn split_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn merge_warnings(mut existing: Vec<String>, next: Vec<String>) -> Vec<String> {
    for item in next {
        if !existing.iter().any(|value| value == &item) {
            existing.push(item);
        }
    }
    existing
}

fn absolutize(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        Ok(env::current_dir()?.join(path))
    }
}

fn slugify(value: &str) -> String {
    let mut out = String::new();
    let mut previous_dash = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            out.push('-');
            previous_dash = true;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        String::from("nexus-project")
    } else {
        out
    }
}

fn display_name(value: &str) -> String {
    let mut words = Vec::new();
    for part in value
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
    {
        if part.chars().any(|ch| ch.is_ascii_uppercase()) {
            words.push(part.to_string());
            continue;
        }
        let mut chars = part.chars();
        if let Some(first) = chars.next() {
            let word = format!(
                "{}{}",
                first.to_ascii_uppercase(),
                chars.as_str().to_ascii_lowercase()
            );
            words.push(word);
        }
    }
    if words.is_empty() {
        String::from("Nexus Packaged App")
    } else {
        words.join(" ")
    }
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn print_json<T: Serialize>(value: &T) -> Result<()> {
    let stdout = std::io::stdout();
    let mut lock = stdout.lock();
    serde_json::to_writer_pretty(&mut lock, value)?;
    writeln!(&mut lock)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_bundle_dest_rejects_paths_outside_bundle() {
        let root = Path::new("/tmp/nexus-web");
        assert!(safe_bundle_dest(root, "kits/cube.mjs").is_ok());
        assert!(safe_bundle_dest(root, "../cube.mjs").is_err());
        assert!(safe_bundle_dest(root, "/tmp/cube.mjs").is_err());
    }
}
