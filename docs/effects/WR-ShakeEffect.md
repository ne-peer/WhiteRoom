Created: 2026-05-16
Last Updated: 2026-05-16 (rev 1)

# WhiteRoom Shake Effect Specification

## Purpose

Applies a vertical oscillation to the cell image.  
An optional **trail delay** overlay renders a masked circular region that follows the shake with a configurable lag, producing a fluid, organic feel.  
Multiple independent trail areas can be defined per cell (up to `SHAKE_TRAIL_AREA_MAX_COUNT`).

---

## Placement

- UI: **Motion category (yellow)**, after the Flash Effect section
- `titleColor`: `#f5cc30` (motion category unified color)

---

## Constants

```typescript
/** Maximum number of independently configurable trail areas per cell. */
export const SHAKE_TRAIL_AREA_MAX_COUNT = 5
```

Declare in `src/shared/types.ts` (or a co-located constants file). Any feature that enforces or displays the limit must import this constant — never hard-code `5`.

---

## Type Definitions

### `ShakeTrailArea`

One independently positioned circular trail region.

```typescript
export type ShakeTrailArea = {
  centerX: number        // normalized 0–1 (0 = left edge of cell); default 0.5
  centerY: number        // normalized 0–1 (0 = top edge of cell); default 0.5
  size: number           // ellipse horizontal radius ratio (0–1); default 0.7
  height: number         // height-to-width ratio of the ellipse (0–1); default 1.0
  duplicateEnabled: boolean          // mirror this area left/right; default false
  duplicateSpacingShift: number      // fine-tune center-to-center distance; -0.5–+0.5; default 0
  duplicateVerticalSpacingShift: number  // alternate Y stagger; -0.5–+0.5; default 0
}
```

**`duplicateSpacingShift`** — adjustment relative to the "flush" baseline where each copy's center is exactly one horizontal radius `rx` away from the shared center. Actual center-to-center half-distance = `rx × (1 + value)`.

**`duplicateVerticalSpacingShift`** — the left copy's Y offset = `−ry × value`, right copy's = `+ry × value` (pixels). Produces an alternating-row stagger effect.

### `ShakeEffect`

```typescript
export type ShakeEffect = {
  // ── Core shake ────────────────────────────────────────────────────────
  enabled: boolean
  mode: 'once' | 'loop'
  directionDeg: number            // animation direction in degrees; 0=right, 90=vertical; default 90
  repeatEnabled: boolean          // 'once' mode only
  repeatIntervalSec: number       // seconds between repeats; default 3
  amplitudeFactor: number         // vertical amplitude scale (once); default 0.5
  speedFactor: number             // bounce speed scale (once); default 0.6
  timerSync: boolean              // link shake start to timer
  loopAmplitudePx: number         // peak displacement (loop); default 20
  loopSpeedPxPerSec: number       // movement speed (loop); default 80
  afterimageEnabled: boolean
  afterimageDurationSec: number   // default 0.35
  manualTriggerNonce: number      // increment to fire manual test

  // ── Trail (shared settings) ───────────────────────────────────────────
  trailEnabled: boolean
  trailDelaySec: number           // seconds of lag before trail follows; default 0.01
  trailAlpha: number              // trail overlay opacity 0–1; default 0.8
  trailBlurStrength: number       // BlurFilter strength applied to trail sprites; default 0
  trailSecondStageEnabled: boolean
  trailSecondStageSize: number    // second-stage size ratio relative to area size; 0.1–1.0; default 0.62
  trailSecondStageDelayFactor: number  // second-stage delay as a fraction of trailDelaySec; default 0.25
  lockBaseImage?: boolean         // freeze base image while trail is active; default false

  // ── Trail areas ───────────────────────────────────────────────────────
  /** Independent circular trail regions. Length 1–SHAKE_TRAIL_AREA_MAX_COUNT. */
  trailAreas: ShakeTrailArea[]
}
```

Add `shake: ShakeEffect` to `CellEffects`.

---

## Default Values

