/**
 * ZMK keycode packing, and enough of a keycode table to cover what people
 * actually bind to a gesture.
 *
 * A `&kp` parameter packs three things into one 32-bit value, per ZMK's
 * dt-bindings (hid_usage.h, modifiers.h):
 *
 *     bits 24-31  implicit modifiers   (MOD_LCTL = 0x01, MOD_LSFT = 0x02, ...)
 *     bits 16-23  HID usage page       (0x07 keyboard, 0x0C consumer)
 *     bits  0-15  HID usage ID
 *
 * so `LC(TAB)` is (0x01 << 24) | (0x07 << 16) | 0x2B.
 *
 * The table below is deliberately partial: it is a picker, not a reference.
 * Anything missing can still be entered as a raw value.
 */

const PAGE_KEYBOARD = 0x07;
const PAGE_CONSUMER = 0x0c;

export const MODIFIERS = [
  { label: "Ctrl", bit: 0x01 },
  { label: "Shift", bit: 0x02 },
  { label: "Alt", bit: 0x04 },
  { label: "GUI", bit: 0x08 },
] as const;

export type KeycodeGroupKey =
  | "keysEditing"
  | "keysNavigation"
  | "keysLetters"
  | "keysNumbers"
  | "keysSymbols"
  | "keysFunction"
  | "keysMedia";

export interface Keycode {
  name: string;
  value: number;
}

const key = (name: string, id: number): Keycode => ({
  name,
  value: (PAGE_KEYBOARD << 16) | id,
});

const consumer = (name: string, id: number): Keycode => ({
  name,
  value: (PAGE_CONSUMER << 16) | id,
});

const letters: Keycode[] = Array.from({ length: 26 }, (_, i) =>
  key(String.fromCharCode(65 + i), 0x04 + i),
);

// HID numbers run 1..9 then 0, which is not the order people read them in.
const digits: Keycode[] = [
  ...Array.from({ length: 9 }, (_, i) => key(String(i + 1), 0x1e + i)),
  key("0", 0x27),
];

const functionKeys: Keycode[] = [
  ...Array.from({ length: 12 }, (_, i) => key(`F${i + 1}`, 0x3a + i)),
];

export const KEYCODE_GROUPS: { labelKey: KeycodeGroupKey; keys: Keycode[] }[] = [
  {
    labelKey: "keysEditing",
    keys: [
      key("Enter", 0x28),
      key("Escape", 0x29),
      key("Backspace", 0x2a),
      key("Tab", 0x2b),
      key("Space", 0x2c),
      key("Delete", 0x4c),
      key("Insert", 0x49),
    ],
  },
  {
    labelKey: "keysNavigation",
    keys: [
      key("Left", 0x50),
      key("Right", 0x4f),
      key("Up", 0x52),
      key("Down", 0x51),
      key("Home", 0x4a),
      key("End", 0x4d),
      key("Page Up", 0x4b),
      key("Page Down", 0x4e),
    ],
  },
  {
    labelKey: "keysSymbols",
    keys: [
      key("[", 0x2f),
      key("]", 0x30),
      key("\\", 0x31),
      key(";", 0x33),
      key("'", 0x34),
      key("`", 0x35),
      key(",", 0x36),
      key(".", 0x37),
      key("/", 0x38),
      key("-", 0x2d),
      key("=", 0x2e),
    ],
  },
  { labelKey: "keysLetters", keys: letters },
  { labelKey: "keysNumbers", keys: digits },
  { labelKey: "keysFunction", keys: functionKeys },
  {
    labelKey: "keysMedia",
    keys: [
      consumer("Play / Pause", 0xcd),
      consumer("Next track", 0xb5),
      consumer("Previous track", 0xb6),
      consumer("Volume up", 0xe9),
      consumer("Volume down", 0xea),
      consumer("Mute", 0xe2),
      consumer("Browser back", 0x224),
      consumer("Browser forward", 0x225),
    ],
  },
];

const ALL_KEYS: Keycode[] = KEYCODE_GROUPS.flatMap((g) => g.keys);

export function splitKeycode(param: number): { mods: number; base: number } {
  return { mods: (param >>> 24) & 0xff, base: param & 0x00ffffff };
}

export function packKeycode(mods: number, base: number): number {
  // >>> 0 keeps the result unsigned; the top bit set would otherwise go negative.
  return ((mods << 24) | base) >>> 0;
}

/** Human-readable form of a `&kp` parameter, e.g. "Ctrl+Tab". */
export function describeKeycode(param: number): string {
  const { mods, base } = splitKeycode(param);
  const named = ALL_KEYS.find((k) => k.value === base);
  const parts: string[] = MODIFIERS.filter((m) => mods & m.bit).map((m) => m.label);
  parts.push(named ? named.name : `0x${base.toString(16)}`);
  return parts.join("+");
}

export function isKnownKeycode(param: number): boolean {
  const { base } = splitKeycode(param);
  return ALL_KEYS.some((k) => k.value === base);
}
