import { useLang } from "./i18n";

/**
 * Almost none of this is my work. The page had one library link in the footer,
 * which badly understated what it is standing on — the custom RPC mechanism
 * this module plugs into, the browser transport, and the gesture recognition
 * itself are all other people's.
 *
 * Named with what each actually contributed, rather than a bare list of repos,
 * so the credit means something to a reader who does not know the ecosystem.
 */

type Credit = {
  who: string;
  href: string;
  ja: string;
  en: string;
};

const CREDITS: Credit[] = [
  {
    who: "ZMK",
    href: "https://zmk.dev/",
    ja: "キーボードファームウェア本体",
    en: "the keyboard firmware itself",
  },
  {
    who: "cormoran",
    href: "https://github.com/cormoran",
    ja: "DYA Studio、設定用 RPC の仕組み、ブラウザ接続ライブラリ",
    en: "DYA Studio, the custom RPC mechanism, the browser transport",
  },
  {
    who: "kot149",
    href: "https://github.com/kot149/zmk-mouse-gesture",
    ja: "ジェスチャー認識（zmk-mouse-gesture）と配列切り替え（zmk-layout-shift）",
    en: "gesture recognition (zmk-mouse-gesture) and layout switching (zmk-layout-shift)",
  },
  {
    who: "takamaru",
    href: "https://github.com/takamaru-fpv/zmk_config_CLine46",
    ja: "CLine46 本体とそのファームウェア",
    en: "the CLine46 and its firmware",
  },
  {
    who: "mjmjm0101",
    href: "https://github.com/mjmjm0101/zmk-input-processor-scroll-inertia",
    ja: "慣性スクロール（zmk-input-processor-scroll-inertia）",
    en: "inertial scrolling (zmk-input-processor-scroll-inertia)",
  },
  {
    who: "badjeff",
    href: "https://github.com/badjeff/zmk-pmw3610-driver",
    ja: "PMW3610 トラックボールドライバ",
    en: "the PMW3610 trackball driver",
  },
];

export function Credits() {
  const { lang } = useLang();
  return (
    <div className="credits">
      <p className="creditsLede">
        {lang === "ja"
          ? "このツールは、次の方々の成果の上に成り立っています。"
          : "This tool stands on work by:"}
      </p>
      <ul>
        {CREDITS.map((c) => (
          <li key={c.who}>
            <a href={c.href} target="_blank" rel="noreferrer">
              {c.who}
            </a>
            <span className="creditWhat">{lang === "ja" ? c.ja : c.en}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
