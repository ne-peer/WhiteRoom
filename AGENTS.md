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
|- [0] imageRootLayer          - wraps all image-derived layers; receives the tone (colorMatrix) filter
|     |- [0] dynamicBackgroundLayer - blurred copy of the current image when blankBackground.mode === 'dynamic'
|     |- [1] imageLayer            - main image sprite (mask-clipped); receives the per-cell blur filter
|     |- [2] shakeTrailLayer       - parent index reference for masked delayed shake-trail sprites (inserted dynamically)
|     |- [3] echoLayer             - echo trail sprite (mask-clipped)
|     |- [4] effectsLayer          - blur target when blur.applyToAll = true
|     |- [5] echoMask              - mask graphics for echoLayer
|     `- [n] radial-blur layers / shake-trail dynamic layers (inserted at runtime)
|- [1] overlayLayer            - color overlay Graphics, squish, flash
|- [2] particleContainer       - dynamic assets (ParticleSystem)
|- [3] textLayer               - in-cell text effect (TextSystem)
|- [4] vignetteLayer           - vignette sprite
|- [5] spiralLayer             - spiral Graphics and radial mask
|- [6] fogLayer                - fog effect (blob container + droplet graphics)
`- [7] guideLayer              - temporary radial/position guide Graphics
```

- Blur targets `imageLayer` or `effectsLayer` depending on `blur.applyToAll`
- Tone filter (colorOverlay.imageAdjustEnabled) is applied to `imageRootLayer` so it covers the main image, dynamic background, shake trail, echo, and radial blur clones uniformly
- Radial blur builds cloned image layers and mask sprites inside `imageRootLayer`
- Shake, shake-trail, flash overlay, spiral, radial blur, vignette, particles, and in-cell text are owned by `CellRenderer`
- Timer UI, pre-overlay, end-flash, cell navigation overlay, pick-mode guides, storyboard panel, and text reader window are React overlays with `position: absolute`, outside PixiJS

### State Flow

Zustand (`src/renderer/stores/appStore.ts`) is the source of truth for grid, cells, timer, language, text reader/storyboard state, image effect profile cache, and temporary storyboard image overrides.

`usePixiStage.ts` reacts to store changes and calls `CellRenderer.setImage()`, `clearImage()`, `setImageFit()`, `configureBlankBackground()`, `updateEffects()`, `resize()`, `resetEffectTiming()`, `resetVignetteBlurEchoTiming()`, `setStoryboardScale()`, and `applyTimerProgress()`.

Storyboard image overrides are stored in `cellTagOverrides`; while `textReader.storyboardEffectProgress` is active it overrides timer-linked effect progress inside the Pixi ticker.

Image effect profiles are cached by folder path in `imageEffectProfiles`. Automatic profile application is suspended while a Text Reader file is open so Storyboard tags stay authoritative.

### IPC Pattern

`window.api.xxx()` -> `ipcRenderer.invoke()` / event subscription -> `ipcMain.handle()` (via preload)

Current IPC covers folder selection/path reads, profile save/load, asset and overlay image selection, preset asset folder listing, local image base64 reads, system font listing, text file load/save and temp cleanup, image effect profile load/save, remote storyboard image loading with session cache/limits, fullscreen/window controls, external links/devtools, and fullscreen change notifications.

## Reference Policy

- `docs/WR-Concept_20260505.md` is an app-developer draft/memo file; do not treat it as an implementation spec and you do not need to reference it during normal development tasks.

## Key Types (`src/shared/types.ts`)

Always check and update shared types before adding features.
- Keep these schemas aligned when adding/updating features: `CellFolder`, `Cell`, `CellEffects`, `TimerConfig`, `AppProfile`, `ImageEffectProfileDocument`.
- The canonical definitions live in `src/shared/types.ts` (do not duplicate full type blocks here).

## EffectsPanel UI Rules

### Section titleColor

Each `<Section>` inside `EffectsPanel` must use the **single unified color for its parent `<CategorySection>`**. Do not apply per-effect gradients.

| CategorySection | Unified `titleColor` |
|---|---|
| フィルター (`effectCategoryFilter`) | `#82b0ff` |
| モーション (`effectCategoryMotion`) | `#f5cc30` |
| デコレーション (`effectCategoryDecoration`) | `#b070f8` |

When adding a new `<Section>` to any category, use that category's unified color. Do not introduce new shades or gradients within a category.

## Coding Rules

