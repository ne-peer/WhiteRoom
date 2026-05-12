/** Ensures fade-out runs once (React StrictMode runs effects twice in dev). */
let whiteroomSplashFadeStarted = false

const SPLASH_FADE_MS = 320
const SPLASH_REMOVE_FALLBACK_MS = SPLASH_FADE_MS + 120

export function fadeOutAndRemoveWhiteroomSplash(): void {
  if (whiteroomSplashFadeStarted) return

  const el = document.getElementById('whiteroom-splash')
  if (!el) {
    whiteroomSplashFadeStarted = true
    return
  }
  whiteroomSplashFadeStarted = true

  const finish = () => {
    el.remove()
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish()
    return
  }

  const onEnd = (event: TransitionEvent) => {
    if (event.target !== el || event.propertyName !== 'opacity') return
    el.removeEventListener('transitionend', onEnd)
    window.clearTimeout(fallbackId)
    finish()
  }

  el.addEventListener('transitionend', onEnd)

  const fallbackId = window.setTimeout(() => {
    el.removeEventListener('transitionend', onEnd)
    finish()
  }, SPLASH_REMOVE_FALLBACK_MS)

  // 本番(asar)では単一 rAF 直後のクラス付与だけだと遷移がバッチされて opacity アニメが飛ぶことがある。
  // インライン style + reflow で開始状態と終了状態を確実に分離する。
  requestAnimationFrame(() => {
    el.style.pointerEvents = 'none'
    el.style.transition = `opacity ${SPLASH_FADE_MS}ms ease-out`
    el.style.opacity = '1'
    void el.offsetWidth
    el.style.opacity = '0'
  })
}
