use anyhow::{bail, Context, Result};
use nexus_project_compiler::{generate_headless_crate, parse_project_ir};
use serde_json::json;
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() -> Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.len() != 2 {
        bail!("usage: nexus-project-compiler <project-ir.json> <output-directory>");
    }

    let ir_path = PathBuf::from(&args[0]);
    let output_path = PathBuf::from(&args[1]);
    let source = fs::read_to_string(&ir_path)
        .with_context(|| format!("failed to read {}", ir_path.display()))?;
    let ir = parse_project_ir(&source)?;
    let generated = generate_headless_crate(&ir)?;
    generated.write_to(&output_path)?;

    println!(
        "{}",
        serde_json::to_string(&json!({
            "schema": "nexus-project-compiler-output/v1",
            "projectId": &ir.project.id,
            "packageName": &generated.package_name,
            "outputDirectory": output_path.display().to_string(),
            "fileCount": generated.files.len()
        }))?
    );
    Ok(())
}
