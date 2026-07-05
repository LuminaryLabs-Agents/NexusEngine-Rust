import {
  createPrimitiveCubeState,
  normalizePrimitiveCubeDescriptor,
  resetPrimitiveCube,
  snapshotPrimitiveCube,
  tickPrimitiveCube
} from "./primitive-cube-object-kit.mjs";

export const PHYSICS_CUBE_OBJECT_KIT_VERSION = "0.1.0";

const DEFAULT_PHYSICS = Object.freeze({
  velocity: [0.8, 0, 0],
  gravity: [0, -9.8, 0],
  floorY: 0,
  restitution: 0.58,
  damping: 0.998,
  floorFriction: 0.82,
  maxSpeed: 16
});

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function vector3(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2])
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function clampSpeed(velocity, maxSpeed) {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (speed <= maxSpeed || speed === 0) return velocity;
  return scale3(velocity, maxSpeed / speed);
}

export function normalizePhysicsCubeDescriptor(descriptor = {}) {
  const primitive = normalizePrimitiveCubeDescriptor(descriptor.primitive || descriptor.cube || descriptor);
  const physics = descriptor.physics && typeof descriptor.physics === "object"
    ? descriptor.physics
    : descriptor;

  return {
    schema: "nexus.physics-cube-object.v1",
    kit: "physics-cube-object-kit",
    version: PHYSICS_CUBE_OBJECT_KIT_VERSION,
    primitive,
    physics: {
      velocity: vector3(physics.velocity, DEFAULT_PHYSICS.velocity),
      resetVelocity: vector3(physics.resetVelocity, physics.velocity || DEFAULT_PHYSICS.velocity),
      gravity: vector3(physics.gravity, DEFAULT_PHYSICS.gravity),
      floorY: finiteNumber(physics.floorY, DEFAULT_PHYSICS.floorY),
      restitution: clamp(finiteNumber(physics.restitution, DEFAULT_PHYSICS.restitution), 0, 1.4),
      damping: clamp(finiteNumber(physics.damping, DEFAULT_PHYSICS.damping), 0.8, 1),
      floorFriction: clamp(finiteNumber(physics.floorFriction, DEFAULT_PHYSICS.floorFriction), 0, 1),
      maxSpeed: Math.max(1, finiteNumber(physics.maxSpeed, DEFAULT_PHYSICS.maxSpeed))
    }
  };
}

export function createPhysicsCubeState(descriptor = {}) {
  const normalized = normalizePhysicsCubeDescriptor(descriptor);
  const primitiveState = createPrimitiveCubeState(normalized.primitive);
  return {
    schema: "nexus.physics-cube-state.v1",
    kit: "physics-cube-object-kit",
    version: PHYSICS_CUBE_OBJECT_KIT_VERSION,
    frame: 0,
    descriptor: normalized,
    primitive: primitiveState,
    physics: {
      velocity: [...normalized.physics.velocity],
      gravity: [...normalized.physics.gravity],
      floorY: normalized.physics.floorY,
      restitution: normalized.physics.restitution,
      damping: normalized.physics.damping,
      floorFriction: normalized.physics.floorFriction,
      maxSpeed: normalized.physics.maxSpeed,
      bounceCount: 0,
      lastCollision: null,
      lastResetReason: null
    }
  };
}

export function resetPhysicsCube(state, reason = "manual") {
  const descriptor = state.descriptor || normalizePhysicsCubeDescriptor();
  resetPrimitiveCube(state.primitive, reason);
  state.physics.velocity = [...descriptor.physics.resetVelocity];
  state.physics.bounceCount = 0;
  state.physics.lastCollision = null;
  state.physics.lastResetReason = reason;
  return snapshotPhysicsCube(state);
}

export function applyPhysicsCubeImpulse(state, impulse = [0, 0, 0]) {
  const next = add3(state.physics.velocity, vector3(impulse, [0, 0, 0]));
  state.physics.velocity = clampSpeed(next, state.physics.maxSpeed);
  return snapshotPhysicsCube(state);
}

export function tickPhysicsCube(state, input = {}, deltaSeconds = 1 / 60) {
  const dt = clamp(finiteNumber(deltaSeconds, 1 / 60), 0.001, 0.12);

  if (input.reset === true) {
    resetPhysicsCube(state, input.reason || "tick-reset-input");
  }
  if (input.impulse) {
    applyPhysicsCubeImpulse(state, input.impulse);
  }

  state.frame += 1;
  state.physics.velocity = add3(state.physics.velocity, scale3(state.physics.gravity, dt));
  state.physics.velocity = clampSpeed(scale3(state.physics.velocity, state.physics.damping), state.physics.maxSpeed);
  state.primitive.cube.position = add3(state.primitive.cube.position, scale3(state.physics.velocity, dt));

  const halfSize = state.primitive.cube.size / 2;
  const minY = state.physics.floorY + halfSize;
  if (state.primitive.cube.position[1] < minY) {
    state.primitive.cube.position[1] = minY;
    if (state.physics.velocity[1] < 0) {
      state.physics.velocity[1] = Math.abs(state.physics.velocity[1]) * state.physics.restitution;
      state.physics.velocity[0] *= state.physics.floorFriction;
      state.physics.velocity[2] *= state.physics.floorFriction;
      state.physics.bounceCount += 1;
      state.physics.lastCollision = {
        frame: state.frame,
        kind: "floor",
        y: state.physics.floorY
      };
    }
  }

  tickPrimitiveCube(state.primitive, {}, dt);
  return snapshotPhysicsCube(state);
}

export function snapshotPhysicsCube(state) {
  const primitive = snapshotPrimitiveCube(state.primitive);
  const physics = clone(state.physics);
  const speed = Math.hypot(physics.velocity[0], physics.velocity[1], physics.velocity[2]);
  return {
    schema: "nexus.physics-cube-state.v1",
    kit: "physics-cube-object-kit",
    version: PHYSICS_CUBE_OBJECT_KIT_VERSION,
    frame: state.frame,
    cube: primitive.cube,
    primitive,
    physics,
    speed,
    summary: [
      `physics-cube-frame=${state.frame}`,
      `id=${primitive.cube.id}`,
      `y=${primitive.cube.position[1].toFixed(2)}`,
      `vy=${physics.velocity[1].toFixed(2)}`,
      `bounces=${physics.bounceCount}`
    ].join(" ")
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.NexusPhysicsCubeObjectKit = {
    version: PHYSICS_CUBE_OBJECT_KIT_VERSION,
    normalizePhysicsCubeDescriptor,
    createPhysicsCubeState,
    resetPhysicsCube,
    applyPhysicsCubeImpulse,
    tickPhysicsCube,
    snapshotPhysicsCube
  };
}
