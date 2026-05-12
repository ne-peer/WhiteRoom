import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { getTimerCompletionElapsed } from '../../utils/timerProgress'
import styles from './TimerPreOverlay.module.css'

function toFileUrl(filePath: string): string {
  return 'file:///' + filePath.replace(/\\/g, '/')
}

const POST_END_HOLD_MS = 3000
const POST_END_FADE_MS = 1000

export const TimerPreOverlay: React.FC = () => {
  const timer = useAppStore(s => s.timer)
  const { preOverlay } = timer

  const wasRunningRef = useRef(timer.running)
  const [postEndVisible, setPostEndVisible] = useState(false)
  const [postEndFading, setPostEndFading] = useState(false)
  const holdTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const completionElapsed = getTimerCompletionElapsed(timer)
    const endedNow =
      timer.enabled &&
      wasRunningRef.current &&
      !timer.running &&
      timer.totalSec > 0 &&
      timer.elapsedSec >= completionElapsed

    wasRunningRef.current = timer.running

    if (timer.elapsedSec === 0) {
      if (holdTimerRef.current !== null) { window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
      if (hideTimerRef.current !== null) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
      setPostEndVisible(false)
      setPostEndFading(false)
      return
    }

    if (endedNow && preOverlay.enabled && preOverlay.imagePath) {
      if (holdTimerRef.current !== null) { window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
      if (hideTimerRef.current !== null) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
      setPostEndVisible(true)
      setPostEndFading(false)
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null
        setPostEndFading(true)
        hideTimerRef.current = window.setTimeout(() => {
          hideTimerRef.current = null
          setPostEndVisible(false)
          setPostEndFading(false)
        }, POST_END_FADE_MS)
      }, POST_END_HOLD_MS)
    }
  }, [
    timer.enabled,
    timer.running,
    timer.elapsedSec,
    timer.totalSec,
    timer.partial.enabled,
    timer.partial.startSec,
    timer.partial.endSec,
    preOverlay.enabled,
    preOverlay.imagePath,
  ])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current)
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  if (!preOverlay.enabled || !preOverlay.imagePath) return null

  if (postEndVisible) {
    const opacity = postEndFading ? 0 : preOverlay.endOpacity / 100
    return (
      <div
        className={styles.overlay}
        style={{ opacity, transition: postEndFading ? `opacity ${POST_END_FADE_MS / 1000}s linear` : 'none' }}
      >
        <img src={toFileUrl(preOverlay.imagePath)} className={styles.image} alt="" draggable={false} />
      </div>
    )
  }

  const completionElapsed = getTimerCompletionElapsed(timer)
  const remainingSec = Math.max(0, completionElapsed - timer.elapsedSec)
  const isTimerCompleted = timer.elapsedSec >= completionElapsed && timer.elapsedSec > 0
  const isInPrePeriod = timer.enabled && !isTimerCompleted && remainingSec <= preOverlay.displayStartSec && timer.elapsedSec > 0

  if (!isInPrePeriod) return null

  let progress: number
  if (preOverlay.displayStartSec > 0) {
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
