# ZMK Gesture Action

*[日本語版はこちら](README.ja.md)*

Gestures on a ZMK keyboard whose actions you can change from a web page, without
rebuilding firmware.

Settings page: <https://korokoro.ttm.jp/>

## What it does

Hold a layer key, roll the trackball up, and a new browser tab opens. Roll it
left and you go to the previous tab. Roll down and the tab closes.

That much is already possible with
[zmk-mouse-gesture](https://github.com/kot149/zmk-mouse-gesture). What this
module adds is that **you can change what each gesture does from a web page**,
in a couple of seconds, without a toolchain, a rebuild, or a flash.

Open the page, connect over USB or Bluetooth, pick a different key, done.

## Why it exists

`zmk-mouse-gesture` invokes ordinary ZMK behaviours, and those are written into
the devicetree at build time. Changing one means rebuilding.

The obvious workaround is to point each gesture at a
[runtime macro](https://github.com/cormoran/zmk-feature-runtime-macro), which
*is* editable at runtime. It works, but there are only 16 macro slots, and a
keyboard with 16 gestures has none left for actual macros. Gestures and macros
end up fighting over the same scarce resource.

This module gives gestures storage of their own.

## How it works

`&gesture_action N` is a behaviour that stands in for another behaviour. Slot
`N` holds a binding — say `&kp LC(T)` — in the keyboard's settings storage.
When the behaviour runs, it invokes whatever the slot currently holds.

```
gesture recognised  →  &gesture_action 0  →  looks up slot 0  →  &kp LC(T)
```

Each slot is seeded from a devicetree default, so a freshly flashed keyboard
works straight away, before anyone has configured anything. Assign something to
a slot and the stored value takes over. Reset it and the default comes back.

The web page reads and writes those slots over ZMK Studio's RPC transport, which
works over both USB (Web Serial) and Bluetooth (Web Bluetooth).

**None of this is specific to gestures.** A slot is just a redirectable
behaviour. Anything that takes a binding — a combo, a macro step, a key
position — can point at one. Gesture recognition is simply what it was built
for.

## What you need

- **ZMK with Studio enabled**, and a build that carries a custom RPC subsystem.
  In practice that means [cormoran's ZMK fork and module
  set](https://github.com/cormoran), which is what DYA Studio is built on.
- **This module**, for the slots.
- **Something to trigger the slots.** `zmk-mouse-gesture` if you want trackball
  gestures; anything that takes a binding otherwise.
- **A Chromium browser** (Chrome or Edge) for the settings page. On iOS,
  [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055).

## Adding it to a keyboard

### 1. Add the module

```yaml
# config/west.yml
manifest:
  remotes:
    - name: jpttm
      url-base: https://github.com/jpttm
  projects:
    - name: zmk-feature-gesture-action
      remote: jpttm
      revision: main
```

### 2. Choose how many slots

```ini
# boards/shields/<your board>/<your board>.conf
CONFIG_ZMK_GESTURE_ACTION_COUNT=24
```

One slot per gesture. Six gesture groups of four directions each needs 24.

The RPC handler switches itself on when a `gesture_action` node exists, so
there is no separate `CONFIG_..._STUDIO_RPC` to remember.

### 3. Declare the node

```dts
#include <behaviors/gesture_action.dtsi>

&gesture_action {
    /* Shown in the settings UI instead of a bare slot number. Keep them
       short - they travel over RPC with a 24-byte cap. */
    slot-names =
        "G1 Up", "G1 Down", "G1 Left", "G1 Right",
        "G2 Up", "G2 Down", "G2 Left", "G2 Right";

    /* What each slot does before anyone configures it, in slot order. */
    default-bindings =
        <&kp LC(T)>, <&kp LC(W)>, <&kp LS(LC(TAB))>, <&kp LC(TAB)>,
        <&kp LG(TAB)>, <&kp LG(D)>, <&kp LC(LG(LEFT))>, <&kp LC(LG(RIGHT))>;

    /* Layers you want kept for ordinary use, so the settings page does not
       offer them for gestures. Policy only - see "Which layers get offered". */
    reserved-layers = <0 1 2>;
};
```

### 4. Point something at the slots

With `zmk-mouse-gesture`, one processor instance per gesture group:

```dts
zip_gesture_1: zip_gesture_1 {
    compatible = "zmk,input-processor-mouse-gesture";
    #input-processor-cells = <0>;
    display-name = "Group 1";
    active-layers = <BIT(7)>;   /* which layer this group acts on */
    always-active;
    suppress-movement;          /* freeze the cursor while gesturing */
    enable-eager-mode;

    up    { pattern = <GESTURE_UP>;    bindings = <&gesture_action 0>; };
    down  { pattern = <GESTURE_DOWN>;  bindings = <&gesture_action 1>; };
    left  { pattern = <GESTURE_LEFT>;  bindings = <&gesture_action 2>; };
    right { pattern = <GESTURE_RIGHT>; bindings = <&gesture_action 3>; };
};
```

Then add the processors to your input listener's **base** chain — not a layer
override. See the design notes for why that matters.

```dts
&trackball_listener {
    input-processors = <&mouse_runtime_input_processor>,
        <&zip_gesture_1>, <&zip_gesture_2>;
};
```

### 5. Name your layers

Optional, but the settings page shows them, and "GESTURE1" beats "7".

```dts
layer_7 {
    display-name = "GESTURE1";
    bindings = < ... >;
};
```

A working example of all of this is in the
[CLine46 config](https://github.com/jpttm/zmk_config_CLine46/blob/feat/gesture-action/boards/shields/CLine46/CLine46_R.overlay).

### What it costs

Measured on an nRF52840 with 24 slots: roughly 1 KB of RAM for the slot table,
plus about 3.2 KB per gesture processor instance. A CLine46 build with six
groups lands at about 60% RAM.

### Things to know before adopting

- Runtime layer assignment for gesture groups (`active-layers`) currently needs
  [a fork of zmk-mouse-gesture](https://github.com/jpttm/zmk-mouse-gesture).
  Without it, a group's layer is fixed at build time and everything else still
  works. [Upstreaming is in
  progress](https://github.com/kot149/zmk-mouse-gesture/pull/11).
- The preset buttons on the settings page assume four gestures per group and
  sixteen slots. Everything else — slot names, group count, layers — comes from
  the device, so a different shape falls back to the per-slot editor rather than
  breaking.

## Design notes

These cost time to work out. None of them are visible from the devicetree.

### Put gesture processors in the base chain, not a layer override

An input listener evaluates its layer overrides first, and **returns there**
unless the override sets `process-next`. Two consequences follow:

- A gesture processor placed *inside* an override only ever runs on that layer,
  and the mapping is fixed at build time. Putting it in the base chain and
  letting `active-layers` decide is what makes the layer runtime-settable.
- A gesture processor in the base chain never sees events on a layer some
  *other* override has claimed. Assign a gesture group to a layer that has a
  scroll override and it will silently never fire. No error, no hint, nothing in
  the log.

The second is why `reserved-layers` alone is not enough.

### Which layers get offered

The settings page needs three things, from three places:

| What | Where it comes from |
|---|---|
| Which layers exist, and their names | the standard ZMK keymap RPC |
| Which layers are reserved by policy | `reserved-layers` on this node |
| Which layers *cannot* work | derived — every `zmk,input-listener` in the tree is walked, and any layer claimed by an override without `process-next` is reserved too |

Only the middle row is hand-written, because only it is a judgement call. Move
your scroll layer and nothing needs editing.

An earlier attempt had this node name its listeners with a phandle. That does
not work: the listener references the gesture processors, whose bindings
reference this node, and devicetree rejects the cycle at configure time.
Walking by compatible sidesteps the loop and needs no configuration at all.

### Layer masks index by position, not by ID

`active-layers` and `reserved-layers` are bitmasks over a layer's **position**
in the keymap, which is what `zmk_keymap_layer_active()` takes. ZMK Studio's
`Layer.id` is a stable identifier that survives reordering and is *not* the same
number. A client reading the keymap must use the array position, or a mask will
point at the wrong layer as soon as anyone reorders anything.

### `active-layers = 0` means every layer

A gesture group you want switched off cannot simply be zeroed — zero is the
"no filter" value. Park it on a layer that does not exist, `BIT(31)`, instead.

### One group per layer

Two groups sharing a layer both fire, and which action wins is not something a
user should have to reason about. The settings page enforces one owner per
layer by disabling a layer another group already holds.

### Freezing the cursor

Without `suppress-movement`, drawing a gesture also flings the pointer across
the screen. The upstream implementation returns `ZMK_INPUT_PROC_STOP` to
suppress it, which ZMK's input listener discards on the layer-override path — so
the option silently does nothing there. The fork zeroes the event value instead,
which works from anywhere in the chain.

## Working on the settings page

```bash
cd web
npm install
npm run dev
```

The page talks to the keyboard through
[@cormoran/zmk-studio-react-hook](https://github.com/cormoran/react-zmk-studio).
Wire protocol lives in `proto/jpttm/gesture_action/gesture_action.proto`, with a
hand-written codec in `web/src/gestureActionCodec.ts`.

## Acknowledgements

Very little of what makes this work is mine.

- **[ZMK](https://zmk.dev/)** — the firmware everything here is a guest in.
- **[cormoran](https://github.com/cormoran)** — the custom Studio RPC subsystem
  mechanism this module registers with, the
  [runtime input processor](https://github.com/cormoran/zmk-module-runtime-input-processor),
  [runtime macros](https://github.com/cormoran/zmk-feature-runtime-macro),
  [device info](https://github.com/cormoran/zmk-feature-device-info) and the rest
  of the module set, plus
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

MIT, so that it stays easy for other projects to adopt. Please do — I would be
glad to see this in other configuration tools or firmware distributions.

This project deliberately takes nothing from
[DYA Studio](https://github.com/cormoran/dya-studio), which is AGPL-3.0. Reading
it to understand the RPC protocol is one thing; copying from it would have forced
this module to AGPL too.
