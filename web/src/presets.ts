/**
 * Ready-made assignments, so a fresh keyboard does not have to be configured
 * one slot at a time.
 *
 * Presets live here rather than in the firmware because they encode OS
 * conventions, not keyboard hardware — the same keyboard wants different
 * shortcuts depending on what it is plugged into.
 *
 * They do assume the CLine46 slot layout: four gesture layers of up/down/
 * left/right, in that order. That assumption is why applying one always shows
 * a preview first; on a keyboard laid out differently the preview is where it
 * becomes obvious.
 *
 * Adding a preset is a data change: append an entry below.
 */
import { packKeycode } from "./keycodes";

const CTRL = 0x01;
const SHIFT = 0x02;
const ALT = 0x04;
const GUI = 0x08;

const PAGE_KEY = 0x07 << 16;
const PAGE_CONSUMER = 0x0c << 16;

const kc = (mods: number, id: number) => packKeycode(mods, PAGE_KEY | id);
const cc = (mods: number, id: number) => packKeycode(mods, PAGE_CONSUMER | id);

// HID keyboard usage IDs used below.
const K = {
  T: 0x17,
  W: 0x1a,
  D: 0x07,
  Z: 0x1d,
  Y: 0x1c,
  C: 0x06,
  V: 0x19,
  TAB: 0x2b,
  LEFT: 0x50,
  RIGHT: 0x4f,
  UP: 0x52,
  DOWN: 0x51,
  HOME: 0x4a,
  END: 0x4d,
  LBRACKET: 0x2f,
  RBRACKET: 0x30,
  F3: 0x3c,
  F11: 0x44,
} as const;

export interface PresetAction {
  slot: number;
  keycode: number;
  label: { ja: string; en: string };
}

export interface Preset {
  id: string;
  name: { ja: string; en: string };
  actions: PresetAction[];
}

const a = (
  slot: number,
  keycode: number,
  ja: string,
  en: string,
): PresetAction => ({ slot, keycode, label: { ja, en } });

