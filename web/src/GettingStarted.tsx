import { useLang } from "./i18n";

/**
 * The page is useless without matching firmware, and nothing on screen used to
 * say so. This is the panel that answers "I just found this link, now what?".
 *
 * Written as two hand-authored language variants rather than a pile of i18n
 * keys: it is long-form prose with links and lists, and keeping each language
 * readable as a whole is worth more here than sharing the markup.
 */

/* One place to bump, so the two halves cannot drift apart in name or date. */
const FW_VERSION = "20260818b";
const FW_R_NAME = `CLine46_R-${FW_VERSION}.uf2`;
const FW_L_NAME = `CLine46_L-${FW_VERSION}.uf2`;
const FW_R = import.meta.env.BASE_URL + "firmware/" + FW_R_NAME;
const FW_L = import.meta.env.BASE_URL + "firmware/" + FW_L_NAME;

export function GettingStarted() {
  const { lang } = useLang();
  return (
    <details className="guide">
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
    <div className="downloads">
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
        組み込んだファームウェアを書き込んだキーボードです。
      </p>
      <p>
        <strong>CLine46 をお使いの方</strong>は下記をご利用ください。2026年8月18日時点の
        CLine46 最新ファームウェアに、ジェスチャー機能などを追加したものです。
      </p>
      <Downloads lang="ja" />
      <p className="muted small">
        <strong>左右の両方を書き込んでください。</strong>
        変更を加えたのは右側だけですが、左側はお使いの版によって組み合わせが変わります。
        両方を書き込んでいただくのが確実です。
      </p>
      <p className="muted small">
        <strong>CLine46 以外のキーボードの方へ:</strong> ファームウェアに対応モジュールを
        組み込めば、このページはそのまま使えます（表示されるグループやレイヤーは
        キーボード側から読み取ります）。組み込み方は{" "}
        <a href="https://github.com/jpttm/zmk-feature-gesture-action/blob/main/README.md" target="_blank" rel="noreferrer">
          モジュールの README
        </a>
        をご覧ください。
      </p>

      <h3>設定の手順</h3>
      <ol>
        <li>左右の両方にファームウェアを書き込みます</li>
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

      <h3>CLine46 用ファームウェアに入っているもの</h3>
      <p>
        上のファームウェアは「書き込むだけで便利機能が揃う」ことを目指した
        CLine46 用の詰め合わせです。中身は2種類に分かれます。
      </p>
      <h4>ジェスチャー機能 — このページで設定するもの</h4>
      <ul>
        <li>トラックボールジェスチャーの組み込み（判定を実機で調整済みで、誤爆は稀です）</li>
        <li>レイヤー数を11個（0〜10）に拡張し、7〜10 を GESTURE1〜4 と命名</li>
      </ul>
      <h4>その他の同梱機能 — ジェスチャーとは独立した CLine46 向けの改善</h4>
      <ul>
        <li>スクロール量と軸スナップを DYA Studio から調整可能に</li>
        <li>Runtime Macro をキーに割り当て可能に</li>
        <li>設定ツール接続中の Bluetooth 応答を改善（3110 さんの知見）</li>
        <li>JIS/US 配列の実行時切り替え（kot149 さんの zmk-layout-shift。Toggle Layout Shift をキーやジェスチャーに割り当てて使用）</li>
      </ul>
      <p className="muted small">
        他のキーボードでこのページを使う場合に必要なのは、ジェスチャー機能
        （gesture-action モジュール）だけです。「その他の同梱機能」はこのツールの
        動作条件ではありません。
      </p>

      <h3>できること</h3>
      <p>
        上記の CLine46 用ファームウェアでは、初期状態でレイヤー7〜10 に16個の
        ジェスチャーを設定し、レイヤー4〜10 の中から<strong>最大6つのレイヤー・
        合計24個</strong>まで拡張できます（グループ数・レイヤー範囲はファームウェア側の
        設定で、他のキーボードでは異なります）。
      </p>
      <p>
        ジェスチャーを設定したレイヤーでは、
        <strong>トラックボールを動かしてもマウスカーソルは移動しません。</strong>
        これがないと、ジェスチャーを描くたびにカーソルが飛んでしまうためです。
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
        ただし <code>settings_reset.uf2</code> を書き込んだ場合は例外で、
        こちらはキーボードの保存内容をすべて消去します。
      </p>

      <h4>すべてのレイヤーでジェスチャーを使いたい</h4>
      <p>
        ジェスチャーを設定したレイヤーではマウスカーソルが動かなくなります。そのため
        <strong>CLine46 では</strong>レイヤー0〜3（通常のカーソル操作とスクロール）を
        予約し、レイヤー4〜10 のみに設定できるようにしています。どのレイヤーが
        予約されるかはキーボードのファームウェアが決めるので、他のキーボードでは
        異なります。
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
        module.
      </p>
      <p>
        <strong>On a CLine46</strong>, use the build below: the latest CLine46
        firmware as of 18 August 2026, with gesture support and more added.
      </p>
      <Downloads lang="en" />
      <p className="muted small">
        <strong>Flash both halves.</strong> Only the right half changed, but which
        left-half build you already have varies, so flashing both is the reliable
        route.
      </p>
      <p className="muted small">
        <strong>On any other keyboard:</strong> integrate the module into its
        firmware and this page works as-is — groups and layers are read from the
        device. See{" "}
        <a href="https://github.com/jpttm/zmk-feature-gesture-action/blob/main/README.en.md" target="_blank" rel="noreferrer">
          the module README
        </a>
        .
      </p>

      <h3>Setting it up</h3>
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

      <h3>What the CLine46 build includes</h3>
      <p>
        The build above is a CLine46 bundle, aiming for "flash it and the good
        stuff is just there". Its contents fall in two groups.
      </p>
      <h4>The gesture feature — what this page configures</h4>
      <ul>
        <li>Trackball gestures, with recognition tuned on hardware so misfires are rare</li>
        <li>Layer count raised to 11 (0–10), with 7–10 named GESTURE1–4</li>
      </ul>
      <h4>Also bundled — CLine46 improvements independent of gestures</h4>
      <ul>
        <li>Scroll speed and axis snap adjustable from DYA Studio</li>
        <li>Runtime Macros assignable to keys</li>
        <li>Faster Bluetooth responses while a settings tool is connected (via 3110's fork)</li>
        <li>Runtime JIS/US layout switching (kot149's zmk-layout-shift; assign Toggle Layout Shift to a key or gesture)</li>
      </ul>
      <p className="muted small">
        On another keyboard, all this page needs is the gesture feature (the
        gesture-action module). The "also bundled" list is not a requirement.
      </p>

      <h3>What you get</h3>
      <p>
        This build targets the CLine46. Out of the box it places 16 gestures on layers
        7–10, and you can grow that to <strong>up to 6 layers and 24 gestures</strong>{" "}
        chosen from layers 4–10.
      </p>
      <p>
        On a layer with gestures,{" "}
        <strong>rolling the trackball does not move the cursor.</strong> Without that,
        the pointer would fly across the screen every time you drew a gesture.
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
        The one exception is <code>settings_reset.uf2</code>, which erases everything
        stored on the keyboard.
      </p>

      <h4>Can I put gestures on every layer?</h4>
      <p>
        A layer with gestures loses cursor movement. <strong>On the CLine46</strong>{" "}
        layers 0–3 stay reserved for normal pointing and scrolling, leaving 4–10 for
        gestures. The reserved set comes from the keyboard's firmware, so it differs
        on other keyboards.
      </p>

      <h4>Reuse and modification</h4>
      <p>
        Please do. Everything I wrote is MIT licensed, and I would be glad to see it in
        other configuration tools or firmware distributions.
      </p>
    </>
  );
}
