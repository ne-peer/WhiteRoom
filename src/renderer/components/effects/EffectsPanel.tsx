import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, DEFAULT_EFFECTS } from '../../stores/appStore'
import { Section, Row, Toggle, Slider, ColorPicker, NumberInput, Button, Select } from '../controls/UIKit'
import { formatCount, useTranslation } from '../../i18n'
import type { AssetEffectFolder, Cell, CellEffects } from '../../../shared/types'

const FALLBACK_FONT_OPTIONS = ['Meiryo', 'BIZ UDPGothic', 'Yu Gothic', 'MS PGothic']
  .map(font => ({ value: font, label: font }))

type Props = { selectedCell: Cell | undefined | null }

const assetEffectFoldersStartupPromise = typeof window !== 'undefined'
  ? window.api.listAssetEffectFolders().catch(() => ({ folders: [] }))
  : Promise.resolve({ folders: [] })

const EFFECT_PRESET_1: CellEffects = {
  effectCenter: { x: 0.5, y: 0.5 },
  colorOverlay: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    alpha: 0.3,
    imageAdjustEnabled: false,
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
    imagePath: null,
    opacity: 1,
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
  },
  dynamicAsset: {
    enabled: true,
    pattern: 'rising',
    assetPath: 'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart1.png',
    assetPaths: [
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart1.png',
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart2.png',
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart5.png',
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart6.png',
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart7.png',
      'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A\\A_heart9.png',
    ],
    assetFolderPath: 'C:\\develop\\WhiteRoom\\assets\\asset-effect\\heart-sketch-A',
    spawnIntervalMs: 600,
    riseSpeedPx: 2,
    maxParticles: 20,
    sizeRatio: 0.56,
    baseAlpha: 1,
    alphaTimerSync: false,
    emergenceSpeedFactor: 1,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 100, b: 150 },
    colorOverlayAlpha: 0.5,
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
}

const EFFECT_PRESET_2: CellEffects = {
  effectCenter: { x: 0.5, y: 0.59 },
  colorOverlay: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    alpha: 0.3,
    imageAdjustEnabled: false,
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
    imagePath: null,
    opacity: 1,
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
  },
  dynamicAsset: {
    enabled: false,
    pattern: 'rising',
    assetPath: null,
    assetPaths: [],
    assetFolderPath: null,
    spawnIntervalMs: 800,
    riseSpeedPx: 2,
    maxParticles: 20,
    sizeRatio: 1,
    baseAlpha: 1,
    alphaTimerSync: false,
    emergenceSpeedFactor: 1,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 100, b: 150 },
    colorOverlayAlpha: 0.5,
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
}

