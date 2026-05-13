Created: 2026-05-13  
Last Updated: 2026-05-13 (initial development instructions)

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

### Recommended: dedicated handler

**Name (example):** `resolve-raster-sources` (or `expandSutToPngPaths`)

**Input:** `filePath: string` (absolute or normalizable).

**Output (conceptual):**

```typescript
type ResolveRasterSourcesResult =
  | { kind: 'image'; filePath: string }           // already a normal raster file
  | { kind: 'sut'; pngPaths: string[] }           // cached PNG files, stable for Pixi
  | { kind: 'error'; message: string }
```

For **folder workflows**, either:

- Call the handler per `.sut` when building the effective texture list, or  
- Add a batch variant `resolve-raster-sources-batch(paths: string[])` that preserves order.

### Optional: extend `read-image-base64`

If existing callers need a single data URL, `read-image-base64` may detect `.sut` and return **only the first** successfully extracted tip — document this limitation clearly. **Multi-tip** flows must use the dedicated API above.

---

## Folder Listing and File Dialogs

Today [`readImagePaths`](../src/main/index.ts) filters by `IMAGE_EXTENSIONS` (e.g. `.png`, `.jpg`, …). To surface `.sut` in asset folders and drag-and-drop:

- Add `.sut` to the allowed extension list **or** introduce `readRasterSourcePaths` that unions image extensions and `.sut`.
- Update open-dialog filters where relevant (e.g. `open-asset`, `open-asset-folder` consumers) so users can pick `.sut` when appropriate.

Keep extension constants in **shared** code if both main and renderer need the same list for UI hints.

---

## Renderer Integration (Dynamic Asset Effect)

In [`CellRenderer.updateAsset`](../src/renderer/utils/CellRenderer.ts), before `PIXI.Assets.load(toFileUrl(path))`:

1. If `path` ends with `.sut` (case-insensitive), **invoke IPC** to resolve to `pngPaths[]`.
2. **Expand in order:** for `assetPaths = ['a.sut', 'b.png']`, the effective texture list becomes `[...tips from a in stable order], [b.png]]`. Document the ordering rule in code comments.
3. If resolution fails, log and skip that entry (consistent with current per-path `try/catch` behavior).

**Do not** persist expanded paths into Zustand for long-term storage.

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
