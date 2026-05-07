import React, { useState } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { useTranslation } from '../../i18n'
import type { TimerPosition } from '../../../shared/types'
import styles from './TimerOverlay.module.css'

const positionStyles: Record<TimerPosition, React.CSSProperties> = {
  'top-left':       { top: 16, left: 16, alignItems: 'flex-start' },
  'top-center':     { top: 16, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  'top-right':      { top: 16, right: 16, alignItems: 'flex-end' },
  'middle-left':    { top: '50%', left: 16, transform: 'translateY(-50%)', alignItems: 'flex-start' },
  'middle-center':  { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', alignItems: 'center' },
  'middle-right':   { top: '50%', right: 16, transform: 'translateY(-50%)', alignItems: 'flex-end' },
  'bottom-left':    { bottom: 16, left: 16, alignItems: 'flex-start' },
  'bottom-center':  { bottom: 16, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  'bottom-right':   { bottom: 16, right: 16, alignItems: 'flex-end' },
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export const TimerOverlay: React.FC = () => {
  const { timer, progress, start, pause, reset } = useTimer()
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  if (!timer.enabled) return null

  const posStyle = positionStyles[timer.position]
  const remaining = timer.totalSec - timer.elapsedSec
  const isEnded = !timer.running && timer.elapsedSec >= timer.totalSec && timer.elapsedSec > 0

  const handleBtnClick = isEnded ? reset : (timer.running ? pause : start)
  const btnLabel = isEnded ? t('reset') : (timer.running ? t('pause') : t('start'))

  return (
    <div
      className={`${styles.wrapper} ${timer.showBackground ? '' : styles.wrapperPlain}`}
      style={posStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.timeLabel}>{formatTime(remaining)}</div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      </div>
      {hovered && (
        <button
          className={styles.controlBtn}
          onClick={handleBtnClick}
        >
          {btnLabel}
        </button>
      )}
    </div>
  )
}
