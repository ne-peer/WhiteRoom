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

- **TypeScript strict mode**: `any` 禁止
- **CSS Modules**: コンポーネントと同名の `.module.css`
- **Zustand immer**: set 内で直接 mutate してよい
- **PixiJS 操作は CellRenderer に閉じる**: React から PixiJS オブジェクトを直接操作しない
- **IPC**: renderer からは必ず `window.api.xxx()` 経由
- **エラーハンドリング**: ファイル I/O・PixiJS Assets ロードは必ず try/catch

## 開発時の注意点

1. **PixiJS v8**: `PIXI.Sprite.from()` は使わない → `PIXI.Assets.load()` を使う
2. **webSecurity: false**: ローカル画像の `file://` アクセスに必要。本番でも維持する
3. **CellRenderer.destroy()**: セル削除時に必ず呼ぶ（メモリリーク防止）
4. **GSAPとPixiJS Ticker**: 別物。PixiJS のフレームに合わせる場合は `gsap.ticker` を設定
5. **immer draft**: `structuredClone` が必要な箇所に注意

## コマンド

```bash
npm run dev                        # 開発起動
npm run build && npm run package   # 配布ビルド
npx tsc --noEmit                   # 型チェック
```

## 実装状況

### ✅ 完成済み

グリッドレイアウト（最大15×15）、D&D フォルダ割り当て、スライドショー、色調オーバレイ、ビネットエフェクト（GSAP アニメーション）、ブラーエフェクト（徐々に増加・最大3600秒）、動的アセットオーバレイ（パーティクル）、タイマー（9ポジション）、ブランクスペース色、フルスクリーン、プロファイル JSON 保存/読み込み

### ❌ 未実装

- ビネットテクスチャの動的リビルド（色変更・リサイズ時の再生成）
- 画像ロードのエラーハンドリング（フォールバック表示）
- セルボーダー表示（選択中セルのハイライト）
- 全セル一括エフェクト適用 UI（`setAllCellsEffect` はストア実装済み）
- エフェクトのプリセット機能
- パフォーマンス最適化（多数セル時の ticker 負荷計測）
