import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTimer } from '../../hooks/useTimer'
import { Section, Row, Toggle, NumberInput, Select, Button } from '../controls/UIKit'
import { useTranslation } from '../../i18n'
import type { TimerPosition } from '../../../shared/types'

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
  const { setTimer } = useAppStore()
  const { timer, start, pause, reset } = useTimer()
  const { t } = useTranslation()

  return (
    <div>
      <Section title={t('timerSettings')}>
        <Row label={t('display')}>
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
                <span>{t('remaining')}: {formatTime(timer.totalSec - timer.elapsedSec)}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${timer.totalSec > 0 ? (timer.elapsedSec / timer.totalSec) * 100 : 0}%`,
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
    </div>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
