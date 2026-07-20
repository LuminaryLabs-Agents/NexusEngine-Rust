use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

pub const PROJECT_IR_SCHEMA: &str = "nexus-project-ir/v1";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIr {
    pub schema: String,
    pub project: ProjectDescriptor,
    #[serde(default)]
    pub entry_modules: Vec<String>,
    #[serde(default)]
    pub kits: Vec<KitDescriptor>,
    #[serde(default)]
    pub assets: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDescriptor {
    pub id: String,
    pub name: String,
    pub entry_html: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KitDescriptor {
    pub id: String,
    pub source_module: String,
    #[serde(default)]
    pub resources: BTreeMap<String, Value>,
    #[serde(default)]
    pub systems: Vec<SystemDescriptor>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDescriptor {
    #[serde(default = "default_phase")]
    pub phase: String,
    #[serde(default)]
    pub operations: Vec<OperationDescriptor>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OperationDescriptor {
    pub op: String,
    #[serde(default)]
    pub arguments: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct GeneratedCrate {
    pub package_name: String,
    pub files: BTreeMap<String, String>,
}

impl GeneratedCrate {
    pub fn write_to(&self, root: &Path) -> Result<()> {
        for (relative_path, content) in &self.files {
            let path = root.join(relative_path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)
                    .with_context(|| format!("failed to create {}", parent.display()))?;
            }
            fs::write(&path, content)
                .with_context(|| format!("failed to write {}", path.display()))?;
        }
        Ok(())
    }
}

fn default_phase() -> String {
    "simulation".to_string()
}

pub fn parse_project_ir(source: &str) -> Result<ProjectIr> {
    let ir: ProjectIr = serde_json::from_str(source).context("invalid Nexus project IR JSON")?;
    validate_project_ir(&ir)?;
    Ok(ir)
}

pub fn validate_project_ir(ir: &ProjectIr) -> Result<()> {
    if ir.schema != PROJECT_IR_SCHEMA {
        bail!("unsupported project IR schema: {}", ir.schema);
    }
    if ir.project.id.trim().is_empty() {
        bail!("project id is required");
    }
    if ir.project.entry_html.trim().is_empty() {
        bail!("project entryHtml is required");
    }

    let mut ids = BTreeSet::new();
    for kit in &ir.kits {
        if kit.id.trim().is_empty() {
            bail!("kit id is required");
        }
        if !ids.insert(kit.id.as_str()) {
            bail!("duplicate kit id: {}", kit.id);
        }
        for system in &kit.systems {
            if system.phase.trim().is_empty() {
                bail!("kit {} has a system without a phase", kit.id);
            }
            for operation in &system.operations {
                if operation.op.trim().is_empty() {
                    bail!("kit {} has an operation without an id", kit.id);
                }
            }
        }
    }
    Ok(())
}

pub fn generate_headless_crate(ir: &ProjectIr) -> Result<GeneratedCrate> {
    validate_project_ir(ir)?;
    let package_name = format!("nexus-{}-native", slugify(&ir.project.id));
    let mut files = BTreeMap::new();
    files.insert(
        "Cargo.toml".to_string(),
        format!(
            "[package]\nname = \"{package_name}\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n\n[workspace]\n"
        ),
    );
    files.insert("src/main.rs".to_string(), render_main(ir));
    files.insert(
        "nexus-project-ir.json".to_string(),
        serde_json::to_string_pretty(ir).context("failed to serialize project IR")?,
    );
    Ok(GeneratedCrate {
        package_name,
        files,
    })
}

fn render_main(ir: &ProjectIr) -> String {
    let mut output = String::from(
        "#[derive(Debug)]\n\
         enum ResourceValue { Number(f64), Bool(bool), Text(&'static str), Json(&'static str), Null }\n\n\
         #[derive(Debug)]\n\
         struct Resource { name: &'static str, value: ResourceValue }\n\n\
         #[derive(Debug)]\n\
         struct Operation { id: &'static str, arguments: &'static [&'static str] }\n\n\
         #[derive(Debug)]\n\
         struct System { phase: &'static str, operations: &'static [Operation] }\n\n\
         #[derive(Debug)]\n\
         struct Kit { id: &'static str, source_module: &'static str, resources: &'static [Resource], systems: &'static [System] }\n\n",
    );

    for (kit_index, kit) in ir.kits.iter().enumerate() {
        output.push_str(&format!("static KIT_{kit_index}_RESOURCES: &[Resource] = &[\n"));
        for (name, value) in &kit.resources {
            output.push_str(&format!(
                "    Resource {{ name: \"{}\", value: {} }},\n",
                escape_rust(name),
                render_resource_value(value)
            ));
        }
        output.push_str("];\n\n");

        for (system_index, system) in kit.systems.iter().enumerate() {
            output.push_str(&format!(
                "static KIT_{kit_index}_SYSTEM_{system_index}_OPERATIONS: &[Operation] = &[\n"
            ));
            for operation in &system.operations {
                let arguments = operation
                    .arguments
                    .iter()
                    .map(|argument| format!("\"{}\"", escape_rust(argument)))
                    .collect::<Vec<_>>()
                    .join(", ");
                output.push_str(&format!(
                    "    Operation {{ id: \"{}\", arguments: &[{}] }},\n",
                    escape_rust(&operation.op),
                    arguments
                ));
            }
            output.push_str("];\n\n");
        }

        output.push_str(&format!("static KIT_{kit_index}_SYSTEMS: &[System] = &[\n"));
        for (system_index, system) in kit.systems.iter().enumerate() {
            output.push_str(&format!(
                "    System {{ phase: \"{}\", operations: KIT_{kit_index}_SYSTEM_{system_index}_OPERATIONS }},\n",
                escape_rust(&system.phase)
            ));
        }
        output.push_str("];\n\n");
    }

    output.push_str("static KITS: &[Kit] = &[\n");
    for (kit_index, kit) in ir.kits.iter().enumerate() {
        output.push_str(&format!(
            "    Kit {{ id: \"{}\", source_module: \"{}\", resources: KIT_{kit_index}_RESOURCES, systems: KIT_{kit_index}_SYSTEMS }},\n",
            escape_rust(&kit.id),
            escape_rust(&kit.source_module)
        ));
    }
    output.push_str("];\n\n");

    output.push_str(&format!(
        "const PROJECT_ID: &str = \"{}\";\nconst PROJECT_NAME: &str = \"{}\";\nconst ENTRY_HTML: &str = \"{}\";\nconst ENTRY_MODULE_COUNT: usize = {};\nconst ASSET_COUNT: usize = {};\n\n",
        escape_rust(&ir.project.id),
        escape_rust(&ir.project.name),
        escape_rust(&ir.project.entry_html),
        ir.entry_modules.len(),
        ir.assets.len()
    ));

    output.push_str(
        "fn main() {\n\
             let system_count: usize = KITS.iter().map(|kit| kit.systems.len()).sum();\n\
             let operation_count: usize = KITS.iter().flat_map(|kit| kit.systems).map(|system| system.operations.len()).sum();\n\
             let resource_count: usize = KITS.iter().map(|kit| kit.resources.len()).sum();\n\
             println!(\"project={} name={} entry={} entries={} kits={} resources={} systems={} operations={} assets={}\", PROJECT_ID, PROJECT_NAME, ENTRY_HTML, ENTRY_MODULE_COUNT, KITS.len(), resource_count, system_count, operation_count, ASSET_COUNT);\n\
             for kit in KITS {\n\
                 println!(\"kit={} source={} resources={} systems={}\", kit.id, kit.source_module, kit.resources.len(), kit.systems.len());\n\
             }\n\
         }\n",
    );
    output
}

fn render_resource_value(value: &Value) -> String {
    match value {
        Value::Null => "ResourceValue::Null".to_string(),
        Value::Bool(value) => format!("ResourceValue::Bool({value})"),
        Value::Number(value) => format!("ResourceValue::Number({})", value.as_f64().unwrap_or_default()),
        Value::String(value) => format!("ResourceValue::Text(\"{}\")", escape_rust(value)),
        other => format!(
            "ResourceValue::Json(\"{}\")",
            escape_rust(&serde_json::to_string(other).unwrap_or_else(|_| "null".to_string()))
        ),
    }
}

fn slugify(value: &str) -> String {
    let mut output = String::new();
    let mut previous_dash = false;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash && !output.is_empty() {
            output.push('-');
            previous_dash = true;
        }
    }
    let slug = output.trim_matches('-');
    if slug.is_empty() { "project".to_string() } else { slug.to_string() }
}

fn escape_rust(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "schema":"nexus-project-ir/v1",
      "project":{"id":"compiler-proof","name":"Compiler Proof","entryHtml":"index.html"},
      "entryModules":["main.mjs"],
      "kits":[{
        "id":"game:movement",
        "sourceModule":"kits/movement-kit.mjs",
        "resources":{"speed":8,"enabled":true},
        "systems":[{"phase":"simulation","operations":[{"op":"input.axis","arguments":["\"move\""]}]}]
      }],
      "assets":["assets/player.glb"]
    }"#;

    #[test]
    fn parses_and_generates_headless_crate() {
        let ir = parse_project_ir(SAMPLE).unwrap();
        let generated = generate_headless_crate(&ir).unwrap();
        assert_eq!(generated.package_name, "nexus-compiler-proof-native");
        let main = generated.files.get("src/main.rs").unwrap();
        assert!(main.contains("game:movement"));
        assert!(main.contains("input.axis"));
        assert!(main.contains("ResourceValue::Number(8"));
    }

    #[test]
    fn rejects_duplicate_kit_ids() {
        let mut ir = parse_project_ir(SAMPLE).unwrap();
        ir.kits.push(ir.kits[0].clone());
        assert!(validate_project_ir(&ir).is_err());
    }
}
