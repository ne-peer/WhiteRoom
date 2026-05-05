import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Row, Toggle, ColorPicker, Select } from '../controls/UIKit'
import { languageOptions, useTranslation } from '../../i18n'
import type { UiLanguage } from '../../../shared/types'

export const AppearanceControls: React.FC = () => {
  const { blankColor, setBlankColor, fullscreen, setFullscreen } = useAppStore()
  const { language, setLanguage, t } = useTranslation()

  const handleFullscreen = (v: boolean) => {
    setFullscreen(v)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(v)
  }

  return (
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
        <ColorPicker
          r={blankColor.r}
          g={blankColor.g}
          b={blankColor.b}
          onChange={(r, g, b) => setBlankColor({ ...blankColor, r, g, b })}
          showAlpha
          alpha={blankColor.a}
          onAlphaChange={a => setBlankColor({ ...blankColor, a })}
        />
        {/* プリセット */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{t('presets')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <div
                key={p.labelKey}
                title={t(p.labelKey)}
                onClick={() => setBlankColor({ r: p.r, g: p.g, b: p.b, a: 1 })}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: `rgb(${p.r},${p.g},${p.b})`,
                  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('windowSection')}>
        <Row label={t('fullscreen')}>
          <Toggle value={fullscreen} onChange={handleFullscreen} />
        </Row>
      </Section>
    </div>
  )
}

const PRESETS = [
  { labelKey: 'presetBlack', r: 0, g: 0, b: 0 },
  { labelKey: 'presetDarkGray', r: 18, g: 18, b: 18 },
  { labelKey: 'presetWhite', r: 255, g: 255, b: 255 },
  { labelKey: 'presetNavy', r: 10, g: 15, b: 30 },
  { labelKey: 'presetDarkPurple', r: 20, g: 10, b: 30 },
  { labelKey: 'presetDeepBlue', r: 5, g: 10, b: 25 },
  { labelKey: 'presetRoseBlack', r: 20, g: 8, b: 15 },
] as const
