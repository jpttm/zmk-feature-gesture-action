import { useEffect, useState } from "react";
import { useLang } from "./i18n";

/**
 * The page is useless without matching firmware, and nothing on screen used to
 * say so. This is the panel that answers "I just found this link, now what?".
 *
 * Ordered for the wider audience first: any DYA-compatible keyboard can
 * integrate the module, and the CLine46 downloads are one clearly-bounded
 * section a non-CLine46 reader can skip whole. CLine46 facts (layer numbers,
 * bundle contents) stay inside that section so nothing outside it needs a
 * "CLine46 では" disclaimer.
 *
 * Written as two hand-authored language variants rather than a pile of i18n
 * keys: it is long-form prose with links and lists, and keeping each language
 * readable as a whole is worth more here than sharing the markup.
 */

/* One place to bump, so the four files cannot drift apart in name or date.
 * "jpttm" in the name marks whose build this is - it keeps these apart from
 * takamaru's official CLine46_R.uf2 in a download folder, and a support
 * conversation can start from the filename alone. */
const FW_VERSION = "jpttm-20260822";
const FW_R_NAME = `CLine46_R-${FW_VERSION}.uf2`;
const FW_L_NAME = `CLine46_L-${FW_VERSION}.uf2`;
const FW_R = import.meta.env.BASE_URL + "firmware/" + FW_R_NAME;
const FW_L = import.meta.env.BASE_URL + "firmware/" + FW_L_NAME;
/* Same bundle minus scroll inertia, for anyone who prefers scrolling to stop
 * when the ball does. Named by what is absent, so the file explains itself. */
const FW_NI_VERSION = "jpttm-no-inertia-20260822";
const FW_R_NI = import.meta.env.BASE_URL + `firmware/CLine46_R-${FW_NI_VERSION}.uf2`;
const FW_L_NI = import.meta.env.BASE_URL + `firmware/CLine46_L-${FW_NI_VERSION}.uf2`;
/* The beginner-facing setup guide: flashing, DYA Studio, what the bundle
 * holds. Japanese only, like nearly all of this keyboard's users. */
const GUIDE_URL = import.meta.env.BASE_URL + "guide/";

const REPO = "https://github.com/jpttm/zmk-feature-gesture-action";

export function GettingStarted() {
  const { lang } = useLang();
  /* The guide page links here as /#download: a search visitor reading the
   * flashing steps needs the files, and they live inside this panel. The
   * hash opens the panel and lands them on the download cards, instead of
   * leaving them in front of a closed summary line. */
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#download",
  );
  useEffect(() => {
    if (window.location.hash === "#download") {
      // Wait a frame so the freshly opened panel has laid out.
      requestAnimationFrame(() =>
        document.getElementById("download")?.scrollIntoView({ block: "start" }),
      );
    }
  }, []);
  return (
    <details
      className="guide"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{lang === "ja" ? "初めての方へ" : "Start here"}</summary>
      <div className="guideBody">{lang === "ja" ? <Ja /> : <En />}</div>
    </details>
  );
}

/**
 * Both halves, equally weighted. Only the right half actually changed, but the
 * upstream repo still publishes an older release alongside the newer branch
 * build, so "the left one is fine as-is" is only true for some readers and
 * makes them work out which they have. Flashing both is one instruction that
 * is right for everyone.
 */
function Downloads({ lang }: { lang: "ja" | "en" }) {
  return (
    <div className="downloads" id="download">
      <a className="dl primary" href={FW_R} download>
        <strong>{lang === "ja" ? "右側" : "Right half"}</strong>
        <span>{FW_R_NAME}</span>
      </a>
      <a className="dl primary" href={FW_L} download>
        <strong>{lang === "ja" ? "左側" : "Left half"}</strong>
        <span>{FW_L_NAME}</span>
      </a>
    </div>
  );
}

