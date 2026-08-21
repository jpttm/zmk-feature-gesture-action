# ZMK Gesture Action

*[日本語版 (Japanese README)](README.md)*

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

### 1. Add the modules

You need two: the module that **recognizes** gestures (kot149's
zmk-mouse-gesture) and this one, which **stores and hot-swaps** what each
recognized gesture does. Add both to `remotes:` and `projects:` in west.yml.

```yaml
# config/west.yml
manifest:
  remotes:
    - name: jpttm
      url-base: https://github.com/jpttm
  projects:
    # Gesture recognition (kot149's zmk-mouse-gesture; points at a fork that
    # adds runtime layer switching (active-layers) until it lands upstream)
    - name: zmk-mouse-gesture
      remote: jpttm
      revision: v1-active-layers
    # Action slots for recognized gestures (this module)
    - name: zmk-feature-gesture-action
      remote: jpttm
      revision: main
```

### 2. Include the preset and splice it into your listener

In the overlay - **and that is essentially the whole integration:**

```dts
#include <presets/gesture_six_groups.dtsi>

&trackball_listener {
    input-processors = <...existing processors...>, <KOROKORO_GESTURES>;
};

&gesture_action {
    /* layers you want kept for ordinary use (policy only) */
    reserved-layers = <0 1 2>;
};
```

The preset carries six recognizer instances, 24 named slots, and defaults for
groups 1-4 (browser tabs / virtual desktops / navigation / editing), so a
fresh flash already does something useful. Everything is editable from the
settings page afterwards.

- `&trackball_listener` is keyboard-specific — look for the node with
  `zmk,input-listener` in your shield's overlay
- Groups 1-4 default to layers 7-10; override before the include with
  `#define KOROKORO_GESTURE_LAYER_1 4` if your keyboard numbers differently
- The tuning was done on a 600 CPI trackball. A higher-CPI sensor makes
  recognition oversensitive, so scale stroke-size proportionally
  (e.g. 1000 CPI: `&zip_gesture_1 { stroke-size = <170>; };` for all six).
  Everything else overrides the normal devicetree way too
- `CONFIG_ZMK_GESTURE_ACTION_COUNT` defaults to 24 now, so no conf line needed
- Splice into the listener's **base** chain, not a layer override - see the
  design notes for why

<details>
<summary>Writing it all yourself instead</summary>

Declare the `&gesture_action` node (slot-names / default-bindings /
reserved-layers) and the six processor instances by hand. The preset source,
[`dts/presets/gesture_six_groups.dtsi`](dts/presets/gesture_six_groups.dtsi),
is the worked example.

</details>

### 3. Name your layers

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
  [a fork of zmk-mouse-gesture](https://github.com/jpttm/zmk-mouse-gesture)
  (branch `v1-active-layers`). Without it, a group's layer is fixed at build
  time and everything else still works. Three of the four PRs in this series
  are merged upstream; the last is
  [proposed](https://github.com/kot149/zmk-mouse-gesture/pull/14).
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

It contains no code from
[DYA Studio](https://github.com/cormoran/dya-studio) (AGPL-3.0).
