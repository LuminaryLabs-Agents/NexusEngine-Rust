const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const VALIDATE = process.env.NEXUS_ELECTRON_VALIDATE === "1";
const VALIDATE_EXPECTED_CUBE_ID = process.env.NEXUS_ELECTRON_VALIDATE_EXPECTED_CUBE_ID || "default-rust-cube";
const VALIDATE_MIN_FRAME = Number.parseInt(process.env.NEXUS_ELECTRON_VALIDATE_MIN_FRAME || "2", 10);
const VALIDATE_REQUIRE_MESH_WINDING = process.env.NEXUS_ELECTRON_VALIDATE_REQUIRE_MESH_WINDING === "1";
const VALIDATE_OUT_DIR = process.env.NEXUS_ELECTRON_VALIDATE_OUT_DIR
  ? path.resolve(process.env.NEXUS_ELECTRON_VALIDATE_OUT_DIR)
  : path.join(process.cwd(), "validation-output");
const VALIDATE_OUT_BASENAME = process.env.NEXUS_ELECTRON_VALIDATE_OUT_BASENAME || "default-rust-project-electron";

function readManifest() {
  const manifestPath = path.join(__dirname, "app", "nexus-package-manifest.json");
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { appName: "Nexus Packaged App" };
  }
}

function createWindow() {
  const manifest = readManifest();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: manifest.appName || "Nexus Packaged App",
    backgroundColor: "#101418",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (VALIDATE) {
    installValidationHooks(win);
  }
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

function installValidationHooks(win) {
  const fail = (message) => {
    console.error(`NEXUS_ELECTRON_VALIDATE_FAIL ${message}`);
    app.exit(1);
  };

  win.webContents.on("console-message", (_event, _level, message) => {
    console.log(`renderer: ${message}`);
  });

  win.webContents.on("did-finish-load", async () => {
    try {
      fs.mkdirSync(VALIDATE_OUT_DIR, { recursive: true });
      const snapshot = await waitForSnapshot(win);
      if (snapshot?.cube?.id !== VALIDATE_EXPECTED_CUBE_ID) {
        fail(`unexpected cube id: ${snapshot?.cube?.id || "missing"}`);
        return;
      }
      if (VALIDATE_REQUIRE_MESH_WINDING && snapshot?.cube?.mesh?.windingValidation?.valid !== true) {
        fail("snapshot cube mesh winding is invalid or missing");
        return;
      }
      if (VALIDATE_REQUIRE_MESH_WINDING && snapshot?.render?.meshWindingValid !== true) {
        fail("renderer mesh winding proof is invalid or missing");
        return;
      }
      if (VALIDATE_REQUIRE_MESH_WINDING && (!Array.isArray(snapshot?.render?.drawnFaces) || snapshot.render.drawnFaces.length < 3)) {
        fail("renderer did not draw at least three cube faces from mesh");
        return;
      }
      if (VALIDATE_REQUIRE_MESH_WINDING && Number(snapshot?.render?.minimumFaceArea || 0) < 256) {
        fail(`renderer cube face area is too small: ${snapshot?.render?.minimumFaceArea || "missing"}`);
        return;
      }
      const image = await win.webContents.capturePage();
      const snapshotPath = path.join(VALIDATE_OUT_DIR, `${VALIDATE_OUT_BASENAME}-snapshot.json`);
      const screenshotPath = path.join(VALIDATE_OUT_DIR, `${VALIDATE_OUT_BASENAME}.png`);
      fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
      fs.writeFileSync(screenshotPath, image.toPNG());
      console.log(`NEXUS_ELECTRON_VALIDATE_OK ${snapshotPath} ${screenshotPath}`);
      app.exit(0);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  });

  setTimeout(() => fail("timed out waiting for renderer validation"), 15000).unref();
}

async function waitForSnapshot(win) {
  for (let index = 0; index < 120; index += 1) {
    const snapshot = await win.webContents.executeJavaScript(
      "window.NexusCubeApp && window.NexusCubeApp.ready && window.NexusCubeApp.snapshot ? window.NexusCubeApp.snapshot() : null",
      true
    );
    if (snapshot?.cube?.id && snapshot.frame >= VALIDATE_MIN_FRAME) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("window.NexusCubeApp.snapshot() did not become ready");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
