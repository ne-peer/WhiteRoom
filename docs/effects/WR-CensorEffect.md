Created: 2026-05-15
Last Updated: 2026-05-15 (rev 2)

# WhiteRoom Censor Effect Specification

## Purpose

Lets the user paint rectangular censorship bars over arbitrary areas of the displayed image. Bars can optionally appear only when the Focus Effect center moves nearby, or can track the Shake Effect's trail region.

---

## Placement

- UI: bottom of the **Decoration category (purple)**, after the Text Effect section
- `titleColor`: `#b070f8` (decoration category unified color)

---

## Type Definition

```typescript
export type CensorRect = {
  x: number   // left edge; normalized 0–1 within the cell
  y: number   // top edge; normalized 0–1 within the cell
  w: number   // width; normalized 0–1
  h: number   // height; normalized 0–1
}

export type CensorEffect = {
  enabled: boolean
  rects: CensorRect[]                          // user-defined rectangles; no enforced maximum
  color: { r: number; g: number; b: number }  // fill color; default { r:13, g:13, b:13 } (#0d0d0d)
  alpha: number                                // fill opacity; 0–1; default 0.9
  linkToFocus: boolean                         // show rects only near focus center; default false
  linkToShake: boolean                         // also censor the Shake trail area; default false
}
```

Add `censor: CensorEffect` to `CellEffects`.

---

## Default Values

```typescript
censor: {
  enabled: false,
  rects: [],
  color: { r: 13, g: 13, b: 13 },
  alpha: 0.9,
  linkToFocus: false,
  linkToShake: false,
}
```

---

## UI Options

### Main

| Label (JA) | Label (EN) | Control | Notes |
|---|---|---|---|
| 有効 | Enabled | Toggle | — |

### Filter type

| Label (JA) | Label (EN) | Control | Notes |
|---|---|---|---|
| タイプ | Type | Select | `color` only (others reserved for future) |
| カラー | Color | ColorPicker | shown when type = `color` |
| 透明度 | Opacity | Slider | 0–100 % → `alpha = v / 100` |

### Censor areas

| Label (JA) | Label (EN) | Control | Notes |
|---|---|---|---|
| エリアを追加 | Add area | Button | starts rect pick mode |
| クリア | Clear | Button | resets `rects` to `[]` |

Added rects are listed with index numbers (e.g. "① x:0.10 y:0.20 w:0.30 h:0.15").

### Options

| Label (JA) | Label (EN) | Control | Notes |
|---|---|---|---|
| フォーカスエフェクト連動 | Focus Effect link | Toggle | `linkToFocus` |
| シェイクエフェクトエリアを検閲 | Censor Shake area | Toggle | `linkToShake` |

---

## Rendering

### Layer

Add `censorLayer: PIXI.Container` to `container` after `focusLayer`, before `guideLayer`.

```
container
  ...
  |- fogLayer     [6]
  |- focusLayer   [7]  (see WR-FocusEffect.md)
  |- censorLayer  [8]  ← this
  |- guideLayer   [9]
```

### Drawing (`updateCensor` / `tickCensor`)

Clear and redraw `censorGraphics: PIXI.Graphics` every frame.

#### User-defined rects

```
for each rect in censor.rects:
  draw filled rect at (rect.x*W, rect.y*H, rect.w*W, rect.h*H)
    fill color(r,g,b) alpha
```

#### Shake area censor (`linkToShake`)

When `linkToShake` is true, regardless of whether `shake.enabled` is on:

```
cx = effectCenter.x * W
cy = effectCenter.y * H
rx = shake.trailSize * min(W,H) / 2
ry = rx * (shake.trailHeight ?? 1)
draw filled ellipse at (cx, cy) with radii (rx, ry) * 1.15, fill color(r,g,b) alpha

if shake.trailDuplicateCirclesEnabled:
  compute the two actual left/right circle centers using trailDuplicateSpacingShift and
  trailDuplicateVerticalSpacingShift (mirror the mask geometry from CellRenderer)
  draw the two ellipses as one merged fill so overlapping pixels are not multiplied.
  The renderer should use a precomposited mask/sprite for the Shake censor area rather than stacking semi-transparent vector draws.
```

The 1.15 scale applies only to the censor Shake area and must not affect the Shake Effect's own trail mask or guide geometry.

`focusCurrentX/Y` is read from `CellRenderer`'s internal focus state. Falls back to `effectCenter.x/y` when Focus Effect is disabled or has 0 waypoints.

Censor display text is clipped to both user-defined rectangles and the Shake area censor region.

---

## Rect Pick Mode

### appStore State

Add `censorRectPicking: boolean`. Mutually exclusive with all other pick modes.

### Behavior (mirrors `flashRangePicking` pattern)

1. User presses "Add area" → `censorRectPicking = true`.
2. Drag inside the active column:
   - `handleMouseDown`: record drag start into `censorRectDragRef`; restricted to the selected cell's column.
   - `handleMouseMove`: update `censorRectDrag` state for overlay preview.
   - `handleMouseUp`: convert to normalized `CensorRect`; call `setCellEffect(cellId, 'censor', { rects: [...current, newRect] })`; clear drag state.
3. `Escape` or out-of-column click → cancel (extend `cancelPickMode`).

### Drag overlay

- Column highlight (same style as `flashRangeColumnBounds`)
- In-progress rect drawn in `censor.color` at `alpha * 0.5` as a React absolute-positioned div

---

## Profile Compatibility

Add to `mergeEffectsWithDefaults`:
```typescript
censor: { ...DEFAULT_EFFECTS.censor, ...effects?.censor },
```
Old profiles (no `censor` field) load with defaults (`enabled: false`, `rects: []`).

---

## i18n Keys

| Key | JA | EN |
|---|---|---|
| `censorEffect` | 検閲エフェクト | Censor Effect |
| `censorFilterType` | タイプ | Type |
| `censorFilterTypeColor` | カラー | Color |
| `censorColor` | カラー | Color |
| `censorAlpha` | 透明度 | Opacity |
| `censorAddArea` | エリアを追加 | Add area |
| `censorPickActive` | エリア選択中... | Selecting area... |
| `censorPickHint` | 検閲するエリアをドラッグ | Drag the area to censor |
| `censorPickTip` | Escで終了 | Esc to exit |
| `censorClear` | クリア | Clear |
| `censorAreas` | 検閲エリア | Censor areas |
| `censorLinkToFocus` | フォーカスエフェクト連動 | Focus Effect link |
| `censorLinkToShake` | シェイクエフェクトエリアを検閲 | Censor Shake area |