- **TypeScript strict**: no `any`, maximize type inference
- **CSS Modules**: use `.module.css` files named after their component
- **Zustand + immer**: direct mutation is fine inside `set()` because the draft is immer-managed
- **PixiJS stays in `CellRenderer`**: never manipulate PixiJS display objects from React components
- **IPC**: always use `window.api.xxx()` from renderer, never call Electron APIs directly
- **Error handling**: keep `try/catch` around file I/O and `PIXI.Assets.load()`
- **Profile compatibility**: merge imported profiles with store defaults so old JSON remains loadable
- **Commit messages**: write commit messages in Japanese
- **Japanese text encoding**: keep Japanese messages in `src/renderer/i18n.ts` as literal Japanese text, not Unicode escape sequences. Save `src/renderer/i18n.ts` as UTF-8 with BOM so Japanese text is detected correctly on Windows.

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
9. **Fog evaporation tail**: keep fog fade visually smooth by avoiding alpha cutoffs. The final 20% of fog fade uses `easeOutSine` and an extended tail duration (slow factor) in `CellRenderer`; this may make visual fade time longer than `fadeDurationSec`, and that mismatch is currently accepted by design.

## Storyboard Tag Spec

For the Text Reader storyboard tag system, read `docs/WR-Storyboard.md` before implementation.

- Tags are standalone lines that trigger image/effect changes when the next clean paragraph first becomes visible.
- Rich tags use the format `[WR:<appVersion>:<JSON payload>]`.
- The `timer` field in rich tags is `Partial<SavedTimerConfig>` (= `TimerConfig` minus `elapsedSec` and `running`). This includes `timer.partial` for partial start/end control.
- `timer.partial.enabled` starts the timer at `totalSec - startSec` remaining and stops it early at `endSec` remaining; completion fires `timerCompletedNonce` and resumes Text Reader Auto-advance.
- Remote storyboard images must be loaded through main-process IPC, deduplicated, and session-cached.
- pixiv-family hosts (`pixiv.net` and `pximg.net`) are capped at 10 distinct image/page URLs per app session.
- Never add hard-coded sample pixiv artwork URLs or artwork IDs to code, tests, docs, or commit messages.

## Image Effect Profile Spec

For the per-image effect profile save/load feature, read `docs/WR-EffectProfile.md` before implementation.

- Effects are saved per image, not per cell or column.
- The local folder file is `whiteroom_effects.json`.
- Saved image paths must be relative.
- Text Reader / Storyboard activity suspends automatic application until the text file is closed.
- Remote URL images cannot be saved because there is no local target folder.

## SUT Brush Raster Spec

For `.sut` (Clip Studio SQLite brush material) import, PNG extraction, IPC, and renderer integration, read [`docs/WR-SutBrushRaster.md`](docs/WR-SutBrushRaster.md).

- Reference script: `lib/wr_cspbrushextract.py` (offline extraction and schema notes).
- Runtime: user-visible paths stay `.sut`; Pixi loads cached `tip-*.png` under `userData/sut-cache/` via `resolveRasterSourcePaths` IPC.
- Optional preset authoring: `npm run extract:sut-presets` (Python + `lib/wr_cspbrushextract.py` per `assets/asset-effect` subfolder that contains `.sut`).
- **Multi-tip `.sut`:** resolved tips flatten into one texture pool; `ParticleSystem` picks uniformly at random per spawn (`randomTexture`). UI **`sutTipMode`** (`allTipsRandom` / `firstTipOnly`) limits `.sut` expansion when users want a single tip from one file.

## Vector Stamp Spec (draft)

For procedural vector stamps (e.g. Bézier paths) alongside raster dynamic assets, read the **draft** spec [`docs/WR-VectorStamp.md`](docs/WR-VectorStamp.md) before changing implementation or `src/shared/types.ts`.

- Built-in presets use path-independent preset IDs; user-loaded image paths for raster drawing remain supported.
- User-editable control-point “warping” of the base shape is out of scope; transforms are limited to fixed code paths (scale, rotation, alpha, pattern offsets, etc.).
- Stamp groups assume a normalized cell anchor (0–1) and child placement in group-local space.

**At stable release:** Remove the **DRAFT** banner and draft-only notes at the top of [`docs/WR-VectorStamp.md`](docs/WR-VectorStamp.md), align the body with shipped behavior, and trim this `AGENTS.md` section to a normal spec pointer (drop “draft” and the release-instructions paragraph).

## Stash Spec

For the stash feature, read `docs/WR-Stash.md` before implementation.

