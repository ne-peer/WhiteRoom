import React from 'react'
import { useAppStore } from '../../stores/appStore'
import styles from './TimerPreOverlay.module.css'

function toFileUrl(filePath: string): string {
  return 'file:///' + filePath.replace(/\\/g, '/')
}

export const TimerPreOverlay: React.FC = () => {
  const timer = useAppStore(s => s.timer)
  const { preOverlay } = timer

  if (!preOverlay.enabled || !preOverlay.imagePath) return null

  const remainingSec = Math.max(0, timer.totalSec - timer.elapsedSec)
  const isTimerEnded = !timer.running && timer.elapsedSec >= timer.totalSec && timer.elapsedSec > 0
  const isInPrePeriod = timer.enabled && remainingSec <= preOverlay.displayStartSec && timer.elapsedSec > 0

  if (!isInPrePeriod && !isTimerEnded) return null

  let progress: number
  if (isTimerEnded) {
    progress = 1
  } else if (preOverlay.displayStartSec > 0) {
    progress = Math.max(0, Math.min(1, (preOverlay.displayStartSec - remainingSec) / preOverlay.displayStartSec))
  } else {
    progress = 1
  }

  const opacity = (preOverlay.startOpacity + (preOverlay.endOpacity - preOverlay.startOpacity) * progress) / 100

  return (
    <div className={styles.overlay} style={{ opacity, transition: 'opacity 1s linear' }}>
      <img
        src={toFileUrl(preOverlay.imagePath)}
        className={styles.image}
        alt=""
        draggable={false}
      />
    </div>
  )
}
