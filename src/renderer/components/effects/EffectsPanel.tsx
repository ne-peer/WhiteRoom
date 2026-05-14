import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, DEFAULT_EFFECTS } from '../../stores/appStore'
import { CategorySection, Section, Row, Toggle, Slider, ColorPicker, NumberInput, Button, Select, IconButton, HoverTooltip } from '../controls/UIKit'
import { formatCount, useTranslation } from '../../i18n'
import {
  DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART,
  normalizeDynamicAssetEffect,
  type AssetEffectFolder,
  type Cell,
  type CellEffects,
  type DynamicAssetAdditionalEffect,
  type DynamicAssetDisplayFileMode,
  type DynamicAssetSutTipMode,
  type FlashDisplayFileMode,
  type RippleMovePattern,
  type FocusBlurPattern,
} from '../../../shared/types'
import { formatRasterSourceListingExtensionsForTooltip, isSutFilename } from '../../../shared/rasterSourceExtensions'

/** フラッシュ用ベクターアセット（`Select` の候補）。追加時はここに列挙する。 */
const FLASH_BUILTIN_VECTOR_ASSET_OPTIONS = [
  { value: DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART, labelKey: 'dynamicAssetVectorHeart' as const },
] as const

const FALLBACK_FONT_OPTIONS = ['Meiryo', 'BIZ UDPGothic', 'Yu Gothic', 'MS PGothic']
  .map(font => ({ value: font, label: font }))

type Props = { selectedCell: Cell | undefined | null }

/** Zoom/Squish modes that use one-shot style UI (repeat interval, random position, etc.). */
function isZoomSquishOneshotLikeMode(
  mode: 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB' | undefined,
): boolean {
  const m = mode ?? 'oneshotA'
  return m === 'oneshot' || m === 'oneshotA' || m === 'oneshotB'
}

const assetEffectFoldersStartupPromise = typeof window !== 'undefined'
  ? window.api.listAssetEffectFolders().catch(() => ({ folders: [] }))
  : Promise.resolve({ folders: [] })

const DYNAMIC_ASSET_RASTER_FORMATS_TOOLTIP = formatRasterSourceListingExtensionsForTooltip()

const EFFECT_PRESET_1: CellEffects = {
  effectCenter: { x: 0.5, y: 0.5 },
  colorOverlay: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    alpha: 0.3,
    dynamic: false,
    dynamicFrom: 0.2,
    dynamicTo: 0.5,
    dynamicDurationMs: 1000,
    dynamicTimerSync: false,
    imageAdjustEnabled: false,
    brightness: 1,
    saturationMax: 1.25,
    contrastMax: 1.25,
    dynamicAdjust: true,
    dynamicAdjustDurationMs: 1000,
    dynamicAdjustTimerSync: false,
  },
  vignette: {
    enabled: true,
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    intensity: 50,
    dynamic: true,
    dynamicFrom: 0.62,
    dynamicTo: 1,
    dynamicDurationMs: 3000,
    dynamicTimerSync: false,
  },
  spiral: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    pattern: 'classic',
    dualColorEnabled: false,
    secondaryColor: { r: 82, g: 139, b: 255 },
    detail: 82,
    rotationSpeedDegPerSec: -330,
    alpha: 0.55,
    radialEnabled: true,
    radialMode: 'periphery',
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 0.6,
    radialFadeStrength: 0.25,
    dynamic: false,
    dynamicFrom: 0.2,
    dynamicTo: 0.8,
    dynamicDurationMs: 1200,
    dynamicTimerSync: false,
  },
  blur: {
    enabled: true,
    strength: 8,
    applyToAll: false,
    gradualEnabled: true,
    gradualDurationSec: 1,
    gradualStartStrength: 0,
    gradualEndStrength: 12,
    gradualTimerSync: false,
    radialEnabled: true,
    radialPattern: 'a',
    radialIntensity: 0.8,
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 1,
    radialHeight: 1,
  },
  echo: {
    enabled: true,
    durationSec: 1.5,
    startAlpha: 0.45,
    startScale: 1,
    endScale: 1.12,
    timerSync: false,
  },
  flash: {
    enabled: false,
    displayFileMode: 'pickFile',
    imagePath: null,
    vectorPresetId: null,
    scaleRatio: 1,
    colorOverlayColor: { r: 255, g: 15, b: 91 },
    colorOverlayAlpha: 1,
    colorOverlayAlphaRandomEnabled: false,
    opacity: 1,
    blurStrength: 0,
    surroundingTransparency: 0,
    innerRadius: 0.5,
    displayDurationSec: 1,
    intervalSec: 1,
    startTransition: 'none',
    startTransitionDurationSec: 0.6,
    endTransition: 'fade',
    endTransitionDurationSec: 0.6,
  },
  breathing: {
    enabled: true,
    speedPxPerSec: 8,
    maxOffsetPx: 8,
    timerSync: false,
    scaleEnabled: true,
    scaleDurationSec: 8,
  },
  shake: {
    enabled: false,
    mode: 'once',
    repeatEnabled: false,
    repeatIntervalSec: 3,
    amplitudeFactor: 1,
    speedFactor: 1,
    timerSync: false,
    loopAmplitudePx: 20,
    loopSpeedPxPerSec: 80,
    afterimageEnabled: false,
    afterimageDurationSec: 0.35,
    manualTriggerNonce: 0,
    trailEnabled: false,
    trailSecondStageEnabled: false,
    trailSecondStageSize: 0.62,
    trailSecondStageDelayFactor: 1,
    trailDelaySec: 0.12,
    trailAlpha: 0.55,
    trailBlurStrength: 2,
    trailCenterX: 0.5,
    trailCenterY: 0.5,
    trailSize: 0.7,
    trailHeight: 1,
    trailDuplicateCirclesEnabled: false,
    trailDuplicateSpacingShift: 0,
    trailDuplicateVerticalSpacingShift: 0,
  },
  zoom: {
    enabled: false,
    mode: 'oneshotA' as const,
    speedFactor: 1,
    repeatEnabled: true,
    repeatIntervalSec: 0.8,
    timerSync: false,
    zoomFactor: 1.5,
    centerCorrection: true,
  },
  squish: {
    enabled: false,
    mode: 'oneshotA' as const,
    organicEnabled: false,
    colorSource: 'manual',
    circleSizeRatio: 0.6,
    gapRatio: 0,
    color: { r: 222, g: 124, b: 155 },
    alpha: 0.45,
    opacity: 1,
    featherStrength: 10,
    speedFactor: 1,
    repeatEnabled: true,
    repeatIntervalSec: 0.8,
    timerSync: false,
    timerSyncStartOpacity: 0 / 100,
    timerSyncEndOpacity: 80 / 100,
    randomPosition: false,
    burstEnabled: false,
    burstMaxOpacity: 0.8,
  },
  dynamicAsset: {
    enabled: true,
    pattern: 'rising',
    displayFileMode: 'asset',
    sourceKind: 'vector',
    vectorPresetId: DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART,
    assetPath: null,
    assetPaths: [],
    assetFolderPath: null,
    spawnIntervalMs: 600,
    riseSpeedPx: 2,
    riseSpeedFactor: 1,
    maxParticles: 20,
    featherStrength: 0,
    sizeRatio: 0.56,
    sizeRandomPercent: 10,
    baseAlpha: 1,
    alphaTimerSync: false,
    emergenceSpeedFactor: 1,
    additionalEffect: 'none',
    additionalEffectSpeedFactor: 1,
    randomRotationEnabled: false,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 15, b: 91 },
    colorOverlayAlpha: 0.5,
    colorOverlayAlphaRandomEnabled: false,
    colorOverlayAlphaRandomMin: 0.4,
    colorOverlayAlphaRandomMax: 1,
    rasterColorInvertEnabled: false,
    sutTipMode: 'allTipsRandom',
    peripheralOnlyRadius: 0,
    rippleMovePattern: 'easeInSine' as RippleMovePattern,
  },
  textEffect: {
    enabled: false,
    texts: ['', '', '', '', ''],
    font: 'Meiryo',
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    alphaTimerSync: false,
    fontSize: 48,
    charIntervalMs: 300,
    displayDurationMs: 1000,
    intervalMs: 600,
    direction: 'vertical',
  },
  fog: {
    enabled: false,
    color: { r: 231, g: 193, b: 211 },
    alpha: 0.3,
    timerSync: false,
    timerSyncStartOpacity: 30 / 100,
    timerSyncEndOpacity: 100 / 100,
    fogCount: 6,
    fogSizeRatio: 0.45,
    blurStrength: 15,
    growDurationSec: 0.4,
    holdDurationSec: 0.3,
    fadeDurationSec: 1,
    dropletEnabled: true,
    dropletCount: 30,
    dropletSpreadRatio: 0.55,
    repeatEnabled: true,
    repeatIntervalSec: 1.5,
    randomPositionEnabled: false,
  },
  focus: {
    enabled: false,
    pattern: 'circular' as const,
    viewSizeRatio: 0.4,
    blurStrength: 20,
    waypoints: [],
    movementSpeedSec: 3,
  },
  censor: {
    enabled: false,
    rects: [],
    color: { r: 13, g: 13, b: 13 },
    alpha: 0.9,
    feather: 0,
    textEnabled: false,
    text: '',
    textFontFamily: 'sans-serif',
    textFontSize: 14,
    textBold: false,
    textItalic: false,
    textColor: { r: 200, g: 200, b: 200 },
    textAlpha: 0.5,
    linkToFocus: false,
    linkToFocusRadius: 0.3,
    linkToShake: false,
  },
}

