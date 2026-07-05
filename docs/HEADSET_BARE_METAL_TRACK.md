# Headset Bare-Metal Track

Status: gated

## Purpose

Keep headset OS work behind stable NexusEngine-Rust app/package proof.

The current priority is:

```txt
default-rust-project package proof
  -> stock OS Quest/Android app proof
  -> hardware facts and recovery proof
  -> temporary boot experiments
  -> persistent Linux only after reversibility is proven
```

## Gate 1: Stock OS App Proof

- Authorize the connected ADB device.
- Run `make quest-apk`.
- Run `make adb-quest-check`.
- Do not start persistent OS modification until install, launch, and logcat proof pass on the stock OS.

## Gate 2: Hardware Truth

Capture facts before deciding whether Armada, Alpine/postmarketOS, Arch ARM, or another rootfs is realistic:

```bash
adb shell getprop ro.product.model
adb shell getprop ro.product.device
adb shell getprop ro.product.manufacturer
adb shell getprop ro.board.platform
adb shell getprop ro.hardware
adb shell getprop ro.boot.hardware
adb shell getprop ro.boot.verifiedbootstate
adb shell getprop ro.boot.vbmeta.device_state
adb shell uname -a
adb reboot bootloader
fastboot devices
fastboot getvar all
```

Record the exact SoC, firmware, bootloader lock state, partition names, active slot, and recovery path.

## Gate 3: Recovery First

Before any persistent flash:

- Back up boot-critical partitions where accessible: `abl_a`, `abl_b`, `boot_a`, `boot_b`, `vendor_boot_a`, `vendor_boot_b`, `dtbo_a`, `dtbo_b`, `vbmeta_a`, `vbmeta_b`, and relevant super metadata.
- Store backups off-device.
- Prove the device can return to the stock boot path.
- Prefer temporary boot or external media experiments before writing persistent boot chain changes.

## Gate 4: Distro Decision

- Armada: external reference or prebuilt-media target only after hardware compatibility is proven. Do not clone or build Armada locally while disk is constrained.
- Alpine/postmarketOS: preferred small rootfs direction for an unsupported XR Gen 1 or Quest-like device when a custom bring-up is required.
- Arch ARM: secondary option when package familiarity matters more than image size.
- Buildroot: smallest appliance route, but higher maintenance cost.

## Gate 5: Compiler Reality

Do not start by writing a CPU compiler.

The likely blockers are:

- bootloader and verified boot
- kernel and device tree
- display panel and compositor path
- input/controller stack
- GPU acceleration
- OpenXR or XR runtime replacement
- recovery after failed boot

Cross-compile Nexus launcher binaries for `aarch64` first. Consider custom compiler/toolchain work only after Linux boots and the launcher stack can run.

## Disk Rule

The local machine has limited free space. Keep large OS images, Armada artifacts, and rootfs experiments out of this repo unless explicitly approved.
