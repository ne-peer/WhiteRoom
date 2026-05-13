Created: 2026-05-13  
Last Updated: 2026-05-14 (multi-tip asset effect behavior; `sutTipMode`)

# WhiteRoom SUT Brush Material Rasterization — Development Specification

## Purpose

WhiteRoom loads raster textures for dynamic asset effects (and may load arbitrary local images elsewhere) via `file://` URLs and PixiJS `Assets.load`. Files with the **`.sut`** extension are **SQLite databases** used by Clip Studio family tools to store brush material data. Embedded PNG brush tips live inside BLOB columns; they are **not** valid standalone image files until extracted.

This document defines a **reusable main-process pipeline** that turns a `.sut` file into one or more **PNG byte sequences** (and optionally **cached `.png` files** on disk), so the renderer can keep using the existing Pixi raster path. The logic must remain **domain-agnostic** enough for future features (e.g. overlay images, flash assets, thumbnails) to call the same resolution layer.

**Reference implementation (Python, offline tooling):** [`lib/wr_cspbrushextract.py`](../lib/wr_cspbrushextract.py). Ship behavior should match its extraction rules unless a deliberate, documented deviation is required.

---

## File Format Summary

| Item | Detail |
|------|--------|
| Container | SQLite 3 database (file extension `.sut`) |
| Primary table | `MaterialFile` |
| Query | `SELECT _PW_ID, FileData FROM MaterialFile` (column names match the reference script) |
| `FileData` | Binary blob; contains an embedded PNG |
| Multiple rows | One `.sut` may yield **multiple** brush-tip PNGs (one texture per successful row) |

### PNG extraction from `FileData` (must match reference)

The reference script does **not** assume `FileData` starts at the PNG signature. It:

