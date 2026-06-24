use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NexusProject {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub target: String,
    #[serde(default, rename = "entrySequence")]
    pub entry_sequence: String,
    #[serde(default)]
    pub kits: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectBundle {
    pub project: NexusProject,
    pub sequence_json: String,
    pub host_json: String,
    pub interaction_json: String,
    pub materials_json: String,
}

impl ProjectBundle {
    pub fn from_parts(
        project_json: &str,
        sequence_json: &str,
        host_json: &str,
        interaction_json: &str,
        materials_json: &str,
    ) -> Result<Self> {
        let project: NexusProject = serde_json::from_str(project_json).context("invalid Nexus project json")?;
        validate_json(sequence_json, "sequence")?;
        validate_json(host_json, "host")?;
        validate_json(interaction_json, "interaction")?;
        validate_json(materials_json, "materials")?;
        Ok(Self {
            project,
            sequence_json: sequence_json.to_string(),
            host_json: host_json.to_string(),
            interaction_json: interaction_json.to_string(),
            materials_json: materials_json.to_string(),
        })
    }

    pub fn summary(&self) -> String {
        format!("project={} kits={}", self.project.id, self.project.kits.len())
    }
}

fn validate_json(source: &str, label: &str) -> Result<()> {
    let _: serde_json::Value = serde_json::from_str(source).with_context(|| format!("invalid {label} json"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_project_bundle() {
        let bundle = ProjectBundle::from_parts(
            r#"{"id":"xr-house-demo","name":"XR House","target":"adaptive-xr","entrySequence":"scene.sequence.json","kits":["xr-input-kit","toon-visual-kit"]}"#,
            r#"{"id":"scene","type":"flow"}"#,
            r#"{"profiles":[]}"#,
            r#"{"grabbables":[]}"#,
            r#"{"materials":[]}"#,
        )
        .unwrap();
        assert_eq!(bundle.summary(), "project=xr-house-demo kits=2");
    }
}
