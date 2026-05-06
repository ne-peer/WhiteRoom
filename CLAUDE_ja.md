# CLAUDE.md — WhiteRoom

## プロジェクト概要

**アプリ名**: WhiteRoom — 動的ビジュアルエフェクトをオーバレイ描画できる画像ビューア  
**種別**: Electronデスクトップアプリ（Windows 11以上）  
**開発方針**: LLMによる自動コーディング・メンテナンスを前提とした設計

## 技術スタック

| レイヤー | 技術 |
|---|---|
| デスクトップ | Electron v30 |
| UI | React v18 + TypeScript |
| 描画エンジン | PixiJS v8 (WebGL) |
| 状態管理 | Zustand + immer |
| アニメーション | GSAP |
| ビルド | electron-vite + Vite |

## アーキテクチャ

### PixiJS 描画レイヤー（CellRenderer単位）

```
CellRenderer.container
├── [0] imageLayer       ← 画像スプライト（マスクでクリッピング）
├── [1] effectsLayer     ← ビネット等（blur.applyToAll=true時のブラー対象）
├── [2] overlayLayer     ← カラーオーバレイ Graphics
└── [3] particleContainer ← 動的アセット（ParticleSystem）
```

- ブラーフィルタは `blur.applyToAll` の値で `imageLayer` か `effectsLayer` に適用
- タイマーは PixiJS 外で React コンポーネントとして `position: absolute` で重ねる

### 状態管理フロー

Zustand（appStore.ts）→ usePixiStage.ts の useEffect が変更を検知 → `CellRenderer.updateEffects()` / `resize()` / `setImage()` を呼び出す

### IPC パターン

`window.api.xxx()` → `ipcRenderer.invoke()` → `ipcMain.handle()` （preload 経由）

## 実装済み機能一覧

### ✅ 完成済み

- **グリッドレイアウト**: 最大15×15、動的追加/削除、既存データ保持
- **D&Dでフォルダ割り当て**: フォルダドロップで列自動追加、セルに画像セット
- **フォルダ選択ダイアログ**: Electronネイティブダイアログ
- **スライドショー**: 間隔設定・ランダム表示・セルごと独立
- **色調オーバレイ**: カラーピッカー + 透明度
- **ビネットエフェクト**: ピンクデフォルト・動的アニメーション（GSAPで透明度変化・即時リセット繰り返し）
- **ブラーエフェクト**: 強度スライダー・画像のみ/全体切替・徐々に増加（最大3600秒）・放射線状ブラー
  - ✨ **アニメーション途中リセットバグ修正** (v0.1.1): CellRenderer.updateBlur() にキー比較ロジック導入→tween中断防止
  - ✨ **ブラー・ビネット開始タイミング同期** (v0.1.1): 両エフェクト同時有効時に時間軸を統一
  - ✨ **放射線ブラー＆ビネット表示優先度修正** (v0.1.2): vignetteLayer追加→ビネットが常に前面・放射線ブラー+徐々に増加で残像更新
- **動的アセットオーバレイ**: 透過PNG読み込み・ランダム位置スポーン・上昇しながら透過するパーティクル
- **タイマー**: プログレスバー表示・9ポジション選択・開始/一時停止/リセット
- **ブランクスペース色**: カラーピッカー + プリセット7色
- **フルスクリーン**: Electron APIと連動
- **プロファイルJSON保存/読み込み**: 全状態をエクスポート・インポート
- **右サイドパネル**: タブ切替（グリッド/エフェクト/タイマー/外観/プロファイル）

### ❌ 未実装（今後のタスク）

- **セルのリサイズ**: CellRendererのresize()はあるが、PixiJS側のビネットテクスチャ再生成が未完全
- **ビネットテクスチャの動的リビルド**: 色変更・リサイズ時に再生成する処理の整備
- **画像ロードのエラーハンドリング**: 存在しないパス・対応外フォーマット時のフォールバック表示
- **セルボーダー表示**: 選択中セルのハイライト（PixiJS側のGraphicsで境界線描画）
- **全セル一括エフェクト適用**: `setAllCellsEffect` はストアに実装済みだがUIパーツ未実装
- **エフェクトのプリセット機能**: よく使うエフェクト設定をワンクリック適用
- **ビネットテクスチャキャッシュ**: 同色のビネットを複数セルで共有できるようキャッシュ化
- **パフォーマンス最適化**: 多数セル時のticker負荷計測・必要に応じてOffscreenCanvas検討

---

## 重要な型定義（src/shared/types.ts）

新機能追加時は必ず先に確認・更新すること。

```typescript
type Cell = {
  id: string; col: number; row: number
  folder: CellFolder | null
  currentImageIndex: number
  slideshow: SlideShowConfig
  effects: CellEffects          // colorOverlay / vignette / blur / dynamicAsset
}

type AppProfile = {             // プロファイルJSON構造と同一
  version: string; createdAt: string; name: string
  blankColor: BlankColor; grid: GridLayout
  cells: Cell[]; timer: TimerConfig; fullscreen: boolean
}
```

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

## 開発時の注意点

1. **PixiJS v8**: `PIXI.Sprite.from()` は使わない → `PIXI.Assets.load()` を使う
2. **webSecurity: false**: ローカル画像の `file://` アクセスに必要。本番でも維持する
3. **CellRenderer.destroy()**: セル削除時に必ず呼ぶ（メモリリーク防止）
4. **GSAPとPixiJS Ticker**: 別物。PixiJS のフレームに合わせる場合は `gsap.ticker` を設定
5. **immer draft**: `structuredClone` が必要な箇所に注意

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.1.0 | 初期実装（claude.ai上で設計・コーディング） |
| v0.1.1 | ブラーエフェクトのバグ修正＆ビネット同期機能追加（Claude Code） |
| v0.1.2 | 放射線ブラー＆ビネット表示優先度バグ修正（Claude Code） |
| 今後 | 要件追加時はここに記録する |
