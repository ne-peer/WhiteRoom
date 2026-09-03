import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { getTimerCompletionElapsed } from '../../utils/timerProgress'
import { toGridTemplateColumns } from '../../utils/gridGeometry'
import styles from './TimerEndFlashOverlay.module.css'

export const TimerEndFlashOverlay: React.FC = () => {
  const timer = useAppStore(s => s.timer)
  const grid = useAppStore(s => s.grid)
  const [flashKey, setFlashKey] = useState(0)
  const [visible, setVisible] = useState(false)
  const wasRunningRef = useRef(timer.running)
  const hideTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const completionElapsed = getTimerCompletionElapsed(timer)
    const endedNow =
      timer.enabled &&
      wasRunningRef.current &&
      !timer.running &&
      timer.totalSec > 0 &&
      timer.elapsedSec >= completionElapsed

    wasRunningRef.current = timer.running

    if (!endedNow || !timer.endFlash.enabled) return

    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current)
    }

    setFlashKey(key => key + 1)
    setVisible(true)

    const durationMs = Math.max(0.05, timer.endFlash.intervalSec) * Math.max(1, timer.endFlash.count) * 1000
    hideTimeoutRef.current = window.setTimeout(() => {
      setVisible(false)
      hideTimeoutRef.current = null
    }, durationMs)
  }, [
    timer.enabled,
    timer.running,
    timer.elapsedSec,
    timer.totalSec,
    timer.partial.enabled,
    timer.partial.startSec,
    timer.partial.endSec,
    timer.endFlash.enabled,
    timer.endFlash.intervalSec,
    timer.endFlash.count,
  ])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  if (!visible || grid.cols <= 0) return null

  const { color, maxTransparency, count, intervalSec } = timer.endFlash
  const opacity = Math.max(0, Math.min(1, 1 - maxTransparency / 100))
  const background = `rgb(${color.r}, ${color.g}, ${color.b})`

  return (
    <div
      key={flashKey}
      className={styles.overlay}
      style={{ gridTemplateColumns: toGridTemplateColumns(grid) }}
    >
      {Array.from({ length: grid.cols }, (_, index) => (
        <div
          key={index}
          className={styles.column}
          style={{
            background,
            animationDuration: `${Math.max(0.05, intervalSec)}s`,
            animationIterationCount: Math.max(1, Math.round(count)),
            ['--flash-opacity' as string]: opacity,
          }}
        />
      ))}
    </div>
  )
}
