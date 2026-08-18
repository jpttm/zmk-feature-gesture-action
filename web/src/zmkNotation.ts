/**
 * Parsing ZMK binding notation, e.g. `&kp LC(TAB)` or `&mo 3`.
 *
 * For people who already write keymaps, typing the binding is faster than
 * hunting through a list. Typos are the whole risk, so everything that can be
 * checked here is: the behaviour has to exist on this keyboard, the modifiers
 * and key name have to resolve, and the parameter count has to match.
 *
 * What cannot be checked is whether the value makes sense - `&mo 30` parses
 * fine on a keyboard with eleven layers. The firmware rejects those on its own.
 */
import type { BehaviorInfo } from "./useBehaviors";
import { MODIFIERS } from "./keycodes";

const PAGE_KEY = 0x07 << 16;
const PAGE_CONSUMER = 0x0c << 16;

/**
 * ZMK's own key names. Written out rather than derived from the picker's
 * labels: "Page Up" and `PG_UP` are the same key with different names, and
 * guessing between them silently produces the wrong keycode.
 */
const ZMK_KEYS: Record<string, number> = {
  A: 0x04, B: 0x05, C: 0x06, D: 0x07, E: 0x08, F: 0x09, G: 0x0a, H: 0x0b,
  I: 0x0c, J: 0x0d, K: 0x0e, L: 0x0f, M: 0x10, N: 0x11, O: 0x12, P: 0x13,
  Q: 0x14, R: 0x15, S: 0x16, T: 0x17, U: 0x18, V: 0x19, W: 0x1a, X: 0x1b,
  Y: 0x1c, Z: 0x1d,
  N1: 0x1e, N2: 0x1f, N3: 0x20, N4: 0x21, N5: 0x22,
  N6: 0x23, N7: 0x24, N8: 0x25, N9: 0x26, N0: 0x27,
  NUMBER_1: 0x1e, NUMBER_2: 0x1f, NUMBER_3: 0x20, NUMBER_4: 0x21,
  NUMBER_5: 0x22, NUMBER_6: 0x23, NUMBER_7: 0x24, NUMBER_8: 0x25,
  NUMBER_9: 0x26, NUMBER_0: 0x27,
  ENTER: 0x28, RET: 0x28, RETURN: 0x28,
  ESC: 0x29, ESCAPE: 0x29,
  BSPC: 0x2a, BACKSPACE: 0x2a,
  TAB: 0x2b, SPACE: 0x2c,
  MINUS: 0x2d, EQUAL: 0x2e,
  LBKT: 0x2f, LEFT_BRACKET: 0x2f,
  RBKT: 0x30, RIGHT_BRACKET: 0x30,
  BSLH: 0x31, BACKSLASH: 0x31,
  SEMI: 0x33, SEMICOLON: 0x33,
  SQT: 0x34, APOS: 0x34,
  GRAVE: 0x35, COMMA: 0x36, DOT: 0x37, PERIOD: 0x37,
  FSLH: 0x38, SLASH: 0x38,
  CAPS: 0x39, CAPSLOCK: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  INS: 0x49, INSERT: 0x49,
  HOME: 0x4a,
  PG_UP: 0x4b, PAGE_UP: 0x4b,
  DEL: 0x4c, DELETE: 0x4c,
  END: 0x4d,
  PG_DN: 0x4e, PAGE_DOWN: 0x4e,
  RIGHT: 0x4f, RIGHT_ARROW: 0x4f,
  LEFT: 0x50, LEFT_ARROW: 0x50,
  DOWN: 0x51, DOWN_ARROW: 0x51,
  UP: 0x52, UP_ARROW: 0x52,
};

const ZMK_CONSUMER: Record<string, number> = {
  C_PP: 0xcd, C_PLAY_PAUSE: 0xcd,
  C_NEXT: 0xb5, C_PREV: 0xb6, C_PREVIOUS: 0xb6,
  C_VOL_UP: 0xe9, C_VOLUME_UP: 0xe9,
  C_VOL_DN: 0xea, C_VOLUME_DOWN: 0xea,
  C_MUTE: 0xe2,
  C_AC_BACK: 0x224, C_AC_FORWARD: 0x225,
};

/** ZMK's modifier wrappers, in the order they nest. */
const MOD_FUNCS: Record<string, number> = {
  LC: 0x01, LS: 0x02, LA: 0x04, LG: 0x08,
  RC: 0x10, RS: 0x20, RA: 0x40, RG: 0x80,
};

/**
 * ZMK node labels for the behaviours a keyboard is likely to have. The Studio
 * protocol reports a display name ("Key Press"), not the label people type
 * (`&kp`), so the two have to be bridged here.
 */