```typescript
const DEFAULT_SHAKE_TRAIL_AREA: ShakeTrailArea = {
  centerX: 0.5,
  centerY: 0.5,
  size: 0.7,
  height: 1.0,
  duplicateEnabled: false,
  duplicateSpacingShift: 0,
  duplicateVerticalSpacingShift: 0,
}

const DEFAULT_SHAKE: ShakeEffect = {
  enabled: false,
  mode: 'once',
  directionDeg: 90,
  repeatEnabled: false,
  repeatIntervalSec: 3,
  amplitudeFactor: 0.5,
  speedFactor: 0.6,
  timerSync: false,
  loopAmplitudePx: 20,
  loopSpeedPxPerSec: 80,
  afterimageEnabled: false,
  afterimageDurationSec: 0.35,
  manualTriggerNonce: 0,
  trailEnabled: false,
  trailDelaySec: 0.01,
  trailAlpha: 0.8,
  trailBlurStrength: 0,
  trailSecondStageEnabled: false,
  trailSecondStageSize: 0.62,
  trailSecondStageDelayFactor: 0.25,
  lockBaseImage: false,
  trailAreas: [{ ...DEFAULT_SHAKE_TRAIL_AREA }],
}
```

---

## UI Layout

### Core Shake

Direction option is shown directly under Mode. It uses `directionDeg` with a 0-350 degree range in 10-degree steps; default `90` preserves the original vertical shake.

| Label (JA) | Label (EN) | Control | Range / Notes |
|---|---|---|---|
| 有効 | Enabled | Toggle | — |
| 方式 | Mode | Select | 単発 / 永久 |
| 繰り返す | Repeat | Toggle | once mode only |
| 実行間隔 | Interval | Slider | sec; shown when repeat enabled |
| 振幅 | Amplitude | Slider | amplitudeFactor; once mode |
| 速度 | Speed | Slider | speedFactor; once mode |
| 移動量 | Range | Slider | loopAmplitudePx; loop mode |
| 移動速度 | Move speed | Slider | loopSpeedPxPerSec; loop mode |
| 残像 | Afterimage | Toggle | — |
| 残像時間 | Duration | Slider | afterimageDurationSec |
| タイマー同期 | Timer sync | Toggle | — |
| 動作確認 | Test motion | Button | increments manualTriggerNonce |

### Trail (shared)

| Label (JA) | Label (EN) | Control | Range / Notes |
|---|---|---|---|
| 追従遅延 | Trail delay | Toggle (section header) | trailEnabled |
| 遅延時間 | Delay time | Slider | trailDelaySec |
| 追従透明度 | Trail opacity | Slider | trailAlpha 0–1 |
| 追従ブラー | Trail blur | Slider | trailBlurStrength 0–100 |
| 2段階追従 | Two-stage trail | Toggle | trailSecondStageEnabled |
| 2段目の大きさ | Second-stage size | Slider | trailSecondStageSize 0.1–1.0 |
| 2段目の遅延係数 | Second-stage delay factor | Slider | trailSecondStageDelayFactor |
| ベース画像を固定 | Lock base image | Toggle | lockBaseImage |

### Trail Areas

Shown inside the trail section when `trailEnabled = true`.

```
┌──────────────────────────────────────────────────────┐
│ エリア 1                                [ピック] [✕] │
│  サイズ ──●────  高さ ───●───                        │
│  複製 [OFF]                                          │
├──────────────────────────────────────────────────────┤
│ エリア 2                                [ピック] [✕] │
│  サイズ ──●────  高さ ────●──                        │
│  複製 [ON]  円の間隔 ──●───  上下間隔 ──●──           │
├──────────────────────────────────────────────────────┤
│                          [＋ エリアを追加]             │
└──────────────────────────────────────────────────────┘
```

- **サイズ / Size** — `size` slider (0–100 % → `size = v / 100`)
- **高さ / Height** — `height` slider (0–100 % → `height = v / 100`)
- **複製 / Duplicate** — `duplicateEnabled` toggle
- **円の間隔 / Circle spacing** — `duplicateSpacingShift` slider; shown only when `duplicateEnabled = true`
- **上下間隔 / Vertical stagger** — `duplicateVerticalSpacingShift` slider; shown only when `duplicateEnabled = true`
- **[ピック] / [Pick]** — starts center-position pick mode for that specific area index
- **[✕]** — removes that area; disabled when only one area remains
- **[＋ エリアを追加] / [＋ Add area]** — appends a new area with default values; disabled at `SHAKE_TRAIL_AREA_MAX_COUNT`

