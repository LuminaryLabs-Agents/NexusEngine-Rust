fn main() {
    let manifest = r#"{"schema":"nexus.dsk-manifest.v1","kits":[{"id":"xr-session-kit"},{"id":"xr-frame-kit"},{"id":"xr-layer-kit"},{"id":"xr-render-descriptor-kit"},{"id":"xr-input-kit"},{"id":"xr-grab-throw-kit"},{"id":"simple-rigid-body-kit"},{"id":"toon-visual-kit"},{"id":"sky-gradient-kit"}]}"#;
    println!("{}", manifest);
}