- A stash captures: `blankColor`, `blankBackground`, `grid`, `cells`, `timer`, `textReaderConfig`, `textReaderFilePath`, `textReaderPageIndex`. Not captured: `fullscreen`, `showControls`, `windowSize`, `language`, `imageEffectProfiles`.
- Saving a stash immediately calls `resetProfile()` without a confirmation dialog.
- POP restores settings but does **not** remove the stash slot.
- `AppProfile` version `'1.1.0'` is used when stashes are present; old profiles (no `stashes` field) load as empty stash list.
- `serializeAppProfile` / `resolveAppProfile` must process stash cell effects via `mapEffectsAssetReferences`.
- The app close guard reads `window.__whiteroom_hasStash()` (set by `StashWindow`) and shows a native dialog when stashes remain.
- Maximum 15 stash slots; minimum 3 rows displayed.
- Stash window is opened with the `[s]` shortcut (panel top-left at last mouse position, clamped to viewport), by **right-button long press (400 ms)** on the image grid (anchor = press-down position; disabled during `[p]` center pick mode and squish color picking), or by hovering the collapsed stash icon in the top-left corner.

## Effect Specs

Individual effect specifications live under `docs/effects/`. Read the relevant file before implementing or modifying an effect.

| File | Effect |
|---|---|
| [`docs/effects/WR-ShakeEffect.md`](docs/effects/WR-ShakeEffect.md) | Shake Effect (vertical oscillation + multi-area trail delay) |
| [`docs/effects/WR-FocusEffect.md`](docs/effects/WR-FocusEffect.md) | Focus Effect (peripheral blur + waypoint animation) |
| [`docs/effects/WR-CensorEffect.md`](docs/effects/WR-CensorEffect.md) | Censor Effect (rectangular color bars, focus/shake link) |

## Documentation Workflow

When a new feature is added to this work instruction file, ask whether a feature specification should also be created under `docs/`.

- Use the filename pattern `docs/WR-{FeatureName}.md` for general features.
- Use `docs/effects/WR-{EffectName}.md` for effect specifications.
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

Classify commits and append them to `RELEASE_NOTES.md` using these sections:

- **Features**: commits with `feat:` / `add:`
- **Adjustments**: commits with `update:` / `docs:` and UI / label changes
- **Bug Fixes**: commits with `fix:`

Release note template:

```md
# Release Notes — v{tag}

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
4. Append the change summary to the Changelog in `AGENTS.md`.
5. Update `package.json` `version` to the requested version without the leading `v` (for example, `1.5.1`).
6. Run `npm i` to synchronize `package-lock.json`.
7. Commit the resulting changes with the exact commit message `bump to v{x.x.x}`.
8. Create tag `v{x.x.x}` at the current commit.

## Changelog

| Version | Changes |
|---|---|
| v0.1.0 | Initial implementation |
| v0.1.1 | Blur mid-animation reset fix; blur and vignette start-time sync |
| v0.1.2 | Radial blur and vignette z-order fix (`vignetteLayer` added) |
| v1.3.1 | Timer sync enhancements, preset asset packaging, pre-timer overlay improvements, fullscreen UI auto-hide |
| v1.4.0 | Text reader improvements, hamburger tab UI, floating navigation when controls are hidden, packaging/doc updates |
| v1.4.1 | Storyboard tag system: text-reader image sync, effect progress, timer auto-start, storyboard panel; selected-column effect reset |
| v1.4.2 | Remote URL storyboard images with pixiv-family session limits; text window max-width setting |
| v1.5.0 | Shake, flash, and spiral effects; shared effect center controls; advanced shake trail controls |
| v1.5.1 | One-shot shake repeat option and effect center picking improvements |
| v1.5.2 | Per-image effect profiles, pick-mode circle height shortcuts, image navigation shortcuts, window size reset |
| v1.5.3 | Storyboard reader settings save/restore, timer profile auto-next integration, fixed-base shake trail option, spiral coverage fix |
| v1.5.4 | Storyboard timer partial control, squish effect expansion, storyboard loading guardrails, profile window/UI state persistence |
| v1.5.5 | Fog and zoom effects, squish/zoom mutual sync, broader timer-sync coverage, effect-category UI refresh, rendering and interaction fixes |
| v1.5.6 | Stash feature and UI, grid long-press to open stash, tone/color filter and vignette controls, vector heart builtin asset, hamburger hover UX, echo blend fix, effect profile cache reload after stash POP |
| v1.5.7 | Startup splash; flash radial fade, blur, range assets, vector tint; asset wiggle, edge blur, rise speed, random size/color; shake-trail circle grid; selected-cell frame; timer UI and partial sync fixes; README stash/effects; stash exit dialog; packaged splash fade |
