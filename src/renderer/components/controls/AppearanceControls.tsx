import React from 'react'
import { DEFAULT_BLANK_COLOR, useAppStore } from '../../stores/appStore'
import { Section, Row, Toggle, ColorPicker, Select, Button, Slider } from '../controls/UIKit'
import { languageOptions, useTranslation } from '../../i18n'
import type { UiLanguage } from '../../../shared/types'
import styles from './AppearanceControls.module.css'

export const AppearanceControls: React.FC = () => {
  const {
    blankColor,
    blankBackground,
    setBlankColor,
    setBlankBackground,
    fullscreen,
    setFullscreen,
    showControls,
    setControlsVisible,
  } = useAppStore()
  const { language, setLanguage, t } = useTranslation()
  const backgroundModeOptions = [
    { value: 'color', label: t('backgroundModeColor') },
    { value: 'dynamic', label: t('backgroundModeDynamic') },
  ]

  const handleFullscreen = (v: boolean) => {
    setFullscreen(v)
    window.api.setFullscreen(v)
  }

  const handleOpenDevTools = () => {
    window.api.openDevTools()
  }

  const handleResetWindowSize = () => {
    setFullscreen(false)
    window.api.resetWindowSize()
  }

  return (
    <div className={styles.appearancePanel}>
      <div>
        <Section title={t('languageSettings')}>
          <Row label={t('uiLanguage')}>
            <Select
              value={language}
              options={languageOptions}
              onChange={v => setLanguage(v as UiLanguage)}
            />
          </Row>
        </Section>

        <Section title={t('backgroundColor')}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            {t('blankSpaceColorHelp')}
          </div>
          <Row label={t('backgroundType')}>
            <Select
              value={blankBackground.mode}
              options={backgroundModeOptions}
              onChange={mode => setBlankBackground({ mode: mode as 'color' | 'dynamic' })}
            />
          </Row>

          {blankBackground.mode === 'color' ? (
            <>
              <Row label={t('backgroundColorLabel')}>
                <ColorPicker
                  r={blankColor.r}
                  g={blankColor.g}
                  b={blankColor.b}
                  onChange={(r, g, b) => setBlankColor({ ...blankColor, r, g, b })}
                  showAlpha
                  alpha={blankColor.a}
                  onAlphaChange={a => setBlankColor({ ...blankColor, a })}
                />
              </Row>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{t('presets')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <div
                      key={p.label}
                      title={p.label}
                      onClick={() => setBlankColor({ r: p.r, g: p.g, b: p.b, a: 1 })}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: `rgb(${p.r},${p.g},${p.b})`,
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Row label={t('backgroundBlur')}>
              <Slider
                value={blankBackground.dynamicBlur}
                min={0}
                max={100}
                onChange={dynamicBlur => setBlankBackground({ dynamicBlur })}
              />
            </Row>
          )}
        </Section>

        <Section title={t('windowSection')}>
          <Row label={t('fullscreen')}>
            <Toggle value={fullscreen} onChange={handleFullscreen} />
          </Row>
          <Row label={t('hideUi')}>
            <Toggle value={!showControls} onChange={hide => setControlsVisible(!hide)} />
          </Row>
          <div className={styles.fullWidthButtonRow}>
            <Button variant="secondary" onClick={handleResetWindowSize}>
              {t('resetWindowSize')}
            </Button>
          </div>
        </Section>
        <div className={styles.shortcutHelp}>{t('appearanceShortcutHelp')}</div>
      </div>

      <div className={styles.debugSection}>
        <Section title="Debug">
          <Button variant="secondary" onClick={handleOpenDevTools} className={styles.debugButton}>
            Open Electron DevTools
          </Button>
        </Section>
      </div>
    </div>
  )
}

const PRESETS = [
  { label: 'Default', r: DEFAULT_BLANK_COLOR.r, g: DEFAULT_BLANK_COLOR.g, b: DEFAULT_BLANK_COLOR.b },
  { label: '#000000', r: 0, g: 0, b: 0 },
  { label: '#FFFFFF', r: 255, g: 255, b: 255 },
  { label: '#140A1E', r: 20, g: 10, b: 30 },
  { label: '#050A19', r: 5, g: 10, b: 25 },
  { label: '#14080F', r: 20, g: 8, b: 15 },
  { label: '#7A384D', r: 122, g: 56, b: 77 },
] as const
