/**
 * Named actions to pick from, so assigning a gesture is choosing "new tab"
 * rather than working out that Ctrl+T packs to 0x01070017.
 *
 * This is the catalogue the whole UI reads from: the chooser lists it, the
 * table names a slot by looking its value up here, and presets are just
 * selections from it. Anything not listed still reaches the same place through
 * the key picker - the catalogue is for convenience, not a limit.
 *
 * Where a shortcut differs between platforms the entry carries both, and the
 * chooser's OS switch decides which is sent.
 */
import { packKeycode } from "./keycodes";

const CTRL = 0x01;
const SHIFT = 0x02;
const ALT = 0x04;
const GUI = 0x08;

const PAGE_KEY = 0x07 << 16;
const PAGE_CONSUMER = 0x0c << 16;

/** Keyboard usage. */
const k = (mods: number, id: number) => packKeycode(mods, PAGE_KEY | id);
/** Consumer-page usage: media keys, browser back/forward. */
const c = (id: number) => packKeycode(0, PAGE_CONSUMER | id);

const K = {
  A: 0x04, C: 0x06, D: 0x07, F: 0x09, R: 0x15, S: 0x16, T: 0x17,
  V: 0x19, W: 0x1a, X: 0x1b, Y: 0x1c, Z: 0x1d,
  ENTER: 0x28, ESC: 0x29, BSPC: 0x2a, TAB: 0x2b, SPACE: 0x2c,
  LBRACKET: 0x2f, RBRACKET: 0x30,
  F4: 0x3d, F5: 0x3e, F11: 0x44,
  HOME: 0x4a, PGUP: 0x4b, DEL: 0x4c, END: 0x4d, PGDN: 0x4e,
  RIGHT: 0x4f, LEFT: 0x50, DOWN: 0x51, UP: 0x52,
} as const;

export type Os = "win" | "mac";

export type CategoryKey =
  | "catBrowser"
  | "catWindow"
  | "catEdit"
  | "catMove"
  | "catMedia";

export interface NamedAction {
  id: string;
  label: { ja: string; en: string };
  /** Keycode per platform. `mac` is omitted when the shortcut is the same. */
  win: number;
  mac?: number;
}

export interface Category {
  key: CategoryKey;
  actions: NamedAction[];
}

const a = (
  id: string,
  ja: string,
  en: string,
  win: number,
  mac?: number,
): NamedAction => ({ id, label: { ja, en }, win, mac });

export const CATEGORIES: Category[] = [
  {
    key: "catBrowser",
    actions: [
      a("newTab", "新しいタブ", "New tab", k(CTRL, K.T), k(GUI, K.T)),
      a("closeTab", "タブを閉じる", "Close tab", k(CTRL, K.W), k(GUI, K.W)),
      a("nextTab", "次のタブ", "Next tab", k(CTRL, K.TAB)),
      a("prevTab", "前のタブ", "Previous tab", k(CTRL | SHIFT, K.TAB)),
      a("reopenTab", "閉じたタブを戻す", "Reopen closed tab", k(CTRL | SHIFT, K.T), k(GUI | SHIFT, K.T)),
      a("back", "戻る", "Back", k(ALT, K.LEFT), k(GUI, K.LBRACKET)),
      a("forward", "進む", "Forward", k(ALT, K.RIGHT), k(GUI, K.RBRACKET)),
      a("reload", "再読み込み", "Reload", k(0, K.F5), k(GUI, K.R)),
      a("find", "ページ内検索", "Find", k(CTRL, K.F), k(GUI, K.F)),
    ],
  },
  {
    key: "catWindow",
    actions: [
      a("taskView", "タスクビュー / Mission Control", "Task view / Mission Control", k(GUI, K.TAB), k(CTRL, K.UP)),
      a("showDesktop", "デスクトップを表示", "Show desktop", k(GUI, K.D), k(0, K.F11)),
      a("desktopLeft", "左のデスクトップ", "Desktop left", k(CTRL | GUI, K.LEFT), k(CTRL, K.LEFT)),
      a("desktopRight", "右のデスクトップ", "Desktop right", k(CTRL | GUI, K.RIGHT), k(CTRL, K.RIGHT)),
      a("switchApp", "アプリを切り替え", "Switch app", k(ALT, K.TAB), k(GUI, K.TAB)),
      a("closeWindow", "ウィンドウを閉じる", "Close window", k(ALT, K.F4), k(GUI, K.W)),
    ],
  },
  {
    key: "catEdit",
    actions: [
      a("copy", "コピー", "Copy", k(CTRL, K.C), k(GUI, K.C)),
      a("paste", "貼り付け", "Paste", k(CTRL, K.V), k(GUI, K.V)),
      a("cut", "切り取り", "Cut", k(CTRL, K.X), k(GUI, K.X)),
      a("undo", "元に戻す", "Undo", k(CTRL, K.Z), k(GUI, K.Z)),
      a("redo", "やり直し", "Redo", k(CTRL, K.Y), k(GUI | SHIFT, K.Z)),
      a("selectAll", "すべて選択", "Select all", k(CTRL, K.A), k(GUI, K.A)),
      a("save", "保存", "Save", k(CTRL, K.S), k(GUI, K.S)),
      a("delete", "削除", "Delete", k(0, K.DEL)),
    ],
  },
  {
    key: "catMove",
    actions: [
      a("docTop", "先頭へ", "Top of document", k(CTRL, K.HOME), k(GUI, K.UP)),
      a("docEnd", "末尾へ", "End of document", k(CTRL, K.END), k(GUI, K.DOWN)),
      a("pageUp", "1画面上へ", "Page up", k(0, K.PGUP)),
      a("pageDown", "1画面下へ", "Page down", k(0, K.PGDN)),
      a("lineStart", "行頭へ", "Start of line", k(0, K.HOME)),
      a("lineEnd", "行末へ", "End of line", k(0, K.END)),
      a("escape", "Esc", "Escape", k(0, K.ESC)),
      a("enter", "Enter", "Enter", k(0, K.ENTER)),
    ],
  },
  {
    key: "catMedia",
    actions: [
      a("playPause", "再生 / 一時停止", "Play / pause", c(0xcd)),
      a("nextTrack", "次の曲", "Next track", c(0xb5)),
      a("prevTrack", "前の曲", "Previous track", c(0xb6)),
      a("volUp", "音量を上げる", "Volume up", c(0xe9)),
      a("volDown", "音量を下げる", "Volume down", c(0xea)),
      a("mute", "ミュート", "Mute", c(0xe2)),
    ],
  },
];

const ALL = CATEGORIES.flatMap((cat) => cat.actions);

export function keycodeFor(action: NamedAction, os: Os): number {
  return os === "mac" ? (action.mac ?? action.win) : action.win;
}

/**
 * The catalogue entry a keycode corresponds to, if any.
 *
 * Both platforms are searched rather than only the selected one: a value set
 * while the switch said Windows should still read as "copy" after switching to
 * macOS, instead of falling back to a bare key combination.
 */
export function findAction(keycode: number): NamedAction | undefined {
  return ALL.find((x) => x.win === keycode || x.mac === keycode);
}
