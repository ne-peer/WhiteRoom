import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

export function useTimer() {
  const { timer, tickTimer, setTimer } = useAppStore()
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (timer.running && timer.elapsedSec < timer.totalSec) {
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
  }, [timer.running, timer.elapsedSec, timer.totalSec, tickTimer])

  const start = () => setTimer({ running: true })
  const pause = () => setTimer({ running: false })
  const reset = () => setTimer({ running: false, elapsedSec: 0 })

  const progress = timer.totalSec > 0 ? timer.elapsedSec / timer.totalSec : 0

  return { timer, start, pause, reset, progress }
}
