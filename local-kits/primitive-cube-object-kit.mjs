export const PRIMITIVE_CUBE_OBJECT_KIT_VERSION = "0.1.0";

const DEFAULT_DESCRIPTOR = Object.freeze({
  schema: "nexus.primitive-cube-object.v1",
  id: "primitive-cube",
  label: "Primitive Cube",
  size: 1,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  spinAxis: [0, 1, 0],
  angularVelocity: 42,
  material: {
    color: "#4f8cff",
    edgeColor: "#10213f",
    highlightColor: "#d8e7ff",
    sideColor: "#2d5bb7"
  }
});

const UNIT_CUBE_VERTICES = Object.freeze([
  Object.freeze([-0.5, -0.5, -0.5]),
  Object.freeze([0.5, -0.5, -0.5]),
  Object.freeze([0.5, 0.5, -0.5]),
  Object.freeze([-0.5, 0.5, -0.5]),
  Object.freeze([-0.5, -0.5, 0.5]),
  Object.freeze([0.5, -0.5, 0.5]),
  Object.freeze([0.5, 0.5, 0.5]),
  Object.freeze([-0.5, 0.5, 0.5])
]);

const UNIT_CUBE_FACES = Object.freeze([
  Object.freeze({
    name: "front",
    vertices: Object.freeze([4, 5, 6, 7]),
    triangles: Object.freeze([Object.freeze([4, 5, 6]), Object.freeze([4, 6, 7])]),
    normal: Object.freeze([0, 0, 1]),
    materialSlot: "front"
  }),
  Object.freeze({
    name: "right",
    vertices: Object.freeze([5, 1, 2, 6]),
    triangles: Object.freeze([Object.freeze([5, 1, 2]), Object.freeze([5, 2, 6])]),
    normal: Object.freeze([1, 0, 0]),
    materialSlot: "side"
  }),
  Object.freeze({
    name: "top",
    vertices: Object.freeze([7, 6, 2, 3]),
    triangles: Object.freeze([Object.freeze([7, 6, 2]), Object.freeze([7, 2, 3])]),
    normal: Object.freeze([0, 1, 0]),
    materialSlot: "top"
  }),
  Object.freeze({
    name: "left",
    vertices: Object.freeze([0, 4, 7, 3]),
    triangles: Object.freeze([Object.freeze([0, 4, 7]), Object.freeze([0, 7, 3])]),
    normal: Object.freeze([-1, 0, 0]),
    materialSlot: "side"
  }),
  Object.freeze({
    name: "back",
    vertices: Object.freeze([1, 0, 3, 2]),
    triangles: Object.freeze([Object.freeze([1, 0, 3]), Object.freeze([1, 3, 2])]),
    normal: Object.freeze([0, 0, -1]),
    materialSlot: "side"
  }),
  Object.freeze({
    name: "bottom",
    vertices: Object.freeze([0, 1, 5, 4]),
    triangles: Object.freeze([Object.freeze([0, 1, 5]), Object.freeze([0, 5, 4])]),
    normal: Object.freeze([0, -1, 0]),
    materialSlot: "side"
  })
]);

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function stringValue(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function vector3(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2])
  ];
}

