# WhiteRoom

様々なビジュアルエフェクトを付与できるマルチカラムスライドショー対応の画像ビューア

## 使い方

以下からバージョンを選んで.exeファイルをダウンロードしてください。（現在Windows用のみ）
- https://github.com/ne-peer/WhiteRoom/releases

## 基本的な使い方

1. **グリッド設定**: 右パネル「グリッド」タブで列・行数を設定
2. **画像フォルダの割り当て**:
   - セルをクリックして選択 → 「フォルダを選択」ボタン
   - またはフォルダをキャンバスにドラッグ&ドロップ
3. **スライドショー**: セル選択後、グリッドタブでON
4. **エフェクト**: セル選択後、エフェクトタブで設定
    * カラーフィルタ: シンプルなオーバレイカラーフィルタ
    * 画像強調フィルタ: 画像の彩度・コントラストを強調するエフェクト
    * ビネットエフェクト: 周辺減光エフェクト
    * ブラーエフェクト: ぼかしエフェクト
    * エコーエフェクト: 波紋を表現するエフェクト
    * ブリージングエフェクト: 呼吸を表現するエフェクト
    * テキストエフェクト: 指定テキストをランダム位置に浮遊させる
    * アセットエフェクト: 指定画像をランダム位置に配置し浮遊させる
5. **タイマー**: タイマータブでON・位置設定
    * **エフェクトタブで設定したエフェクトをタイマーの経過時間にあわせて徐々に反映する機能**: エフェクトタブの各エフェクト項目のタイマー同期をONにするか、タイマー同期セクションの一括反映ボタンを使用してください
6. **プロファイル保存**: プロファイルタブでJSON保存/読み込み

---

## セットアップ手順（開発者向け）

### 必須環境

- **Node.js** v18以上（推奨: v22）
- **npm** v9以上
- **Windows 11** / macOS / Linux

### インストール

```bash
# プロジェクトフォルダに移動
cd C:\develop\WhiteRoom

# 依存関係インストール
npm install
```

### 開発起動

```bash
npm run dev
```

### ビルド（配布用）

```bash
# Windows インストーラー生成
npm run build
npm run package
```

出力先: `release/` フォルダ

---

## ディレクトリ構造

```
src/
├── main/           # Electronメインプロセス
│   └── index.ts    # ファイルI/O、ダイアログ、IPC
├── preload/        # IPC ブリッジ
│   └── index.ts
├── shared/         # 型定義（main/renderer共有）
│   └── types.ts
└── renderer/       # React + PixiJS フロントエンド
    ├── App.tsx
    ├── main.tsx
    ├── global.css
    ├── stores/
    │   └── appStore.ts       # Zustand グローバル状態
    ├── hooks/
    │   ├── usePixiStage.ts   # PixiJSアプリ初期化
    │   ├── useDropHandler.ts # D&D処理
    │   └── useTimer.ts       # タイマー
    ├── utils/
    │   ├── CellRenderer.ts   # セルごとの描画クラス
    │   └── pixiEffects.ts    # エフェクトユーティリティ
    └── components/
        ├── layout/
        │   ├── MasterCanvas  # PixiJSキャンバスホスト
        │   └── TopBar        # 上部ツールバー
        ├── controls/
        │   ├── ControlPanel  # 右サイドパネル
        │   ├── GridControls  # グリッド・セル操作
        │   ├── UIKit         # 共通UIコンポーネント
        │   ├── AppearanceControls
        │   └── ProfileControls
        ├── effects/
        │   └── EffectsPanel  # エフェクト設定
        └── timer/
            ├── TimerOverlay  # タイマー表示
            └── TimerControls # タイマー設定
```

## 技術スタック

- **Electron** v30 — クロスプラットフォームデスクトップアプリ
- **React** v18 + **TypeScript** — UI
- **PixiJS** v8 — WebGL描画エンジン
- **Zustand** + immer — 状態管理
- **GSAP** — アニメーション制御
- **electron-vite** — ビルドツール

---

## プロファイルJSON形式

```json
{
  "version": "1.0.0",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "name": "MyProfile",
  "blankColor": { "r": 10, "g": 10, "b": 10, "a": 1 },
  "grid": { "cols": 3, "rows": 2 },
  "cells": [...],
  "timer": { "enabled": false, "totalSec": 300, ... },
  "fullscreen": false
}
```
