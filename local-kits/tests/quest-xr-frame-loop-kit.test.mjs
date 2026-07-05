import assert from "node:assert/strict";

import {
  createQuestCubeDemoState,
  createQuestStereoFramePacket,
  resetQuestCube,
  snapshotQuestCubeDemo,
  tickQuestCubeDemo
} from "../quest-xr-frame-loop-kit.mjs";

const state = createQuestCubeDemoState();
assert.equal(state.kit, "quest-xr-frame-loop-kit");
assert.equal(state.stereo.eyeCount, 2);

const startX = state.player.position[0];
tickQuestCubeDemo(state, { leftStick: [1, 0], source: "test-left-stick" }, 1);
assert.ok(state.player.position[0] > startX, "left stick should move the player");

const nearRightHand = {
  source: "test-grab",
  rightControllerPosition: [0, 1.2, -2.1],
  rightGrip: true,
  rightTrigger: true
};
tickQuestCubeDemo(state, nearRightHand, 1 / 72);
assert.equal(state.cube.heldBy, "right", "right grip should grab the cube");

tickQuestCubeDemo(state, {
  source: "test-throw",
  rightControllerPosition: [0.28, 1.38, -2.25],
  rightGrip: true,
  rightTrigger: true
}, 1 / 72);
const heldPosition = [...state.cube.position];

tickQuestCubeDemo(state, {
  source: "test-release",
  rightControllerPosition: [0.42, 1.52, -2.35],
  rightGrip: false,
  rightTrigger: false
}, 1 / 72);
assert.equal(state.cube.heldBy, null, "release should stop holding the cube");
assert.notDeepEqual(state.cube.position, heldPosition, "released cube should keep moving");
assert.ok(Math.hypot(...state.cube.velocity) > 0, "release should apply throw velocity");

const resetsBefore = state.cube.resetCount;
resetQuestCube(state, "test-reset");
assert.equal(state.cube.resetCount, resetsBefore + 1);
assert.deepEqual(state.cube.position, [0, 1.2, -2.15]);

const inputResetCount = state.cube.resetCount;
tickQuestCubeDemo(state, { reset: true, source: "test-reset-input" }, 1 / 72);
assert.equal(state.cube.resetCount, inputResetCount + 1, "reset input should reset the cube");

const snapshot = snapshotQuestCubeDemo(state);
assert.equal(snapshot.stereo.views.length, 2);
assert.equal(snapshot.stereo.views[0].eye, "left");
assert.equal(snapshot.stereo.views[1].eye, "right");
assert.ok(snapshot.summary.includes("eyes=2"));

const packet = createQuestStereoFramePacket(state);
assert.equal(packet.schema, "nexus.quest-xr-frame-packet.v1");
assert.equal(packet.stereo.eyeCount, 2);
assert.equal(packet.controllers.left.tracked, true);
assert.equal(packet.controllers.right.tracked, true);

console.log("quest xr frame loop kit tests passed");
