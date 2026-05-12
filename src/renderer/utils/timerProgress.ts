import type { TimerConfig } from '../../shared/types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** タイマーが完了する際の経過秒（途中終了を含む） */
export function getTimerCompletionElapsed(timer: TimerConfig): number {
  return timer.partial.enabled && timer.partial.endSec > 0
    ? Math.max(0, timer.totalSec - timer.partial.endSec)
    : timer.totalSec
}

/**
 * タイマー同期用 0–1 進捗。
 * 詳細制御 ON 時: 途中開始の経過秒で 0、途中終了の経過秒で 1。
 * OFF 時: 従来どおり effectCompletionLeadSec を考慮した経過割合。
 */
export function getTimerEffectSyncProgress(timer: TimerConfig, elapsedSec: number): number {
  if (!timer.enabled || timer.totalSec <= 0) return 0

  if (timer.partial.enabled) {
    const startElapsed = Math.max(0, timer.totalSec - timer.partial.startSec)
    const endElapsed =
      timer.partial.endSec > 0
        ? Math.max(0, timer.totalSec - timer.partial.endSec)
        : timer.totalSec
    const span = Math.max(1e-6, endElapsed - startElapsed)
    return clamp((elapsedSec - startElapsed) / span, 0, 1)
  }

  const effectiveDuration = Math.max(1, timer.totalSec - (timer.effectCompletionLeadSec ?? 0))
  return clamp(elapsedSec / effectiveDuration, 0, 1)
}
