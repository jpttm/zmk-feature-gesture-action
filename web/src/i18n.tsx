import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "ja" | "en";

const STORAGE_KEY = "zmk-gesture-action.lang";

/**
 * Japanese first: this exists because the people testing it read Japanese, and
 * an English-only page made them guess at what each control did.
 */
export const DEFAULT_LANG: Lang = "ja";

type Entry = { ja: string; en: string };

export const STRINGS = {
  title: { ja: "ZMK ジェスチャーアクション", en: "ZMK Gesture Action" },
  lede: {
    ja: "キーボードに接続して、ジェスチャーごとの動作を設定します。",
    en: "Connect a keyboard and set what each gesture does.",
  },

  transportSupport: { ja: "接続方式の対応状況", en: "Transport support" },
  webSerial: { ja: "USB（Web Serial）", en: "Web Serial (USB)" },
  webBluetooth: { ja: "Bluetooth（Web Bluetooth）", en: "Web Bluetooth" },
  yes: { ja: "対応", en: "yes" },
  no: { ja: "非対応", en: "no" },
  noTransport: {
    ja: "このブラウザはどちらにも対応していません。Chrome か Edge を HTTPS で開くか、iOS では Bluefy をお使いください。",
    en: "This browser exposes neither transport. Use a Chromium-based browser (Chrome or Edge) over HTTPS, or Bluefy on iOS.",
  },

  connection: { ja: "接続", en: "Connection" },
  disconnect: { ja: "切断", en: "Disconnect" },
  connectUsb: { ja: "USB で接続", en: "Connect over USB" },
  connectBle: { ja: "Bluetooth で接続", en: "Connect over Bluetooth" },
  connecting: { ja: "接続中…", en: "Connecting…" },

  device: { ja: "デバイス", en: "Device" },
  deviceName: { ja: "名前", en: "Name" },
  serial: { ja: "シリアル", en: "Serial" },

  subsystems: { ja: "カスタムサブシステム", en: "Custom subsystems" },
  noSubsystems: {
    ja: "ありません。接続はできていますが、カスタム RPC を持たないファームウェアです。",
    en: "None reported. The firmware is reachable but exposes no custom RPC subsystems.",
  },
  index: { ja: "番号", en: "Index" },
  identifier: { ja: "識別子", en: "Identifier" },

  gestureActions: { ja: "ジェスチャーの動作", en: "Gesture actions" },
  notSupported: {
    ja: "このキーボードは gesture-action に対応していません。対応ファームウェアを書き込んでください。",
    en: "This keyboard does not expose the gesture-action subsystem. Flash firmware built with the module to configure it here.",
  },
  loadingBehaviors: {
    ja: "キーボードからビヘイビア一覧を読み込んでいます…",
    en: "Loading the behaviour list from the keyboard…",
  },
  namesFallback: {
    ja: "スロット名を読み取れなかったため番号で表示しています",
    en: "Showing slot numbers — could not read slot names",
  },

  slot: { ja: "スロット", en: "Slot" },
  assignment: { ja: "割り当て", en: "Assignment" },
  fromFirmware: { ja: "既定値（ファームウェア）", en: "default (from firmware)" },
  edit: { ja: "編集", en: "Edit" },
  cancel: { ja: "キャンセル", en: "Cancel" },
  reload: { ja: "再読み込み", en: "Reload" },

  behaviour: { ja: "ビヘイビア", en: "Behaviour" },
  useFirmwareDefault: {
    ja: "— ファームウェアの既定値を使う —",
    en: "— use the firmware default —",
  },
  keyLabel: { ja: "キー", en: "Key" },
  pickKey: { ja: "— キーを選択 —", en: "— pick a key —" },
  sends: { ja: "送信する内容:", en: "Sends" },
  sendsHint: {
    ja: "一覧に無いキーは下の「生のパラメータ」から入力できます。",
    en: "Anything missing from the list can be entered as a raw value below.",
  },
  rawParameters: { ja: "生のパラメータ", en: "Raw parameters" },

  save: { ja: "保存", en: "Save" },
  tryWithoutSaving: { ja: "保存せず試す", en: "Try without saving" },
  tryTitle: {
    ja: "フラッシュに書かずに適用します。再起動すると元に戻ります。",
    en: "Apply without writing to flash — lost on reboot",
  },
  resetToDefault: { ja: "既定値に戻す", en: "Reset to default" },

  noResponse: { ja: "応答がありません", en: "no response" },
  oldFirmware: {
    ja: "このファームウェアはスロット名に未対応です",
    en: "this firmware predates slot names",
  },

  presets: { ja: "おすすめ設定", en: "Presets" },
  presetsHint: {
    ja: "OS に合わせた一括設定です。適用前に内容を確認できます。",
    en: "Bulk settings for your OS. You can review them before applying.",
  },
  presetPreview: { ja: "適用される内容", en: "What will be applied" },
  colLayer: { ja: "レイヤー", en: "Layer" },
  colUp: { ja: "上", en: "Up" },
  colDown: { ja: "下", en: "Down" },
  colLeft: { ja: "左", en: "Left" },
  colRight: { ja: "右", en: "Right" },
  groupLabel: { ja: "グループ", en: "Group" },
  presetApply: { ja: "この内容で一括設定", en: "Apply these" },
  presetCancel: { ja: "やめる", en: "Cancel" },
  presetApplying: { ja: "設定中…", en: "Applying…" },
  presetOverwrite: {
    ja: "現在の割り当ては上書きされます。",
    en: "This overwrites the current assignments.",
  },
  presetMismatch: {
    ja: "このプリセットはスロット16個の構成向けです。お使いのキーボードでは意図しない割り当てになる可能性があります。内容をよく確認してください。",
    en: "This preset targets a 16-slot layout. On this keyboard it may land somewhere unintended — check the list carefully.",
  },
  presetNoKeyPress: {
    ja: "キーボードから Key Press ビヘイビアが見つかりません。",
    en: "The keyboard does not report a Key Press behaviour.",
  },
  groupTab: { ja: "グループ", en: "Group" },
  appliesTo: { ja: "適用先レイヤー", en: "Applies to layers" },
  appliesToHint: {
    ja: "このグループのジェスチャーが効くレイヤーを選びます。複数選択できます。",
    en: "Which layers this group's gestures respond on. Several can be selected.",
  },
  layerWord: { ja: "レイヤー", en: "Layer" },
  unassigned: { ja: "未割り当て", en: "not assigned" },
  saveLayers: { ja: "適用先を保存", en: "Save layers" },
  groupsUnsupported: {
    ja: "このファームウェアはレイヤー割り当ての変更に未対応です。",
    en: "This firmware does not support changing layer assignment.",
  },
  source: { ja: "ソース", en: "Source" },
  builtOn: { ja: "使用ライブラリ:", en: "built on" },

  keysEditing: { ja: "編集", en: "Editing" },
  keysNavigation: { ja: "移動", en: "Navigation" },
  keysLetters: { ja: "英字", en: "Letters" },
  keysNumbers: { ja: "数字", en: "Numbers" },
  keysSymbols: { ja: "記号", en: "Symbols" },
  keysFunction: { ja: "ファンクション", en: "Function" },
  keysMedia: { ja: "メディア", en: "Media" },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "ja" ? stored : DEFAULT_LANG;
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((key: StringKey) => STRINGS[key][lang], [lang]);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="langToggle" role="group" aria-label="Language">
      <button
        className={lang === "ja" ? "lang on" : "lang"}
        onClick={() => setLang("ja")}
      >
        日本語
      </button>
      <button
        className={lang === "en" ? "lang on" : "lang"}
        onClick={() => setLang("en")}
      >
        English
      </button>
    </div>
  );
}
