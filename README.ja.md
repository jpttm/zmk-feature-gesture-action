# ZMK Gesture Action

*[English version](README.md)*

ZMK キーボードのジェスチャーに割り当てる動作を、ファームウェアを作り直さずに
ブラウザから変更できるようにするモジュールです。

設定ページ: <https://jpttm.github.io/zmk-feature-gesture-action/>

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

すぐ思いつく回避策は、各ジェスチャーを
[ランタイムマクロ](https://github.com/cormoran/zmk-feature-runtime-macro)
に向けることです。実際に動きますが、**マクロの枠は16個しかありません。**
ジェスチャーを16個作ると、本来のマクロに使える枠がゼロになります。ジェスチャーと
マクロが同じ乏しい資源を奪い合うことになります。

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

**この仕組み自体はジェスチャー専用ではありません。** スロットは「差し替え可能な
ビヘイビア」でしかないので、バインディングを取れるもの — コンボ、マクロの一手、
キー位置 — なら何でも向けられます。ジェスチャーはたまたま最初の用途だっただけです。

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

### 1. モジュールを追加する

```yaml
# config/west.yml
manifest:
  remotes:
    - name: jpttm
      url-base: https://github.com/jpttm
  projects:
    - name: zmk-feature-gesture-action
      remote: jpttm
      revision: main
```

### 2. スロット数を決める

```ini
# boards/shields/<ボード名>/<ボード名>.conf
CONFIG_ZMK_GESTURE_ACTION_COUNT=24
```

ジェスチャー1つにつきスロット1つです。上下左右4方向のグループを6つ持つなら 24
になります。

RPC のハンドラは `gesture_action` ノードがあれば自動で有効になるので、
`CONFIG_..._STUDIO_RPC` のような設定を別途書く必要はありません。

### 3. ノードを宣言する

```dts
#include <behaviors/gesture_action.dtsi>

&gesture_action {
    /* 設定画面にスロット番号ではなくこの名前が出る。
       RPC で運ぶ都合上 24 バイト上限なので短めに。 */
    slot-names =
        "G1 Up", "G1 Down", "G1 Left", "G1 Right",
        "G2 Up", "G2 Down", "G2 Left", "G2 Right";

    /* 何も設定していないときの動作。スロット番号順に並べる。 */
    default-bindings =
        <&kp LC(T)>, <&kp LC(W)>, <&kp LS(LC(TAB))>, <&kp LC(TAB)>,
        <&kp LG(TAB)>, <&kp LG(D)>, <&kp LC(LG(LEFT))>, <&kp LC(LG(RIGHT))>;

    /* 通常用途のために空けておきたいレイヤー。設定画面がジェスチャーの
       割り当て先として出さなくなる。方針の分だけ書けばよい
       （後述「どのレイヤーが選択肢に出るか」を参照）。 */
    reserved-layers = <0 1 2>;
};
```

### 4. スロットを叩くものを用意する

`zmk-mouse-gesture` の場合、グループごとにプロセッサのインスタンスを1つ置きます。

```dts
zip_gesture_1: zip_gesture_1 {
    compatible = "zmk,input-processor-mouse-gesture";
    #input-processor-cells = <0>;
    display-name = "Group 1";
    active-layers = <BIT(7)>;   /* このグループが効くレイヤー */
    always-active;
    suppress-movement;          /* ジェスチャー中カーソルを止める */
    enable-eager-mode;

    up    { pattern = <GESTURE_UP>;    bindings = <&gesture_action 0>; };
    down  { pattern = <GESTURE_DOWN>;  bindings = <&gesture_action 1>; };
    left  { pattern = <GESTURE_LEFT>;  bindings = <&gesture_action 2>; };
    right { pattern = <GESTURE_RIGHT>; bindings = <&gesture_action 3>; };
};
```

そして input listener の**ベースチェーン**に並べます。レイヤー上書き
（`layers = <N>`）**ではありません。** 理由は後述の設計メモにあります。

```dts
&trackball_listener {
    input-processors = <&mouse_runtime_input_processor>,
        <&zip_gesture_1>, <&zip_gesture_2>;
};
```

### 5. レイヤーに名前を付ける

任意ですが、設定画面に表示されるので「GESTURE1」のほうが「7」より分かりやすいです。

```dts
layer_7 {
    display-name = "GESTURE1";
    bindings = < ... >;
};
```

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
  を必要とします。無くてもレイヤーがビルド時固定になるだけで、他は動きます。
  [本家への取り込みを進めているところです](https://github.com/kot149/zmk-mouse-gesture/pull/11)。
- 設定ページの「おすすめ初期設定」は、1グループ4方向・16スロットを前提にして
  います。それ以外（スロット名・グループ数・レイヤー）はすべてデバイスから
  読んでいるので、構成が違っても壊れることはなく、個別編集に落ちるだけです。

## 設計メモ

分かるまでに時間のかかった事柄です。devicetree を読んでも見えません。

### ジェスチャーはベースチェーンに置く。レイヤー上書きではない

input listener はレイヤー上書きを先に評価し、`process-next` が無い限り
**そこで処理を打ち切ります。** ここから2つの結果が出ます。

- 上書きの**中に**ジェスチャープロセッサを置くと、そのレイヤーでしか動かず、
  対応がビルド時に固定されます。ベースチェーンに置いて `active-layers` に
  判断させるからこそ、レイヤーを実行時に変更できます。
- ベースチェーンに置いたプロセッサは、**他の**上書きが押さえているレイヤーでは
  イベントを一切受け取りません。スクロール用の上書きがあるレイヤーに
  ジェスチャーを割り当てると、**何の反応もなく、エラーもログも出ません。**

後者があるため、`reserved-layers` だけでは足りません。

### どのレイヤーが選択肢に出るか

設定ページは3つの情報を、3つの別々の場所から得ています。

| 情報 | 出所 |
|---|---|
| どのレイヤーが存在し、名前は何か | ZMK 標準のキーマップ RPC |
| 方針として空けておきたいレイヤー | このノードの `reserved-layers` |
| そもそも動作しないレイヤー | 自動導出。devicetree 上の `zmk,input-listener` を全て走査し、`process-next` の無い上書きが押さえているレイヤーを追加 |

手書きなのは真ん中だけです。そこだけが人の判断だからです。スクロールのレイヤーを
動かしても、どこも書き換える必要はありません。

当初は、このノードから listener を phandle で指す実装にしていました。これは
**成立しません。** listener がジェスチャープロセッサを参照し、そのバインディングが
このノードを参照するため、参照が循環して devicetree に拒否されます。compatible
で走査すれば循環せず、しかも設定を一切書かずに済みます。

### マスクはレイヤーの「位置」を指す。ID ではない

`active-layers` と `reserved-layers` はキーマップ上の**位置**に対するビットマスク
です。`zmk_keymap_layer_active()` が取るのがこれだからです。ZMK Studio の
`Layer.id` は並べ替えても変わらない識別子で、**位置とは別の数**です。キーマップを
読むクライアントは配列の順番を使う必要があります。混同すると、誰かがレイヤーを
並べ替えた瞬間にマスクが別のレイヤーを指します。

### `active-layers = 0` は「全レイヤー」の意味

無効にしたいグループを 0 にしてはいけません。0 は「絞り込みなし」だからです。
存在しないレイヤー、`BIT(31)` に退避させてください。

### 1つのレイヤーに1グループ

2つのグループが同じレイヤーを共有すると両方が発火します。どちらが勝つかを利用者に
考えさせるべきではないので、設定ページは他のグループが押さえているレイヤーを
選べないようにしています。

### カーソルを止める

`suppress-movement` が無いと、ジェスチャーを描くたびにポインタが画面を飛び回り
ます。本家の実装は `ZMK_INPUT_PROC_STOP` を返して抑制しようとしますが、ZMK の
input listener はレイヤー上書きの経路でこれを握りつぶすため、**そこでは何も
起きません。** フォークではイベントの値を 0 にする方式に変えてあり、チェーンの
どこに置いても効きます。

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

このプロジェクトは [DYA Studio](https://github.com/cormoran/dya-studio)
（AGPL-3.0）からコードを一切取っていません。RPC の仕組みを理解するために読むのと、
コードを写すのは別の話で、写していればこのモジュールも AGPL になっていました。
