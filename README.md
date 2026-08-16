# ZMK Gesture Action

Runtime-configurable gesture actions for ZMK, configured from the browser over
USB or Bluetooth.

A settings page for the CLine46 is published at
<https://jpttm.github.io/zmk-feature-gesture-action/>.

## Why

[zmk-mouse-gesture](https://github.com/kot149/zmk-mouse-gesture) recognises
trackball strokes and invokes ordinary ZMK behaviours, but those bindings are
fixed at build time. Pointing them at
[runtime macros](https://github.com/cormoran/zmk-feature-runtime-macro) makes
them editable without reflashing, at the cost of consuming macro slots that
users need for ordinary macros — there are only 16, and gestures can eat all of
them.

This module gives gestures their own runtime-editable storage, so gestures and
macros stop competing.

## What it is

`&gesture_action N` is a behaviour whose binding lives in settings rather than
in devicetree. Each slot is seeded from a devicetree default, so a freshly
flashed board works before it is ever configured, and can then be reassigned at
runtime over the Studio RPC transport.

Nothing about it is specific to gestures. Any behaviour that takes a binding
can point at a slot; gesture recognition is simply the case it was built for.

## Using it in another keyboard

### 1. Add the module

```yaml
# config/west.yml
  remotes:
    - name: jpttm
      url-base: https://github.com/jpttm
  projects:
    - name: zmk-feature-gesture-action
      remote: jpttm
      revision: main
```

### 2. Enable it and size the slot pool

```ini
# <shield>.conf
CONFIG_ZMK_GESTURE_ACTION_COUNT=24
```

The RPC handler is enabled automatically when a `gesture_action` node is
present, so there is no separate `CONFIG_..._STUDIO_RPC` to set.

### 3. Declare the node

```dts
#include <behaviors/gesture_action.dtsi>

&gesture_action {
    /* Shown in the settings UI in place of a bare slot number. */
    slot-names = "G1 Up", "G1 Down", "G1 Left", "G1 Right", /* ... */;

    /* What each slot does before anyone configures it. */
    default-bindings = <&kp LC(T)>, <&kp LC(W)>, /* ... */;
};
```

### 4. Point something at the slots

```dts
zip_gesture_1: zip_gesture_1 {
    compatible = "zmk,input-processor-mouse-gesture";
    /* ... */
    up    { pattern = <GESTURE_UP>;    bindings = <&gesture_action 0>; };
    down  { pattern = <GESTURE_DOWN>;  bindings = <&gesture_action 1>; };
};
```

### Cost

Measured on an nRF52840 with 24 slots: roughly 1 KB of RAM for the slot table,
plus what the gesture processor itself uses (about 3.2 KB per instance).

### Caveats for adopters

- The published web UI hardcodes the CLine46's layer numbering
  (`SELECTABLE_LAYERS` in `web/src/GroupTabs.tsx`). The firmware side reports
  its own slot names and groups, so a different keyboard needs that one list
  changed — or better, that list derived from the device. Patches welcome.
- Runtime layer assignment for gesture groups (`active-layers`) currently needs
  [a fork of zmk-mouse-gesture](https://github.com/jpttm/zmk-mouse-gesture)
  rather than upstream. Without it, a gesture group's layer is fixed at build
  time and everything else still works.

## Web UI

```bash
cd web
npm install
npm run dev
```

Web Bluetooth and Web Serial need a Chromium-based browser (Chrome, Edge) served
over HTTPS or `localhost`; on iOS, use
[Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055).

## Acknowledgements

Very little of what makes this work is mine.

- **[ZMK](https://zmk.dev/)** — the firmware everything here is a guest in.
- **[cormoran](https://github.com/cormoran)** — the custom Studio RPC subsystem
  mechanism this module registers with, the
  [runtime input processor](https://github.com/cormoran/zmk-module-runtime-input-processor),
  [runtime macros](https://github.com/cormoran/zmk-feature-runtime-macro),
  [device info](https://github.com/cormoran/zmk-feature-device-info) and the
  rest of the module set, plus
  [@cormoran/zmk-studio-react-hook](https://github.com/cormoran/react-zmk-studio),
  which is the only reason the browser page exists at all. DYA Studio is the
  model this settings page is imitating.
- **[kot149](https://github.com/kot149/zmk-mouse-gesture)** — the gesture
  recognition itself. This module only decides what a recognised gesture does.
- **[takamaru](https://github.com/takamaru-fpv/zmk_config_CLine46)** — the
  CLine46 and its firmware, which is what all of this was built for.
- **[badjeff](https://github.com/badjeff/zmk-pmw3610-driver)** — the PMW3610
  trackball driver.

## Licence

MIT, so that it stays easy for other projects to adopt.

This project deliberately takes nothing from
[DYA Studio](https://github.com/cormoran/dya-studio), which is AGPL-3.0. Reading
it to understand the RPC protocol is one thing; copying from it would have
forced this module to AGPL too.