function Ja() {
  return (
    <>
      <h3>対応ファームウェアが必要です</h3>
      <p>
        このページで設定できるのは、ジェスチャー機能（gesture-action モジュール）を
        組み込んだファームウェアを書き込んだキーボードです。お使いのキーボードに
        合わせて、次のどちらかをご覧ください。
      </p>

      <h3>お使いのキーボードに組み込む — 自作・その他のキーボードの方</h3>
      <p>
        cormoran さんの <strong>DYA Studio が動くファームウェア構成</strong>
        （カスタム RPC 対応の ZMK）で、トラックボールなどのポインティングデバイスが
        あるキーボードなら、モジュールを組み込むだけでこのページがそのまま使えます。
        グループ数・スロット名・レイヤーは<strong>キーボード側から読み取る</strong>ので、
        ページの改造は要りません。
      </p>
      <p>
        組み込みは<strong>プリセット同梱で、overlay に書くのは実質3行</strong>です
        — プリセットの include、リスナーへの接続、予約レイヤーの指定だけ。
        6グループ分の認識設定・24スロット・初期割り当てまで全部入りで、
        書き込んだ直後から動きます。
      </p>
      <pre className="code-sample">{`#include <presets/gesture_six_groups.dtsi>

&トラックボールのリスナー {
    input-processors = <既存のプロセッサ...>, <KOROKORO_GESTURES>;
};

&gesture_action { reserved-layers = <0 1 2>; };`}</pre>
      <p>
        このほかに必要なのは、ジェスチャー用のレイヤー（と、そこへ入るキー）を
        keymap に用意することだけです。レイヤー番号や感度（CPI 比例）は、include
        の前の <code>#define</code> 1行で合わせられます。
      </p>
      <p>
        コピーして使える west.yml、レイヤーの足し方、感度の変え方、メモリ消費の実測値は{" "}
        <a href={`${REPO}/blob/main/README.md`} target="_blank" rel="noreferrer">
          モジュールの README（日本語）
        </a>
        にまとめてあります。モジュールは MIT ライセンスです。
      </p>
      <p className="muted small">
        組み込んで動いた方は、ぜひ動作報告をください。CLine46 以外での実例を
        お待ちしています。
      </p>

      <h3>CLine46 の方はこちら — 書き込むだけで使えます</h3>
      <p>
        ビルド不要の非公式ファームウェアを用意しています。2026年8月18日時点の
        CLine46 最新ファームウェアに、ジェスチャー機能などを追加したものです。
      </p>
      <p className="muted small">
        <strong>2026年8月22日 更新:</strong> ころころKit で変更した割り当てや
        グループのレイヤーが、電源を入れ直すと初期値に戻ってしまう不具合を修正
        しました。8月18日版をお使いの方は書き換えをおすすめします（キーマップなど
        保存済みの設定はそのまま残ります）。
      </p>
      <Downloads lang="ja" />
      <p className="muted small">
        <strong>左右の両方を書き込んでください。</strong>
        変更を加えたのは右側だけですが、左側はお使いの版によって組み合わせが変わります。
        両方を書き込んでいただくのが確実です。
      </p>
      <p className="muted small">
        標準版にはフリック後にスクロールが滑る「慣性スクロール」が入っています。
        慣性なしがいい場合はこちらをどうぞ（
        <a href={FW_R_NI} download>右側</a> / <a href={FW_L_NI} download>左側</a>
        ）。それ以外の中身は同一です。
      </p>

      <h4>設定の手順（CLine46）</h4>
      <ol>
        <li>
          左右の両方にファームウェアを書き込みます（Reset スイッチのダブルクリックで
          USB ストレージとして認識させ、.uf2 をコピー。
          <a href={GUIDE_URL}>詳しい手順はセットアップガイドへ</a>）
        </li>
        <li>
          このページでキーボードに接続し、おすすめ設定を選んで書き込みます。
          レイヤー7・8・9・10 にジェスチャーが割り当てられます
        </li>
        <li>
          <strong>DYA Studio</strong> で、レイヤー7〜10 へ移動するキーを設定します
        </li>
      </ol>
      <p>
        これで完了です。レイヤー移動キーを押しながらトラックボールを上下左右に動かすと、
        ジェスチャーが発動します。あとはこのページでお好みの動作に変更してお使いください。
      </p>

      <h4>おすすめのキー設定</h4>
      <p>
        キーに余裕がない場合は<strong>レイヤータップ</strong>が便利です。DYA Studio で
        <code>&amp;lt 7 A</code> のように設定すると、<strong>短押しで通常のキー入力、
        長押しでジェスチャーのレイヤー</strong>になります。1つのキーを二役で使えるので、
        既存の配列を崩さずに済みます。
      </p>
      <p className="muted small">
        レイヤータップは押してから切り替わるまでに少しだけ間があります。押してすぐ
        回すと最初の動きを拾えないことがあるので、一拍おいてから回してください。
        空きキーがあるなら <code>&amp;mo 7</code>（押している間だけレイヤー7）でも
        構いません。こちらは待ちがありません。
      </p>

      <p>
        この CLine46 用ファームウェアには、慣性スクロール・JIS/US 配列切り替え・
        スクロール調整などジェスチャー以外の機能も同梱しています。
        <a href={`${GUIDE_URL}#modules`}>それぞれの説明と使い方はセットアップガイドへ</a>。
      </p>

      <h3>このページでできること</h3>
      <ul>
        <li>ジェスチャーごとの動作を、ブラウザから数秒で変更（USB / Bluetooth、再ビルド不要）</li>
        <li>ジェスチャーのグループを、どのレイヤーで効かせるかチェックボックスで変更</li>
        <li>OS に合わせたおすすめ初期設定の一括適用</li>
      </ul>
      <p className="muted small">
        グループの数・スロットの名前・選べるレイヤーの範囲は、接続したキーボードの
        ファームウェアが決めます。ジェスチャーを効かせたレイヤーでは、トラックボールを
        動かしてもカーソルは移動しません（ジェスチャーを描くたびにカーソルが飛ばない
        ようにするためです）。
      </p>

      <h3>よくある質問</h3>

      <h4>Bluetooth でつながらない</h4>
      <p>
        <strong>USB ケーブルを抜いてから接続してください。</strong>
        ZMK は設定用の通信を「キー入力の出力先」と同じ経路にしか返しません。USB が
        繋がっていると出力先が USB になるため、Bluetooth 側に要求を送っても応答が
        返らず、接続がタイムアウトします。
      </p>
      <p className="muted small">
        USB を挿したまま使いたい場合は、DYA Studio の接続設定で出力優先度を
        Bluetooth に切り替えてください。
      </p>

      <h4>それでもつながらない</h4>
      <p>
        DYA Studio・ZMK Studio・このツールのうち、
        <strong>同時に開けるのは1つだけ</strong>です。いったんすべて閉じてから、
        使うものだけを開いてください。それでも駄目な場合はキーボードの電源を
        入れ直してください。多くの場合これで復帰します。
      </p>

      <h4>DYA Studio で設定した内容は消えませんか</h4>
      <p>
        消えません。このツールが書き込むのはジェスチャー専用の保存領域で、
        キーマップやマクロとは別に管理されています。おすすめ設定を書き込んでも、
        DYA Studio で設定したキー配置・マクロ・トラックボールの設定はそのまま残ります。
      </p>
      <p className="muted small">
        ただし、設定の全消去用ファームウェア（settings reset）を書き込んだ場合は
        例外で、キーボードの保存内容がすべて消えます。
      </p>

      <h4>すべてのレイヤーでジェスチャーを使いたい</h4>
      <p>
        ジェスチャーを効かせたレイヤーではマウスカーソルが動かなくなるため、
        通常操作用のレイヤーは選択肢から外れるようになっています。どのレイヤーが
        予約されるかは<strong>キーボードのファームウェアが決めます</strong>
        （上記の CLine46 用ファームウェアでは 0〜3 を予約し、4〜10 が選べます）。
      </p>

      <h4>流用・改変について</h4>
      <p>
        広くお使いいただけると嬉しいので、私が作成した部分は自由にご利用ください。
        設定ツールや配布ファームウェアへの活用も歓迎します（MIT ライセンス）。
      </p>
    </>
  );
}

