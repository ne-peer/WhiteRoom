import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { getTimerCompletionElapsed } from '../utils/timerProgress'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function useTimer() {
  const { timer, timerCompletedNonce, tickTimer, setTimer, timerAutoNextImages } = useAppStore()
  const intervalRef = useRef<number | null>(null)

  const completionElapsed = getTimerCompletionElapsed(timer)
  const partialStartElapsed = timer.partial.enabled
    ? Math.max(0, timer.totalSec - timer.partial.startSec)
    : 0

  const progress = (() => {
    if (timer.totalSec <= 0) return 0
    if (timer.partial.enabled) {
      const span = Math.max(1e-6, completionElapsed - partialStartElapsed)
      return clamp((timer.elapsedSec - partialStartElapsed) / span, 0, 1)
    }
    return timer.elapsedSec / timer.totalSec
  })()

  useEffect(() => {
    const ce = getTimerCompletionElapsed(timer)
    if (timer.running && timer.elapsedSec < ce) {
      intervalRef.current = window.setInterval(() => {
        tickTimer()
      }, 1000)
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [timer.running, timer.elapsedSec, timer.totalSec, timer.partial.enabled, timer.partial.startSec, timer.partial.endSec, tickTimer])

  useEffect(() => {
    if (timerCompletedNonce === 0) return
    if (!timer.autoNext.enabled) return

    const delaySec = timer.autoNext.delaySec
    const timeout = window.setTimeout(() => {
      const s = useAppStore.getState()
      const ce = getTimerCompletionElapsed(s.timer)
      if (!s.timer.running && s.timer.elapsedSec >= ce) {
        timerAutoNextImages()
      }
    }, delaySec * 1000)

    return () => clearTimeout(timeout)
  }, [timerCompletedNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if (timer.partial.enabled && timer.elapsedSec < partialStartElapsed) {
      setTimer({ running: true, elapsedSec: partialStartElapsed })
    } else {
      setTimer({ running: true })
    }
  }
  const pause = () => setTimer({ running: false })
  const reset = () => setTimer({ running: false, elapsedSec: partialStartElapsed })

  return { timer, start, pause, reset, progress }
}
