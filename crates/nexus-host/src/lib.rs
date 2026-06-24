use anyhow::Result;
use nexus_command_buffer::CommandBuffer;
use nexus_sequence::SequenceRuntime;

#[derive(Debug, Clone, Default)]
pub struct InputSnapshot {
    pub frame: u64,
    pub primary_pressed: bool,
    pub left_stick: [f32; 2],
    pub right_stick: [f32; 2],
}

pub trait HostAdapter {
    fn start(&mut self) -> Result<()>;
    fn stop(&mut self) -> Result<()>;
    fn read_input(&mut self) -> InputSnapshot;
    fn tick(&mut self, dt: f32) -> Result<CommandBuffer>;
    fn present(&mut self, commands: &CommandBuffer) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct ManifestSummary {
    pub kit_count: usize,
    pub source_count: usize,
}

pub struct HostRuntime {
    sequence: SequenceRuntime,
    manifest: ManifestSummary,
    frame: u64,
    started: bool,
    last_summary: String,
}

impl HostRuntime {
    pub fn from_json(sequence_json: &str, manifest_json: &str) -> Result<Self> {
        let sequence = SequenceRuntime::from_json(sequence_json)?;
        let manifest = summarize_manifest(manifest_json);
        Ok(Self {
            sequence,
            manifest,
            frame: 0,
            started: false,
            last_summary: "runtime created".to_string(),
        })
    }

    pub fn start(&mut self) {
        self.started = true;
        self.last_summary = format!(
            "Nexus host started. kits={} sources={}",
            self.manifest.kit_count, self.manifest.source_count
        );
    }

    pub fn tick(&mut self, dt: f32) -> CommandBuffer {
        self.frame += 1;
        let buffer = self.sequence.tick(dt);
        self.last_summary = format!(
            "frame={} commands={} kits={}",
            self.frame,
            buffer.len(),
            self.manifest.kit_count
        );
        buffer
    }

    pub fn status(&self) -> String {
        self.last_summary.clone()
    }

    pub fn is_started(&self) -> bool {
        self.started
    }
}

fn summarize_manifest(manifest_json: &str) -> ManifestSummary {
    let value: serde_json::Value = serde_json::from_str(manifest_json).unwrap_or(serde_json::Value::Null);
    let kit_count = value
        .get("kits")
        .and_then(|kits| kits.as_array())
        .map(|kits| kits.len())
        .unwrap_or(0);
    let source_count = value
        .get("sources")
        .and_then(|sources| sources.as_object())
        .map(|sources| sources.len())
        .unwrap_or(0);
    ManifestSummary { kit_count, source_count }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_runtime_ticks_sequence() {
        let sequence = r#"{"id":"root","type":"flow","children":[{"id":"panel","type":"host-command","command":"spawn_panel"}]}"#;
        let manifest = r#"{"sources":{"core":"test"},"kits":[{"id":"n:test"}]}"#;
        let mut runtime = HostRuntime::from_json(sequence, manifest).unwrap();
        runtime.start();
        let buffer = runtime.tick(1.0 / 60.0);
        assert_eq!(buffer.len(), 4);
        assert!(runtime.status().contains("kits=1"));
    }
}
