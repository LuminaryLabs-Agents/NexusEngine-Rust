#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createProjectCompiler } from "../local-kits/project-compiler-domain-kit.mjs";

const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", "dist", "target", "output", ".playwright-cli"]);

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function slugify(value) {
  return String(value || "nexus-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "nexus-project";
}

async function listFiles(root, current = "") {
  const directory = path.join(root, current);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const relative = normalizePath(path.join(current, entry.name));
    if (entry.isDirectory()) files.push(...await listFiles(root, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

function createNodeSourceProvider(root) {
  return {
    listFiles: () => listFiles(root),
    readText: (relative) => readFile(path.join(root, relative), "utf8"),
    async exists(relative) {
      try {
        await access(path.join(root, relative));
        return (await stat(path.join(root, relative))).isFile();
      } catch {
        return false;
      }
    },
    resolve(from, specifier) {
      return normalizePath(path.join(path.dirname(from), specifier));
    }
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
  return result.stdout?.trim() || "";
}

async function readPackConfig(projectRoot) {
  try {
    return JSON.parse(await readFile(path.join(projectRoot, "nexus.pack.json"), "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, "..");
  const projectRoot = path.resolve(process.argv[2] || "");
  const outRoot = path.resolve(process.argv[3] || "dist/packager");
  if (!process.argv[2]) throw new Error("usage: compile-nexus-project.mjs <project-root> [out-root]");

  const config = await readPackConfig(projectRoot);
  const entryHtml = typeof config.entry === "string" && config.entry.endsWith(".html") ? config.entry : "index.html";
  const compiler = createProjectCompiler({ sourceProvider: createNodeSourceProvider(projectRoot) });
  const ir = await compiler.createProjectIR({
    entryHtml,
    projectId: slugify(config.name || path.basename(projectRoot)),
    projectName: config.name || path.basename(projectRoot)
  });
  const plan = compiler.planTarget(ir, "native-rust-headless");
  if (!plan.supported) {
    const details = plan.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("\n");
    throw new Error(`native Rust target is not supported\n${details}`);
  }

  const slug = slugify(ir.project.id);
  const workRoot = path.join(outRoot, "work", slug, "native-rust");
  const generatedRoot = path.join(workRoot, "generated");
  const artifactRoot = path.join(outRoot, "artifacts", "native-rust-headless");
  const irPath = path.join(workRoot, "nexus-project-ir.json");
  await mkdir(workRoot, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(irPath, `${JSON.stringify(ir, null, 2)}\n`);

  const compilerOutput = run(
    "cargo",
    ["run", "--quiet", "-p", "nexus-project-compiler", "--", irPath, generatedRoot],
    { cwd: repoRoot, capture: true }
  );
  const generation = JSON.parse(compilerOutput.split("\n").at(-1));
  run("cargo", ["build", "--release", "--manifest-path", path.join(generatedRoot, "Cargo.toml")], { cwd: repoRoot });

  const executableName = `${generation.packageName}${process.platform === "win32" ? ".exe" : ""}`;
  const builtBinary = path.join(generatedRoot, "target", "release", executableName);
  const artifactBinary = path.join(artifactRoot, `${slug}-native-rust-headless${process.platform === "win32" ? ".exe" : ""}`);
  await copyFile(builtBinary, artifactBinary);
  await copyFile(irPath, path.join(artifactRoot, `${slug}-nexus-project-ir.json`));

  const manifest = {
    schema: "nexus-native-rust-package/v1",
    projectId: ir.project.id,
    target: "native-rust-headless",
    packageName: generation.packageName,
    binary: artifactBinary,
    projectIr: path.join(artifactRoot, `${slug}-nexus-project-ir.json`),
    kitCount: ir.kits.length,
    moduleCount: ir.modules.length
  };
  await writeFile(path.join(artifactRoot, `${slug}-native-rust-headless.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
