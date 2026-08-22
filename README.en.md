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

Pointing each gesture at a
[runtime macro](https://github.com/cormoran/zmk-feature-runtime-macro) works
around this, but eats the 16 macro slots. This module gives gestures storage
of their own.

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

A slot is just a redirectable behaviour, so anything that takes a binding — a
combo, a macro step, a key position — can point at one.

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

If DYA Studio already runs on your keyboard, there are exactly three things
to do. (If not, moving to cormoran's ZMK fork — see "What you need" above —
comes first; on stock ZMK the settings page cannot talk to this module.)

1. Add two modules to west.yml
2. Write three lines in the overlay
3. Give the keymap a gesture layer, and a key that reaches it

Nothing goes in `.conf` — both modules enable themselves once included. Flash,
then connect to <https://korokoro.ttm.jp/> with `studio_unlock` held, and the
gestures appear in the settings page.

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
- The tuning was done on a 600 CPI trackball. A higher-CPI sensor makes
  recognition oversensitive, so scale it proportionally with one line before
  the include: `#define KOROKORO_GESTURE_STROKE_SIZE 170` (the 1000 CPI
  value; applies to all six groups)
- `CONFIG_ZMK_GESTURE_ACTION_COUNT` defaults to 24 now, so no conf line needed
- Splice into the listener's **base** chain, not a layer override - see the
  design notes for why

<details>
<summary>Writing it all yourself instead</summary>

Declare the `&gesture_action` node (slot-names / default-bindings /
reserved-layers) and the six processor instances by hand. The preset source,
[`dts/presets/gesture_six_groups.dtsi`](dts/presets/gesture_six_groups.dtsi),
is the worked example.

If you want Korokoro Kit to edit the layout naturally, keep slots grouped in
consecutive fours: 0-3, 4-7, and so on. Other layouts can work at the firmware
level, but they will not line up with the settings page's group display.

</details>

### 3. Give the keymap a gesture layer

A group only runs while its layer is active; the gesture *is* "hold a layer
key, roll the trackball". So the keymap needs a **gesture layer** and a **key
that reaches it**.

Groups 1-4 default to layers 7-10, but **a group pointed at a layer that does
not exist simply never fires — harmlessly** — so you can start with a single
layer. On a keyboard whose stock keymap has five layers (0-4), say:

```dts
// in the overlay or keymap, before the include:
#define KOROKORO_GESTURE_LAYER_1 5

// add one layer to the keymap (it becomes position 5); all-&trans is fine:
gesture_1 {
    display-name = "GESTURE1";   // what the settings page shows
    bindings = < &trans &trans ... >;
};
```

Then put `&mo 5` (active while held) somewhere on an existing layer. Want more
groups later? Add a layer and set `KOROKORO_GESTURE_LAYER_2` the same way.

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
- On a split keyboard, gesture recognition is built and runs **on the central
  half only**. If the trackball sits on the peripheral, relay its input with
  ZMK's input-split so the listener (and this chain) live on the central.
- Korokoro Kit and the bundled preset treat **one group as four directions:
  up, down, left and right, backed by four consecutive slots**. The settings UI
  displays slots in that shape. Multi-stroke gestures such as up-then-right can
  still be written by hand in devicetree, but they tend to add confirmation
  delay and recognition ambiguity, so they are not the recommended default.
- The default slot count is 24. The recommended presets use the first four
  groups, i.e. 16 slots. Groups 5 and 6 are left as spare capacity; assign them
  to layers from the settings page when you want more gesture layers later.

## Design notes

Only the things that bite if you don't know them.

### Put gesture processors in the base chain

An input listener evaluates its layer overrides (`layers = <N>`) first and
stops there. Two consequences:

- A gesture processor *inside* an override is pinned to that layer, and
  runtime layer switching stops working. Base chain + `active-layers` is the
  correct placement
- On a layer claimed by some *other* override (scroll, say), base-chain
  gestures **silently never fire — no error, nothing in the log.** The module
  detects such layers automatically and removes them from the settings page

### `reserved-layers` is policy only

Hand-write only the layers you want kept for ordinary use. Layers that
physically cannot work (override-claimed) are derived automatically, so moving
your scroll layer needs no edit here.

### Other traps

- The `active-layers` / `reserved-layers` masks index a layer's **position**
  in the keymap — not ZMK Studio's `Layer.id`
- `active-layers = 0` means "every layer". Park a disabled group on a layer
  that does not exist, `BIT(31)` (the preset's groups 5–6 sit there)
- One group per layer; two groups sharing one both fire (the settings page
  refuses the assignment to begin with)
- `suppress-movement` pins the cursor during a gesture. The upstream
  implementation is ineffective on the layer-override path, so the fork uses a
  different mechanism

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
