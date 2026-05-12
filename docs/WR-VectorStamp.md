> **DRAFT**  
> This document is a pre-release design note. For a stable release, remove this DRAFT block and draft-only guidance from the top of the file, revise dates and body text to match shipped behavior, and update the Vector Stamp pointer in `AGENTS.md` to a normal spec link (see `AGENTS.md` for the release checklist).

Created: 2026-05-12  
Last Updated: 2026-05-12

# WhiteRoom Vector Stamp Specification

## Purpose

Bundled asset images used by the asset effect (e.g. heart-sketch PNGs) tend to push **machine-specific absolute paths** into `AppProfile` and per-folder `whiteroom_effects.json`, which hurts portability and maintenance.

This specification moves bundled artwork to **path-independent procedural vector drawing** while **keeping** the existing **user raster** workflow (user-selected image paths and `PIXI.Assets.load()`). Flash and other effects should be able to **reuse the same vector drawing layer** over time.

---

## Goals

1. **Built-in presets**: Reproduce visuals via **preset IDs** (optionally versioned keys), not via saved paths to bundled PNG files.
2. **User assets**: Preserve **raster** dynamic-asset behavior: users can still pick image files or folders as today.
3. **Reuse**: Asset effect (rising / emergence patterns), flash, and future effects share a **single vector stamp API** in the renderer.
4. **Look parameters**: Size, color, and opacity are driven by instance / effect settings.
5. **Shape extensibility**: Start with a heart preset only, but allow **new presets** by extending the in-app registry (definitions live in code or bundled data; **do not** store Bézier control-point arrays in profile JSON).
6. **Groups**: Support **logical groups** of multiple vector instances (e.g. three hearts with random size/color) that can be **animated as one unit** (translate, rotate, fade).

---

## Non-Goals

- User-editable control points or JSON that redefines the base vector silhouette.
- Mesh-level warping or arbitrary per-control-point deformation (“art tool” complexity).

---

## Raster and vector coexistence

| Kind | Behavior | Saved in profiles / `whiteroom_effects.json` |
|------|----------|-----------------------------------------------|
| **Raster** | Load user images with `PIXI.Assets.load()` (or equivalent); keep existing `assetPath` / `assetPaths` / folder flows. | Same rules as today (e.g. **relative** paths where applicable). |
| **Vector** | Draw from an in-app registry by **preset ID** via `PIXI.Graphics` (or similar). Bundled heart-sketch PNGs are replaced by this path. | **No image paths**; store `presetId` (and numeric parameters only). |

Implementation uses explicit fields on `DynamicAssetEffect` (e.g. `sourceKind: 'raster' | 'vector'`, `vectorPresetId`). **Imported JSON without `sourceKind` merges as `raster`** so older profiles keep working. Canonical field names live in [`src/shared/types.ts`](../src/shared/types.ts).

---

## Deformation scope

- **Base shape** is fixed by the preset definition (Bézier path, etc.).
- **Runtime transforms** are limited to **deterministic code** (scale, rotation, optional affine skew, timer-linked `alpha`, motion offsets, simple periodic wobble).  
  There is **no** requirement to serialize per-point shape edits in JSON.

---

## Group coordinate model

- **Group anchor**: Normalized coordinates **0–1** over the cell (or target draw rect).
- **Children**: Positions and spawn jitter in **group-local** space.

Revise this section if product feedback requires a different convention.

---

## Architecture notes (implementation)

- Keep PixiJS ownership in **`CellRenderer`** (and helpers); do not drive display objects from React (`AGENTS.md` coding rules).
- **Registry**: preset ID → path in a normalized space + default fill/stroke. Adding a shape means registering one definition.
- **Modules**: Prefer a dedicated helper (e.g. `vectorStampRegistry.ts`) alongside `TextSystem` / `ParticleSystem` rather than growing `CellRenderer` without bound.
- **Groups**: Parent `PIXI.Container` with child `Graphics` (or child containers); animate the parent; destroy the parent to avoid leaks.
- **Performance**: Prefer updating `transform` / `alpha`; avoid per-frame full `clear()` + full retrace for many instances unless profiling shows it is necessary.

---

## Related code (reference)

- Shared types: [`src/shared/types.ts`](../src/shared/types.ts) — `DynamicAssetEffect`, `AssetParticle`, `DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART`.
- Renderer: [`src/renderer/utils/CellRenderer.ts`](../src/renderer/utils/CellRenderer.ts) — dynamic asset / `updateAsset`.
- Vector helper: [`src/renderer/utils/vectorStampRegistry.ts`](../src/renderer/utils/vectorStampRegistry.ts).
- UI: [`src/renderer/components/effects/EffectsPanel.tsx`](../src/renderer/components/effects/EffectsPanel.tsx) — preset asset and vector/raster selector.

---

## Documentation checklist (stable release)

1. Remove the **DRAFT** banner and draft-only notes from the top of this file.  
2. Update **Last Updated** and body text to match the shipped product.  
3. In `AGENTS.md`, drop “draft” wording and the release-instructions paragraph from the Vector Stamp section; keep a short pointer like other specs.  
4. Optionally add a one-line user-facing note to `RELEASE_NOTES.md` when the feature ships.
