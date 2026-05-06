import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import styles from './TimerEndFlashOverlay.module.css'

export const TimerEndFlashOverlay: React.FC = () => {
  const timer = useAppStore(s => s.timer)
  const cols = useAppStore(s => s.grid.cols)
  const [flashKey, setFlashKey] = useState(0)
  const [visible, setVisible] = useState(false)
  const wasRunningRef = useRef(timer.running)
  const hideTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const endedNow =
      timer.enabled &&
      wasRunningRef.current &&
      !timer.running &&
      timer.totalSec > 0 &&
      timer.elapsedSec >= timer.totalSec

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

  if (!visible || cols <= 0) return null

  const { color, maxTransparency, count, intervalSec } = timer.endFlash
  const opacity = Math.max(0, Math.min(1, 1 - maxTransparency / 100))
  const background = `rgb(${color.r}, ${color.g}, ${color.b})`

  return (
    <div
      key={flashKey}
      className={styles.overlay}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols }, (_, index) => (
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
