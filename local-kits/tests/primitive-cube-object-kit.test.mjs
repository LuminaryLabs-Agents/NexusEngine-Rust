import assert from "node:assert/strict";

import {
  createPrimitiveCubeMesh,
  createPrimitiveCubeState,
  normalizePrimitiveCubeDescriptor,
  resetPrimitiveCube,
  snapshotPrimitiveCube,
  tickPrimitiveCube,
  validatePrimitiveCubeMeshWinding
} from "../primitive-cube-object-kit.mjs";

const descriptor = normalizePrimitiveCubeDescriptor({
  id: "default-rust-cube",
  label: "Default Rust Cube",
  size: 1.25,
  position: [0, 0.25, -1],
  rotation: [0, 15, 0],
  spinAxis: [0, 1, 0],
  angularVelocity: 90,
  material: {
    color: "#4f8cff",
    edgeColor: "#0f1d36",
    highlightColor: "#d9e8ff",
    sideColor: "#2d5bb7"
  }
});

assert.equal(descriptor.kit, "primitive-cube-object-kit");
assert.equal(descriptor.id, "default-rust-cube");
assert.deepEqual(descriptor.position, [0, 0.25, -1]);
assert.equal(descriptor.angularVelocity, 90);
assert.equal(descriptor.material.sideColor, "#2d5bb7");

const mesh = createPrimitiveCubeMesh(descriptor.size);
assert.equal(mesh.faces.length, 6);
assert.equal(mesh.windingValidation.valid, true);
assert.equal(mesh.windingValidation.checkedTriangles, 12);
assert.deepEqual(mesh.faces.find((face) => face.name === "front").triangles[0], [4, 5, 6]);

const reversedMesh = structuredClone(mesh);
reversedMesh.faces[0].triangles[0] = [...reversedMesh.faces[0].triangles[0]].reverse();
assert.equal(validatePrimitiveCubeMeshWinding(reversedMesh).valid, false);

const state = createPrimitiveCubeState(descriptor);
assert.equal(state.frame, 0);
assert.equal(state.cube.resetCount, 0);
assert.equal(state.cube.mesh.windingValidation.valid, true);

const first = tickPrimitiveCube(state, {}, 1);
assert.equal(first.frame, 1);
assert.equal(first.cube.rotation[1], 37.5);
assert.equal(first.cube.position[2], -1);
assert.ok(first.summary.includes("primitive-cube-frame=1"));

const second = tickPrimitiveCube(state, { rotationDelta: [5, 0, 0] }, 0.5);
assert.equal(second.frame, 2);
assert.equal(second.cube.rotation[0], 5);
assert.equal(second.cube.rotation[1], 60);

const reset = resetPrimitiveCube(state, "test-reset");
assert.equal(reset.cube.resetCount, 1);
assert.equal(reset.cube.lastResetReason, "test-reset");
assert.deepEqual(reset.cube.rotation, [0, 15, 0]);

const resetViaTick = tickPrimitiveCube(state, { reset: true, reason: "input-reset" }, 1);
assert.equal(resetViaTick.cube.resetCount, 2);
assert.equal(resetViaTick.cube.lastResetReason, "input-reset");
assert.equal(resetViaTick.cube.rotation[1], 37.5);

const snapshot = snapshotPrimitiveCube(state);
assert.equal(snapshot.schema, "nexus.primitive-cube-state.v1");
assert.equal(snapshot.cube.id, "default-rust-cube");

console.log("primitive cube object kit tests passed");
