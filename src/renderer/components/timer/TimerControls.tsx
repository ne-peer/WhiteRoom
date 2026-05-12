import React, { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTimer } from '../../hooks/useTimer'
import { Section, Row, Toggle, NumberInput, Select, Button, ColorPicker, Slider } from '../controls/UIKit'
import { useTranslation } from '../../i18n'
import type { TimerPosition } from '../../../shared/types'

function getApi() {
  return (window as unknown as { api: import('../../../shared/types').IpcApi }).api
}

const POSITION_OPTIONS: { value: TimerPosition; labelKey: 'topLeft' | 'topCenter' | 'topRight' | 'middleLeft' | 'middleCenter' | 'middleRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight' }[] = [
  { value: 'top-left', labelKey: 'topLeft' },
  { value: 'top-center', labelKey: 'topCenter' },
  { value: 'top-right', labelKey: 'topRight' },
  { value: 'middle-left', labelKey: 'middleLeft' },
  { value: 'middle-center', labelKey: 'middleCenter' },
  { value: 'middle-right', labelKey: 'middleRight' },
  { value: 'bottom-left', labelKey: 'bottomLeft' },
  { value: 'bottom-center', labelKey: 'bottomCenter' },
  { value: 'bottom-right', labelKey: 'bottomRight' },
]