const LABEL_TO_DISPLAY: Record<string, string> = {
  kp: "Key Press",
  mo: "Momentary Layer",
  to: "To Layer",
  tog: "Toggle Layer",
  sl: "Sticky Layer",
  sk: "Sticky Key",
  mt: "Mod-Tap",
  lt: "Layer-Tap",
  trans: "Transparent",
  none: "None",
  mkp: "Mouse Button Press",
  bt: "Bluetooth",
  bootloader: "Bootloader",
  sys_reset: "Reset",
  rmacro: "Runtime Macro",
  gesture_action: "Gesture Action",
  kpls: "Key Press with Layout Shift",
  mtls: "Mod-Tap with Layout Shift",
  tog_ls: "Toggle Layout Shift",
  tog_ls_on: "Toggle Layout Shift On",
  tog_ls_off: "Toggle Layout Shift Off",
};

export interface ParsedBinding {
  behaviorId: number;
  param1: number;
  param2: number;
}

export type ParseResult =
  | { ok: true; value: ParsedBinding }
  | { ok: false; error: string };

const normalise = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

/** Parse one ZMK binding against the behaviours this keyboard reports. */
export function parseBinding(
  input: string,
  behaviors: BehaviorInfo[],
): ParseResult {
  const text = input.trim().replace(/^</, "").replace(/>$/, "").trim();
  if (!text) {
    return { ok: false, error: "empty" };
  }

  const match = text.match(/^&\s*([A-Za-z0-9_]+)\s*(.*)$/);
  if (!match) {
    return { ok: false, error: "syntax" };
  }

  const [, label, rest] = match;

  const wanted = LABEL_TO_DISPLAY[label.toLowerCase()];
  const behavior = behaviors.find(
    (b) =>
      normalise(b.displayName) === normalise(label) ||
      (wanted && normalise(b.displayName) === normalise(wanted)),
  );
  if (!behavior) {
    return { ok: false, error: "unknownBehavior" };
  }

  const args = rest.length > 0 ? splitArgs(rest) : [];
  const expected =
    (behavior.param1.length > 0 ? 1 : 0) + (behavior.param2.length > 0 ? 1 : 0);
  if (args.length !== expected) {
    return { ok: false, error: "paramCount" };
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = parseParam(arg);
    if (value === null) {
      return { ok: false, error: "badParam" };
    }
    values.push(value);
  }

  return {
    ok: true,
    value: {
      behaviorId: behavior.id,
      param1: values[0] ?? 0,
      param2: values[1] ?? 0,
    },
  };
}

/** Split on whitespace, but keep `LC(TAB)` and `BT_SEL 0` style args intact. */
function splitArgs(rest: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of rest) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) args.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

function parseParam(arg: string): number | null {
  const wrapped = arg.match(/^([A-Za-z]{2})\s*\((.*)\)$/);
  if (wrapped) {
    const mod = MOD_FUNCS[wrapped[1].toUpperCase()];
    if (mod === undefined) return null;
    const inner = parseParam(wrapped[2]);
    if (inner === null) return null;
    return ((mod << 24) | inner) >>> 0;
  }

  if (/^0x[0-9a-f]+$/i.test(arg)) return parseInt(arg, 16);
  if (/^\d+$/.test(arg)) return parseInt(arg, 10);

  const name = arg.toUpperCase();
  if (name in ZMK_KEYS) return PAGE_KEY | ZMK_KEYS[name];
  if (name in ZMK_CONSUMER) return PAGE_CONSUMER | ZMK_CONSUMER[name];

  return null;
}

/** Render a binding back as ZMK notation, for the field's initial value. */
export function formatBinding(
  behavior: BehaviorInfo | undefined,
  param1: number,
  param2: number,
): string {
  if (!behavior) return "";

  const label =
    Object.entries(LABEL_TO_DISPLAY).find(
      ([, display]) => normalise(display) === normalise(behavior.displayName),
    )?.[0] ?? normalise(behavior.displayName);

  const parts = [`&${label}`];
  if (behavior.param1.length > 0) {
    parts.push(
      behavior.param1.some((d) => d.hidUsage) ? formatKeycode(param1) : String(param1),
    );
  }
  if (behavior.param2.length > 0) parts.push(String(param2));
  return parts.join(" ");
}

function formatKeycode(value: number): string {
  const mods = (value >>> 24) & 0xff;
  const usage = value & 0x0000ffff;
  const page = (value >>> 16) & 0xff;

  const table = page === 0x0c ? ZMK_CONSUMER : ZMK_KEYS;
  const name = Object.keys(table).find((k) => table[k] === usage);
  let out = name ?? `0x${value.toString(16)}`;

  // Wrap innermost-first so the result reads the way ZMK writes it.
  for (const m of MODIFIERS) {
    if (mods & m.bit) {
      const fn = Object.keys(MOD_FUNCS).find((k) => MOD_FUNCS[k] === m.bit);
      out = `${fn}(${out})`;
    }
  }
  return out;
}