---

## Pick Mode (per area)

### appStore state

```typescript
shakeTrailPicking: false | number   // false = inactive; number = area index being picked
```

Mutually exclusive with all other pick modes.

### Behavior

1. User presses **[ピック]** for area index `i` → `shakeTrailPicking = i`.
2. On click inside the active column:
   - Compute normalized `(x, y)` within the cell.
   - Patch `trailAreas[i].centerX/Y`.
3. Click is consumed; pick mode auto-exits.
4. `Escape` or out-of-column click → cancel.

### Guide display

While `shakeTrailPicking` is active or the trail section is expanded, draw on `guideLayer`:
- Per area: ellipse outline at `(centerX, centerY)` with matching `size` / `height`; label `①②…` for each area.
- Duplicate copies shown as dashed ellipses when `duplicateEnabled = true`.

---

## Rendering

### Trail sprite instantiation

For each area in `trailAreas`:
- Spawn one `PIXI.Sprite` (reference to imageLayer texture) with an elliptical mask `PIXI.Graphics`.
- If `duplicateEnabled`, spawn a second masked sprite for the mirrored copy.
- If `trailSecondStageEnabled`, spawn additional sprites at `size × trailSecondStageSize` for each area.
- All trail sprites are children of `shakeTrailLayer`.

Apply `PIXI.BlurFilter` (strength = `trailBlurStrength`) per area group.

### Trail synchronization

`syncShakeTrail` positions every trail sprite according to the time-delayed sample from `shakeTrailSamples`, applying each area's own `centerX/Y`, `size`, `height`, and duplicate geometry.
The sampled one-dimensional shake offset is projected by `directionDeg`, so the base shake and all delayed trail stages share the same animation direction.

---

## Profile Compatibility (Migration)

When loading a profile that has the **old flat fields** (`trailCenterX`, `trailCenterY`, `trailSize`, `trailHeight`, `trailDuplicateCirclesEnabled`, `trailDuplicateSpacingShift`, `trailDuplicateVerticalSpacingShift`) instead of `trailAreas`, migrate inside `mergeEffectsWithDefaults`:

```typescript
if (!effects?.shake?.trailAreas && effects?.shake) {
  const s = effects.shake as Record<string, unknown>
  migratedTrailAreas = [{
    centerX: (s.trailCenterX as number) ?? 0.5,
    centerY: (s.trailCenterY as number) ?? 0.5,
    size: (s.trailSize as number) ?? 0.7,
    height: (s.trailHeight as number) ?? 1.0,
    duplicateEnabled: (s.trailDuplicateCirclesEnabled as boolean) ?? false,
    duplicateSpacingShift: (s.trailDuplicateSpacingShift as number) ?? 0,
    duplicateVerticalSpacingShift: (s.trailDuplicateVerticalSpacingShift as number) ?? 0,
  }]
}
```

Merge result:
```typescript
shake: {
  ...DEFAULT_SHAKE,
  ...effects?.shake,
  trailAreas: migratedTrailAreas ?? effects?.shake?.trailAreas ?? DEFAULT_SHAKE.trailAreas,
}
```

---

## i18n Keys (additions for multi-area)

Existing keys remain unchanged. Add:

| Key | JA | EN |
|---|---|---|
| `shakeTrailAreaLabel` | エリア {n} | Area {n} |
| `shakeTrailAreaSize` | サイズ | Size |
| `shakeTrailAreaHeight` | 高さ | Height |
| `shakeTrailAreaDuplicate` | 複製 | Duplicate |
| `shakeTrailAreaDuplicateGap` | 円の間隔 | Circle spacing |
| `shakeTrailAreaDuplicateVerticalGap` | 上下間隔 | Vertical stagger |
| `shakeTrailAreaPickButton` | ピック | Pick |
| `shakeTrailAreaAdd` | エリアを追加 | Add area |
| `shakeTrailAreaMaxReached` | 最大 {max} エリア | Max {max} areas |
