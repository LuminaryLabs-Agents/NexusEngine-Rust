import assert from "node:assert/strict";

import {
  PROJECT_IR_SCHEMA,
  createMemoryProjectSourceProvider,
  createProjectCompiler,
  projectCompilerDomainKit
} from "../project-compiler-domain-kit.mjs";

assert.equal(projectCompilerDomainKit.path, "n:project-compiler");
assert.ok(projectCompilerDomainKit.provides.includes("n:project.ir"));
assert.deepEqual(projectCompilerDomainKit.requires, ["n:project.bundle"]);

const provider = createMemoryProjectSourceProvider({
  "index.html": `
    <!doctype html>
    <html>
      <head><title>Compiler Proof</title></head>
      <body>
        <canvas id="game"></canvas>
        <div data-nexus-screen="pause">
          <button data-nexus-command="game.resume">Resume</button>
        </div>
        <script type="module" src="./main.mjs"></script>
      </body>
    </html>
  `,
  "main.mjs": `import { movementKit } from "./kits/movement-kit.mjs"; export { movementKit };`,
  "kits/movement-kit.mjs": `
    export const movementKit = defineKit({
      id: "game:movement",
      resources: { speed: 8, enabled: true, label: "Movement" },
      systems: [
        defineSystem({
          phase: "simulation",
          run(ctx) {
            const axis = ctx.input.axis("move");
            ctx.motion.movePlayer(axis, ctx.resources.speed);
          }
        })
      ]
    });
  `,
  "assets/player.glb": "binary-placeholder"
});

const compiler = createProjectCompiler({ sourceProvider: provider });
const ir = await compiler.createProjectIR({ projectId: "compiler-proof" });

assert.equal(ir.schema, PROJECT_IR_SCHEMA);
assert.equal(ir.project.name, "Compiler Proof");
assert.deepEqual(ir.entryModules, ["main.mjs"]);
assert.equal(ir.modules.length, 2);
assert.equal(ir.kits.length, 1);
assert.equal(ir.kits[0].id, "game:movement");
assert.equal(ir.kits[0].resources.speed, 8);
assert.equal(ir.kits[0].resources.enabled, true);
assert.equal(ir.kits[0].systems[0].phase, "simulation");
assert.deepEqual(ir.kits[0].systems[0].operations.map((operation) => operation.op), ["input.axis", "motion.move-player"]);
assert.equal(ir.surfaces[0].id, "game");
assert.equal(ir.screens[0].id, "pause");
assert.deepEqual(ir.assets, ["assets/player.glb"]);

const nativePlan = compiler.planTarget(ir, "native-rust-headless");
assert.equal(nativePlan.supported, true);
assert.deepEqual(nativePlan.stages, ["project-ir", "rust-source", "cargo-build", "artifact"]);
assert.equal(compiler.snapshot().status, "target-planned");
assert.equal(compiler.reset().status, "idle");

const invalidCompiler = createProjectCompiler({
  sourceProvider: createMemoryProjectSourceProvider({
    "index.html": `<script type="module" src="./main.mjs"></script>`,
    "main.mjs": `const moduleName = "./later.mjs"; import(moduleName);`
  })
});
const invalidIr = await invalidCompiler.createProjectIR({ projectId: "invalid" });
assert.equal(invalidCompiler.planTarget(invalidIr, "native-rust-headless").supported, false);
assert.ok(invalidIr.diagnostics.some((diagnostic) => diagnostic.code === "PROJECT_DYNAMIC_IMPORT"));

console.log("project compiler domain kit smoke tests passed");
