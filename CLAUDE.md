# CLAUDE.md - WhiteRoom

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

## Claude Guidance

- Keep documentation and explanatory prose in English by default to reduce token usage
- When changing rendering behavior, inspect `src/shared/types.ts`, `src/renderer/stores/appStore.ts`, `src/renderer/hooks/usePixiStage.ts`, and `src/renderer/utils/CellRenderer.ts` together before editing
- Prefer small, localized changes and preserve profile backward compatibility
- If behavior changes affect saved profiles, timer semantics, or renderer layers, update this file and `AGENTS.md`

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

## Storyboard Tag Spec (`src/renderer/utils/storyboardParser.ts`)

Text files loaded in the text reader can embed **storyboard tags** — special lines that trigger image/effect changes as the reader advances.

### Tag Format

Tags must occupy their own line. They are stripped from the display and associated with the **next clean paragraph** (segment) that follows them.

**Type 1 — Simple (hand-written)**

```
[[C:\path\to\image.jpg]]
```

- Wrap an absolute image path in `[[` and `]]`
- Switches the displayed image on all cells; no effect change

**Type 2 — Rich (app-generated via Storyboard tool)**

```
[WR:1.4.0:{"image":"C:\\path\\image.jpg","effects":{...},"progress":{"enabled":true,"pages":5},"timer":{"enabled":false}}]
```

- Format: `[WR:<appVersion>:<JSON payload>]`
- JSON schema:

```typescript
{
  image: string                          // absolute path, text-file-relative path, file/data URL, or http(s) image/page URL
  effects: Partial<CellEffects>          // effects to apply to all cells
  progress?: { enabled: boolean; pages: number }  // effect ramp-up
  timer?: { enabled: boolean }           // auto-start timer
}
```

### Remote Image Safety

- Remote storyboard images are loaded through the main-process IPC path, then passed to PixiJS as data URLs.
- Keep same-URL loads deduplicated with in-flight promise caches in both renderer and main. Multiple cells showing the same URL must produce at most one network request.
- Successful remote image loads are cached for the app session. Re-entering the same tag must not re-request the image.
- pixiv-family hosts (`pixiv.net` and `pximg.net`) are capped at 10 distinct image/page URLs per app session. The 11th distinct URL must be blocked before network access and surface a user-visible warning.
- Do not reset the pixiv counter when changing or closing a text file; only app restart resets it.
- Text tab must keep showing the current `pixiv requests: n/10` counter from main-process state.
- Never add hard-coded sample pixiv artwork URLs or artwork IDs to code, tests, docs, or commit messages.

### Runtime Behaviour

| Event | Action |
|---|---|
| Page advances into a tagged segment | `applyTagToAllCells()` — sets `cellTagOverrides[cellId]` for image, merges `effects` into all cells |
| Page retreats before all active tags | `restoreBaseline()` — restores snapshot taken at file load time |
| `progress.enabled` | `storyboardEffectProgress` (0–1) increments each page advance; overrides timer sync in `applyTimerProgress()` |
| `timer.enabled` | Timer resets and starts; if Auto-advance is running it suspends until timer completes |

### Key Files

| File | Role |
|---|---|
| `src/renderer/utils/storyboardParser.ts` | `parseTextFile()`, `insertOrReplaceTagBefore()`, `buildRichTagLine()` |
| `src/renderer/stores/appStore.ts` | `tagEntries`, `baselineSnapshot`, `cellTagOverrides`, `storyboardEffectProgress`; actions `applyTagToAllCells`, `restoreBaseline`, `incrementActiveProgressPages`, `insertTagAtCurrentPosition` |
| `src/renderer/components/reader/TextReaderWindow.tsx` | Per-page tag evaluation, rollback detection, timer-completion Auto resume |
| `src/renderer/components/reader/StoryboardPanel.tsx` | UI: insert image tag, insert timer tag, save file |
| `src/renderer/hooks/usePixiStage.ts` | `cellTagOverrides` → image key; `storyboardEffectProgress` overrides timer progress in ticker |

### Storyboard Panel — Save File Naming

```
{original name}_WhiteRoom_{yyyymmdd-hhmmss}{ext}
```

### Gotcha: `structuredClone` inside immer `set()`

The baseline snapshot is computed **outside** `set()` using `get()` before entering the immer draft, because `structuredClone` cannot serialize immer Proxy objects.

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

## Changelog

| Version | Changes |
|---|---|
| v0.1.0 | Initial implementation |
| v0.1.1 | Blur mid-animation reset fix; blur and vignette start-time sync |
| v0.1.2 | Radial blur and vignette z-order fix (`vignetteLayer` added) |
| v1.3.1 | Timer sync enhancements, preset asset packaging, pre-timer overlay improvements, fullscreen UI auto-hide |
| v1.4.0 | Text reader improvements, hamburger tab UI, floating navigation when controls are hidden, packaging/doc updates |
| v1.5.0 | Storyboard tag system: text-reader image sync, effect progress, timer auto-start, storyboard panel |
