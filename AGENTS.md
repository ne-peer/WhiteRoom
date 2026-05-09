# AGENTS.md - WhiteRoom

**WhiteRoom** - Electron desktop app (Windows 11+) for viewing images with dynamic visual effect overlays. Designed for LLM-assisted development.

## Stack

| Layer | Tech |
|---|---|
| Desktop | Electron v30 |
| UI | React v18 + TypeScript |
| Renderer | PixiJS v8 (WebGL) |
| State | Zustand + immer |
| Animation | GSAP |
| Build | electron-vite + Vite |
| Packaging | electron-builder |

## Architecture

### PixiJS Layer Order (per `CellRenderer`)

```text
CellRenderer.container
|- [0] dynamicBackgroundLayer  - blurred copy of the current image when blankBackground.mode === 'dynamic'
|- [1] imageLayer              - main image sprite (mask-clipped)
|- [2] echoLayer               - echo trail sprite (mask-clipped)
|- [3] effectsLayer            - blur target when blur.applyToAll = true
|- [4] overlayLayer            - color overlay Graphics
|- [5] particleContainer       - dynamic assets (ParticleSystem)
|- [6] textLayer               - in-cell text effect (TextSystem)
|- [7] vignetteLayer           - vignette sprite
`- [8] echoMask                - mask graphics attached to the container
```

- Blur targets `imageLayer` or `effectsLayer` depending on `blur.applyToAll`
- Radial blur builds cloned image layers and mask sprites inside `CellRenderer`
- Timer UI, pre-overlay, end-flash, cell navigation overlay, and text reader window are React overlays with `position: absolute`, outside PixiJS

### State Flow

Zustand (`src/renderer/stores/appStore.ts`) is the source of truth for grid, cells, timer, language, and text reader state.

`usePixiStage.ts` reacts to store changes and calls `CellRenderer.setImage()`, `updateEffects()`, `resize()`, `resetEffectTiming()`, and `applyTimerProgress()`.

### IPC Pattern

`window.api.xxx()` -> `ipcRenderer.invoke()` / event subscription -> `ipcMain.handle()` (via preload)

Current IPC covers folder selection, profile save/load, asset selection, preset asset folder listing, system font listing, text file loading, fullscreen control, and fullscreen change notifications.

## Key Types (`src/shared/types.ts`)

Always check and update shared types before adding features.

```typescript
type Cell = {
  id: string
  col: number
  row: number
  folder: CellFolder | null
  imageFit: ImageFitMode
  currentImageIndex: number
  slideshow: SlideShowConfig
  effects: CellEffects
}

type CellEffects = {
  colorOverlay: ColorOverlayEffect
  vignette: VignetteEffect
  blur: BlurEffect
  echo: EchoEffect
  breathing: BreathingEffect
  dynamicAsset: DynamicAssetEffect
  textEffect: TextEffect
}

type TimerConfig = {
  enabled: boolean
  totalSec: number
  elapsedSec: number
  running: boolean
  position: TimerPosition
  showBackground: boolean
  effectCompletionLeadSec: number
  endFlash: TimerEndFlashConfig
  preOverlay: TimerPreOverlayConfig
}

type AppProfile = {
  version: string
  createdAt: string
  name: string
  blankColor: BlankColor
  blankBackground?: BlankBackground
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
}
```

## Coding Rules

- **TypeScript strict**: no `any`, maximize type inference
- **CSS Modules**: use `.module.css` files named after their component
- **Zustand + immer**: direct mutation is fine inside `set()` because the draft is immer-managed
- **PixiJS stays in `CellRenderer`**: never manipulate PixiJS display objects from React components
- **IPC**: always use `window.api.xxx()` from renderer, never call Electron APIs directly
- **Error handling**: keep `try/catch` around file I/O and `PIXI.Assets.load()`
- **Profile compatibility**: merge imported profiles with store defaults so old JSON remains loadable
- **Japanese text encoding**: keep Japanese messages in `src/renderer/i18n.ts` as literal Japanese text, not Unicode escape sequences. Save `src/renderer/i18n.ts` and `CLAUDE_ja.md` as UTF-8 with BOM so Japanese text is detected correctly on Windows.

## Commands

```bash
npm run dev
npm run build
npm run package
npx tsc --noEmit
```

## Gotchas

1. **PixiJS v8**: use `PIXI.Assets.load()`, not `PIXI.Sprite.from()`
2. **`webSecurity: false`**: required for `file://` local image access. Keep it in production unless the image loading strategy changes
3. **`CellRenderer.destroy()`**: must run on cell removal to avoid PixiJS and GSAP leaks
4. **GSAP vs PixiJS ticker**: they are separate loops. Timer-linked and per-frame visuals are coordinated inside `CellRenderer` and `usePixiStage`
5. **`structuredClone` and immer drafts**: use care when copying nested effect/profile data
6. **Dynamic blank background**: it is a cloned image sprite with its own blur filter, not a CSS background
7. **Text reader is not part of `AppProfile`**: it is UI/session state stored separately from exported profiles
8. **`structuredClone` inside immer `set()`**: compute snapshots outside `set()` using `get()` — immer draft Proxies cannot be structurally cloned

