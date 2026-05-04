import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTimer } from '../../hooks/useTimer'
import { Section, Row, Toggle, NumberInput, Select, Button } from '../controls/UIKit'
import type { TimerPosition } from '../../../shared/types'

const POSITION_OPTIONS: { value: TimerPosition; label: string }[] = [
  { value: 'top-left', label: '上・左' },
  { value: 'top-center', label: '上・中央' },
  { value: 'top-right', label: '上・右' },
  { value: 'middle-left', label: '中・左' },
  { value: 'middle-center', label: '中央' },
  { value: 'middle-right', label: '中・右' },
  { value: 'bottom-left', label: '下・左' },
  { value: 'bottom-center', label: '下・中央' },
  { value: 'bottom-right', label: '下・右' },
]

export const TimerControls: React.FC = () => {
  const { setTimer } = useAppStore()
  const { timer, start, pause, reset } = useTimer()

  return (
    <div>
      <Section title="タイマー設定">
        <Row label="表示">
          <Toggle value={timer.enabled} onChange={v => setTimer({ enabled: v })} />
        </Row>
        {timer.enabled && (
          <>
            <Row label="背景">
              <Toggle value={timer.showBackground} onChange={v => setTimer({ showBackground: v })} />
            </Row>
            <Row label="合計時間">
              <NumberInput
                value={timer.totalSec}
                min={10}
                max={86400}
                step={10}
                unit="秒"
                onChange={v => setTimer({ totalSec: v, elapsedSec: 0 })}
              />
            </Row>
            <Row label="表示位置">
              <Select
                value={timer.position}
                options={POSITION_OPTIONS}
                onChange={v => setTimer({ position: v as TimerPosition })}
              />
            </Row>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {timer.running ? (
                <Button variant="secondary" onClick={pause}>一時停止</Button>
              ) : (
                <Button variant="primary" onClick={start}>開始</Button>
              )}
              <Button variant="danger" onClick={reset}>リセット</Button>
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
                <span>経過: {formatTime(timer.elapsedSec)}</span>
                <span>残り: {formatTime(timer.totalSec - timer.elapsedSec)}</span>
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