const EFFECT_PRESET_2: CellEffects = {
  effectCenter: { x: 0.5, y: 0.59 },
  colorOverlay: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    alpha: 0.3,
    dynamic: false,
    dynamicFrom: 0.2,
    dynamicTo: 0.5,
    dynamicDurationMs: 1000,
    dynamicTimerSync: false,
    imageAdjustEnabled: false,
    brightness: 1,
    saturationMax: 1.4,
    contrastMax: 1.35,
    dynamicAdjust: false,
    dynamicAdjustDurationMs: 1000,
    dynamicAdjustTimerSync: false,
  },
  vignette: {
    enabled: false,
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    intensity: 50,
    dynamic: true,
    dynamicFrom: 0.4,
    dynamicTo: 0.7,
    dynamicDurationMs: 1000,
    dynamicTimerSync: false,
  },
  spiral: {
    enabled: true,
    color: { r: 255, g: 0, b: 128 },
    pattern: 'classic',
    dualColorEnabled: false,
    secondaryColor: { r: 82, g: 139, b: 255 },
    detail: 82,
    rotationSpeedDegPerSec: -330,
    alpha: 0.55,
    radialEnabled: true,
    radialMode: 'periphery',
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 0.6,
    radialFadeStrength: 0.25,
    dynamic: true,
    dynamicFrom: 0.2,
    dynamicTo: 0.8,
    dynamicDurationMs: 3000,
    dynamicTimerSync: false,
  },
  blur: {
    enabled: true,
    strength: 0,
    applyToAll: false,
    gradualEnabled: false,
    gradualDurationSec: 1,
    gradualStartStrength: 0,
    gradualEndStrength: 20,
    gradualTimerSync: false,
    radialEnabled: true,
    radialPattern: 'a',
    radialIntensity: 0.8,
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 1,
    radialHeight: 1,
  },
  echo: {
    enabled: false,
    durationSec: 1,
    startAlpha: 0.45,
    startScale: 1,
    endScale: 1.2,
    timerSync: false,
  },
  flash: {
    enabled: false,
    displayFileMode: 'pickFile',
    imagePath: null,
    vectorPresetId: null,
    scaleRatio: 1,
    colorOverlayColor: { r: 255, g: 15, b: 91 },
    colorOverlayAlpha: 1,
    colorOverlayAlphaRandomEnabled: false,
    opacity: 1,
    blurStrength: 0,
    surroundingTransparency: 0,
    innerRadius: 0.5,
    displayDurationSec: 1,
    intervalSec: 1,
    startTransition: 'none',
    startTransitionDurationSec: 0.6,
    endTransition: 'fade',
    endTransitionDurationSec: 0.6,
  },
  breathing: {
    enabled: false,
    speedPxPerSec: 8,
    maxOffsetPx: 20,
    timerSync: false,
    scaleEnabled: false,
    scaleDurationSec: 8,
  },
  shake: {
    enabled: true,
    mode: 'loop',
    repeatEnabled: false,
    repeatIntervalSec: 3,
    amplitudeFactor: 1,
    speedFactor: 1,
    timerSync: false,
    loopAmplitudePx: 20,
    loopSpeedPxPerSec: 80,
    afterimageEnabled: false,
    afterimageDurationSec: 0.35,
    manualTriggerNonce: 2,
    trailEnabled: true,
    trailSecondStageEnabled: true,
    trailSecondStageSize: 0.89,
    trailSecondStageDelayFactor: 0.55,
    trailDelaySec: 0.03,
    trailAlpha: 1,
    trailBlurStrength: 0,
    trailCenterX: 0.5,
    trailCenterY: 0.5,
    trailSize: 0.59,
    trailHeight: 0.92,
    trailDuplicateCirclesEnabled: false,
    trailDuplicateSpacingShift: 0,
    trailDuplicateVerticalSpacingShift: 0,
  },
  zoom: {
    enabled: false,
    mode: 'oneshotA' as const,
    speedFactor: 1,
    repeatEnabled: true,
    repeatIntervalSec: 0.8,
    timerSync: false,
    zoomFactor: 1.5,
    centerCorrection: true,
  },
  squish: {
    enabled: false,
    mode: 'oneshotA' as const,
    organicEnabled: false,
    colorSource: 'manual',
    circleSizeRatio: 0.6,
    gapRatio: 0,
    color: { r: 222, g: 124, b: 155 },
    alpha: 0.45,
    opacity: 1,
    featherStrength: 10,
    speedFactor: 1,
    repeatEnabled: true,
    repeatIntervalSec: 0.8,
    timerSync: false,
    timerSyncStartOpacity: 0 / 100,
    timerSyncEndOpacity: 80 / 100,
    randomPosition: false,
  },
  dynamicAsset: {
    enabled: false,
    pattern: 'rising',
    displayFileMode: 'asset',
    sourceKind: 'raster',
    vectorPresetId: null,
    assetPath: null,
    assetPaths: [],
    assetFolderPath: null,
    spawnIntervalMs: 800,
    riseSpeedPx: 2,
    riseSpeedFactor: 1,
    maxParticles: 20,
    featherStrength: 0,
    sizeRatio: 1,
    sizeRandomPercent: 10,
    baseAlpha: 1,
    alphaTimerSync: false,
    emergenceSpeedFactor: 1,
    additionalEffect: 'none',
    additionalEffectSpeedFactor: 1,
    randomRotationEnabled: false,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 15, b: 91 },
    colorOverlayAlpha: 0.5,
    colorOverlayAlphaRandomEnabled: false,
    colorOverlayAlphaRandomMin: 0.4,
    colorOverlayAlphaRandomMax: 1,
    rasterColorInvertEnabled: false,
    sutTipMode: 'allTipsRandom',
    peripheralOnlyRadius: 0,
    rippleMovePattern: 'easeInSine' as RippleMovePattern,
  },
  textEffect: {
    enabled: false,
    texts: ['', '', '', '', ''],
    font: 'Meiryo',
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    alphaTimerSync: false,
    fontSize: 48,
    charIntervalMs: 300,
    displayDurationMs: 1000,
    intervalMs: 600,
    direction: 'vertical',
  },
  fog: {
    enabled: false,
    color: { r: 231, g: 193, b: 211 },
    alpha: 0.3,
    timerSync: false,
    timerSyncStartOpacity: 30 / 100,
    timerSyncEndOpacity: 100 / 100,
    fogCount: 6,
    fogSizeRatio: 0.45,
    blurStrength: 15,
    growDurationSec: 0.4,
    holdDurationSec: 0.3,
    fadeDurationSec: 1,
    dropletEnabled: true,
    dropletCount: 30,
    dropletSpreadRatio: 0.55,
    repeatEnabled: true,
    repeatIntervalSec: 1.5,
    randomPositionEnabled: false,
  },
  focus: {
    enabled: false,
    pattern: 'circular' as const,
    viewSizeRatio: 0.4,
    blurStrength: 20,
    waypoints: [],
    movementSpeedSec: 3,
  },
  censor: {
    enabled: false,
    rects: [],
    color: { r: 13, g: 13, b: 13 },
    alpha: 0.9,
    feather: 0,
    textEnabled: false,
    text: '',
    textFontFamily: 'sans-serif',
    textFontSize: 14,
    textBold: false,
    textItalic: false,
    textColor: { r: 200, g: 200, b: 200 },
    textAlpha: 0.5,
    linkToFocus: false,
    linkToFocusRadius: 0.3,
    linkToShake: false,
  },
}