1. Finds the **last** occurrence of the ASCII substring `PNG` in the blob.
2. Sets the PNG start offset to **one byte before** that match so the stream begins with the standard PNG signature `\x89 PNG \r \n \x1a \n`.
3. Finds the **last** occurrence of the ASCII substring `IEND`.
4. Sets the end offset to **`IEND` offset + 8`** bytes (chunk type + CRC), **not** +4 — truncating after `IEND` without the CRC produces PNGs that strict decoders (including browser `createImageBitmap`) reject.

**Implementation requirement:** Port this algorithm in **TypeScript** as a **pure function** over `Uint8Array` / `Buffer`, and **validate** when possible (e.g. expected signature at computed start). On failure, return `null` / empty contribution for that row and log at most once per file to avoid spam.

---

## Architectural Principles

1. **Shared vs main split**
   - **Shared (`src/shared/…`)**: PNG carving from a single `FileData` blob — **no** SQLite dependency, unit-test friendly.
   - **Main (`src/main/…`)**: Open SQLite, iterate `MaterialFile`, call shared extractor, optional disk cache.

2. **Single generic “raster source resolution” concept**  
   Any feature that receives a user-chosen **filesystem path** should be able to ask the main process: “Give me loadable PNGs for this path” — normal images pass through unchanged; `.sut` expands to **N** PNG payloads or **N** cached file paths.

3. **Persisted state stores the user path, not cache paths**  
   Profiles and `dynamicAsset.assetPaths` should keep the original `…/brush.sut` path. **Do not** serialize `userData` cache paths into exported JSON — they are machine-specific and fragile.

4. **Renderer stays Pixi-centric**  
   Prefer resolving `.sut` to **real `.png` files** under `app.getPath('userData')` (or returning data URLs only when necessary) so `PIXI.Assets.load(toFileUrl(…))` stays aligned with current `CellRenderer.updateAsset` in [`src/renderer/utils/CellRenderer.ts`](../src/renderer/utils/CellRenderer.ts).

---

## Suggested Module Layout

| Module | Responsibility |
|--------|----------------|
| `src/shared/sut/extractPngFromMaterialBlob.ts` (or `src/shared/sutPngExtract.ts`) | `extractPngFromMaterialFileData(data: Uint8Array): Uint8Array \| null` |
| `src/main/sut/readSutMaterialPngs.ts` | Read `.sut` from disk → array of PNG `Buffer` / `Uint8Array` per row |
| `src/main/sut/sutPngCache.ts` | Deterministic cache dir from `(absolutePath, mtimeMs, layerId)` → write `.png`, return absolute paths; invalidate when `mtime` changes |

Naming is indicative; align with repository conventions when implementing.

---

## SQLite Access in Electron Main

The app currently has **no** SQLite dependency in [`package.json`](../package.json). Pick one strategy and document it in the implementation PR:

| Option | When to prefer |
|--------|----------------|
| **`sql.js` (WASM)** | Avoid native module rebuild across Windows / macOS / Linux; accept bundle size and async `initSqlJs`. |
| **`better-sqlite3`** | Prefer speed and simple sync API; accept Electron native rebuild tooling. |

Isolate DB access behind a small interface, e.g. `queryMaterialFileRows(sutPath: string): Array<{ id: string; fileData: Uint8Array }>`, so the extractor and tests do not depend on the chosen driver.

---

## IPC Design

Extend the typed API in [`src/shared/types.ts`](../src/shared/types.ts) and expose via [`src/preload/index.ts`](../src/preload/index.ts).

### Shipped handler (batch)

**Channel:** `resolve-raster-source-paths`  
**Preload:** `resolveRasterSourcePaths(paths: string[])`

**Input:** `paths: string[]` — same order as `dynamicAsset.assetPaths` (or equivalent).

**Output:** `ResolveRasterSourcePathsResult` in shared types:

- `{ kind: 'ok', entries }` — one `ResolveRasterSourceEntry` per input path, in order. Each entry has `loadablePaths: string[]` (one path for a normal image, many for `.sut` after cache expansion) and `sourceFingerprint` (`mtime:size` for cache invalidation).
- `{ kind: 'error', message }` — invalid input (e.g. non-array).

### `read-image-base64` and `.sut`

For a `.sut` path, the handler returns a `data:image/png;base64,...` URL for the **first** successfully extracted brush tip only. Multi-tip sequences use `resolveRasterSourcePaths` (renderer: dynamic asset / `CellRenderer.updateAsset`).

---

## Folder Listing and File Dialogs

Shared helpers live in [`src/shared/rasterSourceExtensions.ts`](../src/shared/rasterSourceExtensions.ts). [`readImagePaths`](../src/main/index.ts) lists raster images plus `.sut`. The single-file asset dialog includes `.sut` where applicable.

---

## Renderer Integration (Dynamic Asset Effect)

In [`CellRenderer.updateAsset`](../src/renderer/utils/CellRenderer.ts), before `PIXI.Assets.load(toFileUrl(path))`:

1. If `path` ends with `.sut` (case-insensitive), **invoke IPC** to resolve to `pngPaths[]`.
2. **Expand in order:** for `assetPaths = ['a.sut', 'b.png']`, the effective texture list becomes `[...tips from a in stable order], [b.png]]`. Document the ordering rule in code comments.
3. If resolution fails, log and skip that entry (consistent with current per-path `try/catch` behavior).

**Do not** persist expanded paths into Zustand for long-term storage.

---

## Multi-tip `.sut` and the asset-effect texture pool

After `resolveRasterSourcePaths`, [`CellRenderer.updateAsset`](../src/renderer/utils/CellRenderer.ts) flattens each entry’s `loadablePaths` into one array (preserving `assetPaths` order; within each `.sut`, tips follow stable cache file order from `_PW_ID` sorting in [`sutPngCache.ts`](../src/main/sut/sutPngCache.ts)).

[`ParticleSystem`](../src/renderer/utils/pixiEffects.ts) raster spawns call `randomTexture(this.textures)` — **uniform random over the entire flattened list**. Therefore:

- **Multiple tips in one `.sut`** behave like **multiple PNG files in one virtual folder**: every spawn picks a random texture from the pool.
- **“Single file” vs “folder” in the UI** is expressed by how many **paths** are in `assetPaths`, but **random vs effectively single-image** is determined by the **resolved texture count** after expansion. A single picked `brush.sut` with five tips still yields **five** textures and random spawns unless restricted (see `sutTipMode` below).
- **`AssetParticle.assetPath`** on spawn remains the effect’s representative `dynamicAsset.assetPath`; it may **not** match the specific cached PNG path used for that particle’s sprite (debugging only).

### `sutTipMode` (dynamic asset, raster, when any path is `.sut`)

| Value | Behavior |
|-------|----------|
| `allTipsRandom` (default) | All extracted tips from each `.sut` join the pool (same as today’s multi-tip default). |
| `firstTipOnly` | For each input path that is a `.sut`, only the **first** `loadablePaths` entry is kept before flattening; other raster files unchanged. Spawns then use a single texture for that file. |

The renderer includes `sutTipMode` in the internal texture cache key so switching the mode reloads textures. The field is part of [`DynamicAssetEffect`](../src/shared/types.ts) and is normalized on profile load via `normalizeDynamicAssetEffect`.

---

## Disk Cache Semantics

| Rule | Rationale |
|------|-----------|
| Root under `app.getPath('userData')` | Writable, user-local |
| Subpath includes hash of **absolute path + mtime** | Invalidates when the source file changes |
| Filename includes `_PW_ID` or row index | Supports multi-tip files |
| Optional periodic cleanup | Old entries when disk usage matters (out of scope for v1 unless needed) |

---

## Preset Assets (`assets/asset-effect`)

Two supported workflows:

1. **Authoring-time conversion (recommended for shipped presets)**  
   Run [`lib/wr_cspbrushextract.py`](../lib/wr_cspbrushextract.py) or a future `npm` script that produces `.png` files next to or inside preset folders. The packaged app then only ships **PNG** (no runtime SQLite for those assets).

2. **Ship `.sut` in-repo**  
   A build step resolves `.sut` → PNG before `electron-builder` collects resources. Runtime code path can stay identical to user folders.

Avoid committing **large** base64 blobs inside `.ts` files except for **tiny** fixed icons; prefer real image files or generated PNGs on disk.

---

## Error Handling and Security

- Only resolve paths that originate from **user selection**, **known preset roots**, or **already validated** profile-relative resolution — mirror existing local file access assumptions.
- Missing table / column / empty `FileData`: return empty array or error result; never throw uncaught from IPC handlers.
- Log extraction failures at `warn` level with basename only if privacy is a concern.

---

## Testing

| Level | Scope |
|-------|--------|
| Unit | `extractPngFromMaterialFileData` with minimal synthetic buffers cut from a known-good `FileData` fixture (binary test asset in repo **only if licensing permits**) |
| Manual | User-provided `.sut` from Clip Studio; verify multi-tip folders and mixed `.sut` + `.png` folders |

---

## Out of Scope (unless product asks otherwise)

- Parsing pressure curves or other non-image columns in `MaterialFile`.
- Writing or modifying `.sut` files.
- Non-SQLite “`.sut`” variants (if discovered, document and gate behind format detection).
