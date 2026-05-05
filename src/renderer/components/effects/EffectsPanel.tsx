import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore, DEFAULT_EFFECTS } from '../../stores/appStore'
import { Section, Row, Toggle, Slider, ColorPicker, NumberInput, Button, Select } from '../controls/UIKit'
import { formatCount, useTranslation } from '../../i18n'
import type { Cell } from '../../../shared/types'

const FALLBACK_FONT_OPTIONS = ['Meiryo', 'BIZ UDPGothic', 'Yu Gothic', 'MS PGothic']
  .map(font => ({ value: font, label: font }))

type Props = { selectedCell: Cell | undefined | null }

export const EffectsPanel: React.FC<Props> = ({ selectedCell }) => {
  const {
    setCellEffect,
    setAllCellsEffect,
    selectedCellId,
    cells,
    applyEffectsToAll,
    restartEffectsWithRandomTiming,
  } = useAppStore()
  const { language, t } = useTranslation()
  const [systemFonts, setSystemFonts] = useState<string[]>([])

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
    breathing: { ...DEFAULT_EFFECTS.breathing, ...rawEffects.breathing },
    textEffect: { ...DEFAULT_EFFECTS.textEffect, ...rawEffects.textEffect },
  }
  const set = <K extends keyof typeof effects>(key: K, val: Partial<typeof effects[K]>) =>
    setCellEffect(selectedCellId, key, val)

  const applyAssetEffectToAll = () => {
    setAllCellsEffect('dynamicAsset', structuredClone(effects.dynamicAsset))
  }

  const handleOpenAsset = async () => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openAsset(language)
    if (!result.canceled && result.filePath) {
      set('dynamicAsset', { assetPath: result.filePath, assetPaths: [result.filePath], assetFolderPath: null })
    }
  }

  const handleOpenAssetFolder = async () => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    const result = await api.openAssetFolder(language)
    if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
      set('dynamicAsset', { assetPath: result.images[0], assetPaths: result.images, assetFolderPath: result.folderPath })
    }
  }

  return (
    <div>
      <Section title={t('colorOverlay')}>
        <Row label={t('enabled')}>
          <Toggle value={effects.colorOverlay.enabled} onChange={v => set('colorOverlay', { enabled: v })} />
        </Row>
        {effects.colorOverlay.enabled && (
          <>
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
            <ColorPicker
              r={effects.vignette.color.r}
              g={effects.vignette.color.g}
              b={effects.vignette.color.b}
              onChange={(r, g, b) => set('vignette', { color: { r, g, b } })}
              showAlpha
              alpha={effects.vignette.alpha}
              onAlphaChange={a => set('vignette', { alpha: a })}
            />
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
                <Row label={t('strengthFactor')}>
                  <Slider
                    value={Math.round(effects.blur.radialIntensity * 100)}
                    min={0}
                    max={100}
                    onChange={v => set('blur', { radialIntensity: v / 100 })}
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

      <Section title={t('applyAll')}>
        <Button variant="primary" onClick={applyEffectsToAll}>
          {t('applyEffectsAll')}
        </Button>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={restartEffectsWithRandomTiming}
            disabled={!cells.some(c => c.effects.vignette.dynamic || c.effects.blur.gradualEnabled || c.effects.echo.enabled || c.effects.breathing?.enabled)}
          >
            {t('restartRandomTiming')}
          </Button>
        </div>
      </Section>

      <Section title={t('assetEffect')}>
        <Row label={t('enabled')}>
          <Toggle value={effects.dynamicAsset.enabled} onChange={v => set('dynamicAsset', { enabled: v })} />
        </Row>
        {effects.dynamicAsset.enabled && (
          <>
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
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '8px 0 10px' }}>
              {t('riseSpeedHelp')}
            </div>
            <Row label={t('maxSpawnHeight')}>
              <Slider
                value={Math.round(effects.dynamicAsset.spawnMaxHeightRatio * 100)}
                min={0}
                max={70}
                onChange={v => set('dynamicAsset', { spawnMaxHeightRatio: v / 100 })}
                unit="%"
              />
            </Row>
            <Row label={t('maxCount')}>
              <NumberInput
                value={effects.dynamicAsset.maxParticles}
                min={1}
                max={100}
                step={1}
                onChange={v => set('dynamicAsset', { maxParticles: v })}
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
            <Row label={t('opacity')}>
              <Slider
                value={Math.round(effects.dynamicAsset.baseAlpha * 100)}
                min={0}
                max={100}
                onChange={v => set('dynamicAsset', { baseAlpha: v / 100 })}
                unit="%"
              />
            </Row>
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
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={applyAssetEffectToAll}>
                {t('applyAssetAll')}
              </Button>
            </div>
          </>
        )}
      </Section>
    </div>
  )
}