function normalizeDegrees(value) {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function normalizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function subtract3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length3(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize3(a) {
  const length = length3(a);
  return length > 0 ? [a[0] / length, a[1] / length, a[2] / length] : [0, 0, 0];
}

export function createPrimitiveCubeMesh(size = 1) {
  const scale = Math.max(0.05, finiteNumber(size, 1));
  const mesh = {
    schema: "nexus.primitive-cube-mesh.v1",
    kit: "primitive-cube-object-kit",
    version: PRIMITIVE_CUBE_OBJECT_KIT_VERSION,
    coordinateSystem: "right-handed-y-up-z-forward",
    winding: "counter-clockwise-outward",
    size: scale,
    vertices: UNIT_CUBE_VERTICES.map((vertex) => vertex.map((value) => value * scale)),
    faces: UNIT_CUBE_FACES.map((face) => ({
      name: face.name,
      vertices: [...face.vertices],
      triangles: face.triangles.map((triangle) => [...triangle]),
      normal: [...face.normal],
      materialSlot: face.materialSlot
    }))
  };
  mesh.windingValidation = validatePrimitiveCubeMeshWinding(mesh);
  return mesh;
}

export function validatePrimitiveCubeMeshWinding(mesh = createPrimitiveCubeMesh()) {
  const vertices = Array.isArray(mesh.vertices) ? mesh.vertices : [];
  const faces = Array.isArray(mesh.faces) ? mesh.faces : [];
  const faceResults = [];
  const errors = [];

  for (const face of faces) {
    const expectedNormal = vector3(face.normal, [0, 0, 0]);
    const triangleResults = [];
    for (const triangle of face.triangles || []) {
      const [aIndex, bIndex, cIndex] = triangle;
      const a = vertices[aIndex];
      const b = vertices[bIndex];
      const c = vertices[cIndex];
      if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) {
        errors.push(`${face.name}: missing triangle vertex`);
        triangleResults.push({ triangle: [...triangle], valid: false, dot: 0, normal: [0, 0, 0] });
        continue;
      }
      const normal = normalize3(cross3(subtract3(b, a), subtract3(c, a)));
      const dot = dot3(normal, expectedNormal);
      const valid = dot > 0.99;
      if (!valid) {
        errors.push(`${face.name}: triangle ${triangle.join(",")} winding points inward`);
      }
      triangleResults.push({ triangle: [...triangle], valid, dot, normal });
    }
    faceResults.push({
      name: face.name,
      valid: triangleResults.every((triangle) => triangle.valid),
      expectedNormal,
      triangles: triangleResults
    });
  }

  return {
    schema: "nexus.primitive-cube-mesh-winding.v1",
    valid: errors.length === 0 && faceResults.length === 6,
    checkedFaces: faceResults.length,
    checkedTriangles: faceResults.reduce((count, face) => count + face.triangles.length, 0),
    faces: faceResults,
    errors
  };
}

export function normalizePrimitiveCubeDescriptor(descriptor = {}) {
  const cube = descriptor.cube && typeof descriptor.cube === "object" ? descriptor.cube : descriptor;
  const material = cube.material && typeof cube.material === "object" ? cube.material : {};
  const defaults = DEFAULT_DESCRIPTOR;

  return {
    schema: stringValue(cube.schema, defaults.schema),
    kit: "primitive-cube-object-kit",
    version: PRIMITIVE_CUBE_OBJECT_KIT_VERSION,
    id: stringValue(cube.id, defaults.id),
    label: stringValue(cube.label, defaults.label),
    size: Math.max(0.05, finiteNumber(cube.size, defaults.size)),
    position: vector3(cube.position, defaults.position),
    resetPosition: vector3(cube.resetPosition, cube.position || defaults.position),
    rotation: vector3(cube.rotation, defaults.rotation).map(normalizeDegrees),
    spinAxis: vector3(cube.spinAxis, defaults.spinAxis),
    angularVelocity: finiteNumber(
      cube.angularVelocity ?? cube.rotationSpeedDegreesPerSecond,
      defaults.angularVelocity
    ),
    material: {
      color: normalizeColor(material.color, defaults.material.color),
      edgeColor: normalizeColor(material.edgeColor, defaults.material.edgeColor),
      highlightColor: normalizeColor(material.highlightColor, defaults.material.highlightColor),
      sideColor: normalizeColor(material.sideColor, defaults.material.sideColor)
    }
  };
}

export function createPrimitiveCubeState(descriptor = {}) {
  const normalized = normalizePrimitiveCubeDescriptor(descriptor);
  return {
    schema: "nexus.primitive-cube-state.v1",
    kit: "primitive-cube-object-kit",
    version: PRIMITIVE_CUBE_OBJECT_KIT_VERSION,
    frame: 0,
    descriptor: normalized,
    cube: {
      id: normalized.id,
      label: normalized.label,
      size: normalized.size,
      position: [...normalized.position],
      rotation: [...normalized.rotation],
      spinAxis: [...normalized.spinAxis],
      angularVelocity: normalized.angularVelocity,
      mesh: createPrimitiveCubeMesh(normalized.size),
      material: clone(normalized.material),
      resetCount: 0,
      lastResetReason: null
    }
  };
}

export function resetPrimitiveCube(state, reason = "manual") {
  const descriptor = state.descriptor || normalizePrimitiveCubeDescriptor();
  state.cube.position = [...descriptor.resetPosition];
  state.cube.rotation = [...descriptor.rotation];
  state.cube.resetCount += 1;
  state.cube.lastResetReason = reason;
  return snapshotPrimitiveCube(state);
}

export function tickPrimitiveCube(state, input = {}, deltaSeconds = 1 / 60) {
  const dt = Math.max(0.001, Math.min(0.25, finiteNumber(deltaSeconds, 1 / 60)));

  if (input.reset === true) {
    resetPrimitiveCube(state, input.reason || "tick-reset-input");
  }

  state.frame += 1;
  const delta = vector3(input.rotationDelta, [0, 0, 0]);
  for (let index = 0; index < 3; index += 1) {
    const spin = state.cube.spinAxis[index] * state.cube.angularVelocity * dt;
    state.cube.rotation[index] = normalizeDegrees(state.cube.rotation[index] + spin + delta[index]);
  }

  return snapshotPrimitiveCube(state);
}

export function snapshotPrimitiveCube(state) {
  const snapshot = clone(state);
  snapshot.summary = [
    `primitive-cube-frame=${snapshot.frame}`,
    `id=${snapshot.cube.id}`,
    `resetCount=${snapshot.cube.resetCount}`,
    `rotation=${snapshot.cube.rotation.map((value) => value.toFixed(2)).join(",")}`
  ].join(" ");
  return snapshot;
}

if (typeof globalThis !== "undefined") {
  globalThis.NexusPrimitiveCubeObjectKit = {
    version: PRIMITIVE_CUBE_OBJECT_KIT_VERSION,
    createPrimitiveCubeMesh,
    validatePrimitiveCubeMeshWinding,
    normalizePrimitiveCubeDescriptor,
    createPrimitiveCubeState,
    resetPrimitiveCube,
    tickPrimitiveCube,
    snapshotPrimitiveCube
  };
}