export const PRESETS: Preset[] = [
  {
    id: "windows",
    name: { ja: "Windows 向け", en: "Windows" },
    actions: [
      // Layer 7 — browser tabs
      a(0, kc(CTRL, K.T), "新しいタブ", "New tab"),
      a(1, kc(CTRL, K.W), "タブを閉じる", "Close tab"),
      a(2, kc(CTRL | SHIFT, K.TAB), "前のタブ", "Previous tab"),
      a(3, kc(CTRL, K.TAB), "次のタブ", "Next tab"),
      // Layer 8 — windows and virtual desktops
      a(4, kc(GUI, K.TAB), "タスクビュー", "Task view"),
      a(5, kc(GUI, K.D), "デスクトップを表示", "Show desktop"),
      a(6, kc(CTRL | GUI, K.LEFT), "左の仮想デスクトップ", "Desktop left"),
      a(7, kc(CTRL | GUI, K.RIGHT), "右の仮想デスクトップ", "Desktop right"),
      // Layer 9 — moving around a document
      a(8, kc(CTRL, K.HOME), "先頭へ", "Top of document"),
      a(9, kc(CTRL, K.END), "末尾へ", "End of document"),
      a(10, kc(ALT, K.LEFT), "戻る", "Back"),
      a(11, kc(ALT, K.RIGHT), "進む", "Forward"),
      // Layer 10 — editing
      a(12, kc(CTRL, K.Z), "元に戻す", "Undo"),
      a(13, kc(CTRL, K.Y), "やり直し", "Redo"),
      a(14, kc(CTRL, K.C), "コピー", "Copy"),
      a(15, kc(CTRL, K.V), "貼り付け", "Paste"),
    ],
  },
  {
    id: "macos",
    name: { ja: "macOS 向け", en: "macOS" },
    actions: [
      a(0, kc(GUI, K.T), "新しいタブ", "New tab"),
      a(1, kc(GUI, K.W), "タブを閉じる", "Close tab"),
      a(2, kc(CTRL | SHIFT, K.TAB), "前のタブ", "Previous tab"),
      a(3, kc(CTRL, K.TAB), "次のタブ", "Next tab"),
      // Mission Control and Spaces
      a(4, kc(CTRL, K.UP), "Mission Control", "Mission Control"),
      a(5, kc(0, K.F11), "デスクトップを表示", "Show desktop"),
      a(6, kc(CTRL, K.LEFT), "左のスペース", "Space left"),
      a(7, kc(CTRL, K.RIGHT), "右のスペース", "Space right"),
      a(8, kc(GUI, K.UP), "先頭へ", "Top of document"),
      a(9, kc(GUI, K.DOWN), "末尾へ", "End of document"),
      a(10, kc(GUI, K.LBRACKET), "戻る", "Back"),
      a(11, kc(GUI, K.RBRACKET), "進む", "Forward"),
      a(12, kc(GUI, K.Z), "元に戻す", "Undo"),
      a(13, kc(GUI | SHIFT, K.Z), "やり直し", "Redo"),
      a(14, kc(GUI, K.C), "コピー", "Copy"),
      a(15, kc(GUI, K.V), "貼り付け", "Paste"),
    ],
  },
  {
    id: "macos-mission",
    name: { ja: "macOS 向け（アプリ切替重視）", en: "macOS (app switching)" },
    actions: [
      a(0, kc(GUI, K.TAB), "アプリ切替", "Switch app"),
      a(1, kc(GUI, K.F3), "デスクトップを表示", "Show desktop"),
      a(2, kc(CTRL, K.LEFT), "左のスペース", "Space left"),
      a(3, kc(CTRL, K.RIGHT), "右のスペース", "Space right"),
      a(4, kc(GUI, K.T), "新しいタブ", "New tab"),
      a(5, kc(GUI, K.W), "タブを閉じる", "Close tab"),
      a(6, kc(CTRL | SHIFT, K.TAB), "前のタブ", "Previous tab"),
      a(7, kc(CTRL, K.TAB), "次のタブ", "Next tab"),
      a(8, kc(GUI, K.UP), "先頭へ", "Top of document"),
      a(9, kc(GUI, K.DOWN), "末尾へ", "End of document"),
      a(10, kc(GUI, K.LBRACKET), "戻る", "Back"),
      a(11, kc(GUI, K.RBRACKET), "進む", "Forward"),
      a(12, kc(GUI, K.Z), "元に戻す", "Undo"),
      a(13, kc(GUI | SHIFT, K.Z), "やり直し", "Redo"),
      a(14, kc(GUI, K.C), "コピー", "Copy"),
      a(15, kc(GUI, K.V), "貼り付け", "Paste"),
    ],
  },
  {
    id: "media",
    name: { ja: "メディア操作（OS共通）", en: "Media (any OS)" },
    actions: [
      a(0, cc(0, 0xe9), "音量を上げる", "Volume up"),
      a(1, cc(0, 0xea), "音量を下げる", "Volume down"),
      a(2, cc(0, 0xb6), "前の曲", "Previous track"),
      a(3, cc(0, 0xb5), "次の曲", "Next track"),
      a(4, cc(0, 0xcd), "再生 / 一時停止", "Play / pause"),
      a(5, cc(0, 0xe2), "ミュート", "Mute"),
      a(6, cc(0, 0x224), "ブラウザで戻る", "Browser back"),
      a(7, cc(0, 0x225), "ブラウザで進む", "Browser forward"),
      a(8, kc(0, K.HOME), "行頭へ", "Start of line"),
      a(9, kc(0, K.END), "行末へ", "End of line"),
      a(10, kc(0, K.LEFT), "左", "Left"),
      a(11, kc(0, K.RIGHT), "右", "Right"),
      a(12, kc(CTRL, K.Z), "元に戻す", "Undo"),
      a(13, kc(CTRL, K.Y), "やり直し", "Redo"),
      a(14, kc(CTRL, K.C), "コピー", "Copy"),
      a(15, kc(CTRL, K.V), "貼り付け", "Paste"),
    ],
  },
];