export const EffectsPanel: React.FC<Props> = ({ selectedCell }) => {
  const {
    setCellEffect,
    applyCellEffectPreset,
    selectedCellId,
    cells,
    applyEffectChangesToAllColumns,
    setApplyEffectChangesToAllColumns,
    applyEffectsToAll,
    restartEffectsWithRandomTiming,
    syncActiveEffectsInSelectedColumn,
    resetEffectsInSelectedColumn,
    enableAllTimerSyncForSelectedCell,
    disableAllTimerSyncForSelectedCell,
    shakeTrailPositionPicking,
    setShakeTrailPositionPicking,
    spiralRadialPositionPicking,
    setSpiralRadialPositionPicking,
    squishColorPicking,
    setSquishColorPicking,
    flashRangePicking,
    setFlashRangePicking,
    focusWaypointPicking,
    setFocusWaypointPicking,
    censorRectPicking,
    setCensorRectPicking,
    syncZoomSquish,
  } = useAppStore()
  const { language, t } = useTranslation()
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [assetEffectFolders, setAssetEffectFolders] = useState<AssetEffectFolder[]>([])
  const [effectCenterAdjustOpen, setEffectCenterAdjustOpen] = useState(false)
  const [effectCenterHighlightTick, setEffectCenterHighlightTick] = useState(0)
  const effectCenterSectionRef = useRef<HTMLDivElement | null>(null)
  const effectCenterHighlightTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    window.api.listSystemFonts()
      .then(fonts => {
        if (alive) setSystemFonts(fonts)
      })
      .catch(() => {
        if (alive) setSystemFonts([])
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    assetEffectFoldersStartupPromise
      .then(result => {
        if (alive) setAssetEffectFolders(result.folders)
      })
      .catch(() => {
        if (alive) setAssetEffectFolders([])
      })
    return () => { alive = false }
  }, [])

  const selectedFont = selectedCell?.effects.textEffect?.font ?? DEFAULT_EFFECTS.textEffect.font
  const fontOptions = useMemo(() => {
    const fonts = systemFonts.length > 0
      ? systemFonts
      : FALLBACK_FONT_OPTIONS.map(opt => opt.value)
    const values = selectedFont && !fonts.includes(selectedFont)
      ? [selectedFont, ...fonts]
      : fonts
    return values.map(font => ({ value: font, label: font }))
  }, [selectedFont, systemFonts])

  useEffect(() => {
    return () => {
      if (effectCenterHighlightTimerRef.current !== null) {
        window.clearInterval(effectCenterHighlightTimerRef.current)
      }
    }
  }, [])

  if (!selectedCellId || !selectedCell) {
    return (
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' }}>
        {t('selectCellForEffectsLine1')}
        <br />
        {t('selectCellForEffectsLine2')}
      </div>
    )
  }

  const rawEffects = selectedCell.effects
  const effects = {
    ...rawEffects,
    colorOverlay: { ...DEFAULT_EFFECTS.colorOverlay, ...rawEffects.colorOverlay },
    vignette: { ...DEFAULT_EFFECTS.vignette, ...rawEffects.vignette },
    spiral: { ...DEFAULT_EFFECTS.spiral, ...rawEffects.spiral },
    blur: { ...DEFAULT_EFFECTS.blur, ...rawEffects.blur },
    flash: { ...DEFAULT_EFFECTS.flash, ...rawEffects.flash },
    breathing: { ...DEFAULT_EFFECTS.breathing, ...rawEffects.breathing },
    shake: { ...DEFAULT_EFFECTS.shake, ...rawEffects.shake },
    squish: { ...DEFAULT_EFFECTS.squish, ...rawEffects.squish },
    fog: { ...DEFAULT_EFFECTS.fog, ...rawEffects.fog },
    dynamicAsset: normalizeDynamicAssetEffect(
      { ...DEFAULT_EFFECTS.dynamicAsset, ...rawEffects.dynamicAsset },
      __ASSET_EFFECT_FOLDERS__.map(f => f.name),
    ),
    textEffect: { ...DEFAULT_EFFECTS.textEffect, ...rawEffects.textEffect },
  }
  const set = <K extends keyof typeof effects>(key: K, val: Partial<typeof effects[K]>) =>
    setCellEffect(selectedCellId, key, val)

  const applyEffectPreset1 = () => {
    applyCellEffectPreset(selectedCellId, {
      colorOverlay: structuredClone(EFFECT_PRESET_1.colorOverlay),
      vignette: structuredClone(EFFECT_PRESET_1.vignette),
      spiral: structuredClone(EFFECT_PRESET_1.spiral),
      blur: structuredClone(EFFECT_PRESET_1.blur),
      echo: structuredClone(EFFECT_PRESET_1.echo),
      flash: structuredClone(EFFECT_PRESET_1.flash),
      breathing: structuredClone(EFFECT_PRESET_1.breathing),
      shake: structuredClone(EFFECT_PRESET_1.shake),
      squish: structuredClone(EFFECT_PRESET_1.squish),
      dynamicAsset: structuredClone(EFFECT_PRESET_1.dynamicAsset),
      textEffect: structuredClone(EFFECT_PRESET_1.textEffect),
    })
  }

  const applyEffectPreset2 = () => {
    applyCellEffectPreset(selectedCellId, {
      effectCenter: structuredClone(EFFECT_PRESET_2.effectCenter),
      colorOverlay: structuredClone(EFFECT_PRESET_2.colorOverlay),
      vignette: structuredClone(EFFECT_PRESET_2.vignette),
      spiral: structuredClone(EFFECT_PRESET_2.spiral),
      blur: structuredClone(EFFECT_PRESET_2.blur),
      echo: structuredClone(EFFECT_PRESET_2.echo),
      flash: structuredClone(EFFECT_PRESET_2.flash),
      breathing: structuredClone(EFFECT_PRESET_2.breathing),
      shake: structuredClone(EFFECT_PRESET_2.shake),
      squish: structuredClone(EFFECT_PRESET_2.squish),
      dynamicAsset: structuredClone(EFFECT_PRESET_2.dynamicAsset),
      textEffect: structuredClone(EFFECT_PRESET_2.textEffect),
    })
  }

  const hasColumnSyncTarget = cells.some(c =>
    c.col === selectedCell.col &&
    (
      (c.effects.vignette.enabled && c.effects.vignette.dynamic) ||
      (c.effects.spiral?.enabled && c.effects.spiral?.dynamic) ||
      (c.effects.colorOverlay?.enabled && c.effects.colorOverlay?.dynamic) ||
      (c.effects.colorOverlay?.imageAdjustEnabled && c.effects.colorOverlay?.dynamicAdjust) ||
      (c.effects.blur.enabled && c.effects.blur.gradualEnabled) ||
      c.effects.echo.enabled ||
      c.effects.squish?.enabled
    )
  )

  const handleOpenAsset = async () => {
    const result = await window.api.openAsset(language)
    if (!result.canceled && result.filePath) {
      set('dynamicAsset', {
        displayFileMode: 'pickImage',
        sourceKind: 'raster',
        vectorPresetId: null,
        assetPath: result.filePath,
        assetPaths: [result.filePath],
        assetFolderPath: null,
      })
    }
  }

  const handleOpenAssetFolder = async () => {
    const result = await window.api.openAssetFolder(language)
    if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
      set('dynamicAsset', {
        displayFileMode: 'pickImage',
        sourceKind: 'raster',
        vectorPresetId: null,
        assetPath: result.images[0],
        assetPaths: result.images,
        assetFolderPath: result.folderPath,
      })
    }
  }

  const handleDynamicAssetDisplayFileModeChange = (mode: DynamicAssetDisplayFileMode) => {
    if (mode === effects.dynamicAsset.displayFileMode) return
    if (mode === 'asset') {
      set('dynamicAsset', {
        displayFileMode: 'asset',
        sourceKind: 'vector',
        vectorPresetId: DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART,
        assetPath: null,
        assetPaths: [],
        assetFolderPath: null,
      })
      return
    }
    set('dynamicAsset', {
      displayFileMode: 'pickImage',
      sourceKind: 'raster',
      vectorPresetId: null,
      assetPath: null,
      assetPaths: [],
      assetFolderPath: null,
    })
  }

  const handleOpenFlashImage = async () => {
    const result = await window.api.openOverlayImage(language)
    if (!result.canceled && result.filePath) {
      set('flash', { imagePath: result.filePath, vectorPresetId: null, displayFileMode: 'pickFile' })
    }
  }

  const handleFlashDisplayFileModeChange = (mode: FlashDisplayFileMode) => {
    const f = effects.flash
    if (mode === f.displayFileMode) return
    setFlashRangePicking(false)
    if (mode === 'pickFile') {
      set('flash', {
        displayFileMode: 'pickFile',
        vectorPresetId: null,
        ...(f.imagePath?.startsWith('data:') ? { imagePath: null } : {}),
      })
      return
    }
    if (mode === 'displayCrop') {
      set('flash', {
        displayFileMode: 'displayCrop',
        vectorPresetId: null,
        ...(!f.imagePath?.startsWith('data:') ? { imagePath: null } : {}),
      })
      return
    }
    set('flash', {
      displayFileMode: 'asset',
      imagePath: null,
      vectorPresetId: f.vectorPresetId ?? DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART,
    })
  }

  const handleSelectAssetEffectSource = (value: string) => {
    if (value.startsWith('__vector:')) {
      const id = value.slice('__vector:'.length)
      set('dynamicAsset', {
        displayFileMode: 'asset',
        sourceKind: 'vector',
        vectorPresetId: id,
        assetPath: null,
        assetPaths: [],
        assetFolderPath: null,
      })
      return
    }
    handleSelectAssetEffectFolder(value)
  }

  const handleSelectAssetEffectFolder = (folderName: string) => {
    if (!folderName) return
    const folder = assetEffectFolders.find(item => item.name === folderName)
    if (!folder) return
    set('dynamicAsset', {
      displayFileMode: 'asset',
      sourceKind: 'raster',
      vectorPresetId: null,
      assetPath: folder.images[0],
      assetPaths: folder.images,
      assetFolderPath: folder.path,
    })
  }
  const scrollToEffectCenterSetting = () => {
    effectCenterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (effectCenterHighlightTimerRef.current !== null) {
      window.clearInterval(effectCenterHighlightTimerRef.current)
      effectCenterHighlightTimerRef.current = null
    }
    let tick = 0
    setEffectCenterHighlightTick(1)
    effectCenterHighlightTimerRef.current = window.setInterval(() => {
      tick += 1
      if (tick >= 8) {
        if (effectCenterHighlightTimerRef.current !== null) {
          window.clearInterval(effectCenterHighlightTimerRef.current)
          effectCenterHighlightTimerRef.current = null
        }
        setEffectCenterHighlightTick(0)
        return
      }
      setEffectCenterHighlightTick(tick + 1)
    }, 220)
  }
  const assetEffectFolderLabel = language === 'ja' ? 'プリセットアセット' : 'Preset asset'
  const dynamicAssetPattern = effects.dynamicAsset.pattern ?? 'rising'
  const bounceAllowed = dynamicAssetPattern === 'emergence' || dynamicAssetPattern === 'ripple'
  const visibleDynamicAssetAdditionalEffect =
    !bounceAllowed && effects.dynamicAsset.additionalEffect === 'bounce'
      ? 'none'
      : effects.dynamicAsset.additionalEffect ?? 'none'
  const dynamicAssetAdditionalEffectOptions = [
    { value: 'none', label: t('assetAdditionalEffectNone') },
    { value: 'jiggle', label: t('assetAdditionalEffectJiggle') },
    ...(bounceAllowed
      ? [{ value: 'bounce', label: t('assetAdditionalEffectBounce') }]
      : []),
    { value: 'wiggle', label: t('assetAdditionalEffectWiggle') },
  ]

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button small variant="secondary" onClick={applyEffectPreset1}>
          {t('samplePresetBlur')}
        </Button>
        <Button small variant="secondary" onClick={applyEffectPreset2}>
          {t('samplePresetShake')}
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Row label={t('applyEffectChangesToAllColumns')}>
          <Toggle
            value={applyEffectChangesToAllColumns}
            onChange={setApplyEffectChangesToAllColumns}
          />
        </Row>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', wordBreak: 'break-all' }}>
          {t('applyEffectChangesToAllColumnsHelp')}
        </div>
        <div
          ref={effectCenterSectionRef}
          style={{
            marginTop: 8,
            padding: '6px 8px',
            borderRadius: 8,
            border: effectCenterHighlightTick > 0 && effectCenterHighlightTick % 2 === 1
              ? '1px solid rgba(140, 220, 255, 0.55)'
              : '1px solid transparent',
            background: effectCenterHighlightTick > 0 && effectCenterHighlightTick % 2 === 1
              ? 'rgba(80, 180, 255, 0.12)'
              : 'transparent',
            boxShadow: effectCenterHighlightTick > 0 && effectCenterHighlightTick % 2 === 1
              ? '0 0 0 1px rgba(120, 210, 255, 0.25), 0 0 16px rgba(120, 210, 255, 0.15)'
              : 'none',
            transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
          }}
        >
          <Row label={t('effectCenterSetting')}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                small
                variant={(shakeTrailPositionPicking || spiralRadialPositionPicking) ? 'primary' : 'secondary'}
                onClick={() => {
                  const next = !(shakeTrailPositionPicking || spiralRadialPositionPicking)
                  setShakeTrailPositionPicking(next)
                  setSpiralRadialPositionPicking(next)
                }}
              >
                {(shakeTrailPositionPicking || spiralRadialPositionPicking) ? t('shakeTrailPickActive') : t('shakeTrailPickButton')}
              </Button>
              <Button
                small
                variant={effectCenterAdjustOpen ? 'primary' : 'secondary'}
                onClick={() => setEffectCenterAdjustOpen(v => !v)}
              >
                {t('adjust')}
              </Button>
            </div>
          </Row>
          {effectCenterAdjustOpen && (
            <>
              <Row label={t('effectCenterX')}>
                <Slider
                  value={Math.round((effects.effectCenter?.x ?? DEFAULT_EFFECTS.effectCenter.x) * 100)}
                  min={0}
                  max={100}
                  onChange={v => setCellEffect(selectedCellId, 'effectCenter', { x: v / 100 })}
                  unit="%"
                />
              </Row>
              <Row label={t('effectCenterY')}>
                <Slider
                  value={Math.round((effects.effectCenter?.y ?? DEFAULT_EFFECTS.effectCenter.y) * 100)}
                  min={0}
                  max={100}
                  onChange={v => setCellEffect(selectedCellId, 'effectCenter', { y: v / 100 })}
                  unit="%"
                />
              </Row>
            </>
          )}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            {t('effectCenterSettingHelp')}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(130, 130, 170, 0.60)', lineHeight: 1.5, padding: '0 2px', textAlign: 'right' }}>
            {t('effectCenterShortcutHelp')}
          </div>
        </div>
      </div>

      {/* ===== フィルターカテゴリ ===== */}
      <CategorySection
        title={t('effectCategoryFilter')}
        headerBg="rgba(42, 88, 196, 0.55)"
        bodyBg="rgba(28, 65, 165, 0.15)"
      >

      <Section title={t('colorFilter')} titleColor="#82b0ff">
        <Row label={t('enabled')}>
          <Toggle value={effects.colorOverlay.enabled} onChange={v => set('colorOverlay', { enabled: v })} />
        </Row>
        {effects.colorOverlay.enabled && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('color')}</div>
            <ColorPicker
              r={effects.colorOverlay.color.r}
              g={effects.colorOverlay.color.g}
              b={effects.colorOverlay.color.b}
              onChange={(r, g, b) => set('colorOverlay', { color: { r, g, b } })}
            />
            {!effects.colorOverlay.dynamic && (
              <Row label={t('opacity')}>
                <Slider
                  value={Math.round(effects.colorOverlay.alpha * 100)}
                  min={0}
                  max={100}
                  onChange={v => set('colorOverlay', { alpha: v / 100 })}
                  unit="%"
                />
              </Row>
            )}
            <Row label={t('dynamicReflect')}>
              <Toggle value={effects.colorOverlay.dynamic} onChange={v => set('colorOverlay', { dynamic: v })} />
            </Row>
            {effects.colorOverlay.dynamic && (
              <>
                <Row label={t('startOpacity')}>
                  <Slider
                    value={Math.round((effects.colorOverlay.dynamicFrom ?? 0) * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('colorOverlay', { dynamicFrom: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('endOpacity')}>
                  <Slider
                    value={Math.round((effects.colorOverlay.dynamicTo ?? 1) * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('colorOverlay', { dynamicTo: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('changeDuration')}>
                  <NumberInput
                    value={(effects.colorOverlay.dynamicDurationMs ?? 1000) / 1000}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit={t('seconds')}
                    onChange={v => set('colorOverlay', { dynamicDurationMs: v * 1000 })}
                  />
                </Row>
                <Row label={t('timerSync')}>
                  <Toggle
                    value={effects.colorOverlay.dynamicTimerSync ?? false}
                    onChange={v => set('colorOverlay', { dynamicTimerSync: v })}
                    theme="timerSync"
                  />
                </Row>
              </>
            )}
          </div>
        )}
      </Section>

      <Section title={t('imageEnhanceFilter')} titleColor="#82b0ff">
        <Row label={t('enabled')}>
          <Toggle
            value={effects.colorOverlay.imageAdjustEnabled}
            onChange={v => set('colorOverlay', { imageAdjustEnabled: v })}
          />
        </Row>
        {effects.colorOverlay.imageAdjustEnabled && (
          <>
            <Row label={t('imageBrightness')}>
              <Slider
                value={Math.round((effects.colorOverlay.brightness ?? 1) * 100)}
                min={30}
                max={200}
                onChange={v => set('colorOverlay', { brightness: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('saturationMax')}>
              <Slider
                value={Math.round(effects.colorOverlay.saturationMax * 100)}
                min={100}
                max={250}
                onChange={v => set('colorOverlay', { saturationMax: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('contrastMax')}>
              <Slider
                value={Math.round(effects.colorOverlay.contrastMax * 100)}
                min={100}
                max={250}
                onChange={v => set('colorOverlay', { contrastMax: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('dynamicImageEnhance')}>
              <Toggle
                value={effects.colorOverlay.dynamicAdjust}
                onChange={v => set('colorOverlay', { dynamicAdjust: v })}
              />
            </Row>
            {effects.colorOverlay.dynamicAdjust && (
              <>
                <Row label={t('changeDuration')}>
                  <NumberInput
                    value={effects.colorOverlay.dynamicAdjustDurationMs / 1000}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit={t('seconds')}
                    onChange={v => set('colorOverlay', { dynamicAdjustDurationMs: v * 1000 })}
                  />
                </Row>
                <Row label={t('timerSync')}>
                  <Toggle
                    value={effects.colorOverlay.dynamicAdjustTimerSync ?? false}
                    onChange={v => set('colorOverlay', { dynamicAdjustTimerSync: v })}
                    theme="timerSync"
                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('vignetteEffect')} titleColor="#82b0ff">
        <Row label={t('enabled')}>
          <Toggle value={effects.vignette.enabled} onChange={v => set('vignette', { enabled: v })} />
        </Row>
        {effects.vignette.enabled && (
          <>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('color')}</div>
              <ColorPicker
                r={effects.vignette.color.r}
                g={effects.vignette.color.g}
                b={effects.vignette.color.b}
                onChange={(r, g, b) => set('vignette', { color: { r, g, b } })}
              />
              {!effects.vignette.dynamic && (
                <Row label={t('opacity')}>
                  <Slider
                    value={Math.round(effects.vignette.alpha * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('vignette', { alpha: v / 100 })}
                    unit="%"
                  />
                </Row>
              )}
            </div>
            <Row label={t('strength')}>
              <Slider
                value={Math.round(effects.vignette.intensity ?? 50)}
                min={0}
                max={100}
                onChange={v => set('vignette', { intensity: v })}
                unit="%"
              />
            </Row>
            <Row label={t('dynamicVignette')}>
              <Toggle value={effects.vignette.dynamic} onChange={v => set('vignette', { dynamic: v })} />
            </Row>
            {effects.vignette.dynamic && (
              <>
                <Row label={t('startOpacity')}>
                  <Slider
                    value={Math.round(effects.vignette.dynamicFrom * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('vignette', { dynamicFrom: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('endOpacity')}>
                  <Slider
                    value={Math.round(effects.vignette.dynamicTo * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('vignette', { dynamicTo: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('changeDuration')}>
                  <NumberInput
                    value={effects.vignette.dynamicDurationMs / 1000}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit={t('seconds')}
                    onChange={v => set('vignette', { dynamicDurationMs: v * 1000 })}

                  />
                </Row>
                <Row label={t('timerSync')}>
                  <Toggle
                    value={effects.vignette.dynamicTimerSync ?? false}
                    onChange={v => set('vignette', { dynamicTimerSync: v })}
                    theme="timerSync"

                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('blurEffect')} titleColor="#82b0ff">
        <Row label={t('enabled')}>
          <Toggle value={effects.blur.enabled} onChange={v => set('blur', { enabled: v })} />
        </Row>
        {effects.blur.enabled && (
          <>
            <Row label={t('strength')}>
              <Slider
                value={effects.blur.strength}
                min={0}
                max={100}
                onChange={v => set('blur', { strength: v })}
              />
            </Row>
            <Row label={t('radialBlur')}>
              <Toggle value={effects.blur.radialEnabled} onChange={v => set('blur', { radialEnabled: v })} />
            </Row>
            {effects.blur.radialEnabled && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                  {t('radialBlurHelp')}
                </div>
                <div style={{ marginTop: -2, marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={scrollToEffectCenterSetting}
                    style={{
                      fontSize: 11,
                      lineHeight: 1.2,
                      color: 'rgba(255,255,255,0.72)',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('shakeTrailCirclePositionAdjust')}
                  </button>
                </div>
                <Row label={t('radialBlurPattern')}>
                  <Select
                    value={effects.blur.radialPattern ?? 'a'}
                    options={[
                      { value: 'a', label: t('radialBlurPatternA') },
                      { value: 'b', label: t('radialBlurPatternB') },
                    ]}
                    onChange={v => set('blur', { radialPattern: v as 'a' | 'b' })}
                  />
                </Row>
                <Row label={t('strengthFactor')}>
                  <Slider
                    value={Math.round(effects.blur.radialIntensity * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { radialIntensity: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('radialBlurSize')}>
                  <Slider
                    value={Math.round((effects.blur.radialSize ?? DEFAULT_EFFECTS.blur.radialSize) * 100)}
                    min={50}
                    max={150}
                    onChange={v => set('blur', { radialSize: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('radialBlurHeight')}>
                  <Slider
                    value={Math.round((effects.blur.radialHeight ?? DEFAULT_EFFECTS.blur.radialHeight) * 100)}
                    min={25}
                    max={200}
                    onChange={v => set('blur', { radialHeight: v / 100 })}
                    unit="%"
                  />
                </Row>
              </>
            )}
            <Row label={t('gradualIncrease')}>
              <Toggle value={effects.blur.gradualEnabled} onChange={v => set('blur', { gradualEnabled: v })} />
            </Row>
            {effects.blur.gradualEnabled && (
              <>
                <Row label={t('startStrength')}>
                  <Slider
                    value={effects.blur.gradualStartStrength}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { gradualStartStrength: v })}
                  />
                </Row>
                <Row label={t('endStrength')}>
                  <Slider
                    value={effects.blur.gradualEndStrength}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { gradualEndStrength: v })}
                  />
                </Row>
                <Row label={t('duration')}>
                  <NumberInput
                    value={effects.blur.gradualDurationSec}
                    min={1}
                    max={3600}
                    step={1}
                    unit={t('seconds')}
                    onChange={v => set('blur', { gradualDurationSec: v })}

                  />
                </Row>
                <Row label={t('timerSync')}>
                  <Toggle
                    value={effects.blur.gradualTimerSync ?? false}
                    onChange={v => set('blur', { gradualTimerSync: v })}
                    theme="timerSync"

                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('focusEffect')} titleColor="#82b0ff">
        <Row label={t('enabled')}>
          <Toggle value={effects.focus.enabled} onChange={v => set('focus', { enabled: v })} />
        </Row>
        {effects.focus.enabled && (
          <>
            <Row label={t('focusBlurPattern')}>
              <Select
                value={effects.focus.pattern}
                options={[
                  { value: 'circular', label: t('focusBlurPatternCircular') },
                  { value: 'horizontal', label: t('focusBlurPatternHorizontal') },
                  { value: 'vertical', label: t('focusBlurPatternVertical') },
                ]}
                onChange={v => set('focus', { pattern: v as FocusBlurPattern })}
              />
            </Row>
            <Row label={t('focusViewSize')}>
              <Slider
                value={Math.round(effects.focus.viewSizeRatio * 100)}
                min={10}
                max={100}
                onChange={v => set('focus', { viewSizeRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('focusBlurStrength')}>
              <Slider
                value={effects.focus.blurStrength}
                min={0}
                max={100}
                onChange={v => set('focus', { blurStrength: v })}
              />
            </Row>
            <Row label={t('focusWaypoints')}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {effects.focus.waypoints.length} {t('focusWaypointCount')}
              </span>
            </Row>
            {effects.focus.waypoints.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                {effects.focus.waypoints.map((wp, i) => (
                  <div key={i}>{'①②③④⑤⑥⑦⑧'[i]} {wp.x.toFixed(2)}, {wp.y.toFixed(2)}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setFocusWaypointPicking(true)}
                disabled={focusWaypointPicking || effects.focus.waypoints.length >= 8}
              >
                {focusWaypointPicking ? t('focusWaypointPickActive') : t('focusWaypointAddButton')}
              </Button>
              {effects.focus.waypoints.length > 0 && (
                <Button variant="secondary" onClick={() => set('focus', { waypoints: [] })}>
                  {t('focusWaypointClear')}
                </Button>
              )}
            </div>
            {focusWaypointPicking && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,180,0.7)', marginBottom: 6 }}>
                {t('focusWaypointPickHint')} / {t('focusWaypointPickTip')}
              </div>
            )}
            {effects.focus.waypoints.length >= 2 && (
              <Row label={t('focusMoveSpeed')}>
                <Slider
                  value={effects.focus.movementSpeedSec}
                  min={0.5}
                  max={30}
                  step={0.5}
                  onChange={v => set('focus', { movementSpeedSec: v })}
                  unit={t('focusMoveSpeedUnit')}
                />
              </Row>
            )}
          </>
        )}
      </Section>

      </CategorySection>

      {/* ===== モーションカテゴリ ===== */}
      <CategorySection
        title={t('effectCategoryMotion')}
        headerBg="rgba(155, 112, 0, 0.55)"
        bodyBg="rgba(130, 95, 0, 0.15)"
      >

      <Section title={t('shakeEffect')} titleColor="#f5cc30">
        <Row label={t('enabled')}>
          <Toggle value={effects.shake.enabled} onChange={v => set('shake', { enabled: v })} />
        </Row>
        {effects.shake.enabled && (
          <>
            <Row label={t('shakeMode')}>
              <Select
                value={effects.shake.mode}
                options={[
                  { value: 'once', label: t('shakeModeOnce') },
                  { value: 'loop', label: t('shakeModeLoop') },
                ]}
                onChange={v => set('shake', { mode: v === 'loop' ? 'loop' : 'once' })}
              />
            </Row>
            {effects.shake.mode === 'once' ? (
              <>
                <Row label={t('shakeRepeat')}>
                  <Toggle
                    value={effects.shake.repeatEnabled}
                    onChange={v => set('shake', { repeatEnabled: v })}
                  />
                </Row>
                {effects.shake.repeatEnabled && (
                  <Row label={t('shakeRepeatInterval')}>
                    <NumberInput
                      value={effects.shake.repeatIntervalSec}
                      min={0.1}
                      max={60}
                      step={0.1}
                      unit={t('seconds')}
                      onChange={v => set('shake', { repeatIntervalSec: v })}
                    />
                  </Row>
                )}
                <Row label={t('distanceFactor')}>
                  <NumberInput
                    value={effects.shake.amplitudeFactor}
                    min={0}
                    max={5}
                    step={0.1}
                    unit="x"
                    onChange={v => set('shake', { amplitudeFactor: v })}
                  />
                </Row>
                <Row label={t('speedFactor')}>
                  <NumberInput
                    value={effects.shake.speedFactor}
                    min={0.1}
                    max={5}
                    step={0.1}
                    unit="x"
                    onChange={v => set('shake', { speedFactor: v })}
                  />
                </Row>
              </>
            ) : (
              <>
                <Row label={t('verticalRange')}>
                  <Slider
                    value={effects.shake.loopAmplitudePx}
                    min={0}
                    max={120}
                    step={1}
                    unit="px"
                    onChange={v => set('shake', { loopAmplitudePx: v })}
                  />
                </Row>
                <Row label={t('moveSpeed')}>
                  <Slider
                    value={effects.shake.loopSpeedPxPerSec}
                    min={0}
                    max={600}
                    step={1}
                    unit="px/s"
                    onChange={v => set('shake', { loopSpeedPxPerSec: v })}
                  />
                </Row>
              </>
            )}
            <Row label={t('afterimage')}>
              <Toggle
                value={effects.shake.afterimageEnabled}
                onChange={v => set('shake', { afterimageEnabled: v })}
              />
            </Row>
            {effects.shake.afterimageEnabled && (
              <Row label={t('afterimageDuration')}>
                <NumberInput
                  value={effects.shake.afterimageDurationSec}
                  min={0.05}
                  max={3}
                  step={0.05}
                  unit={t('seconds')}
                  onChange={v => set('shake', { afterimageDurationSec: v })}
                />
              </Row>
            )}
            <Row label={t('shakeTrail')}>
              <Toggle
                value={effects.shake.trailEnabled}
                onChange={v => set('shake', { trailEnabled: v })}
              />
            </Row>
            {effects.shake.trailEnabled && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
                  {t('shakeTrailHelp')}
                </div>
                <div style={{ marginTop: -2, marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={scrollToEffectCenterSetting}
                    style={{
                      fontSize: 11,
                      lineHeight: 1.2,
                      color: 'rgba(255,255,255,0.72)',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {t('shakeTrailCirclePositionAdjust')}
                  </button>
                </div>
                <Row label={t('shakeTrailDelay')}>
                  <Slider
                    value={effects.shake.trailDelaySec}
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    unit={t('seconds')}
                    onChange={v => set('shake', { trailDelaySec: v })}
                  />
                </Row>
                <Row label={t('shakeTrailOpacity')}>
                  <Slider
                    value={Math.round(effects.shake.trailAlpha * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('shake', { trailAlpha: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('shakeTrailBlur')}>
                  <Slider
                    value={effects.shake.trailBlurStrength ?? DEFAULT_EFFECTS.shake.trailBlurStrength}
                    min={0}
                    max={12}
                    step={0.5}
                    onChange={v => set('shake', { trailBlurStrength: v })}
                  />
                </Row>
                <Row label={t('radialBlurSize')}>
                  <Slider
                    value={Math.round((effects.shake.trailSize ?? DEFAULT_EFFECTS.shake.trailSize) * 100)}
                    min={5}
                    max={150}
                    onChange={v => set('shake', { trailSize: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('radialBlurHeight')}>
                  <Slider
                    value={Math.round((effects.shake.trailHeight ?? DEFAULT_EFFECTS.shake.trailHeight) * 100)}
                    min={25}
                    max={200}
                    onChange={v => set('shake', { trailHeight: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('shakeTrailDuplicateCircles')}>
                  <Toggle
                    value={effects.shake.trailDuplicateCirclesEnabled ?? DEFAULT_EFFECTS.shake.trailDuplicateCirclesEnabled}
                    onChange={v => set('shake', { trailDuplicateCirclesEnabled: v })}
                  />
                </Row>
                {(effects.shake.trailDuplicateCirclesEnabled ?? DEFAULT_EFFECTS.shake.trailDuplicateCirclesEnabled) && (
                  <>
                    <Row label={t('shakeTrailDuplicateGap')}>
                      <Slider
                        value={Math.round((effects.shake.trailDuplicateSpacingShift ?? 0) * 100)}
                        min={-50}
                        max={50}
                        onChange={v => set('shake', { trailDuplicateSpacingShift: v / 100 })}
                        unit="%"
                      />
                    </Row>
                    <Row label={t('shakeTrailDuplicateVerticalGap')}>
                      <Slider
                        value={Math.round((effects.shake.trailDuplicateVerticalSpacingShift ?? 0) * 100)}
                        min={-50}
                        max={50}
                        onChange={v => set('shake', { trailDuplicateVerticalSpacingShift: v / 100 })}
                        unit="%"
                      />
                    </Row>
                  </>
                )}
                <Row label={t('shakeTrailSecondStage')}>
                  <Toggle
                    value={effects.shake.trailSecondStageEnabled ?? DEFAULT_EFFECTS.shake.trailSecondStageEnabled}
                    onChange={v => set('shake', { trailSecondStageEnabled: v })}
                  />
                </Row>
                {(effects.shake.trailSecondStageEnabled ?? DEFAULT_EFFECTS.shake.trailSecondStageEnabled) && (
                  <>
                    <Row label={t('shakeTrailSecondStageSize')}>
                      <Slider
                        value={Math.round((effects.shake.trailSecondStageSize ?? DEFAULT_EFFECTS.shake.trailSecondStageSize) * 100)}
                        min={10}
                        max={100}
                        onChange={v => set('shake', { trailSecondStageSize: v / 100 })}
                        unit="%"
                      />
                    </Row>
                    <Row label={t('shakeTrailSecondStageDelayFactor')}>
                      <Slider
                        value={Math.round((effects.shake.trailSecondStageDelayFactor ?? DEFAULT_EFFECTS.shake.trailSecondStageDelayFactor) * 100)}
                        min={25}
                        max={300}
                        step={5}
                        onChange={v => set('shake', { trailSecondStageDelayFactor: v / 100 })}
                        unit="%"
                      />
                    </Row>
                  </>
                )}
                <Row label={t('shakeTrailLockBase')}>
                  <Toggle
                    value={effects.shake.lockBaseImage ?? false}
                    onChange={v => set('shake', { lockBaseImage: v })}
                  />
                </Row>
                {effects.shake.mode === 'once' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <Button
                      small
                      variant="secondary"
                      onClick={() => set('shake', { manualTriggerNonce: (effects.shake.manualTriggerNonce ?? 0) + 1 })}
                    >
                      {t('shakeManualTrigger')}
                    </Button>
                  </div>
                )}
              </>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.shake.timerSync ?? false}
                  onChange={v => set('shake', v ? { timerSync: true, repeatEnabled: true } : { timerSync: false })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('zoomEffect')} titleColor="#f5cc30">
        <Row label={t('enabled')}>
          <Toggle value={effects.zoom.enabled} onChange={v => set('zoom', { enabled: v })} />
        </Row>
        {effects.zoom.enabled && (
          <>
            <Row label={t('zoomMode')}>
              <Select
                value={effects.zoom.mode ?? 'oneshotA'}
                options={[
                  { value: 'oneshotA', label: t('zoomModeOneshotA') },
                  { value: 'oneshotB', label: t('zoomModeOneshotB') },
                  { value: 'permanentA', label: t('zoomModePermanentA') },
                  { value: 'permanentB', label: t('zoomModePermanentB') },
                ]}
                disabled={effects.zoom.timerSync ?? false}
                onChange={v => set('zoom', { mode: v as 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB' })}
              />
            </Row>
            <Row label={t('zoomFactor')}>
              <NumberInput
                value={effects.zoom.zoomFactor}
                min={1.0}
                max={5.0}
                step={0.1}
                unit="x"
                onChange={v => set('zoom', { zoomFactor: v })}
              />
            </Row>
            <Row label={t('zoomCenterCorrection')}>
              <Toggle
                value={effects.zoom.centerCorrection}
                onChange={v => set('zoom', { centerCorrection: v })}
              />
            </Row>
            <Row label={t('speedFactor')}>
              <NumberInput
                value={effects.zoom.speedFactor}
                min={0.1}
                max={5}
                step={0.1}
                unit="x"
                disabled={effects.zoom.timerSync ?? false}
                onChange={v => set('zoom', { speedFactor: v })}
              />
            </Row>
            {isZoomSquishOneshotLikeMode(effects.zoom.mode) && (
              <>
                <Row label={t('shakeRepeat')}>
                  <Toggle
                    value={effects.zoom.repeatEnabled}
                    onChange={v => set('zoom', v ? { repeatEnabled: true, timerSync: false } : { repeatEnabled: false })}
                  />
                </Row>
                {effects.zoom.repeatEnabled && (
                  <Row label={t('shakeRepeatInterval')}>
                    <NumberInput
                      value={effects.zoom.repeatIntervalSec}
                      min={0}
                      max={60}
                      step={0.1}
                      unit={t('seconds')}
                      onChange={v => set('zoom', { repeatIntervalSec: v })}
                    />
                  </Row>
                )}
              </>
            )}
            {selectedCellId && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button
                  small
                  variant="secondary"
                  onClick={() => syncZoomSquish(selectedCellId, 'zoom')}
                >
                  {t('syncWithSquish')}
                </Button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.zoom.timerSync ?? false}
                  onChange={v => set('zoom', v ? { timerSync: true, repeatEnabled: false } : { timerSync: false })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('breathingEffect')} titleColor="#f5cc30">
        <Row label={t('enabled')}>
          <Toggle value={effects.breathing.enabled} onChange={v => set('breathing', { enabled: v })} />
        </Row>
        {effects.breathing.enabled && (
          <>
            <Row label={t('moveSpeed')}>
              <NumberInput
                value={effects.breathing.speedPxPerSec}
                min={0.1}
                max={100}
                step={0.1}
                unit="px/s"
                onChange={v => set('breathing', { speedPxPerSec: v })}
              />
            </Row>
            <Row label={t('moveLimit')}>
              <Slider
                value={effects.breathing.maxOffsetPx}
                min={0}
                max={40}
                step={1}
                unit="px"
                onChange={v => set('breathing', { maxOffsetPx: v })}
              />
            </Row>
            <Row label={t('scale')}>
              <Toggle
                value={effects.breathing.scaleEnabled}
                onChange={v => set('breathing', { scaleEnabled: v })}
              />
            </Row>
            {effects.breathing.scaleEnabled && (
              <Row label={t('cycle')}>
                <NumberInput
                  value={effects.breathing.scaleDurationSec}
                  min={1}
                  max={60}
                  step={0.5}
                  unit={t('seconds')}
                  onChange={v => set('breathing', { scaleDurationSec: v })}
                />
              </Row>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.breathing.timerSync ?? false}
                  onChange={v => set('breathing', { timerSync: v })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('echoEffect')} titleColor="#f5cc30">
        <Row label={t('enabled')}>
          <Toggle value={effects.echo.enabled} onChange={v => set('echo', { enabled: v })} />
        </Row>
        {effects.echo.enabled && (
          <>
            <Row label={t('duration')}>
              <NumberInput
                value={effects.echo.durationSec}
                min={0.1}
                max={3600}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('echo', { durationSec: v })}
              />
            </Row>
            <Row label={t('startOpacity')}>
              <Slider
                value={Math.round(effects.echo.startAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('echo', { startAlpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('endScale')}>
              <Slider
                value={Math.round(effects.echo.endScale * 100)}
                min={100}
                max={200}
                onChange={v => set('echo', { endScale: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('timerSync')}>
              <Toggle
                value={effects.echo.timerSync ?? false}
                onChange={v => set('echo', { timerSync: v })}
                theme="timerSync"

              />
            </Row>
          </>
        )}
      </Section>

      </CategorySection>

      {/* ===== デコレーションカテゴリ ===== */}
      <CategorySection
        title={t('effectCategoryDecoration')}
        headerBg="rgba(100, 35, 185, 0.55)"
        bodyBg="rgba(80, 25, 155, 0.15)"
      >

      <Section title={t('assetEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.dynamicAsset.enabled} onChange={v => set('dynamicAsset', { enabled: v })} />
        </Row>
        {effects.dynamicAsset.enabled && (
          <>
            <Row label={t('assetPeripheralOnlyRadius')}>
              <Slider
                value={Math.round((effects.dynamicAsset.peripheralOnlyRadius ?? 0) * 100)}
                min={0}
                max={95}
                onChange={v => set('dynamicAsset', { peripheralOnlyRadius: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('flashDisplayFile')}>
              <Select
                value={effects.dynamicAsset.displayFileMode}
                options={[
                  { value: 'asset', label: t('dynamicAssetDisplayFilePreset') },
                  { value: 'pickImage', label: t('flashDisplayFilePickFile') },
                ]}
                onChange={v => handleDynamicAssetDisplayFileModeChange(v as DynamicAssetDisplayFileMode)}
              />
            </Row>
            {effects.dynamicAsset.displayFileMode === 'pickImage' && (
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.35,
                  marginTop: -2,
                  marginBottom: 8,
                  width: '100%',
                  textAlign: 'right',
                }}
              >
                <HoverTooltip content={DYNAMIC_ASSET_RASTER_FORMATS_TOOLTIP}>
                  {t('dynamicAssetSupportedFormatsLink')}
                </HoverTooltip>
              </div>
            )}
            {effects.dynamicAsset.displayFileMode === 'asset' && (
              <>
                <Row label={assetEffectFolderLabel}>
                  <Select
                    value={(() => {
                      if (effects.dynamicAsset.sourceKind === 'vector' && effects.dynamicAsset.vectorPresetId) {
                        return `__vector:${effects.dynamicAsset.vectorPresetId}`
                      }
                      const currentName = effects.dynamicAsset.assetFolderPath?.split(/[/\\]/).pop() ?? ''
                      return __ASSET_EFFECT_FOLDERS__.some(f => f.name === currentName)
                        ? currentName
                        : `__vector:${DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART}`
                    })()}
                    options={[
                      {
                        value: `__vector:${DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART}`,
                        label: t('dynamicAssetVectorHeart'),
                      },
                      ...__ASSET_EFFECT_FOLDERS__.map(folder => ({
                        value: folder.name,
                        label: `${folder.name} (${formatCount(language, folder.count, t('imagesUnit'))})`,
                      })),
                    ]}
                    onChange={handleSelectAssetEffectSource}
                  />
                </Row>
                {effects.dynamicAsset.sourceKind === 'vector' && effects.dynamicAsset.vectorPresetId && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)', marginBottom: 8 }}>
                    {t('dynamicAssetVectorActiveHint')}
                  </div>
                )}
              </>
            )}
            {effects.dynamicAsset.displayFileMode === 'pickImage' && (
              <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button variant="secondary" onClick={handleOpenAsset}>
                  {t('selectImage')}
                </Button>
                <Button variant="secondary" onClick={handleOpenAssetFolder}>
                  {t('drawRandomFromFolder')}
                </Button>
              </div>
            )}
            {effects.dynamicAsset.sourceKind === 'raster' && effects.dynamicAsset.assetPath && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, wordBreak: 'break-all' }}>
                {effects.dynamicAsset.assetFolderPath
                  ? `${effects.dynamicAsset.assetFolderPath} (${formatCount(language, effects.dynamicAsset.assetPaths.length, t('imagesUnit'))})`
                  : effects.dynamicAsset.assetPath.split(/[\\/]/).pop()}
              </div>
            )}
            {effects.dynamicAsset.sourceKind === 'raster' &&
              effects.dynamicAsset.assetPaths.some(p => isSutFilename(p)) && (
              <Row label={t('dynamicAssetSutTipMode')}>
                <Select
                  value={effects.dynamicAsset.sutTipMode}
                  options={[
                    { value: 'allTipsRandom', label: t('dynamicAssetSutTipModeAllTipsRandom') },
                    { value: 'firstTipOnly', label: t('dynamicAssetSutTipModeFirstTipOnly') },
                  ]}
                  onChange={v => set('dynamicAsset', { sutTipMode: v as DynamicAssetSutTipMode })}
                />
              </Row>
            )}
            {effects.dynamicAsset.sourceKind === 'raster' && (
              <Row label={t('assetColorInvert')}>
                <Toggle
                  value={effects.dynamicAsset.rasterColorInvertEnabled}
                  onChange={v => set('dynamicAsset', { rasterColorInvertEnabled: v })}
                />
              </Row>
            )}
            <Row label={t('assetColor')}>
              <Toggle
                value={effects.dynamicAsset.colorOverlayEnabled}
                onChange={v =>
                  set('dynamicAsset', {
                    colorOverlayEnabled: v,
                    ...(v ? {} : { colorOverlayAlphaRandomEnabled: false }),
                  })}
              />
            </Row>
            {effects.dynamicAsset.colorOverlayEnabled && (
              <>
                <ColorPicker
                  r={effects.dynamicAsset.colorOverlayColor.r}
                  g={effects.dynamicAsset.colorOverlayColor.g}
                  b={effects.dynamicAsset.colorOverlayColor.b}
                  onChange={(r, g, b) => set('dynamicAsset', { colorOverlayColor: { r, g, b } })}
                />
                <Row label={t('assetColorApplyRandom')}>
                  <Toggle
                    value={effects.dynamicAsset.colorOverlayAlphaRandomEnabled ?? false}
                    onChange={v => set('dynamicAsset', { colorOverlayAlphaRandomEnabled: v })}
                  />
                </Row>
                {effects.dynamicAsset.colorOverlayAlphaRandomEnabled && (
                  <>
                    <Row label={t('assetColorRandomMin')}>
                      <Slider
                        value={Math.round((effects.dynamicAsset.colorOverlayAlphaRandomMin ?? 0.4) * 100)}
                        min={0}
                        max={100}
                        onChange={v => {
                          const min = v / 100
                          const max = effects.dynamicAsset.colorOverlayAlphaRandomMax ?? 1
                          set('dynamicAsset', {
                            colorOverlayAlphaRandomMin: Math.min(min, max),
                            colorOverlayAlphaRandomMax: Math.max(min, max),
                          })
                        }}
                        unit="%"
                      />
                    </Row>
                    <Row label={t('assetColorRandomMax')}>
                      <Slider
                        value={Math.round((effects.dynamicAsset.colorOverlayAlphaRandomMax ?? 1) * 100)}
                        min={0}
                        max={100}
                        onChange={v => {
                          const max = v / 100
                          const min = effects.dynamicAsset.colorOverlayAlphaRandomMin ?? 0.4
                          set('dynamicAsset', {
                            colorOverlayAlphaRandomMin: Math.min(min, max),
                            colorOverlayAlphaRandomMax: Math.max(min, max),
                          })
                        }}
                        unit="%"
                      />
                    </Row>
                  </>
                )}
                {!effects.dynamicAsset.colorOverlayAlphaRandomEnabled && (
                  <Row label={t('assetColorOpacity')}>
                    <Slider
                      value={Math.round(effects.dynamicAsset.colorOverlayAlpha * 100)}
                      min={0}
                      max={100}
                      onChange={v => set('dynamicAsset', { colorOverlayAlpha: v / 100 })}
                      unit="%"
                    />
                  </Row>
                )}
              </>
            )}
            <Row label={t('assetDrawPattern')}>
              <Select
                value={dynamicAssetPattern}
                options={[
                  { value: 'rising', label: t('assetPatternRising') },
                  { value: 'emergence', label: t('assetPatternEmergence') },
                  { value: 'ripple', label: t('assetPatternRipple') },
                ]}
                onChange={v =>
                  set('dynamicAsset', {
                    pattern: v as import('../../../shared/types').AssetDrawPattern,
                    ...(
                      v !== 'emergence' && effects.dynamicAsset.additionalEffect === 'bounce'
                        ? { additionalEffect: 'none' as DynamicAssetAdditionalEffect }
                        : {}
                    ),
                  })}
              />
            </Row>
            {(dynamicAssetPattern === 'rising' || dynamicAssetPattern === 'ripple') && (
              <Row label={t('riseSpeedFactor')}>
                <Slider
                  value={effects.dynamicAsset.riseSpeedFactor ?? 1}
                  min={0.1}
                  max={5}
                  step={0.1}
                  unit="x"
                  onChange={v => set('dynamicAsset', { riseSpeedFactor: v })}
                />
              </Row>
            )}
            {dynamicAssetPattern === 'ripple' && (
              <Row label={t('rippleMovePattern')}>
                <Select
                  value={effects.dynamicAsset.rippleMovePattern ?? 'easeInSine'}
                  options={[
                    { value: 'easeInSine',    label: t('rippleEaseInSine') },
                    { value: 'easeInCubic',   label: t('rippleEaseInCubic') },
                    { value: 'easeInQuint',   label: t('rippleEaseInQuint') },
                    { value: 'easeInElastic', label: t('rippleEaseInElastic') },
                    { value: 'easeOutSine',   label: t('rippleEaseOutSine') },
                    { value: 'easeOutCubic',  label: t('rippleEaseOutCubic') },
                    { value: 'easeOutQuint',  label: t('rippleEaseOutQuint') },
                    { value: 'easeOutElastic',label: t('rippleEaseOutElastic') },
                  ]}
                  onChange={v => set('dynamicAsset', { rippleMovePattern: v as RippleMovePattern })}
                />
              </Row>
            )}
            <Row label={t('assetAdditionalEffect')}>
              <Select
                value={visibleDynamicAssetAdditionalEffect}
                options={dynamicAssetAdditionalEffectOptions}
                onChange={v => set('dynamicAsset', { additionalEffect: v as DynamicAssetAdditionalEffect })}
              />
            </Row>
            {visibleDynamicAssetAdditionalEffect !== 'none' && (
              <Row label={t('assetAdditionalEffectSpeedFactor')}>
                <Slider
                  value={effects.dynamicAsset.additionalEffectSpeedFactor ?? 1}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={v => set('dynamicAsset', { additionalEffectSpeedFactor: v })}
                />
              </Row>
            )}
            <Row label={t('assetRandomRotation')}>
              <Toggle
                value={effects.dynamicAsset.randomRotationEnabled ?? false}
                onChange={v => set('dynamicAsset', { randomRotationEnabled: v })}
              />
            </Row>
            <Row label={t('spawnInterval')}>
              <NumberInput
                value={effects.dynamicAsset.spawnIntervalMs / 1000}
                min={0.1}
                max={5}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('dynamicAsset', { spawnIntervalMs: v * 1000 })}
              />
            </Row>
            {dynamicAssetPattern === 'rising' && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '8px 0 10px' }}>
                  {t('riseSpeedHelp')}
                </div>
              </>
            )}
            <Row label={t('maxCount')}>
              <NumberInput
                value={effects.dynamicAsset.maxParticles}
                min={1}
                max={100}
                step={1}
                onChange={v => set('dynamicAsset', { maxParticles: v })}
              />
            </Row>
            <Row label={t('assetFeather')}>
              <Slider
                value={effects.dynamicAsset.featherStrength ?? 0}
                min={0}
                max={100}
                onChange={v => set('dynamicAsset', { featherStrength: v })}
              />
            </Row>
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.dynamicAsset.baseAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('dynamicAsset', { baseAlpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('size')}>
              <Slider
                value={Math.round(effects.dynamicAsset.sizeRatio * 100)}
                min={10}
                max={300}
                onChange={v => set('dynamicAsset', { sizeRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('assetRandomSize')}>
              <Slider
                value={effects.dynamicAsset.sizeRandomPercent ?? 10}
                min={0}
                max={200}
                onChange={v => set('dynamicAsset', { sizeRandomPercent: v })}
                unit="%"
              />
            </Row>
            {dynamicAssetPattern === 'emergence' && (
              <Row label={t('emergenceSpeedFactor')}>
                <Slider
                  value={effects.dynamicAsset.emergenceSpeedFactor ?? 1.0}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={v => set('dynamicAsset', { emergenceSpeedFactor: v })}
                />
              </Row>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.dynamicAsset.alphaTimerSync ?? false}
                  onChange={v => set('dynamicAsset', { alphaTimerSync: v })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('flashEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.flash.enabled} onChange={v => set('flash', { enabled: v })} />
        </Row>
        {effects.flash.enabled && (
          <>
            <Row label={t('flashDisplayFile')}>
              <Select
                value={effects.flash.displayFileMode}
                options={[
                  { value: 'pickFile', label: t('flashDisplayFilePickFile') },
                  { value: 'displayCrop', label: t('flashDisplayFileDisplayCrop') },
                  { value: 'asset', label: t('flashDisplayFileAsset') },
                ]}
                onChange={v => handleFlashDisplayFileModeChange(v as FlashDisplayFileMode)}
              />
            </Row>
            {effects.flash.displayFileMode === 'pickFile' && (
              <Row label={t('flashImage')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <Button variant="secondary" onClick={handleOpenFlashImage}>
                    {t('selectImage')}
                  </Button>
                  {effects.flash.imagePath &&
                    !effects.flash.imagePath.startsWith('data:') &&
                    !effects.flash.vectorPresetId && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                      {effects.flash.imagePath.split(/[\\/]/).pop()}
                    </div>
                  )}
                </div>
              </Row>
            )}
            {effects.flash.displayFileMode === 'displayCrop' && (
              <Row label={t('flashImage')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <Button
                    variant={flashRangePicking ? 'primary' : 'secondary'}
                    onClick={() => setFlashRangePicking(!flashRangePicking)}
                  >
                    {flashRangePicking ? t('flashRangePickActive') : t('flashRangePickButton')}
                  </Button>
                </div>
              </Row>
            )}
            {effects.flash.displayFileMode === 'asset' && (
              <>
                <Row label={t('flashAsset')}>
                  <Select
                    value={effects.flash.vectorPresetId ?? DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART}
                    options={FLASH_BUILTIN_VECTOR_ASSET_OPTIONS.map(o => ({
                      value: o.value,
                      label: t(o.labelKey),
                    }))}
                    onChange={v =>
                      set('flash', {
                        vectorPresetId: v,
                        displayFileMode: 'asset',
                        imagePath: null,
                      })}
                  />
                </Row>
                <ColorPicker
                  r={effects.flash.colorOverlayColor.r}
                  g={effects.flash.colorOverlayColor.g}
                  b={effects.flash.colorOverlayColor.b}
                  onChange={(r, g, b) => set('flash', { colorOverlayColor: { r, g, b } })}
                />
                <Row label={t('assetColorApplyRandom')}>
                  <Toggle
                    value={effects.flash.colorOverlayAlphaRandomEnabled ?? false}
                    onChange={v => set('flash', { colorOverlayAlphaRandomEnabled: v })}
                  />
                </Row>
                {!effects.flash.colorOverlayAlphaRandomEnabled && (
                  <Row label={t('assetColorOpacity')}>
                    <Slider
                      value={Math.round(effects.flash.colorOverlayAlpha * 100)}
                      min={0}
                      max={100}
                      onChange={v => set('flash', { colorOverlayAlpha: v / 100 })}
                      unit="%"
                    />
                  </Row>
                )}
              </>
            )}
            <Row label={t('flashStartTransition')}>
              <Select
                value={effects.flash.startTransition}
                options={[
                  { value: 'none', label: t('transitionNone') },
                  { value: 'fade', label: t('transitionFade') },
                  { value: 'zoom-in', label: t('transitionZoomIn') },
                  { value: 'zoom-out', label: t('transitionZoomOut') },
                ]}
                onChange={v => set('flash', { startTransition: v as import('../../../shared/types').FlashStartTransition })}
              />
            </Row>
            <Row label={t('drawSpeed')}>
              {effects.flash.startTransition === 'none' ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>-</div>
              ) : (
                <Slider
                  value={effects.flash.startTransitionDurationSec}
                  min={0.2}
                  max={5}
                  step={0.1}
                  unit={t('seconds')}
                  onChange={v => set('flash', { startTransitionDurationSec: v })}
                />
              )}
            </Row>
            <Row label={t('flashEndTransition')}>
              <Select
                value={effects.flash.endTransition}
                options={[
                  { value: 'none', label: t('transitionNone') },
                  { value: 'fade', label: t('transitionFade') },
                  { value: 'zoom-in', label: t('transitionZoomIn') },
                  { value: 'zoom-out', label: t('transitionZoomOut') },
                ]}
                onChange={v => set('flash', { endTransition: v as import('../../../shared/types').SlideShowTransition })}
              />
            </Row>
            <Row label={t('flashScaleRatio')}>
              <Slider
                value={Math.round((effects.flash.scaleRatio ?? 1) * 100)}
                min={10}
                max={300}
                step={1}
                unit="%"
                onChange={v => set('flash', { scaleRatio: v / 100 })}
              />
            </Row>
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.flash.opacity * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => set('flash', { opacity: v / 100 })}
              />
            </Row>
            <Row label={t('flashBlur')}>
              <Slider
                value={Math.round(effects.flash.blurStrength ?? 0)}
                min={0}
                max={100}
                step={1}
                onChange={v => set('flash', { blurStrength: v })}
              />
            </Row>
            <Row label={t('flashSurroundingTransparency')}>
              <Slider
                value={Math.round((effects.flash.surroundingTransparency ?? 0) * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => set('flash', { surroundingTransparency: v / 100 })}
              />
            </Row>
            <div style={{ opacity: (effects.flash.surroundingTransparency ?? 0) > 0 ? 1 : 0.4 }}>
              <Row label={t('flashInnerRadius')}>
                <Slider
                  value={Math.round((effects.flash.innerRadius ?? 0.5) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={v => set('flash', { innerRadius: v / 100 })}
                />
              </Row>
            </div>
            <Row label={t('drawSpeed')}>
              {effects.flash.endTransition === 'none' ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>-</div>
              ) : (
                <Slider
                  value={effects.flash.endTransitionDurationSec}
                  min={0.2}
                  max={5}
                  step={0.1}
                  unit={t('seconds')}
                  onChange={v => set('flash', { endTransitionDurationSec: v })}
                />
              )}
            </Row>
            <Row label={t('flashHoldDuration')}>
              <Slider
                value={effects.flash.displayDurationSec}
                min={0}
                max={5}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('flash', { displayDurationSec: v })}
              />
            </Row>
            <Row label={t('displayInterval')}>
              <Slider
                value={effects.flash.intervalSec}
                min={0}
                max={60}
                step={1}
                unit={t('seconds')}
                onChange={v => set('flash', { intervalSec: v })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('squishEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.squish.enabled} onChange={v => set('squish', { enabled: v })} />
        </Row>
        {effects.squish.enabled && (
          <>
            <Row label={t('squishMode')}>
              <Select
                value={effects.squish.mode ?? 'oneshotA'}
                options={[
                  { value: 'oneshotA', label: t('squishModeOneshotA') },
                  { value: 'oneshotB', label: t('squishModeOneshotB') },
                  { value: 'permanentA', label: t('squishModePermanentA') },
                  { value: 'permanentB', label: t('squishModePermanentB') },
                ]}
                onChange={v => set('squish', { mode: v as 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB' })}
              />
            </Row>
            {isZoomSquishOneshotLikeMode(effects.squish.mode) && (
              <Row label={t('squishRandomPosition')}>
                <Toggle
                  value={effects.squish.randomPosition ?? false}
                  onChange={v => set('squish', { randomPosition: v })}
                />
              </Row>
            )}
            {!(effects.squish.randomPosition && isZoomSquishOneshotLikeMode(effects.squish.mode)) && (
              <Row label={t('squishCirclePositionY')}>
                <Slider
                  value={Math.round((effects.squish.circlePositionY ?? 0.5) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={v => set('squish', { circlePositionY: v / 100 })}
                />
              </Row>
            )}
            <Row label={t('squishOpacity')}>
              <Slider
                value={Math.round(effects.squish.opacity * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => set('squish', { opacity: v / 100 })}
              />
            </Row>
            <Row label={t('squishOrganic')}>
              <Toggle
                value={effects.squish.organicEnabled}
                onChange={v => set('squish', { organicEnabled: v })}
              />
            </Row>
            <Row label={t('squishColorSource')}>
              <Select
                value={effects.squish.colorSource ?? 'manual'}
                options={[
                  { value: 'manual', label: t('squishColorSourceManual') },
                  { value: 'imageCenter', label: t('squishColorSourceImageCenter') },
                ]}
                onChange={v => {
                  set('squish', { colorSource: v as 'manual' | 'imageCenter' })
                  if (v !== 'manual') setSquishColorPicking(false)
                }}
              />
            </Row>
            {(effects.squish.colorSource ?? 'manual') === 'manual' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <ColorPicker
                  r={effects.squish.color.r}
                  g={effects.squish.color.g}
                  b={effects.squish.color.b}
                  onChange={(r, g, b) => set('squish', { color: { r, g, b } })}
                  leading={
                    <IconButton
                      active={squishColorPicking}
                      onClick={() => setSquishColorPicking(!squishColorPicking)}
                      title={squishColorPicking ? t('squishColorPickActive') : t('squishColorPickButton')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M14.5 4.5l5 5m-3.5-6.5l5 5-10.5 10.5-4.5 1 1-4.5 10.5-10.5z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </IconButton>
                  }
                />
              </div>
            )}
            <Row label={t('squishColorAlpha')}>
              <Slider
                value={Math.round(effects.squish.alpha * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => set('squish', { alpha: v / 100 })}
              />
            </Row>
            <Row label={t('squishCircleSize')}>
              <Slider
                value={Math.round(effects.squish.circleSizeRatio * 100)}
                min={5}
                max={150}
                step={1}
                unit="%"
                onChange={v => set('squish', { circleSizeRatio: v / 100 })}
              />
            </Row>
            <Row label={t('squishCircleGap')}>
              <Slider
                value={Math.round(effects.squish.gapRatio * 100)}
                min={-50}
                max={50}
                step={1}
                unit="%"
                onChange={v => set('squish', { gapRatio: v / 100 })}
              />
            </Row>
            <Row label={t('squishFeather')}>
              <Slider
                value={effects.squish.featherStrength}
                min={0}
                max={24}
                step={0.5}
                unit="px"
                onChange={v => set('squish', { featherStrength: v })}
              />
            </Row>
            <Row label={t('speedFactor')}>
              <NumberInput
                value={effects.squish.speedFactor}
                min={0.1}
                max={5}
                step={0.1}
                unit="x"
                onChange={v => set('squish', { speedFactor: v })}
              />
            </Row>
            {isZoomSquishOneshotLikeMode(effects.squish.mode) && (
              <>
                <Row label={t('shakeRepeat')}>
                  <Toggle
                    value={effects.squish.repeatEnabled}
                    onChange={v => set('squish', { repeatEnabled: v })}
                  />
                </Row>
                {effects.squish.repeatEnabled && (
                  <Row label={t('shakeRepeatInterval')}>
                    <NumberInput
                      value={effects.squish.repeatIntervalSec}
                      min={0}
                      max={60}
                      step={0.1}
                      unit={t('seconds')}
                      onChange={v => set('squish', { repeatIntervalSec: v })}
                    />
                  </Row>
                )}
              </>
            )}
            <Row label={t('squishGapCorrection')}>
              <Toggle
                value={effects.squish.gapCorrectionEnabled ?? false}
                onChange={v => set('squish', { gapCorrectionEnabled: v })}
              />
            </Row>
            {(effects.squish.gapCorrectionEnabled ?? false) && (
              <>
                <Row label={t('squishGapCorrectionScale')}>
                  <NumberInput
                    value={effects.squish.gapCorrectionScale ?? 1.5}
                    min={1.0}
                    max={4.0}
                    step={0.05}
                    unit="x"
                    onChange={v => set('squish', { gapCorrectionScale: v })}
                  />
                </Row>
                <Row label={t('squishCircleGapFactor')}>
                  <Slider
                    value={Math.round((effects.squish.circleGapFactor ?? 1) * 100)}
                    min={0}
                    max={300}
                    step={1}
                    unit="%"
                    onChange={v => set('squish', { circleGapFactor: v / 100 })}
                  />
                </Row>
              </>
            )}
            <Row label={t('squishBurst')}>
              <Toggle
                value={effects.squish.burstEnabled ?? false}
                onChange={v => set('squish', { burstEnabled: v })}
              />
            </Row>
            {(effects.squish.burstEnabled ?? false) && (
              <Row label={t('squishBurstMaxOpacity')}>
                <Slider
                  value={Math.round((effects.squish.burstMaxOpacity ?? 0.8) * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={v => set('squish', { burstMaxOpacity: v / 100 })}
                />
              </Row>
            )}
            {(effects.squish.timerSync ?? false) && (
              <>
                <Row label={t('startOpacity')}>
                  <Slider
                    value={Math.round((effects.squish.timerSyncStartOpacity ?? effects.squish.opacity) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={v => set('squish', { timerSyncStartOpacity: v / 100 })}
                  />
                </Row>
                <Row label={t('endOpacity')}>
                  <Slider
                    value={Math.round((effects.squish.timerSyncEndOpacity ?? 1) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={v => set('squish', { timerSyncEndOpacity: v / 100 })}
                  />
                </Row>
              </>
            )}
            {selectedCellId && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button
                  small
                  variant="secondary"
                  onClick={() => syncZoomSquish(selectedCellId, 'squish')}
                >
                  {t('syncWithZoom')}
                </Button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.squish.timerSync ?? false}
                  onChange={v => set('squish', v ? { timerSync: true, repeatEnabled: true } : { timerSync: false })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('fogEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.fog.enabled} onChange={v => set('fog', { enabled: v })} />
        </Row>
        {effects.fog.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('fogColor')}</div>
            <div style={{ marginBottom: 10 }}>
              <ColorPicker
                r={effects.fog.color.r}
                g={effects.fog.color.g}
                b={effects.fog.color.b}
                onChange={(r, g, b) => set('fog', { color: { r, g, b } })}
              />
            </div>
            <Row label={t('fogAlpha')}>
              <Slider
                value={Math.round(effects.fog.alpha * 100)}
                min={0}
                max={100}
                onChange={v => set('fog', { alpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('fogCount')}>
              <Slider
                value={effects.fog.fogCount}
                min={1}
                max={12}
                step={1}
                onChange={v => set('fog', { fogCount: v })}
              />
            </Row>
            <Row label={t('fogSizeRatio')}>
              <Slider
                value={Math.round(effects.fog.fogSizeRatio * 100)}
                min={10}
                max={90}
                step={1}
                onChange={v => set('fog', { fogSizeRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('fogBlurStrength')}>
              <Slider
                value={effects.fog.blurStrength}
                min={0}
                max={60}
                step={1}
                onChange={v => set('fog', { blurStrength: v })}
              />
            </Row>
            <Row label={t('fogGrowDuration')}>
              <NumberInput
                value={effects.fog.growDurationSec}
                min={0.2}
                max={10}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('fog', { growDurationSec: v })}
              />
            </Row>
            <Row label={t('fogHoldDuration')}>
              <NumberInput
                value={effects.fog.holdDurationSec}
                min={0}
                max={10}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('fog', { holdDurationSec: v })}
              />
            </Row>
            <Row label={t('fogFadeDuration')}>
              <NumberInput
                value={effects.fog.fadeDurationSec}
                min={0.2}
                max={15}
                step={0.1}
                unit={t('seconds')}
                onChange={v => set('fog', { fadeDurationSec: v })}
              />
            </Row>
            <Row label={t('fogDroplet')}>
              <Toggle
                value={effects.fog.dropletEnabled}
                onChange={v => set('fog', { dropletEnabled: v })}
              />
            </Row>
            {effects.fog.dropletEnabled && (
              <>
                <Row label={t('fogDropletCount')}>
                  <Slider
                    value={effects.fog.dropletCount}
                    min={1}
                    max={150}
                    step={1}
                    onChange={v => set('fog', { dropletCount: v })}
                  />
                </Row>
                <Row label={t('fogDropletSpread')}>
                  <Slider
                    value={Math.round((effects.fog.dropletSpreadRatio ?? 0.85) * 100)}
                    min={1}
                    max={100}
                    step={1}
                    onChange={v => set('fog', { dropletSpreadRatio: v / 100 })}
                    unit="%"
                  />
                </Row>
              </>
            )}
            <Row label={t('fogRepeat')}>
              <Toggle
                value={effects.fog.repeatEnabled}
                onChange={v => set('fog', { repeatEnabled: v })}
              />
            </Row>
            {effects.fog.repeatEnabled && (
              <Row label={t('fogRepeatInterval')}>
                <NumberInput
                  value={effects.fog.repeatIntervalSec}
                  min={0}
                  max={60}
                  step={0.5}
                  unit={t('seconds')}
                  onChange={v => set('fog', { repeatIntervalSec: v })}
                />
              </Row>
            )}
            <Row label={t('fogRandomPosition')}>
              <Toggle
                value={effects.fog.randomPositionEnabled ?? false}
                onChange={v => set('fog', { randomPositionEnabled: v })}
              />
            </Row>
            {(effects.fog.timerSync ?? false) && (
              <>
                <Row label={t('startOpacity')}>
                  <Slider
                    value={Math.round((effects.fog.timerSyncStartOpacity ?? effects.fog.alpha) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={v => set('fog', { timerSyncStartOpacity: v / 100 })}
                  />
                </Row>
                <Row label={t('endOpacity')}>
                  <Slider
                    value={Math.round((effects.fog.timerSyncEndOpacity ?? 1) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={v => set('fog', { timerSyncEndOpacity: v / 100 })}
                  />
                </Row>
              </>
            )}
            <Row label={t('timerSync')}>
              <Toggle
                value={effects.fog.timerSync ?? false}
                onChange={v => set('fog', { timerSync: v })}
                theme="timerSync"
              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('spiralEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.spiral.enabled} onChange={v => set('spiral', { enabled: v })} />
        </Row>
        {effects.spiral.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('color')}</div>
            <div style={{ marginBottom: 10 }}>
              <ColorPicker
                r={effects.spiral.color.r}
                g={effects.spiral.color.g}
                b={effects.spiral.color.b}
                onChange={(r, g, b) => set('spiral', { color: { r, g, b } })}
              />
            </div>
            {effects.spiral.pattern === 'classic' && (
              <>
                <Row label={t('spiralDualColor')}>
                  <Toggle
                    value={effects.spiral.dualColorEnabled}
                    onChange={v => set('spiral', { dualColorEnabled: v })}
                  />
                </Row>
                {effects.spiral.dualColorEnabled && (
                  <>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('spiralSecondaryColor')}</div>
                    <div style={{ marginBottom: 10 }}>
                      <ColorPicker
                        r={effects.spiral.secondaryColor.r}
                        g={effects.spiral.secondaryColor.g}
                        b={effects.spiral.secondaryColor.b}
                        onChange={(r, g, b) => set('spiral', { secondaryColor: { r, g, b } })}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            <Row label={t('spiralDetail')}>
              <Slider
                value={effects.spiral.detail}
                min={6}
                max={120}
                onChange={v => set('spiral', { detail: v })}
              />
            </Row>
            <Row label={t('spiralPattern')}>
              <Select
                value={effects.spiral.pattern ?? 'classic'}
                options={[
                  { value: 'classic', label: t('spiralPatternClassic') },
                  { value: 'vortex', label: t('spiralPatternVortex') },
                ]}
                onChange={v => set('spiral', { pattern: v as 'classic' | 'vortex' })}
              />
            </Row>
            <Row label={t('rotationSpeed')}>
              <Slider
                value={Math.round(effects.spiral.rotationSpeedDegPerSec)}
                min={-1200}
                max={1200}
                step={10}
                onChange={v => set('spiral', { rotationSpeedDegPerSec: Math.round(v / 10) * 10 })}
                unit="deg/s"
              />
            </Row>
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.spiral.alpha * 100)}
                min={0}
                max={100}
                onChange={v => set('spiral', { alpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('radialOption')}>
              <Toggle
                value={effects.spiral.radialEnabled}
                onChange={v => set('spiral', { radialEnabled: v })}
              />
            </Row>
            <div style={{ marginTop: -2, marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={scrollToEffectCenterSetting}
                style={{
                  fontSize: 11,
                  lineHeight: 1.2,
                  color: 'rgba(255,255,255,0.72)',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                {t('shakeTrailCirclePositionAdjust')}
              </button>
            </div>
            {effects.spiral.radialEnabled && (
              <>
                <Row label={t('radialMode')}>
                  <Select
                    value={effects.spiral.radialMode}
                    options={[
                      { value: 'center', label: t('radialModeCenter') },
                      { value: 'periphery', label: t('radialModePeriphery') },
                    ]}
                    onChange={v => set('spiral', { radialMode: v as 'center' | 'periphery' })}
                  />
                </Row>
                <Row label={t('radialSize')}>
                  <Slider
                    value={Math.round(effects.spiral.radialSize * 100)}
                    min={5}
                    max={95}
                    onChange={v => set('spiral', { radialSize: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('radialFadeStrength')}>
                  <Slider
                    value={Math.round((effects.spiral.radialFadeStrength ?? DEFAULT_EFFECTS.spiral.radialFadeStrength) * 100)}
                    min={1}
                    max={150}
                    onChange={v => set('spiral', { radialFadeStrength: v / 100 })}
                    unit="%"
                  />
                </Row>
              </>
            )}
            <Row label={t('dynamicApply')}>
              <Toggle value={effects.spiral.dynamic} onChange={v => set('spiral', { dynamic: v })} />
            </Row>
            {effects.spiral.dynamic && (
              <>
                <Row label={t('startOpacity')}>
                  <Slider
                    value={Math.round(effects.spiral.dynamicFrom * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('spiral', { dynamicFrom: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('endOpacity')}>
                  <Slider
                    value={Math.round(effects.spiral.dynamicTo * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('spiral', { dynamicTo: v / 100 })}
                    unit="%"
                  />
                </Row>
                <Row label={t('changeDuration')}>
                  <NumberInput
                    value={effects.spiral.dynamicDurationMs / 1000}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit={t('seconds')}
                    onChange={v => set('spiral', { dynamicDurationMs: v * 1000 })}
                  />
                </Row>
              </>
            )}
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.spiral.dynamicTimerSync ?? false}
                  onChange={v => set('spiral', { dynamicTimerSync: v })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('textEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.textEffect.enabled} onChange={v => set('textEffect', { enabled: v })} />
        </Row>
        {effects.textEffect.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{t('textEffectHelp')}</div>
            {effects.textEffect.texts.map((txt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', minWidth: 14 }}>{i + 1}</span>
                <input
                  type="text"
                  value={txt}
                  placeholder={`${t('textPlaceholder')} ${i + 1}`}
                  onChange={e => {
                    const next = [...effects.textEffect.texts]
                    next[i] = e.target.value
                    set('textEffect', { texts: next })
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    padding: '3px 6px',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <Row label={t('font')}>
              <Select
                value={effects.textEffect.font}
                options={fontOptions}
                onChange={v => set('textEffect', { font: v })}
              />
            </Row>
            <Row label={t('direction')}>
              <Select
                value={effects.textEffect.direction}
                options={[
                  { value: 'horizontal', label: t('horizontal') },
                  { value: 'vertical', label: t('vertical') },
                ]}
                onChange={v => set('textEffect', { direction: v as 'horizontal' | 'vertical' })}
              />
            </Row>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, marginTop: 6 }}>{t('textColor')}</div>
            <ColorPicker
              r={effects.textEffect.color.r}
              g={effects.textEffect.color.g}
              b={effects.textEffect.color.b}
              onChange={(r, g, b) => set('textEffect', { color: { r, g, b } })}
            />
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.textEffect.alpha * 100)}
                min={0}
                max={100}
                onChange={v => set('textEffect', { alpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('fontSize')}>
              <Slider
                value={effects.textEffect.fontSize}
                min={8}
                max={200}
                step={1}
                onChange={v => set('textEffect', { fontSize: v })}
                unit="px"
              />
            </Row>
            <Row label={t('drawSpeed')}>
              <NumberInput
                value={effects.textEffect.charIntervalMs}
                min={10}
                max={2000}
                step={10}
                unit={t('msPerChar')}
                onChange={v => set('textEffect', { charIntervalMs: v })}
              />
            </Row>
            <Row label={t('displayDuration')}>
              <NumberInput
                value={effects.textEffect.displayDurationMs}
                min={100}
                max={30000}
                step={100}
                unit="ms"
                onChange={v => set('textEffect', { displayDurationMs: v })}
              />
            </Row>
            <Row label={t('displayInterval')}>
              <NumberInput
                value={effects.textEffect.intervalMs}
                min={0}
                max={30000}
                step={100}
                unit="ms"
                onChange={v => set('textEffect', { intervalMs: v })}
              />
            </Row>
            <div style={{ marginTop: 8 }}>
              <Row label={t('timerSync')}>
                <Toggle
                  value={effects.textEffect.alphaTimerSync ?? false}
                  onChange={v => set('textEffect', { alphaTimerSync: v })}
                  theme="timerSync"
                />
              </Row>
            </div>
          </>
        )}
      </Section>

      <Section title={t('censorEffect')} titleColor="#b070f8">
        <Row label={t('enabled')}>
          <Toggle value={effects.censor.enabled} onChange={v => set('censor', { enabled: v })} />
        </Row>
        {effects.censor.enabled && (
          <>
            <Row label={t('censorFilterType')}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('censorFilterTypeColor')}</span>
            </Row>
            <ColorPicker
              r={effects.censor.color.r}
              g={effects.censor.color.g}
              b={effects.censor.color.b}
              onChange={(r, g, b) => set('censor', { color: { r, g, b } })}
            />
            <Row label={t('censorAlpha')}>
              <Slider
                value={Math.round(effects.censor.alpha * 100)}
                min={0}
                max={100}
                onChange={v => set('censor', { alpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('censorFeather')}>
              <Slider
                value={effects.censor.feather ?? 0}
                min={0}
                max={50}
                onChange={v => set('censor', { feather: v })}
              />
            </Row>
            <Row label={t('censorTextEnabled')}>
              <Toggle
                value={effects.censor.textEnabled ?? false}
                onChange={v => set('censor', { textEnabled: v })}
              />
            </Row>
            {(effects.censor.textEnabled ?? false) && (
              <>
                <div style={{ marginBottom: 4 }}>
                  <textarea
                    value={effects.censor.text ?? ''}
                    placeholder={t('censorText')}
                    rows={2}
                    onChange={e => set('censor', { text: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 12,
                      padding: '4px 6px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <Row label={t('censorTextFont')}>
                  <Select
                    value={effects.censor.textFontFamily ?? 'sans-serif'}
                    options={fontOptions}
                    onChange={v => set('censor', { textFontFamily: v })}
                  />
                </Row>
                <Row label={t('censorTextSize')}>
                  <Slider
                    value={effects.censor.textFontSize ?? 14}
                    min={8}
                    max={72}
                    onChange={v => set('censor', { textFontSize: v })}
                    unit="px"
                  />
                </Row>
                <Row label={t('censorTextBold')}>
                  <Toggle
                    value={effects.censor.textBold ?? false}
                    onChange={v => set('censor', { textBold: v })}
                  />
                </Row>
                <Row label={t('censorTextItalic')}>
                  <Toggle
                    value={effects.censor.textItalic ?? false}
                    onChange={v => set('censor', { textItalic: v })}
                  />
                </Row>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, marginTop: 4 }}>{t('censorTextColor')}</div>
                <ColorPicker
                  r={effects.censor.textColor?.r ?? 200}
                  g={effects.censor.textColor?.g ?? 200}
                  b={effects.censor.textColor?.b ?? 200}
                  onChange={(r, g, b) => set('censor', { textColor: { r, g, b } })}
                />
                <Row label={t('censorTextAlpha')}>
                  <Slider
                    value={Math.round((effects.censor.textAlpha ?? 0.5) * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('censor', { textAlpha: v / 100 })}
                    unit="%"
                  />
                </Row>
              </>
            )}
            <Row label={t('censorAreas')}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {effects.censor.rects.length}
              </span>
            </Row>
            {effects.censor.rects.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                {effects.censor.rects.map((r, i) => (
                  <div key={i}>{'①②③④⑤⑥⑦⑧⑨⑩'[i] ?? `${i+1}`} x:{r.x.toFixed(2)} y:{r.y.toFixed(2)} w:{r.w.toFixed(2)} h:{r.h.toFixed(2)}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setCensorRectPicking(true)}
                disabled={censorRectPicking}
              >
                {censorRectPicking ? t('censorPickActive') : t('censorAddArea')}
              </Button>
              {effects.censor.rects.length > 0 && (
                <Button variant="secondary" onClick={() => set('censor', { rects: [] })}>
                  {t('censorClear')}
                </Button>
              )}
            </div>
            {censorRectPicking && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,180,0.7)', marginBottom: 6 }}>
                {t('censorPickHint')} / {t('censorPickTip')}
              </div>
            )}
            <Row label={t('censorLinkToFocus')}>
              <Toggle
                value={effects.censor.linkToFocus}
                onChange={v => set('censor', { linkToFocus: v })}
              />
            </Row>
            {effects.censor.linkToFocus && (
              <Row label={t('censorLinkToFocusRadius')}>
                <Slider
                  value={Math.round(effects.censor.linkToFocusRadius * 100)}
                  min={10}
                  max={100}
                  onChange={v => set('censor', { linkToFocusRadius: v / 100 })}
                  unit="%"
                />
              </Row>
            )}
            <Row label={t('censorLinkToShake')}>
              <Toggle
                value={effects.censor.linkToShake}
                onChange={v => set('censor', { linkToShake: v })}
              />
            </Row>
          </>
        )}
      </Section>

      </CategorySection>

      <Section title={t('applyAll')}>
        <Button variant="primary" onClick={applyEffectsToAll}>
          {t('applyEffectsAll')}
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={restartEffectsWithRandomTiming}
            disabled={!cells.some(c => c.effects.vignette.dynamic || c.effects.spiral?.dynamic || c.effects.colorOverlay?.dynamic || c.effects.colorOverlay?.dynamicAdjust || c.effects.blur.gradualEnabled || c.effects.echo.enabled || c.effects.breathing?.enabled || c.effects.shake?.enabled || c.effects.zoom?.enabled || c.effects.squish?.enabled)}
            title={t('restartRandomTimingTip')}
          >
            {t('restartRandomTiming')}
          </Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={syncActiveEffectsInSelectedColumn}
            disabled={!hasColumnSyncTarget}
            title={t('syncColumnEffectTimingTip')}
          >
            {t('syncColumnEffectTiming')}
          </Button>
        </div>
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <button
            type="button"
            onClick={resetEffectsInSelectedColumn}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: 'rgba(180,72,72,0.72)',
              cursor: 'pointer',
              fontSize: 10,
              padding: 0,
              textAlign: 'right',
            }}
          >
            {t('resetColumnEffects')}
          </button>
        </div>
      </Section>

      <Section title={t('timerSyncSection')}>
        <Button variant="secondary" onClick={enableAllTimerSyncForSelectedCell}>
          {t('enableAllTimerSync')}
        </Button>
        <div style={{ marginTop: 6 }}>
          <Button variant="secondary" onClick={disableAllTimerSyncForSelectedCell}>
            {t('disableAllTimerSync')}
          </Button>
        </div>
      </Section>

    </div>
  )
}