function En() {
  return (
    <>
      <h3>You need the matching firmware</h3>
      <p>
        This page configures keyboards whose firmware includes the gesture-action
        module. Pick whichever of the two sections below matches your keyboard.
      </p>

      <h3>Integrate it into your keyboard — any DYA-compatible build</h3>
      <p>
        On a keyboard running cormoran's <strong>DYA-Studio-compatible firmware
        stack</strong> (the custom-RPC ZMK fork) with a trackball or other pointing
        device, integrating the module is all it takes — this page then works as-is.
        Groups, slot names and layers are <strong>read from the device</strong>, so
        nothing here needs modifying.
      </p>
      <p>
        Integration ships as a preset — <strong>the overlay needs essentially three
        lines</strong>: include the preset, splice it into your listener, name your
        reserved layers. Six gesture groups, 24 slots and default assignments are
        all included, working right after flashing.
      </p>
      <pre className="code-sample">{`#include <presets/gesture_six_groups.dtsi>

&your_pointer_listener {
    input-processors = <...existing...>, <KOROKORO_GESTURES>;
};

&gesture_action { reserved-layers = <0 1 2>; };`}</pre>
      <p>
        Beyond that you only need a gesture layer in the keymap (and a key that
        reaches it). Layer numbers and sensitivity (CPI-proportional) adjust with
        one <code>#define</code> before the include.
      </p>
      <p>
        A copy-paste west.yml, adding layers, sensitivity overrides and measured
        memory cost are in{" "}
        <a href={`${REPO}/blob/main/README.en.md`} target="_blank" rel="noreferrer">
          the module README
        </a>
        . The module is MIT licensed.
      </p>
      <p className="muted small">
        If you get it running, please report back — examples beyond the CLine46 are
        exactly what this project wants to hear about.
      </p>

      <h3>On a CLine46 — flash and go</h3>
      <p>
        A no-build unofficial firmware is provided: the latest CLine46 firmware as of
        18 August 2026, with gesture support and more added.
      </p>
      <p className="muted small">
        <strong>Updated 22 August 2026:</strong> fixed a bug where assignments and
        group layers changed in korokoro Kit reverted to their defaults after a
        power cycle. If you flashed the 18 August build, please re-flash (your
        keymap and other saved settings are kept).
      </p>
      <Downloads lang="en" />
      <p className="muted small">
        <strong>Flash both halves.</strong> Only the right half changed, but which
        left-half build you already have varies, so flashing both is the reliable
        route.
      </p>
      <p className="muted small">
        The standard build includes inertial scrolling - flick and release, and the
        scroll coasts to a stop. If you would rather scrolling stop with the ball,
        take the no-inertia build (
        <a href={FW_R_NI} download>right</a> / <a href={FW_L_NI} download>left</a>
        ). Everything else is identical.
      </p>

      <h4>Setting it up (CLine46)</h4>
      <ol>
        <li>Flash both halves</li>
        <li>
          Connect on this page, pick a recommended preset and write it. Gestures land
          on layers 7, 8, 9 and 10
        </li>
        <li>
          In <strong>DYA Studio</strong>, bind keys that switch to layers 7–10
        </li>
      </ol>
      <p>
        That is all. Hold the layer key and roll the trackball up, down, left or right
        to fire a gesture. Then use this page to change what each one does.
      </p>

      <h4>Which key to use</h4>
      <p>
        If you have no spare keys, a <strong>layer tap</strong> works well. Setting{" "}
        <code>&amp;lt 7 A</code> in DYA Studio gives you{" "}
        <strong>the normal key on a short press and the gesture layer on a long
        press</strong>, so an existing key does double duty and your layout stays
        intact.
      </p>
      <p className="muted small">
        A layer tap takes a moment to engage, so rolling the ball the instant you press
        can lose the start of the stroke. Press, pause for a beat, then roll. With a
        spare key, <code>&amp;mo 7</code> (layer 7 while held) works too and has no such
        delay.
      </p>

      <p>
        The CLine46 bundle also carries features beyond gestures — inertial scrolling,
        JIS/US layout switching, scroll tuning. The setup guide (Japanese) covers each.
      </p>

      <h3>What this page does</h3>
      <ul>
        <li>Change what each gesture does, from the browser, in seconds (USB / Bluetooth, no rebuild)</li>
        <li>Move a gesture group between layers with checkboxes</li>
        <li>Apply a recommended preset for your OS in one go</li>
      </ul>
      <p className="muted small">
        Group count, slot names and the selectable layer range all come from the
        connected keyboard's firmware. On a layer with gestures, rolling the trackball
        does not move the cursor — otherwise the pointer would fly across the screen
        every time you drew a gesture.
      </p>

      <h3>FAQ</h3>

      <h4>It will not connect over Bluetooth</h4>
      <p>
        <strong>Unplug the USB cable first.</strong> ZMK answers configuration
        requests only on whichever transport it is currently sending keystrokes to.
        With USB connected that is USB, so writes to the Bluetooth characteristic get
        no reply and the connection times out.
      </p>
      <p className="muted small">
        To keep USB plugged in, switch the output priority to Bluetooth in DYA
        Studio's connection settings.
      </p>

      <h4>It still will not connect</h4>
      <p>
        Only <strong>one</strong> of DYA Studio, ZMK Studio and this page can be
        connected at a time. Close all of them, then open just the one you want. If it
        still fails, power-cycle the keyboard. That clears it in most cases.
      </p>

      <h4>Will this overwrite what I set in DYA Studio?</h4>
      <p>
        No. Gesture assignments live in their own settings namespace, separate from
        the keymap and macros. Writing a preset here leaves your key layout, macros
        and trackball settings untouched.
      </p>
      <p className="muted small">
        The one exception is a settings-reset firmware, which erases everything
        stored on the keyboard.
      </p>

      <h4>Can I put gestures on every layer?</h4>
      <p>
        A layer with gestures loses cursor movement, so layers meant for ordinary use
        are kept out of the picker. <strong>Which layers are reserved is the
        firmware's decision</strong> — the CLine46 bundle above reserves 0–3 and
        offers 4–10.
      </p>

      <h4>Reuse and modification</h4>
      <p>
        Please do. Everything I wrote is MIT licensed, and I would be glad to see it in
        other configuration tools or firmware distributions.
      </p>
    </>
  );
}