export const TimerControls: React.FC = () => {
  const { setTimer, selectedCellId, enableAllTimerSyncForSelectedCell, disableAllTimerSyncForSelectedCell } = useAppStore()
  const { timer, start, pause, reset, progress } = useTimer()
  const { t } = useTranslation()
  const [showPartial, setShowPartial] = useState(false)

  return (
    <div>
      <Section title={t('timerSettings')}>
        <Row label={t('enabled')}>
          <Toggle value={timer.enabled} onChange={v => setTimer({ enabled: v })} />
        </Row>
        {timer.enabled && (
          <>
            <Row label={t('background')}>
              <Toggle value={timer.showBackground} onChange={v => setTimer({ showBackground: v })} />
            </Row>
            <Row label={t('totalTime')}>
              <NumberInput
                value={timer.totalSec}
                min={10}
                max={86400}
                step={10}
                unit={t('seconds')}
                onChange={v => setTimer({ totalSec: v, elapsedSec: 0 })}
              />
            </Row>
            <Row label={t('position')}>
              <Select
                value={timer.position}
                options={POSITION_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))}
                onChange={v => setTimer({ position: v as TimerPosition })}
              />
            </Row>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPartial(v => !v)}
                style={{
                  background: showPartial ? 'rgba(255,220,0,0.18)' : 'rgba(255,255,255,0.1)',
                  border: showPartial ? '1px solid rgba(255,220,0,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4,
                  color: showPartial ? 'rgba(255,220,0,0.9)' : 'rgba(255,255,255,0.8)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '3px 10px',
                  lineHeight: 1.4,
                }}
              >
                {t('specialControlSection')}
              </button>
            </div>
            {showPartial && (
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                  <Row label={t('partialTimerEnabled')}>
                    <Toggle
                      value={timer.partial.enabled}
                      onChange={v => setTimer({ partial: { ...timer.partial, enabled: v } })}
                    />
                  </Row>
                  {timer.partial.enabled && (
                    <>
                      <Row label={t('partialTimerStart')}>
                        <NumberInput
                          value={timer.partial.startSec}
                          min={0}
                          max={timer.totalSec}
                          step={1}
                          unit={t('seconds')}
                          onChange={v => setTimer({ partial: { ...timer.partial, startSec: Math.round(clamp(v, 0, timer.totalSec)) } })}
                        />
                      </Row>
                      <Row label={t('partialTimerEnd')}>
                        <NumberInput
                          value={timer.partial.endSec}
                          min={0}
                          max={Math.max(0, timer.partial.startSec - 1)}
                          step={1}
                          unit={t('seconds')}
                          onChange={v => setTimer({ partial: { ...timer.partial, endSec: Math.round(clamp(v, 0, Math.max(0, timer.partial.startSec - 1))) } })}
                        />
                      </Row>
                    </>
                  )}
                </div>
              )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {timer.running ? (
                <Button variant="secondary" onClick={pause}>{t('pause')}</Button>
              ) : (
                <Button variant="primary" onClick={start}>{t('start')}</Button>
              )}
              <Button variant="danger" onClick={reset}>{t('reset')}</Button>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: 6,
                }}
              >
                <span>{t('elapsed')}: {formatTime(timer.elapsedSec)}</span>
                <span>{t('remaining')}: {formatTime(Math.max(0, timer.totalSec - timer.elapsedSec))}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress * 100}%`,
                    background: 'linear-gradient(90deg, #ff6eb4, #ff9de2)',
                    borderRadius: 2,
                    transition: 'width 0.8s linear',
                  }}
                />
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title={t('timerSyncSection')}>
        <Row label={t('effectCompletionTiming')}>
          <Slider
            value={timer.effectCompletionLeadSec}
            min={0}
            max={30}
            step={1}
            unit={t('secondsBefore')}
            onChange={v => setTimer({ effectCompletionLeadSec: Math.round(clamp(v, 0, 30)) })}
          />
        </Row>
        <div style={{ marginTop: 10 }}>
          <Button
            variant="secondary"
            onClick={enableAllTimerSyncForSelectedCell}
            disabled={!selectedCellId}
          >
            {t('enableAllTimerSync')}
          </Button>
        </div>
        <div style={{ marginTop: 6 }}>
          <Button
            variant="secondary"
            onClick={disableAllTimerSyncForSelectedCell}
            disabled={!selectedCellId}
          >
            {t('disableAllTimerSync')}
          </Button>
        </div>
      </Section>

      <Section title={t('timerPreOverlaySection')}>
        <Row label={t('enabled')}>
          <Toggle
            value={timer.preOverlay.enabled}
            onChange={v => setTimer({ preOverlay: { ...timer.preOverlay, enabled: v } })}
          />
        </Row>
        {timer.preOverlay.enabled && (
          <>
            <Row label={t('preOverlayImage')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const language = useAppStore.getState().language
                    const result = await getApi().openOverlayImage(language)
                    if (!result.canceled && result.filePath) {
                      setTimer({ preOverlay: { ...timer.preOverlay, imagePath: result.filePath } })
                    }
                  }}
                >
                  {t('selectImage')}
                </Button>
                {timer.preOverlay.imagePath && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                    {timer.preOverlay.imagePath.split(/[\\/]/).pop()}
                  </div>
                )}
              </div>
            </Row>
            <Row label={t('preOverlayDisplayStart')}>
              <Slider
                value={timer.preOverlay.displayStartSec}
                min={1}
                max={timer.totalSec}
                step={1}
                unit={t('secondsBefore')}
                onChange={v => setTimer({ preOverlay: { ...timer.preOverlay, displayStartSec: Math.round(clamp(v, 1, timer.totalSec)) } })}
              />
            </Row>
            <Row label={t('preOverlayStartOpacity')}>
              <Slider
                value={timer.preOverlay.startOpacity}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => setTimer({ preOverlay: { ...timer.preOverlay, startOpacity: clamp(v, 0, 100) } })}
              />
            </Row>
            <Row label={t('preOverlayEndOpacity')}>
              <Slider
                value={timer.preOverlay.endOpacity}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => setTimer({ preOverlay: { ...timer.preOverlay, endOpacity: clamp(v, 0, 100) } })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('timerEndFlashSection')}>
        <Row label={t('enabled')}>
          <Toggle
            value={timer.endFlash.enabled}
            onChange={v => setTimer({ endFlash: { ...timer.endFlash, enabled: v } })}
          />
        </Row>
        {timer.endFlash.enabled && (
          <>
            <Row label={t('backgroundColorLabel')}>
              <div style={{ width: '100%' }}>
                <ColorPicker
                  r={timer.endFlash.color.r}
                  g={timer.endFlash.color.g}
                  b={timer.endFlash.color.b}
                  onChange={(r, g, b) => setTimer({ endFlash: { ...timer.endFlash, color: { r, g, b } } })}
                />
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FLASH_COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        title={preset.label}
                        onClick={() => setTimer({ endFlash: { ...timer.endFlash, color: preset.color } })}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: preset.label,
                          cursor: 'pointer',
                          border: '1px solid rgba(255,255,255,0.18)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Row>
            <Row label={t('transparency')}>
              <Slider
                value={timer.endFlash.maxTransparency}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => setTimer({ endFlash: { ...timer.endFlash, maxTransparency: clamp(v, 0, 100) } })}
              />
            </Row>
            <Row label={t('flashCount')}>
              <NumberInput
                value={timer.endFlash.count}
                min={1}
                max={100}
                step={1}
                unit={t('times')}
                onChange={v => setTimer({ endFlash: { ...timer.endFlash, count: Math.max(1, Math.round(v)) } })}
              />
            </Row>
            <Row label={t('flashInterval')}>
              <NumberInput
                value={timer.endFlash.intervalSec}
                min={0.05}
                max={60}
                step={0.05}
                unit={t('seconds')}
                onChange={v => setTimer({ endFlash: { ...timer.endFlash, intervalSec: Math.max(0.05, v) } })}
              />
            </Row>
          </>
        )}
      </Section>

      <Section title={t('timerAutoNextSection')}>
        <Row label={t('enabled')}>
          <Toggle
            value={timer.autoNext.enabled}
            onChange={v => setTimer({ autoNext: { ...timer.autoNext, enabled: v } })}
          />
        </Row>
        {timer.autoNext.enabled && (
          <Row label={t('timerAutoNextDelay')}>
            <NumberInput
              value={timer.autoNext.delaySec}
              min={0}
              max={60}
              step={1}
              unit={t('seconds')}
              onChange={v => setTimer({ autoNext: { ...timer.autoNext, delaySec: Math.max(0, Math.round(v)) } })}
            />
          </Row>
        )}
      </Section>
    </div>
  )
}

const FLASH_COLOR_PRESETS = [
  { label: '#FF00AE', color: { r: 255, g: 0, b: 174 } },
  { label: '#FFFFFF', color: { r: 255, g: 255, b: 255 } },
] as const

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