## Storyboard Tag Spec

For the Text Reader storyboard tag system, read `docs/WR-Storyboard.md` before implementation.

- Tags are standalone lines that trigger image/effect changes when the next clean paragraph first becomes visible.
- Rich tags use the format `[WR:<appVersion>:<JSON payload>]`.
- Remote storyboard images must be loaded through main-process IPC, deduplicated, and session-cached.
- pixiv-family hosts (`pixiv.net` and `pximg.net`) are capped at 10 distinct image/page URLs per app session.
- Never add hard-coded sample pixiv artwork URLs or artwork IDs to code, tests, docs, or commit messages.

## Image Effect Profile Spec

For the planned per-image effect profile save/load feature, read `docs/WR-EffectProfile.md` before implementation.

- Effects are saved per image, not per cell or column.
- The local folder file is `whiteroom_effects.json`.
- Saved image paths must be relative.
- Text Reader / Storyboard activity suspends automatic application until the text file is closed.

## Documentation Workflow

When a new feature is added to this work instruction file, ask whether a feature specification should also be created under `docs/`.

- Use the filename pattern `docs/WR-{FeatureName}.md`.
- If the feature details are already complete in this file, migrating them directly into the docs file is acceptable.
- Keep this file as the quick reference and the docs file as the canonical feature specification.

## TODO (unimplemented / still worth tracking)

- Image load error handling: fallback UI for missing paths / unsupported formats is still minimal
- Cell border highlight: selected cell outline via PixiJS Graphics is still not implemented
- Vignette texture cache: same-size same-color vignette textures are still rebuilt per cell
- Performance validation: measure ticker/filter cost with many cells and consider OffscreenCanvas or other optimizations if needed

## Release Notes Workflow

When creating release notes, use the steps below:

```powershell
# Check the latest tags and the previous tag
git tag --sort=-version:refname | Select-Object -First 3

# Get commits between two tags (example: v1.3.1..v1.4.0)
git log <prev-tag>..<latest-tag> --pretty=format:"%h %s %b" --no-merges
```

Use this heading format:

```md
# Release Notes — v{tag}
```

Classify commits and append them to `RELEASE_NOTES.md` using these sections:

- **Features**: commits with `feat:` / `add:`
- **Adjustments**: commits with `update:` / `docs:` and UI / label changes
- **Bug Fixes**: commits with `fix:`

Release note template:

```md
# Release Notes — v1.4.0

## 機能追加
- xxx

## 調整
- xxx

## バグフィックス
- xxx
```

## Version Bump Workflow

When instructed with `bump to v{x.x.x}` (for example, `bump to v1.5.1`), perform the full release bump workflow below:

1. Pull from the remote first to update the repository.
2. Confirm the current checkout is at `HEAD` after pulling.
3. Read commit messages between `HEAD` and the previous latest version tag, then update `RELEASE_NOTES.md`.
4. Update `package.json` `version` to the requested version without the leading `v` (for example, `1.5.1`).
5. Run `npm i` to synchronize `package-lock.json`.
6. Commit the resulting changes with the exact commit message `bump to v{x.x.x}`.
7. Create tag `v{x.x.x}` at the current commit.

## Changelog

| Version | Changes |
|---|---|
| v0.1.0 | Initial implementation |
| v0.1.1 | Blur mid-animation reset fix; blur and vignette start-time sync |
| v0.1.2 | Radial blur and vignette z-order fix (`vignetteLayer` added) |
| v1.3.1 | Timer sync enhancements, preset asset packaging, pre-timer overlay improvements, fullscreen UI auto-hide |
| v1.4.0 | Text reader improvements, hamburger tab UI, floating navigation when controls are hidden, packaging/doc updates |
| v1.5.0 | Storyboard tag system: text-reader image sync, effect progress, timer auto-start, storyboard panel |
