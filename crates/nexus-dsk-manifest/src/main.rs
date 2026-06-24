fn main() {
    let manifest = r#"{"schema":"nexus.dsk-manifest.v1","kits":[{"id":"xr-input-kit"},{"id":"xr-grab-throw-kit"},{"id":"simple-rigid-body-kit"},{"id":"toon-visual-kit"},{"id":"sky-gradient-kit"},{"id":"xr-house-demo-kit"}]}"#;
    println!("{}", manifest);
}
