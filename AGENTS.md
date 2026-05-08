# AGENTS.md — WhiteRoom

**WhiteRoom** — Electron desktop app (Windows 11+) for viewing images with dynamic visual effect overlays. Designed for LLM-assisted development.

## Stack

| Layer | Tech |
|---|---|
| Desktop | Electron v30 |
| UI | React v18 + TypeScript |
| Renderer | PixiJS v8 (WebGL) |
| State | Zustand + immer |
| Animation | GSAP |
| Build | electron-vite + Vite |

## Architecture

### PixiJS Layer Order (per CellRenderer)

```
CellRenderer.container
├── [0] imageLayer        ← image sprite (mask-clipped)
├── [1] effectsLayer      ← vignette etc. (blur target when blur.applyToAll=true)
├── [2] overlayLayer      ← color overlay Graphics
└── [3] particleContainer ← dynamic assets (ParticleSystem)
```

- Blur filter targets `imageLayer` or `effectsLayer` based on `blur.applyToAll`
- Timer is a React component overlaid with `position: absolute` outside PixiJS

### State Flow

Zustand (`appStore.ts`) → `usePixiStage.ts` useEffect detects changes → calls `CellRenderer.updateEffects()` / `resize()` / `setImage()`

### IPC Pattern

`window.api.xxx()` → `ipcRenderer.invoke()` → `ipcMain.handle()` (via preload)

## Key Types (`src/shared/types.ts`)

Always check and update before adding features.

```typescript
type Cell = {
  id: string; col: number; row: number
  folder: CellFolder | null
  currentImageIndex: number
  slideshow: SlideShowConfig
  effects: CellEffects  // colorOverlay / vignette / blur / dynamicAsset
}

type AppProfile = {  // matches profile JSON structure
  version: string; createdAt: string; name: string
  blankColor: BlankColor; grid: GridLayout
  cells: Cell[]; timer: TimerConfig; fullscreen: boolean
}
```

## Coding Rules

- **TypeScript strict**: no `any`, maximize type inference
- **CSS Modules**: use `.module.css` files named after their component
- **Zustand immer**: direct mutation is fine inside `set()` (immer-managed)
- **PixiJS stays in CellRenderer**: never manipulate PixiJS objects from React
- **IPC**: always use `window.api.xxx()` from renderer, never call Electron APIs directly
- **Error handling**: always `try/catch` for file I/O and `PixiJS.Assets.load()`
- **Japanese text encoding**: keep Japanese messages in `src/renderer/i18n.ts` as literal Japanese text, not Unicode escape sequences. Save `src/renderer/i18n.ts` and `CLAUDE_ja.md` as UTF-8 with BOM so Japanese text is detected correctly on Windows.

## Commands

```bash
npm run dev                    # start dev server
npm run build && npm run package  # production build
npx tsc --noEmit               # type check only
```

## Gotchas

1. **PixiJS v8**: use `PIXI.Assets.load()`, not `PIXI.Sprite.from()`
2. **webSecurity: false**: required for `file://` local image access — keep in production
3. **CellRenderer.destroy()**: must call on cell removal to prevent memory leaks
4. **GSAP vs PixiJS Ticker**: they are separate; use `gsap.ticker` to sync with PixiJS frames
5. **immer draft**: be careful where `structuredClone` is needed

## TODO (unimplemented)

- Cell resize: `CellRenderer.resize()` exists but vignette texture rebuild is incomplete
- Vignette texture rebuild: regeneration on color change / resize
- Image load error handling: fallback for missing paths / unsupported formats
- Cell border highlight: selected cell outline via PixiJS Graphics
- Apply effect to all cells: `setAllCellsEffect` in store, UI missing
- Effect presets: one-click apply for saved effect configs
- Vignette texture cache: share same-color vignette across cells
- Performance: measure ticker load with many cells; consider OffscreenCanvas

## Release Notes Workflow

リリースノートを作成するときは以下の手順で実行する:

```bash
# 最新タグと1つ前のタグを確認
git tag --sort=-version:refname | head -3

# 2タグ間のコミットを取得（例: v1.3.1..v1.4.0）
git log <prev-tag>..<latest-tag> --pretty=format:"%h %s %b" --no-merges
```

取得したコミットを以下3カテゴリに分類して箇条書きで `RELEASE_NOTES.md` に追記する:
- **機能追加**: `feat:` / `add:` プレフィックスのコミット
- **調整**: `update:` / `docs:` / UI・ラベル変更など
- **バグフィックス**: `fix:` プレフィックスのコミット

## Changelog

| Version | Changes |
|---|---|
| v0.1.0 | Initial implementation |
| v0.1.1 | Blur mid-animation reset fix; blur+vignette start-time sync |
| v0.1.2 | Radial blur & vignette z-order fix (added vignetteLayer) |
