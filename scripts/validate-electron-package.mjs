#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const hostDir = path.resolve(process.argv[2] || "dist/packager/work/default-rust-project/electron-host");
const manifestPath = path.join(hostDir, "app", "nexus-package-manifest.json");
const projectPath = path.join(hostDir, "app", "project.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { slug: "default-rust-project" };
const project = fs.existsSync(projectPath)
  ? JSON.parse(fs.readFileSync(projectPath, "utf8"))
  : {};
const slug = process.env.NEXUS_VALIDATE_SLUG || manifest.slug || "default-rust-project";
const expectedCubeId = process.env.NEXUS_VALIDATE_CUBE_ID
  || project?.validation?.expectedCubeId
  || "default-rust-cube";
const minFrame = process.env.NEXUS_VALIDATE_MIN_FRAME || "2";
const requireMeshWinding = process.env.NEXUS_VALIDATE_REQUIRE_MESH_WINDING
  || (project?.validation?.requireMeshWinding ? "1" : "0");
const electronBin = process.platform === "win32"
  ? path.join(hostDir, "node_modules", ".bin", "electron.cmd")
  : path.join(hostDir, "node_modules", ".bin", "electron");
const outDir = path.resolve(
  process.env.NEXUS_ELECTRON_VALIDATE_OUT_DIR || `output/${slug}/electron`
);
const snapshotPath = path.join(outDir, `${slug}-electron-snapshot.json`);
const screenshotPath = path.join(outDir, `${slug}-electron.png`);

if (!fs.existsSync(hostDir)) {
  console.error(`Electron host directory not found: ${hostDir}`);
  process.exit(2);
}

if (!fs.existsSync(electronBin)) {
  console.error(`Electron binary not found: ${electronBin}`);
  console.error("Run package-default-rust-project before validation.");
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });

const child = spawn(electronBin, ["."], {
  cwd: hostDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXUS_ELECTRON_VALIDATE: "1",
    NEXUS_ELECTRON_VALIDATE_OUT_DIR: outDir,
    NEXUS_ELECTRON_VALIDATE_OUT_BASENAME: `${slug}-electron`,
    NEXUS_ELECTRON_VALIDATE_EXPECTED_CUBE_ID: expectedCubeId,
    NEXUS_ELECTRON_VALIDATE_MIN_FRAME: minFrame,
    NEXUS_ELECTRON_VALIDATE_REQUIRE_MESH_WINDING: requireMeshWinding
  }
});

child.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error(`Electron validation failed: code=${code} signal=${signal || ""}`);
    process.exit(code || 1);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  if (snapshot?.cube?.id !== expectedCubeId) {
    console.error(`Unexpected snapshot cube id: ${snapshot?.cube?.id || "missing"}`);
    process.exit(1);
  }
  if (requireMeshWinding === "1" && snapshot?.cube?.mesh?.windingValidation?.valid !== true) {
    console.error("Snapshot is missing valid primitive cube mesh winding.");
    process.exit(1);
  }
  if (requireMeshWinding === "1" && snapshot?.render?.meshWindingValid !== true) {
    console.error("Renderer proof is missing valid mesh winding.");
    process.exit(1);
  }
  if (requireMeshWinding === "1" && (!Array.isArray(snapshot?.render?.drawnFaces) || snapshot.render.drawnFaces.length < 3)) {
    console.error("Renderer proof did not draw enough cube faces.");
    process.exit(1);
  }
  const screenshot = fs.statSync(screenshotPath);
  if (screenshot.size < 1024) {
    console.error(`Electron screenshot is too small: ${screenshotPath}`);
    process.exit(1);
  }

  console.log(`Electron package validation passed: ${snapshotPath}`);
  console.log(`Electron screenshot: ${screenshotPath}`);
});
