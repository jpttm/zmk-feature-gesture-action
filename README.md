# ZMK Gesture Action

Runtime-configurable gesture actions for ZMK, configured from the browser over
USB or Bluetooth.

> **Status: step 1 of 3.** Only the connection check exists so far. The
> behaviour and its RPC are not written yet.

## Why

[zmk-mouse-gesture](https://github.com/kot149/zmk-mouse-gesture) recognises
trackball strokes and invokes ordinary ZMK behaviours, but those bindings are
fixed at build time. Pointing them at
[runtime macros](https://github.com/cormoran/zmk-feature-runtime-macro) makes
them editable without reflashing, at the cost of consuming macro slots that
users need for ordinary macros — there are only 16, and gestures can eat all of
them.

This module aims to give gestures their own runtime-editable storage, so
gestures and macros stop competing.

## Roadmap

1. **Connection check** — confirm a browser page can reach the keyboard over
   Web Serial and Web Bluetooth and enumerate its custom RPC subsystems. *(done)*
2. **`&gesture_action N` behaviour** — a behaviour whose binding is stored in
   settings and editable at runtime, seeded from devicetree defaults so a fresh
   board works before it is ever configured.
3. **Settings UI** — assign an action to each gesture from a web page.

## Web UI

```bash
cd web
npm install
npm run dev
```

Web Bluetooth and Web Serial need a Chromium-based browser (Chrome, Edge) served
over HTTPS or `localhost`; on iOS, use
[Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055).

## Licence

MIT. Built on [@cormoran/zmk-studio-react-hook](https://github.com/cormoran/react-zmk-studio)
(MIT) and [@zmkfirmware/zmk-studio-ts-client](https://github.com/zmkfirmware/zmk-studio-ts-client)
(MIT).

This project deliberately takes nothing from
[DYA Studio](https://github.com/cormoran/dya-studio), which is AGPL-3.0, so that
it can stay MIT and remain easy for other projects to adopt.
