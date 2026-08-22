# ZMK Gesture Action

*[English version](README.en.md)*

ZMK キーボードのジェスチャーに割り当てる動作を、ファームウェアを作り直さずに
ブラウザから変更できるようにするモジュールです。

設定ページ: <https://korokoro.ttm.jp/>

## 何ができるか

レイヤーキーを押しながらトラックボールを上へ転がすと、新しいタブが開く。左へ
転がすと前のタブへ移動する。下へ転がすとタブが閉じる。

ここまでは
[zmk-mouse-gesture](https://github.com/kot149/zmk-mouse-gesture) だけでできます。

このモジュールが足すのは、**それぞれのジェスチャーが何をするかを、ブラウザから
数秒で変更できる**ことです。ビルド環境も、再ビルドも、書き込みも要りません。

ページを開いて、USB か Bluetooth で接続して、別のキーを選ぶ。それだけです。

## なぜ必要か

`zmk-mouse-gesture` は通常の ZMK ビヘイビアを呼び出しますが、その割り当ては
devicetree に書かれるためビルド時に固定されます。変えるには作り直しが必要です。

[ランタイムマクロ](https://github.com/cormoran/zmk-feature-runtime-macro)
に向ければ回避できますが、マクロの枠16個をジェスチャーが食い潰します。
このモジュールは、ジェスチャーに専用の保存場所を与えます。

## 仕組み

`&gesture_action N` は、別のビヘイビアの身代わりになるビヘイビアです。スロット
`N` はキーボードの設定領域に割り当て（たとえば `&kp LC(T)`）を保持していて、
実行されるとその時点でスロットに入っているものを呼び出します。

```
ジェスチャー認識  →  &gesture_action 0  →  スロット0を参照  →  &kp LC(T)
```

各スロットには devicetree で初期値を与えられるので、**書き込んだ直後、何も設定
していない状態でも動きます。** 何かを割り当てれば保存された値が優先され、
リセットすれば初期値に戻ります。

設定ページは ZMK Studio の RPC 経由でこのスロットを読み書きします。USB
（Web Serial）と Bluetooth（Web Bluetooth）の両方で動きます。

スロットは「差し替え可能なビヘイビア」でしかないので、バインディングを
取れるもの — コンボ、マクロの一手、キー位置 — なら何にでも使えます。

## 必要なもの

- **Studio を有効にした ZMK**、かつカスタム RPC サブシステムを持つビルド。
  実質的には [cormoran さんの ZMK フォークとモジュール群](https://github.com/cormoran)
  を指します。DYA Studio が乗っているものと同じです。
- **このモジュール**（スロットを提供します）
- **スロットを叩く何か。** トラックボールジェスチャーなら `zmk-mouse-gesture`、
  そうでなければバインディングを取れるものなら何でも。
- **Chromium 系ブラウザ**（Chrome / Edge）。iOS では
  [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055)。

## キーボードへの組み込み方

DYA Studio が既に動いているキーボードなら、やることは3つだけです。
（まだの場合は、先に上の「必要なもの」にある cormoran さんの ZMK フォークへの
移行が必要です。このモジュールは素の ZMK では設定ページと通信できません。）

1. west.yml にモジュールを2つ追記する
2. overlay に3行書く
3. keymap にジェスチャー用のレイヤーと、そこへ入るキーを用意する

`.conf` に書くものはありません（どちらのモジュールも組み込むだけで有効に
なります）。書き込んだら <https://korokoro.ttm.jp/> に `studio_unlock` を
押した状態で接続すれば、設定画面にジェスチャーが並びます。

### 1. モジュールを追加する

必要なのは2つです。ジェスチャーを**認識する**モジュール（kot149 さんの
zmk-mouse-gesture）と、認識されたジェスチャーの**動作を保存・差し替えする**
このモジュール。west.yml の `remotes:` と `projects:` にそれぞれ追記します。

```yaml
# config/west.yml
manifest:
  remotes:
    - name: jpttm
      url-base: https://github.com/jpttm
  projects:
    # ジェスチャー認識 (kot149 さんの zmk-mouse-gesture。レイヤーの実行時
    # 変更 (active-layers) が本家に入るまでは、それを足したフォークを指す)
    - name: zmk-mouse-gesture
      remote: jpttm
      revision: v1-active-layers
    # 認識されたジェスチャーの動作スロット (このモジュール)
    - name: zmk-feature-gesture-action
      remote: jpttm
      revision: main
```

### 2. プリセットを読み込んで、リスナーにつなぐ

overlay に次を書きます。**これで組み込みは実質完了です。**

```dts
#include <presets/gesture_six_groups.dtsi>

&trackball_listener {
    input-processors = <既存のプロセッサ...>, <KOROKORO_GESTURES>;
};

&gesture_action {
    /* 通常用途のために空けておきたいレイヤー(方針の分だけ) */
    reserved-layers = <0 1 2>;
};
```

プリセットには、6グループ分の認識プロセッサ・24個の名前付きスロット・
グループ1〜4の初期動作（ブラウザのタブ / 仮想デスクトップ / ページ内移動 /
編集）まで入っています。書き込んだ直後から動き、変更は設定ページから行えます。

- `&trackball_listener` はキーボードごとに名前が違います。お使いの shield の
  overlay で `zmk,input-listener` を持つノードを探してください
- 感度は 600 CPI のトラックボールで調整した値です。CPI が高いセンサーでは
  敏感になりすぎるので、include の**前**に1行で比例調整してください:
  `#define KOROKORO_GESTURE_STROKE_SIZE 170`（1000 CPI の例。6グループ全部に
  効きます）
- スロット数の Kconfig（`CONFIG_ZMK_GESTURE_ACTION_COUNT`）は既定で 24 なので、
  書く必要はありません
- リスナーの**ベースチェーン**につなぎます。レイヤー上書き（`layers = <N>`）に
  入れてはいけません。理由は後述の設計メモにあります

<details>
<summary>プリセットを使わず、全部自分で書きたい場合</summary>

スロット数の Kconfig、`&gesture_action` ノード（slot-names / default-bindings /
reserved-layers）、ジェスチャープロセッサ6個を自分で並べます。プリセットの
中身 [`dts/presets/gesture_six_groups.dtsi`](dts/presets/gesture_six_groups.dtsi)
がそのまま見本になります。

</details>

### 3. ジェスチャー用レイヤーを用意する

各グループは「自分のレイヤーが有効なとき」だけ動きます。使い方は、レイヤーキーを
押しながらトラックボールを転がす、です。つまり keymap に**ジェスチャー用の
レイヤー**と、**そこへ入るキー**が必要です。

グループ1〜4の初期レイヤーは 7〜10 ですが、**存在しないレイヤーを指している
グループは発火しないだけで害はない**ので、レイヤー1枚から始められます。
たとえば標準でレイヤーが5枚（0〜4）のキーボードなら:

```dts
// overlay または keymap で、include の前に:
#define KOROKORO_GESTURE_LAYER_1 5

// keymap にレイヤーを1枚追加（位置5になる）。キーは全部 &trans でよい:
gesture_1 {
    display-name = "GESTURE1";   // 設定画面にこの名前が出る
    bindings = < &trans &trans ... >;
};
```

そして既存レイヤーのどこかに `&mo 5`（押している間だけ有効）を置きます。
グループを増やしたくなったら、レイヤーを足して
`KOROKORO_GESTURE_LAYER_2` 以降を同じように合わせるだけです。

実際に動いている一式は
[CLine46 の設定](https://github.com/jpttm/zmk_config_CLine46/blob/feat/gesture-action/boards/shields/CLine46/CLine46_R.overlay)
にあります。

### どれくらい消費するか

nRF52840 でスロット24個の実測で、スロット表に約 1 KB、ジェスチャープロセッサ
1インスタンスあたり約 3.2 KB です。グループ6個の CLine46 のビルドで RAM 使用率
は約 60% になります。

### 採用前に知っておいたほうがよいこと

- グループのレイヤーを実行時に変更する機能（`active-layers`）は、現状
  [zmk-mouse-gesture のフォーク](https://github.com/jpttm/zmk-mouse-gesture)
  （ブランチ `v1-active-layers`）を必要とします。無くてもレイヤーがビルド時固定に
  なるだけで、他は動きます。本家へは4件の PR を送り3件がマージ済みで、残るこの
  1件も[提案中です](https://github.com/kot149/zmk-mouse-gesture/pull/14)。
- 設定ページの「おすすめ初期設定」は、1グループ4方向・16スロットを前提にして
  います。それ以外（スロット名・グループ数・レイヤー）はすべてデバイスから
  読んでいるので、構成が違っても壊れることはなく、個別編集に落ちるだけです。

## 設計メモ

知らないとはまる点だけをまとめます。

### ジェスチャーはベースチェーンに置く

input listener はレイヤー上書き（`layers = <N>`）を先に評価し、そこで処理を
打ち切ります。このため:

- 上書きの**中に**ジェスチャーを置くと、そのレイヤー専用になり、実行時の
  レイヤー変更が効きません。ベースチェーン + `active-layers` が正解です
- **他の**上書き（スクロールなど）が押さえているレイヤーでは、ベースチェーンの
  ジェスチャーは**無反応になります。エラーもログも出ません。** こうした
  レイヤーはモジュールが自動検出し、設定ページの選択肢から外します

### `reserved-layers` に書くのは「方針」だけ

手で書くのは「通常用途に空けておきたいレイヤー」だけです。物理的に動作しない
レイヤー（上書き持ち）は自動導出されるので、スクロールのレイヤーを動かしても
書き換えは不要です。

### そのほかの落とし穴

- `active-layers` / `reserved-layers` のマスクはキーマップ上の**位置**を
  指します。ZMK Studio の `Layer.id` とは別の数です
- `active-layers = 0` は「全レイヤーで動く」の意味です。無効にしたいグループは
  存在しないレイヤー `BIT(31)` に退避させます（プリセットのグループ5・6が
  この状態です）
- 1つのレイヤーに置けるのは1グループだけです。共有すると両方発火します
  （設定ページはそもそも選べないようにしています）
- `suppress-movement` はジェスチャー中のカーソルを固定します。本家の実装は
  レイヤー上書きの経路で効かないため、フォークでは方式を変えてあります

## 設定ページの開発

```bash
cd web
npm install
npm run dev
```

キーボードとの通信は
[@cormoran/zmk-studio-react-hook](https://github.com/cormoran/react-zmk-studio)
経由です。プロトコル定義は
`proto/jpttm/gesture_action/gesture_action.proto`、そのデコーダは
`web/src/gestureActionCodec.ts` に手書きで置いてあります。

## 謝辞

このモジュールを成立させている部分の大半は、私の仕事ではありません。

- **[ZMK](https://zmk.dev/)** — すべての土台となるファームウェア本体。
- **[cormoran](https://github.com/cormoran) さん** — このモジュールが登録している
  カスタム Studio RPC サブシステムの仕組み、
  [ランタイム入力プロセッサ](https://github.com/cormoran/zmk-module-runtime-input-processor)、
  [ランタイムマクロ](https://github.com/cormoran/zmk-feature-runtime-macro)、
  [デバイス情報](https://github.com/cormoran/zmk-feature-device-info)
  をはじめとするモジュール群、そして
  [@cormoran/zmk-studio-react-hook](https://github.com/cormoran/react-zmk-studio)。
  ブラウザから設定できるのは、ひとえにこれらがあるからです。設定ページの手本に
  したのも DYA Studio です。
- **[kot149](https://github.com/kot149/zmk-mouse-gesture) さん** — ジェスチャー
  認識そのもの。このモジュールは「認識されたジェスチャーが何をするか」を
  決めているだけです。
- **[takamaru](https://github.com/takamaru-fpv/zmk_config_CLine46) さん** —
  CLine46 とそのファームウェア。すべてはこのキーボードのために作られました。
- **[badjeff](https://github.com/badjeff/zmk-pmw3610-driver) さん** — PMW3610
  トラックボールドライバ。

## ライセンス

MIT です。他のプロジェクトが取り込みやすいようにするためなので、**どうぞ自由に
お使いください。** 別の設定ツールや配布ファームウェアで活用いただけると嬉しいです。

[DYA Studio](https://github.com/cormoran/dya-studio)（AGPL-3.0）のコードは
含んでいません。
