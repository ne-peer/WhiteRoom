# CLAUDE.md — WhiteRoom 開発コンテキスト引き継ぎ指示書

このファイルはClaude Codeが自動で読み込む開発コンテキストです。
claude.aiでの設計・議論・初期実装をすべて引き継いでいます。

---

## プロジェクト概要

**アプリ名**: WhiteRoom  
**種別**: Electronデスクトップアプリ（Windows 11以上、他OS対応可）  
**目的**: 動的ビジュアルエフェクトをオーバレイ描画できる画像ビューア  
**対象ユーザー**: ミドルクラスGPU以上の環境を持つユーザー（リソース制約なし）  
**開発方針**: LLMによる自動コーディング・メンテナンスを前提とした設計

---

## 技術スタック（確定済み）

| レイヤー | 技術 | 理由 |
|---|---|---|
| デスクトップ | Electron v30 | クロスOS・ファイルシステムアクセス |
| UI | React v18 + TypeScript | LLMとの相性・型安全性 |
| 描画エンジン | PixiJS v8 (WebGL) | GPU描画・エフェクト全対応 |
| 状態管理 | Zustand + immer | 軽量・LLMが書きやすい |
| アニメーション | GSAP | PixiJS Tickerと協調 |
| ビルド | electron-vite + Vite | 高速ビルド |

---

## ディレクトリ構造

```
C:\develop\WhiteRoom\
├── CLAUDE.md                  ← このファイル
├── README.md                  ← ユーザー向けセットアップ手順
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
└── src/
    ├── main/
    │   └── index.ts           ← Electronメインプロセス・IPC・ファイルI/O
    ├── preload/
    │   └── index.ts           ← contextBridgeでAPIをrendererに公開
    ├── shared/
    │   └── types.ts           ← 全型定義（main/renderer共有）★重要
    └── renderer/
        ├── App.tsx             ← ルートコンポーネント
        ├── main.tsx            ← Reactエントリーポイント
        ├── index.html
        ├── global.css
        ├── window.d.ts         ← window.api型定義
        ├── stores/
        │   └── appStore.ts     ← Zustandストア（アプリ全状態）★重要
        ├── hooks/
        │   ├── usePixiStage.ts ← PixiJSアプリ初期化・レイアウト管理
        │   ├── useDropHandler.ts ← D&D処理
        │   └── useTimer.ts     ← タイマーフック
        ├── utils/
        │   ├── CellRenderer.ts ← セルごとの描画クラス（PixiJS）★重要
        │   └── pixiEffects.ts  ← エフェクトユーティリティ関数
        └── components/
            ├── layout/
            │   ├── MasterCanvas.tsx  ← PixiJSキャンバスホスト
            │   └── TopBar.tsx        ← 上部ツールバー
            ├── controls/
            │   ├── ControlPanel.tsx  ← 右サイドパネル（タブ切替）
            │   ├── GridControls.tsx  ← グリッド・セル操作
            │   ├── UIKit.tsx         ← 共通UIコンポーネント群
            │   ├── AppearanceControls.tsx
            │   └── ProfileControls.tsx
            ├── effects/
            │   └── EffectsPanel.tsx  ← エフェクト設定パネル
            └── timer/
                ├── TimerOverlay.tsx  ← タイマー表示（PixiJS上にReactで重ねる）
                └── TimerControls.tsx
```

---

## アーキテクチャ設計（重要）

### レイヤー構成（PixiJS描画スタック）

各セルは `CellRenderer` クラスが管理し、以下の順でコンテナを重ねる：

```
CellRenderer.container
├── [0] imageLayer       ← 画像スプライト（マスクでクリッピング）
├── [1] effectsLayer     ← ビネット等（blur.applyToAll=trueのブラー対象）
├── [2] overlayLayer     ← カラーオーバレイGraphics
└── [3] particleContainer ← 動的アセット（ParticleSystem）
```

- ブラーフィルタは `blur.applyToAll` の値で `imageLayer` か `effectsLayer` に適用
- タイマーはPixiJS外でReactコンポーネントとして `position: absolute` で重ねる

### IPC通信パターン

```
Renderer (React)
  └─ window.api.xxx()  ← preload/index.tsで定義
       └─ ipcRenderer.invoke('channel-name')
            └─ ipcMain.handle('channel-name', handler)  ← main/index.ts
```

### 状態管理フロー

```
Zustandストア (appStore.ts)
  ├── グリッド状態 (grid, cells[])
  ├── エフェクト状態 (cells[].effects)
  ├── タイマー状態 (timer)
  └── UI状態 (selectedCellId, showControls)
       ↓
usePixiStage.ts が useEffect で変更を検知
       ↓
CellRenderer.updateEffects() / resize() / setImage() を呼び出す
```

---

## 実装済み機能一覧

### ✅ 完成済み

