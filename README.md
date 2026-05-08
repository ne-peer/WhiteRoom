![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/ne-peer/WhiteRoom/total?style=flat&color=FF6496)

<div>
   <h1 align="center">WhiteRoom</h1> 
   <p align="center">ビジュアルエフェクトを付与できるマルチカラム対応画像ビューア<br>A multi-column image viewer that lets you apply visual effects.</p>
</div>

&nbsp;

## 使い方

以下からバージョンを選んでダウンロードしてください。
- https://github.com/ne-peer/WhiteRoom/releases

| OS | ファイル |
|---|---|
| Windows | `.exe` |
| macOS (Apple Silicon) | `_arm64_.dmg` |
| macOS (Intel) | `_x64_.dmg` |

### macOSでの注意事項

本アプリはApple Developer証明書による署名がないため、そのままではmacOSのGatekeeperにブロックされます。  
初回のみ、以下のいずれかの方法で開いてください。

#### 方法1: ターミナルで隔離フラグを解除する

**※コマンドの末尾はDLしたバージョンにあわせて書き換えてください！**

```bash
xattr -d com.apple.quarantine ~/Downloads/WhiteRoom.for.Mac_arm64_v*.dmg
```

その後、通常どおりDMGを開いてアプリをApplicationsフォルダにドラッグしてください。

#### 方法2: 右クリックで開く**

1. ダウンロードしたDMGをFinderで右クリック（または Control+クリック）
2. 「開く」を選択
3. 警告ダイアログで「開く」をクリック

## 機能

1. **グリッド設定**: 右パネル「グリッド」タブで列・行数を設定
2. **画像フォルダの割り当て**:
    * セルをクリックして選択 → 「フォルダを選択」ボタン
    * またはフォルダをキャンバスにドラッグ&ドロップ
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
    * **エフェクトのタイマー同期機能**: タイマーの残り時間に応じてエフェクトを適用する機能
    * **終了時オーバレイ画像**: タイマー終了時にあわせて指定した画像をオーバレイ表示する機能
6. **テキストリーダー**: テキストファイル(.txt)を読み込んでRPGツクール風にテキストを閲覧する機能
7. **プロファイル保存**: プロファイルタブでJSON保存/読み込み

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
  "createdAt": "2026-05-08T02:34:56.789Z",
  "name": "MyProfile",
  "blankColor": { "r": 255, "g": 100, "b": 150, "a": 0.5 },
  "blankBackground": {
    "mode": "color",
    "dynamicBlur": 30
  },
  "grid": {
    "cols": 1,
    "rows": 1
  },
  "cells": [
    {
      "id": "cell-0-0-1715135696789-abcd1234",
      "col": 0,
      "row": 0,
      "folder": {
        "id": "folder-1",
        "path": "C:\\Images\\Sample",
        "images": [
          "C:\\Images\\Sample\\image01.jpg",
          "C:\\Images\\Sample\\image02.jpg"
        ]
      },
      "imageFit": "cover",
      "currentImageIndex": 0,
      "slideshow": {
        "enabled": false,
        "intervalMs": 3000,
        "randomOrder": true,
        "transition": "fade",
        "transitionDurationMs": 350
      },
      "effects": {
        "colorOverlay": {
          "enabled": false,
          "color": { "r": 255, "g": 0, "b": 128 },
          "alpha": 0.3,
          "imageAdjustEnabled": false,
          "saturationMax": 1.4,
          "contrastMax": 1.35,
          "dynamicAdjust": false,
          "dynamicAdjustDurationMs": 1000,
          "dynamicAdjustTimerSync": false
        },
        "vignette": {
          "enabled": false,
          "color": { "r": 255, "g": 100, "b": 150 },
          "alpha": 0.5,
          "dynamic": false,
          "dynamicFrom": 0.4,
          "dynamicTo": 0.7,
          "dynamicDurationMs": 1000,
          "dynamicTimerSync": false
        },
        "blur": {
          "enabled": false,
          "strength": 0,
          "applyToAll": false,
          "gradualEnabled": false,
          "gradualDurationSec": 1,
          "gradualStartStrength": 0,
          "gradualEndStrength": 20,
          "gradualTimerSync": false,
          "radialEnabled": false,
          "radialPattern": "a",
          "radialIntensity": 0.8,
          "radialCenterY": 0.5,
          "radialSize": 1
        },
        "echo": {
          "enabled": false,
          "durationSec": 1,
          "startAlpha": 0.45,
          "startScale": 1,
          "endScale": 1.2,
          "timerSync": false
        },
        "breathing": {
          "enabled": false,
          "speedPxPerSec": 8,
          "maxOffsetPx": 20,
          "timerSync": false,
          "scaleEnabled": false,
          "scaleDurationSec": 8
        },
        "dynamicAsset": {
          "enabled": false,
          "pattern": "rising",
          "assetPath": null,
          "assetPaths": [],
          "assetFolderPath": null,
          "spawnIntervalMs": 800,
          "riseSpeedPx": 2,
          "maxParticles": 20,
          "sizeRatio": 1,
          "baseAlpha": 1,
          "alphaTimerSync": false,
          "emergenceSpeedFactor": 1,
          "colorOverlayEnabled": false,
          "colorOverlayColor": { "r": 255, "g": 100, "b": 150 },
          "colorOverlayAlpha": 0.5
        },
        "textEffect": {
          "enabled": false,
          "texts": ["", "", "", "", ""],
          "font": "Meiryo",
          "color": { "r": 255, "g": 100, "b": 150 },
          "alpha": 0.5,
          "alphaTimerSync": false,
          "fontSize": 48,
          "charIntervalMs": 300,
          "displayDurationMs": 1000,
          "intervalMs": 600,
          "direction": "vertical"
        }
      }
    }
  ],
  "timer": {
    "enabled": false,
    "totalSec": 60,
    "elapsedSec": 0,
    "running": false,
    "position": "bottom-center",
    "showBackground": false,
    "effectCompletionLeadSec": 3,
    "endFlash": {
      "enabled": true,
      "color": { "r": 255, "g": 255, "b": 255 },
      "maxTransparency": 0,
      "count": 3,
      "intervalSec": 0.5
    },
    "preOverlay": {
      "enabled": false,
      "imagePath": null,
      "displayStartSec": 10,
      "startOpacity": 0,
      "endOpacity": 80
    }
  },
  "fullscreen": false
}
```

- `blankBackground` は現在の保存形式に含まれます。未指定で読み込んだ場合は `{ "mode": "color", "dynamicBlur": 30 }` が補完されます。
- `cells[].slideshow`、`cells[].effects`、`timer.endFlash`、`timer.preOverlay` は読み込み時に既定値とマージされるため、旧バージョンの JSON で一部キーがなくても取り込み可能です。
- `textReader` の設定や開いているテキストファイル状態は `AppProfile` には含まれず、プロファイル JSON には保存されません。

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/ne-peer/WhiteRoom/total?style=flat&logoColor=%23FF6496)

https://img.shields.io/badge/%2Fgithub%2Fdownloads%2Fne-peer%2FWhiteRoom%2Ftotal?style=flat&logoColor=%23FF6496
