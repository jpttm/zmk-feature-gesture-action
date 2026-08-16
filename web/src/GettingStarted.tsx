import { useLang } from "./i18n";

/**
 * The page is useless without matching firmware, and nothing on screen used to
 * say so. This is the panel that answers "I just found this link, now what?".
 *
 * Written as two hand-authored language variants rather than a pile of i18n
 * keys: it is long-form prose with links and lists, and keeping each language
 * readable as a whole is worth more here than sharing the markup.
 */

const FW_R = import.meta.env.BASE_URL + "firmware/CLine46_R-gesture-20260816.uf2";
const FW_L = import.meta.env.BASE_URL + "firmware/CLine46_L-20260816.uf2";

const BEHAVIORS_DOC = "https://zmk.dev/docs/keymaps/behaviors";

export function GettingStarted() {
  const { lang } = useLang();
  return (
    <details className="guide">
      <summary>{lang === "ja" ? "初めての方へ" : "Start here"}</summary>
      <div className="guideBody">{lang === "ja" ? <Ja /> : <En />}</div>
    </details>
  );
}

function Downloads({ lang }: { lang: "ja" | "en" }) {
  return (
    <div className="downloads">
      <a className="dl primary" href={FW_R} download>
        <strong>CLine46_R.uf2</strong>
        <span>{lang === "ja" ? "右側 — 更新が必要です" : "Right half — required"}</span>
      </a>
      <a className="dl" href={FW_L} download>
        <strong>CLine46_L.uf2</strong>
        <span>{lang === "ja" ? "左側 — 更新は不要です" : "Left half — not required"}</span>
      </a>
    </div>
  );
}

function Ja() {
  return (
    <>
      <h3>専用ファームウェアが必要です</h3>
      <p>
        このページで設定するには、ジェスチャー機能を組み込んだファームウェアが必要です。
        CLine46 をお使いの方は下記をご利用ください。2026年8月16日時点の CLine46 最新
        ファームウェアに、ジェスチャー機能を追加したものです。
      </p>
      <Downloads lang="ja" />
      <p className="muted small">
        変更は右側のみです。左側は手を加えていないため、更新の必要はありません
        （念のため対になるものも置いてあります）。
      </p>

      <h3>設定の手順</h3>
      <ol>
        <li>右側にファームウェアを書き込みます</li>
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

      <h3>このファームウェアの変更点</h3>
      <ul>
        <li>ジェスチャー機能の組み込み</li>
        <li>レイヤー数を11個（0〜10）に拡張</li>
        <li>ジェスチャー判定の調整による誤爆の低減</li>
        <li>スクロール量と軸スナップを DYA Studio から調整可能に</li>
        <li>Runtime Macro をキーに割り当て可能に</li>
      </ul>
      <p>
        判定を詰めた結果、誤爆が少なく狙ったとおりに発動するようになりました。
        実用に耐える精度になっているかと思います。
      </p>

      <h3>できること</h3>
      <p>
        現状は CLine46 に特化しています。初期状態ではレイヤー7〜10 に16個の
        ジェスチャーを設定し、レイヤー4〜10 の中から<strong>最大6つのレイヤー・
        合計24個</strong>まで拡張できます。
      </p>
      <p>
        ジェスチャーを設定したレイヤーでは、
        <strong>トラックボールを動かしてもマウスカーソルは移動しません。</strong>
        これがないと、ジェスチャーを描くたびにカーソルが飛んでしまうためです。
      </p>

      <h3>よくある質問</h3>

      <h4>つながらない</h4>
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
        ジェスチャーを設定したレイヤーではマウスカーソルが動かなくなるため、
        レイヤー4〜10 のみに設定できるようにしています。レイヤー0〜3 は通常の
        カーソル操作とスクロールのために残しています。
      </p>

      <h4>ZMK の記法について</h4>
      <p>
        動作を直接入力する欄では ZMK の記法が使えます。
        <a href={BEHAVIORS_DOC} target="_blank" rel="noreferrer">
          ZMK 公式ドキュメント
        </a>
        が参考になります。
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
        This page can only configure a keyboard running firmware that includes the
        gesture feature. For CLine46, use the build below: the latest CLine46
        firmware as of 16 August 2026, with gesture support added.
      </p>
      <Downloads lang="en" />
      <p className="muted small">
        Only the right half changed. The left half is untouched and does not need
        flashing; the matching file is provided for completeness.
      </p>

      <h3>Setting it up</h3>
      <ol>
        <li>Flash the right half</li>
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

      <h3>What this firmware changes</h3>
      <ul>
        <li>Gesture support</li>
        <li>Layer count raised to 11 (0–10)</li>
        <li>Tuned gesture recognition, so misfires are rare</li>
        <li>Scroll speed and axis snap adjustable from DYA Studio</li>
        <li>Runtime Macros assignable to keys</li>
      </ul>

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

      <h4>It will not connect</h4>
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
        A layer with gestures loses cursor movement, so only layers 4–10 are offered.
        Layers 0–3 stay free for normal pointing and scrolling.
      </p>

      <h4>ZMK notation</h4>
      <p>
        The advanced input field accepts ZMK behaviour notation. The{" "}
        <a href={BEHAVIORS_DOC} target="_blank" rel="noreferrer">
          ZMK documentation
        </a>{" "}
        is the reference.
      </p>

      <h4>Reuse and modification</h4>
      <p>
        Please do. Everything I wrote is MIT licensed, and I would be glad to see it in
        other configuration tools or firmware distributions.
      </p>
    </>
  );
}
