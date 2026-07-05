export const QUEST_XR_FRAME_LOOP_KIT_VERSION = "0.1.0";

const DEFAULT_DT = 1 / 72;
const PLAYER_SPEED = 1.55;
const THROW_SCALE = 2.8;
const GRAVITY = -9.8;
const CUBE_RESET_Y = -1.25;
const CUBE_START = Object.freeze([0, 1.2, -2.15]);
const LEFT_CONTROLLER_START = Object.freeze([-0.32, 1.2, -0.85]);
const RIGHT_CONTROLLER_START = Object.freeze([0.32, 1.2, -0.85]);

function v3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) return [...fallback];
  return [
    Number.isFinite(value[0]) ? value[0] : fallback[0],
    Number.isFinite(value[1]) ? value[1] : fallback[1],
    Number.isFinite(value[2]) ? value[2] : fallback[2]
  ];
}

function v2(value, fallback = [0, 0]) {
  if (!Array.isArray(value)) return [...fallback];
  return [
    Number.isFinite(value[0]) ? value[0] : fallback[0],
    Number.isFinite(value[1]) ? value[1] : fallback[1]
  ];
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function distance3(a, b) {
  const d = sub3(a, b);
  return Math.hypot(d[0], d[1], d[2]);
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createQuestCubeDemoState() {
  return {
    schema: "nexus.quest-xr-frame-loop-state.v1",
    kit: "quest-xr-frame-loop-kit",
    version: QUEST_XR_FRAME_LOOP_KIT_VERSION,
    frame: 0,
    mode: "stereo-mirror",
    player: {
      position: [0, 1.4, 0],
      yaw: 0
    },
    cube: {
      id: "throw-reset-cube",
      position: [...CUBE_START],
      velocity: [0, 0, 0],
      heldBy: null,
      resetCount: 0
    },
    controllers: {
      left: {
        active: true,
        handedness: "left",
        position: [...LEFT_CONTROLLER_START],
        grip: false,
        trigger: false,
        thumbstick: [0, 0],
        tracked: true
      },
      right: {
        active: true,
        handedness: "right",
        position: [...RIGHT_CONTROLLER_START],
        previousPosition: [...RIGHT_CONTROLLER_START],
        grip: false,
        trigger: false,
        thumbstick: [0, 0],
        tracked: true
      }
    },
    stereo: {
      eyeCount: 2,
      referenceSpace: "local-floor",
      projectionSource: "webxr-when-available",
      fallback: "side-by-side-stereo-canvas"
    },
    diagnostics: {
      lastInputSource: "initial",
      nativeStatus: "",
      webxrSupported: false,
      webxrSessionActive: false
    }
  };
}

export function resetQuestCube(state, reason = "manual") {
  state.cube.position = [...CUBE_START];
  state.cube.velocity = [0, 0, 0];
  state.cube.heldBy = null;
  state.cube.resetCount += 1;
  state.diagnostics.lastResetReason = reason;
  return state;
}

export function normalizeQuestInput(input = {}) {
  const leftStick = v2(input.leftStick);
  const rightAim = v2(input.rightAim);
  const player = v3(input.playerPosition, [0, 1.4, 0]);
  const rightFallback = [
    player[0] + rightAim[0] * 0.65,
    1.22 - rightAim[1] * 0.42,
    player[2] - 0.9
  ];

  return {
    source: input.source || "synthetic",
    reset: input.reset === true,
    headPosition: v3(input.headPosition, [player[0], 1.55, player[2]]),
    left: {
      position: v3(input.leftControllerPosition, [player[0] - 0.32, 1.18, player[2] - 0.85]),
      grip: input.leftGrip === true,
      trigger: input.leftTrigger === true,
      thumbstick: leftStick,
      tracked: input.leftTracked !== false
    },
    right: {
      position: v3(input.rightControllerPosition, rightFallback),
      grip: input.rightGrip === true,
      trigger: input.rightTrigger === true,
      thumbstick: v2(input.rightStick),
      tracked: input.rightTracked !== false
    }
  };
}

export function tickQuestCubeDemo(state, input = {}, deltaSeconds = DEFAULT_DT) {
  const dt = Math.max(0.001, Math.min(0.08, Number.isFinite(deltaSeconds) ? deltaSeconds : DEFAULT_DT));
  const normalized = normalizeQuestInput({
    ...input,
    playerPosition: state.player.position
  });

  state.frame += 1;
  state.diagnostics.lastInputSource = normalized.source;

  state.player.position[0] += normalized.left.thumbstick[0] * PLAYER_SPEED * dt;
  state.player.position[2] -= normalized.left.thumbstick[1] * PLAYER_SPEED * dt;

  state.controllers.left = {
    ...state.controllers.left,
    ...normalized.left,
    handedness: "left",
    active: true
  };
  state.controllers.right = {
    ...state.controllers.right,
    ...normalized.right,
    handedness: "right",
    active: true,
    previousPosition: state.controllers.right.position
  };

  if (normalized.reset) {
    resetQuestCube(state, "reset-input");
  }

  const right = state.controllers.right;
  const cube = state.cube;
  const canGrab = distance3(cube.position, right.position) <= 0.58 || right.trigger;

  if (right.grip && cube.heldBy === null && canGrab) {
    cube.heldBy = "right";
    cube.velocity = [0, 0, 0];
  }

  if (right.grip && cube.heldBy === "right") {
    cube.position = [...right.position];
    cube.velocity = [0, 0, 0];
  } else if (!right.grip && cube.heldBy === "right") {
    cube.heldBy = null;
    cube.velocity = scale3(sub3(right.position, right.previousPosition), THROW_SCALE / dt);
  }

  if (cube.heldBy === null) {
    cube.velocity[1] += GRAVITY * dt;
    cube.position = add3(cube.position, scale3(cube.velocity, dt));
    if (cube.position[1] < 0.18 && cube.velocity[1] < 0) {
      cube.position[1] = 0.18;
      cube.velocity[1] *= -0.32;
      cube.velocity[0] *= 0.82;
      cube.velocity[2] *= 0.82;
    }
  }

  if (cube.position[1] < CUBE_RESET_Y) {
    resetQuestCube(state, "fell-below-reset-plane");
  }

  return snapshotQuestCubeDemo(state);
}

export function snapshotQuestCubeDemo(state) {
  const snapshot = cloneState(state);
  snapshot.stereo.views = [
    {
      eye: "left",
      viewport: [0, 0, 0.5, 1],
      eyeOffset: [-0.032, 0, 0],
      referenceSpace: state.stereo.referenceSpace
    },
    {
      eye: "right",
      viewport: [0.5, 0, 0.5, 1],
      eyeOffset: [0.032, 0, 0],
      referenceSpace: state.stereo.referenceSpace
    }
  ];
  snapshot.summary = `quest-js-frame=${state.frame} eyes=2 cubeHeld=${state.cube.heldBy || "none"} resets=${state.cube.resetCount}`;
  return snapshot;
}

export function createQuestStereoFramePacket(state) {
  const snapshot = snapshotQuestCubeDemo(state);
  return {
    schema: "nexus.quest-xr-frame-packet.v1",
    frame: snapshot.frame,
    mode: snapshot.mode,
    stereo: snapshot.stereo,
    player: snapshot.player,
    controllers: snapshot.controllers,
    cube: snapshot.cube,
    diagnostics: snapshot.diagnostics
  };
}

function project(snapshot, eyeOffset, point, width, height) {
  const player = snapshot.player.position;
  const relative = [
    point[0] - player[0] + eyeOffset[0],
    point[1] - 1.25,
    point[2] - player[2]
  ];
  const depth = Math.max(0.35, -relative[2]);
  return [
    width * 0.5 + (relative[0] / depth) * width * 0.62,
    height * 0.58 - (relative[1] / depth) * height * 0.72,
    depth
  ];
}

function drawEye(ctx, snapshot, view, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#244ca8");
  sky.addColorStop(0.58, "#65a5e8");
  sky.addColorStop(1, "#e8be78");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#2f7342";
  ctx.fillRect(0, height * 0.64, width, height * 0.36);
  ctx.strokeStyle = "rgba(20,42,28,0.65)";
  ctx.lineWidth = 2;
  for (let i = -5; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.64);
    ctx.lineTo(width * (i / 8 + 0.5), height);
    ctx.stroke();
  }

  const eyeOffset = view.eyeOffset;
  const cube = project(snapshot, eyeOffset, snapshot.cube.position, width, height);
  const cubeSize = Math.max(14, Math.min(72, 76 / cube[2]));
  ctx.fillStyle = snapshot.cube.heldBy ? "#55e0ff" : "#4272ff";
  ctx.strokeStyle = "#16151a";
  ctx.lineWidth = 4;
  ctx.fillRect(cube[0] - cubeSize / 2, cube[1] - cubeSize / 2, cubeSize, cubeSize);
  ctx.strokeRect(cube[0] - cubeSize / 2, cube[1] - cubeSize / 2, cubeSize, cubeSize);
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.fillRect(cube[0] - cubeSize / 2, cube[1] - cubeSize / 2, cubeSize, cubeSize * 0.3);

  for (const hand of [snapshot.controllers.left, snapshot.controllers.right]) {
    const p = project(snapshot, eyeOffset, hand.position, width, height);
    ctx.strokeStyle = hand.handedness === "left" ? "#f0d35a" : "#ff7b6f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * (hand.handedness === "left" ? 0.2 : 0.8), height * 0.86);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.fillStyle = hand.grip ? "#ffffff" : "#1b1b22";
    ctx.beginPath();
    ctx.arc(p[0], p[1], hand.grip ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(10,12,18,0.72)";
  ctx.fillRect(16, 16, Math.min(width - 32, 440), 92);
  ctx.fillStyle = "#fff";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(`Quest JS XR Frame Loop - ${view.eye}`, 30, 44);
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(snapshot.summary, 30, 68);
  ctx.fillText(`mode=${snapshot.mode} source=${snapshot.diagnostics.lastInputSource}`, 30, 90);

  ctx.restore();
}

export function drawQuestStereoMirror(ctx, snapshot) {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  drawEye(ctx, snapshot, snapshot.stereo.views[0], 0, 0, width / 2, height);
  drawEye(ctx, snapshot, snapshot.stereo.views[1], width / 2, 0, width / 2, height);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
}

function readGamepadInput() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return {};
  const pads = [...navigator.getGamepads()].filter(Boolean);
  const pad = pads[0];
  if (!pad) return {};
  const axes = pad.axes || [];
  const buttons = pad.buttons || [];
  return {
    source: "gamepad-api",
    leftStick: [axes[0] || 0, axes[1] || 0],
    rightAim: [axes[2] || 0, axes[3] || 0],
    rightGrip: Boolean(buttons[1]?.pressed || buttons[7]?.pressed),
    rightTrigger: Boolean(buttons[0]?.pressed || buttons[6]?.pressed),
    reset: Boolean(buttons[3]?.pressed || buttons[9]?.pressed)
  };
}

function mergeInput(...inputs) {
  const merged = {};
  for (const input of inputs) {
    if (!input) continue;
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  return merged;
}

function readWebXrInput(session, frame, referenceSpace) {
  const input = { source: "webxr-frame" };
  const pose = frame.getViewerPose?.(referenceSpace);
  if (pose?.transform?.position) {
    input.headPosition = [pose.transform.position.x, pose.transform.position.y, pose.transform.position.z];
  }

  for (const source of session.inputSources || []) {
    const handKey = source.handedness === "left" ? "left" : "right";
    const gripPose = source.gripSpace ? frame.getPose(source.gripSpace, referenceSpace) : null;
    if (gripPose?.transform?.position) {
      input[`${handKey}ControllerPosition`] = [
        gripPose.transform.position.x,
        gripPose.transform.position.y,
        gripPose.transform.position.z
      ];
    }
    if (source.gamepad) {
      const axes = source.gamepad.axes || [];
      const buttons = source.gamepad.buttons || [];
      if (handKey === "left") input.leftStick = [axes[0] || 0, axes[1] || 0];
      if (handKey === "right") {
        input.rightStick = [axes[0] || 0, axes[1] || 0];
        input.rightGrip = Boolean(buttons[1]?.pressed || buttons[2]?.pressed);
        input.rightTrigger = Boolean(buttons[0]?.pressed);
      }
    }
  }
  return input;
}

export function createQuestXrFrameLoop({ canvas, nativeBridge = null, log = console.log } = {}) {
  if (!canvas) throw new Error("createQuestXrFrameLoop requires a canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const state = createQuestCubeDemoState();
  const hostInput = {
    source: "browser",
    leftStick: [0, 0],
    rightAim: [0, 0],
    rightGrip: false,
    rightTrigger: false,
    reset: false
  };
  let running = false;
  let pointerFallbackInstalled = false;
  let stopRequested = false;
  let raf = 0;
  let lastTime = 0;
  let xrSession = null;
  let xrReferenceSpace = null;

  function resize() {
    const ratio = Math.max(1, globalThis.devicePixelRatio || 1);
    const nextWidth = Math.max(640, Math.floor(canvas.clientWidth * ratio));
    const nextHeight = Math.max(360, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }

  function emitNativeLog(snapshot) {
    if (snapshot.frame % 45 !== 0) return;
    const message = JSON.stringify({
      tag: "quest-demo-frame",
      frame: snapshot.frame,
      mode: snapshot.mode,
      cube: snapshot.cube.position,
      heldBy: snapshot.cube.heldBy,
      resets: snapshot.cube.resetCount
    });
    if (nativeBridge?.log) nativeBridge.log(message);
    else log(message);
  }

  function tick(time, xrInput = null) {
    resize();
    const seconds = lastTime ? (time - lastTime) / 1000 : DEFAULT_DT;
    lastTime = time;
    const input = mergeInput(readGamepadInput(), hostInput, xrInput);
    const snapshot = tickQuestCubeDemo(state, input, seconds);
    drawQuestStereoMirror(ctx, snapshot);
    emitNativeLog(snapshot);
    hostInput.reset = false;
    return snapshot;
  }

  function frame(time) {
    if (!running) return;
    tick(time);
    raf = requestAnimationFrame(frame);
  }

  function installPointerFallback() {
    if (pointerFallbackInstalled) return;
    pointerFallbackInstalled = true;
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture?.(event.pointerId);
      hostInput.rightGrip = true;
      setPointerAim(event);
    });
    canvas.addEventListener("pointermove", setPointerAim);
    canvas.addEventListener("pointerup", (event) => {
      hostInput.rightGrip = false;
      setPointerAim(event);
    });
    canvas.addEventListener("pointercancel", () => {
      hostInput.rightGrip = false;
    });
    globalThis.addEventListener?.("keydown", (event) => {
      if (event.key === "r" || event.key === "R" || event.key === " ") hostInput.reset = true;
      if (event.key === "ArrowLeft") hostInput.leftStick[0] = -1;
      if (event.key === "ArrowRight") hostInput.leftStick[0] = 1;
      if (event.key === "ArrowUp") hostInput.leftStick[1] = -1;
      if (event.key === "ArrowDown") hostInput.leftStick[1] = 1;
    });
    globalThis.addEventListener?.("keyup", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") hostInput.leftStick[0] = 0;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") hostInput.leftStick[1] = 0;
    });
  }

  function setPointerAim(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    hostInput.rightAim = [x, y];
    hostInput.source = "pointer-fallback";
  }

  async function startWebXrSession() {
    if (!globalThis.navigator?.xr) {
      state.diagnostics.webxrSupported = false;
      return { ok: false, reason: "navigator.xr unavailable" };
    }
    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    state.diagnostics.webxrSupported = supported;
    if (!supported) return { ok: false, reason: "immersive-vr unsupported" };

    xrSession = await navigator.xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"],
      optionalFeatures: ["hand-tracking", "anchors", "layers"]
    });
    xrReferenceSpace = await xrSession.requestReferenceSpace("local-floor");
    state.mode = "webxr-immersive-vr";
    state.diagnostics.webxrSessionActive = true;
    if (nativeBridge?.startOpenXr) nativeBridge.startOpenXr();
    running = false;
    cancelAnimationFrame(raf);
    xrSession.requestAnimationFrame(onXrFrame);
    xrSession.addEventListener("end", () => {
      state.mode = "stereo-mirror";
      state.diagnostics.webxrSessionActive = false;
      xrSession = null;
      xrReferenceSpace = null;
      if (!stopRequested) start();
      stopRequested = false;
    });
    return { ok: true, reason: "webxr session started" };
  }

  function onXrFrame(time, frame) {
    if (!xrSession || !xrReferenceSpace) return;
    const xrInput = readWebXrInput(xrSession, frame, xrReferenceSpace);
    tick(time, xrInput);
    xrSession.requestAnimationFrame(onXrFrame);
  }

  function start() {
    if (running) return;
    running = true;
    installPointerFallback();
    lastTime = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    stopRequested = true;
    running = false;
    cancelAnimationFrame(raf);
    xrSession?.end?.();
  }

  const inputBridge = {
    setHostInput(next = {}) {
      Object.assign(hostInput, next, { source: next.source || "android-host" });
    },
    setButton(button, pressed) {
      if (button === "rightGrip") hostInput.rightGrip = pressed;
      if (button === "reset") hostInput.reset = pressed;
      hostInput.source = "android-host";
    }
  };

  globalThis.NexusQuestInput = inputBridge;

  return {
    state,
    inputBridge,
    start,
    stop,
    startWebXrSession,
    snapshot: () => snapshotQuestCubeDemo(state),
    framePacket: () => createQuestStereoFramePacket(state)
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.NexusQuestFrameLoopKit = {
    version: QUEST_XR_FRAME_LOOP_KIT_VERSION,
    createQuestCubeDemoState,
    tickQuestCubeDemo,
    resetQuestCube,
    createQuestStereoFramePacket,
    createQuestXrFrameLoop
  };
}