export const EffectsPanel: React.FC<Props> = ({ selectedCell }) => {
  const {
    setCellEffect,
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
    dynamicAsset: { ...DEFAULT_EFFECTS.dynamicAsset, ...rawEffects.dynamicAsset },
    textEffect: { ...DEFAULT_EFFECTS.textEffect, ...rawEffects.textEffect },
  }
  const set = <K extends keyof typeof effects>(key: K, val: Partial<typeof effects[K]>) =>
    setCellEffect(selectedCellId, key, val)

  const applyEffectPreset1 = () => {
    setCellEffect(selectedCellId, 'colorOverlay', structuredClone(EFFECT_PRESET_1.colorOverlay))
    setCellEffect(selectedCellId, 'vignette', structuredClone(EFFECT_PRESET_1.vignette))
    setCellEffect(selectedCellId, 'spiral', structuredClone(EFFECT_PRESET_1.spiral))
    setCellEffect(selectedCellId, 'blur', structuredClone(EFFECT_PRESET_1.blur))
    setCellEffect(selectedCellId, 'echo', structuredClone(EFFECT_PRESET_1.echo))
    setCellEffect(selectedCellId, 'flash', structuredClone(EFFECT_PRESET_1.flash))
    setCellEffect(selectedCellId, 'breathing', structuredClone(EFFECT_PRESET_1.breathing))
    setCellEffect(selectedCellId, 'shake', structuredClone(EFFECT_PRESET_1.shake))
    setCellEffect(selectedCellId, 'dynamicAsset', structuredClone(EFFECT_PRESET_1.dynamicAsset))
    setCellEffect(selectedCellId, 'textEffect', structuredClone(EFFECT_PRESET_1.textEffect))
  }

  const applyEffectPreset2 = () => {
    setCellEffect(selectedCellId, 'effectCenter', structuredClone(EFFECT_PRESET_2.effectCenter))
    setCellEffect(selectedCellId, 'colorOverlay', structuredClone(EFFECT_PRESET_2.colorOverlay))
    setCellEffect(selectedCellId, 'vignette', structuredClone(EFFECT_PRESET_2.vignette))
    setCellEffect(selectedCellId, 'spiral', structuredClone(EFFECT_PRESET_2.spiral))
    setCellEffect(selectedCellId, 'blur', structuredClone(EFFECT_PRESET_2.blur))
    setCellEffect(selectedCellId, 'echo', structuredClone(EFFECT_PRESET_2.echo))
    setCellEffect(selectedCellId, 'flash', structuredClone(EFFECT_PRESET_2.flash))
    setCellEffect(selectedCellId, 'breathing', structuredClone(EFFECT_PRESET_2.breathing))
    setCellEffect(selectedCellId, 'shake', structuredClone(EFFECT_PRESET_2.shake))
    setCellEffect(selectedCellId, 'dynamicAsset', structuredClone(EFFECT_PRESET_2.dynamicAsset))
    setCellEffect(selectedCellId, 'textEffect', structuredClone(EFFECT_PRESET_2.textEffect))
  }

  const hasColumnSyncTarget = cells.some(c =>
    c.col === selectedCell.col &&
    (
      (c.effects.vignette.enabled && c.effects.vignette.dynamic) ||
      (c.effects.spiral?.enabled && c.effects.spiral?.dynamic) ||
      (c.effects.colorOverlay?.imageAdjustEnabled && c.effects.colorOverlay?.dynamicAdjust) ||
      (c.effects.blur.enabled && c.effects.blur.gradualEnabled) ||
      c.effects.echo.enabled
    )
  )

  const handleOpenAsset = async () => {
    const result = await window.api.openAsset(language)
    if (!result.canceled && result.filePath) {
      set('dynamicAsset', { assetPath: result.filePath, assetPaths: [result.filePath], assetFolderPath: null })
    }
  }

  const handleOpenAssetFolder = async () => {
    const result = await window.api.openAssetFolder(language)
    if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
      set('dynamicAsset', { assetPath: result.images[0], assetPaths: result.images, assetFolderPath: result.folderPath })
    }
  }
  const handleOpenFlashImage = async () => {
    const result = await window.api.openOverlayImage(language)
    if (!result.canceled && result.filePath) {
      set('flash', { imagePath: result.filePath })
    }
  }

  const handleSelectAssetEffectFolder = (folderName: string) => {
    if (!folderName) return
    const folder = assetEffectFolders.find(item => item.name === folderName)
    if (!folder) return
    set('dynamicAsset', {
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
  const assetEffectFolderPlaceholder = __ASSET_EFFECT_FOLDERS__.length > 0
    ? (language === 'ja' ? '未選択' : 'Select folder')
    : (language === 'ja' ? 'assets/asset-effect にフォルダがありません' : 'No folders in assets/asset-effect')
  const assetEffectFolderLabel = language === 'ja' ? 'プリセットアセット' : 'Preset asset'

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

      <Section title={t('colorOverlay')}>
        <Row label={t('colorFilter')}>
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
              showAlpha
              alpha={effects.colorOverlay.alpha}
              onAlphaChange={a => set('colorOverlay', { alpha: a })}
            />
          </div>
        )}
        <Row label={t('imageEnhanceFilter')}>
          <Toggle
            value={effects.colorOverlay.imageAdjustEnabled}
            onChange={v => set('colorOverlay', { imageAdjustEnabled: v })}
          />
        </Row>
        {effects.colorOverlay.imageAdjustEnabled && (
          <>
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

                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('vignetteEffect')}>
        <Row label={t('enabled')}>
          <Toggle value={effects.vignette.enabled} onChange={v => set('vignette', { enabled: v })} />
        </Row>
        {effects.vignette.enabled && (
          <>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{t('color')}</div>
            <div style={{ marginBottom: 10 }}>
              <ColorPicker
                r={effects.vignette.color.r}
                g={effects.vignette.color.g}
                b={effects.vignette.color.b}
                onChange={(r, g, b) => set('vignette', { color: { r, g, b } })}
                showAlpha={!effects.vignette.dynamic}
                alpha={effects.vignette.alpha}
                onAlphaChange={a => set('vignette', { alpha: a })}
              />
            </div>
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

                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('spiralEffect')}>
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
                showAlpha={false}
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
                        showAlpha={false}
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
                <Row label={t('timerSync')}>
                  <Toggle
                    value={effects.spiral.dynamicTimerSync ?? false}
                    onChange={v => set('spiral', { dynamicTimerSync: v })}
                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('blurEffect')}>
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

                  />
                </Row>
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('echoEffect')}>
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

              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('breathingEffect')}>
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
            <Row label={t('timerSync')}>
              <Toggle
                value={effects.breathing.timerSync ?? false}
                onChange={v => set('breathing', { timerSync: v })}

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
          </>
        )}
      </Section>

      <Section title={t('shakeEffect')}>
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
                    min={25}
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
          </>
        )}
      </Section>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ order: 2 }}>
      <Section title={t('textEffect')}>
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
              showAlpha
              alpha={effects.textEffect.alpha}
              onAlphaChange={a => set('textEffect', { alpha: a })}
            />
            <Row label={t('timerSync')}>
              <Toggle
                value={effects.textEffect.alphaTimerSync ?? false}
                onChange={v => set('textEffect', { alphaTimerSync: v })}

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
          </>
        )}
      </Section>

      <Section title={t('flashEffect')}>
        <Row label={t('enabled')}>
          <Toggle value={effects.flash.enabled} onChange={v => set('flash', { enabled: v })} />
        </Row>
        {effects.flash.enabled && (
          <>
            <Row label={t('flashImage')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <Button variant="secondary" onClick={handleOpenFlashImage}>
                  {t('selectImage')}
                </Button>
                {effects.flash.imagePath && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                    {effects.flash.imagePath.split(/[\\/]/).pop()}
                  </div>
                )}
              </div>
            </Row>
            <Row label={t('flashStartTransition')}>
              <Select
                value={effects.flash.startTransition}
                options={[
                  { value: 'none', label: t('transitionNone') },
                  { value: 'fade', label: t('transitionFade') },
                  { value: 'slide-left', label: t('transitionSlideLeft') },
                  { value: 'slide-right', label: t('transitionSlideRight') },
                  { value: 'slide-up', label: t('transitionSlideUp') },
                  { value: 'slide-down', label: t('transitionSlideDown') },
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
                  { value: 'slide-left', label: t('transitionSlideLeft') },
                  { value: 'slide-right', label: t('transitionSlideRight') },
                  { value: 'slide-up', label: t('transitionSlideUp') },
                  { value: 'slide-down', label: t('transitionSlideDown') },
                  { value: 'zoom-in', label: t('transitionZoomIn') },
                  { value: 'zoom-out', label: t('transitionZoomOut') },
                ]}
                onChange={v => set('flash', { endTransition: v as import('../../../shared/types').SlideShowTransition })}
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
            <Row label={t('displayDuration')}>
              <Slider
                value={effects.flash.displayDurationSec}
                min={0.2}
                max={5}
                step={0.2}
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
        </div>

        <div style={{ order: 1 }}>
      <Section title={t('assetEffect')}>
        <Row label={t('enabled')}>
          <Toggle value={effects.dynamicAsset.enabled} onChange={v => set('dynamicAsset', { enabled: v })} />
        </Row>
        {effects.dynamicAsset.enabled && (
          <>
            <Row label={assetEffectFolderLabel}>
              <Select
                value={(() => {
                  const currentName = effects.dynamicAsset.assetFolderPath?.split(/[/\\]/).pop() ?? ''
                  return __ASSET_EFFECT_FOLDERS__.some(f => f.name === currentName) ? currentName : ''
                })()}
                options={[
                  {
                    value: '',
                    label: assetEffectFolderPlaceholder,
                  },
                  ...__ASSET_EFFECT_FOLDERS__.map(folder => ({
                    value: folder.name,
                    label: `${folder.name} (${formatCount(language, folder.count, t('imagesUnit'))})`,
                  })),
                ]}
                onChange={handleSelectAssetEffectFolder}
              />
            </Row>
            <div style={{ marginBottom: 8 }}>
              <Button variant="secondary" onClick={handleOpenAsset}>
                {t('selectAssetImage')}
              </Button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Button variant="secondary" onClick={handleOpenAssetFolder}>
                {t('drawRandomFromFolder')}
              </Button>
            </div>
            {effects.dynamicAsset.assetPath && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, wordBreak: 'break-all' }}>
                {effects.dynamicAsset.assetFolderPath
                  ? `${effects.dynamicAsset.assetFolderPath} (${formatCount(language, effects.dynamicAsset.assetPaths.length, t('imagesUnit'))})`
                  : effects.dynamicAsset.assetPath.split(/[\\/]/).pop()}
              </div>
            )}
            <Row label={t('assetDrawPattern')}>
              <Select
                value={effects.dynamicAsset.pattern ?? 'rising'}
                options={[
                  { value: 'rising', label: t('assetPatternRising') },
                  { value: 'emergence', label: t('assetPatternEmergence') },
                ]}
                onChange={v => set('dynamicAsset', { pattern: v as import('../../../shared/types').AssetDrawPattern })}
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
            {(effects.dynamicAsset.pattern ?? 'rising') === 'rising' && (
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
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.dynamicAsset.baseAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('dynamicAsset', { baseAlpha: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('timerSync')}>
              <Toggle
                value={effects.dynamicAsset.alphaTimerSync ?? false}
                onChange={v => set('dynamicAsset', { alphaTimerSync: v })}

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
            {(effects.dynamicAsset.pattern ?? 'rising') === 'emergence' && (
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
            <Row label={t('assetColor')}>
              <Toggle
                value={effects.dynamicAsset.colorOverlayEnabled}
                onChange={v => set('dynamicAsset', { colorOverlayEnabled: v })}
              />
            </Row>
            {effects.dynamicAsset.colorOverlayEnabled && (
              <ColorPicker
                r={effects.dynamicAsset.colorOverlayColor.r}
                g={effects.dynamicAsset.colorOverlayColor.g}
                b={effects.dynamicAsset.colorOverlayColor.b}
                onChange={(r, g, b) => set('dynamicAsset', { colorOverlayColor: { r, g, b } })}
                showAlpha
                alpha={effects.dynamicAsset.colorOverlayAlpha}
                onAlphaChange={a => set('dynamicAsset', { colorOverlayAlpha: a })}
              />
            )}
          </>
        )}
      </Section>
        </div>
      </div>

      <Section title={t('applyAll')}>
        <Button variant="primary" onClick={applyEffectsToAll}>
          {t('applyEffectsAll')}
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={restartEffectsWithRandomTiming}
            disabled={!cells.some(c => c.effects.vignette.dynamic || c.effects.spiral?.dynamic || c.effects.colorOverlay?.dynamicAdjust || c.effects.blur.gradualEnabled || c.effects.echo.enabled || c.effects.breathing?.enabled || c.effects.shake?.enabled)}
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