- **グリッドレイアウト**: 最大15×15、動的追加/削除、既存データ保持
- **D&Dでフォルダ割り当て**: フォルダドロップで列自動追加、セルに画像セット
- **フォルダ選択ダイアログ**: Electronネイティブダイアログ
- **スライドショー**: 間隔設定・ランダム表示・セルごと独立
- **色調オーバレイ**: カラーピッカー + 透明度
- **ビネットエフェクト**: ピンクデフォルト・動的アニメーション（GSAPで透明度変化・即時リセット繰り返し）
- **ブラーエフェクト**: 強度スライダー・画像のみ/全体切替・徐々に増加（最大3600秒）
- **動的アセットオーバレイ**: 透過PNG読み込み・ランダム位置スポーン・上昇しながら透過するパーティクル
- **タイマー**: プログレスバー表示・9ポジション選択・開始/一時停止/リセット
- **ブランクスペース色**: カラーピッカー + プリセット7色
- **フルスクリーン**: Electron APIと連動
- **プロファイルJSON保存/読み込み**: 全状態をエクスポート・インポート
- **右サイドパネル**: タブ切替（グリッド/エフェクト/タイマー/外観/プロファイル）

### ❌ 未実装（今後のタスク）

- **セルのリサイズ**: CellRendererのresize()はあるが、PixiJS側のビネットテクスチャ再生成が未完全
- **ビネットテクスチャの動的リビルド**: 色変更・リサイズ時に再生成する処理の整備
- **D&Dのフルパス取得**: Electron環境でのFileSystem API経由のフルパス（`entry.fullPath` がElectronで正しく動作するか要確認）
- **画像ロードのエラーハンドリング**: 存在しないパス・対応外フォーマット時のフォールバック表示
- **セルボーダー表示**: 選択中セルのハイライト（PixiJS側のGraphicsで境界線描画）
- **TopBarのキャンバス幅調整**: showControls時に `calc(100vw - 300px)` だがTopBarのright調整と連動させる必要あり
- **エフェクトのプリセット機能**: よく使うエフェクト設定をワンクリック適用
- **全セル一括エフェクト適用**: `setAllCellsEffect` はストアに実装済みだがUIパーツ未実装
- **ビネットテクスチャキャッシュ**: 同色のビネットを複数セルで共有できるようキャッシュ化
- **パフォーマンス最適化**: 多数セル時のticker負荷計測・必要に応じてOffscreenCanvas検討

---

## 重要な型定義（src/shared/types.ts）

新機能追加時は必ずここを先に確認・更新すること。

```typescript
// セル1つの状態
type Cell = {
  id: string
  col: number; row: number
  folder: CellFolder | null
  currentImageIndex: number
  slideshow: SlideShowConfig
  effects: CellEffects
}

// エフェクト群
type CellEffects = {
  colorOverlay: ColorOverlayEffect
  vignette: VignetteEffect
  blur: BlurEffect
  dynamicAsset: DynamicAssetEffect
}

// アプリ全体 = プロファイルJSON構造と同一
type AppProfile = {
  version: string; createdAt: string; name: string
  blankColor: BlankColor
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
}
```

---

## コーディング規約

- **TypeScript strict mode**: `any` 禁止、型推論を最大限活用
- **CSS Modules**: コンポーネントと同名の `.module.css` を使用
- **Zustand immer**: ストアのset内では直接mutateしてよい（immer管理下）
- **PixiJS操作はCellRendererに閉じる**: React側からPixiJSオブジェクトを直接操作しない
- **IPC**: rendererからは必ず `window.api.xxx()` 経由、直接Electron APIを呼ばない
- **エラーハンドリング**: ファイルI/O・PixiJS Assetsロードは必ずtry/catch

---

## よく使うコマンド

```bash
# 開発起動
npm run dev

# ビルド（配布用）
npm run build && npm run package

# 型チェックのみ
npx tsc --noEmit
```

## Codex実行環境メモ

- このチャット実行環境では `node` / `npm` / `npx` が PATH に無い。検証時に毎回 `npm` → `npm.cmd` → `node` を探索してトークンを使わないこと。
- ビルドや型チェックが必要な場合は、まず「この環境では Node.js 系コマンドを実行できない」と判断し、代替として `git diff --check` や静的な差分確認まで行う。

---

## 開発時の注意点

1. **PixiJS v8はAPIが大きく変わっている**: v7以前の書き方（`PIXI.Sprite.from()` 等）は使わない。`PIXI.Assets.load()` を使う
2. **ElectronのwebSecurity: false**: ローカル画像の `file://` アクセスに必要。本番でも維持する
3. **CellRenderer.destroy()**: セル削除時に必ず呼ぶ。PixiJSのメモリリークを防ぐ
4. **GSAPとPixiJS Tickerの共存**: GSAPのデフォルトtickerとPixiJSのtickerは別物。競合しないが、PixiJSのframeタイミングに合わせる場合は `gsap.ticker` を設定する
5. **immerのdraft**: Zustandのset内でdraft（immer）を使う際、`structuredClone` が必要な箇所に注意

---

## 次のセッションで最初に確認すること

Claude Codeで作業を始める際は、以下を順番に実行：

```bash
# 1. 依存関係確認
npm install

# 2. 型エラー確認
npx tsc --noEmit

# 3. 開発起動して動作確認
npm run dev
```

エラーがあれば内容を共有して修正から始める。

---

## 要件の追加・変更履歴

| バージョン | 内容 |
|---|---|
| v0.1.0 | 初期実装（claude.ai上で設計・コーディング） |
| 今後 | 要件追加時はここに記録する |

---

*このファイルはclaude.aiとClaude Codeの橋渡しとして機能します。*
*新しい要件・設計決定・実装済み内容は都度このファイルを更新してください。*
