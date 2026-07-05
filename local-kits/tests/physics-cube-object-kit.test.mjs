import assert from "node:assert/strict";

import {
  applyPhysicsCubeImpulse,
  createPhysicsCubeState,
  resetPhysicsCube,
  snapshotPhysicsCube,
  tickPhysicsCube
} from "../physics-cube-object-kit.mjs";

const state = createPhysicsCubeState({
  primitive: {
    id: "physics-cube",
    label: "Physics Cube",
    size: 0.8,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    angularVelocity: 30,
    material: {
      sideColor: "#2faf6a"
    }
  },
  physics: {
    velocity: [0, -2, 0],
    gravity: [0, -10, 0],
    floorY: 0,
    restitution: 0.5,
    damping: 1,
    floorFriction: 0.5,
    maxSpeed: 20
  }
});

assert.equal(state.kit, "physics-cube-object-kit");
assert.equal(state.primitive.cube.id, "physics-cube");
assert.equal(state.primitive.cube.mesh.windingValidation.valid, true);
assert.deepEqual(state.physics.velocity, [0, -2, 0]);

const falling = tickPhysicsCube(state, {}, 0.1);
assert.equal(falling.frame, 1);
assert.equal(falling.cube.position[1], 0.7);
assert.equal(falling.physics.velocity[1], -3);
assert.equal(falling.physics.bounceCount, 0);

const bounced = tickPhysicsCube(state, {}, 0.2);
assert.equal(bounced.frame, 2);
assert.equal(bounced.cube.position[1], 0.4);
assert.equal(bounced.physics.velocity[1], 2.1);
assert.equal(bounced.physics.bounceCount, 1);
assert.equal(bounced.physics.lastCollision.kind, "floor");

const impulse = applyPhysicsCubeImpulse(state, [1, 2, 0]);
assert.equal(impulse.physics.velocity[0], 1);
assert.equal(impulse.physics.velocity[1], 4.1);

const reset = resetPhysicsCube(state, "test-reset");
assert.equal(reset.cube.position[1], 1);
assert.deepEqual(reset.physics.velocity, [0, -2, 0]);
assert.equal(reset.physics.bounceCount, 0);
assert.equal(reset.physics.lastResetReason, "test-reset");

const snapshot = snapshotPhysicsCube(state);
assert.equal(snapshot.schema, "nexus.physics-cube-state.v1");
assert.equal(snapshot.cube.mesh.windingValidation.checkedTriangles, 12);
assert.ok(snapshot.summary.includes("physics-cube-frame="));

console.log("physics cube object kit tests passed");
