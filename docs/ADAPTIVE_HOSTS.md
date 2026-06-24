# Adaptive Hosts And XR Kits

The domain behavior for the XR house demo belongs in kits. The host owns only platform capabilities that cannot be expressed as domain state: Android lifecycle, OpenXR session setup, swapchain acquisition, controller action polling, frame timing, and APK packaging.

## Kit-owned responsibilities

- `xr-input-kit`: semantic hand/controller frame snapshots.
- `xr-grab-throw-kit`: hover, near grab, ray grab, hold, release, velocity history, throw impulse, and optional haptics requests.
- `simple-rigid-body-kit`: grabbable body state, floor collision, mass, friction, restitution, and impulse application.
- `toon-visual-kit`: 4-band toon material descriptors and sigmoid outline parameters.
- `sky-gradient-kit`: gradient horizon sky and sun descriptors.

## Host-owned responsibilities

- `android-canvas`: no swapchain, pointer-only input, one flat diagnostic/demo view.
- `stereo-panel`: two software eye views or side-by-side debug view; no OpenXR swapchain required.
- `quest-openxr`: OpenXR projection swapchain required, two located views, action-based input, frame sync, and frame submission.

## Input streaming

Every host should publish the same normalized `XrInputFrame` shape before the Nexus tick. Some hosts synthesize it from touch/pointer input, while Quest OpenXR samples action state and controller poses. Kits consume the normalized stream; they do not know whether the source was Android touch, a stereo debug panel, or real OpenXR controllers.

## Swapchain policy

Swapchains are a host capability, not a kit concern.

- `not-required`: flat Android canvas or headless replay.
- `optional-stereo-layer`: stereo debugging without native XR presentation.
- `required-open-xr-projection`: immersive Quest path with OpenXR swapchain image acquire/release and per-eye render submission.

The renderer consumes kit descriptors and host view/projection data. The kits describe what should exist; the host decides how it is presented.
