import { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { useAppStore } from '../stores/appStore'
import { CellRenderer, configureRemoteImageLoading } from '../utils/CellRenderer'

type CellRendererMap = Map<string, CellRenderer>

export function usePixiStage(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const appRef = useRef<PIXI.Application | null>(null)
  const cellRenderersRef = useRef<CellRendererMap>(new Map())
  const slideshowTimersRef = useRef<Map<string, number>>(new Map())
  const lastRandomRestartNonceRef = useRef(0)
  const smoothTimerRef = useRef({
    enabled: false,
    running: false,
    elapsedSec: 0,
    totalSec: 0,
    effectCompletionLeadSec: 3,
    baseElapsedSec: 0,
    baseTimeMs: 0,
  })

  const store = useAppStore()

  useEffect(() => {
    if (!canvasRef.current) return

    const container = canvasRef.current
    const app = new PIXI.Application()
    let cancelled = false
    let initialized = false
    let resizeObserver: ResizeObserver | null = null

    ;(async () => {
      await app.init({
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
        backgroundColor: 0x000000,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      initialized = true

      if (cancelled) {
        app.destroy(true)
        return
      }

      container.querySelectorAll(':scope > canvas').forEach(canvas => canvas.remove())
      container.appendChild(app.canvas)
      appRef.current = app

      app.ticker.add((ticker) => {
        const state = useAppStore.getState()
        const { cells, timer } = state
        const now = performance.now()
        const timerProgress = getSmoothTimerProgress(smoothTimerRef.current, timer, now)
        const sbProgress = state.textReader.storyboardEffectProgress
        // ストーリーボードエフェクト進行中はタイマー同期を上書き
        const effectiveProgress = sbProgress !== null ? sbProgress : timerProgress
        const progressEnabled = sbProgress !== null ? true : timer.enabled
        const progressRunning = sbProgress !== null ? true : timer.running
        cells.forEach(cell => {
          const cr = cellRenderersRef.current.get(cell.id)
          if (!cr) return
          cr.setStoryboardScale(sbProgress)
          cr.applyTimerProgress(cell.effects, progressEnabled, progressRunning, effectiveProgress)
          cr.tick(ticker.deltaTime, cell.effects)
        })
      })

      resizeObserver = new ResizeObserver(() => {
        const { clientWidth, clientHeight } = container
        app.renderer.resize(clientWidth, clientHeight)
        layoutCells(app, cellRenderersRef.current, useAppStore.getState())
      })
      resizeObserver.observe(container)

      layoutCells(app, cellRenderersRef.current, useAppStore.getState())
    })()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      cellRenderersRef.current.forEach(cr => cr.destroy())
      cellRenderersRef.current.clear()
      if (initialized && app.canvas.parentElement === container) {
        container.removeChild(app.canvas)
      }
      if (initialized) {
        app.destroy(true)
      }
      if (appRef.current === app) appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const app = appRef.current
    if (!app) return
    layoutCells(app, cellRenderersRef.current, store)
  }, [store.grid, store.cells.length, store.blankColor, store.blankBackground])

  useEffect(() => {
    const message = store.language === 'en'
      ? 'Pixiv image loading was stopped because this app session reached the 10 unique-image limit. Restart WhiteRoom to reset it.'
      : 'このアプリ起動中のpixiv画像読み込みが上限（異なる画像10件）に達したため、pixiv画像の読み込みを停止しました。WhiteRoomを再起動するとリセットされます。'
    configureRemoteImageLoading(
      () => store.showAppNotification(message, 'warning')
    )
  }, [store.language, store.showAppNotification])

  const imageKey = store.cells
    .map(c => `${c.id}:${c.folder?.id ?? ''}:${c.currentImageIndex}:${store.cellTagOverrides[c.id] ?? ''}`)
    .join(',')

  useEffect(() => {
    store.cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (!cr) return
      const overrideImage = store.cellTagOverrides[cell.id]
      if (overrideImage) {
        cr.setImage(overrideImage, 'fade', 350)
        return
      }
      if (!cell.folder) {
        cr.clearImage()
        return
      }
      const imgPath = cell.folder.images[cell.currentImageIndex]
      if (imgPath) cr.setImage(imgPath, cell.slideshow.transition, cell.slideshow.transitionDurationMs)
    })
  }, [imageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    store.cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) {
        cr.setImageFit(cell.imageFit ?? 'cover')
        cr.updateEffects(cell.effects)
      }
    })
  }, [store.cells])


  useEffect(() => {
    const { cells, slideshowRestartNonce } = store
    const randomizeStart = slideshowRestartNonce !== lastRandomRestartNonceRef.current
    lastRandomRestartNonceRef.current = slideshowRestartNonce

    slideshowTimersRef.current.forEach(id => {
      clearInterval(id)
      clearTimeout(id)
    })
    slideshowTimersRef.current.clear()

    cells.forEach(cell => {
      if (!cell.slideshow.enabled || !cell.folder || cell.folder.images.length <= 1) return
      const startInterval = () => window.setInterval(() => {
        useAppStore.getState().nextCellImage(cell.id)
      }, cell.slideshow.intervalMs)

      if (randomizeStart) {
        const tid = window.setTimeout(() => {
          useAppStore.getState().nextCellImage(cell.id)
          slideshowTimersRef.current.set(cell.id, startInterval())
        }, Math.random() * cell.slideshow.intervalMs)
        slideshowTimersRef.current.set(cell.id, tid)
        return
      }

      const tid = startInterval()
      slideshowTimersRef.current.set(cell.id, tid)
    })

    return () => {
      slideshowTimersRef.current.forEach(id => {
        clearInterval(id)
        clearTimeout(id)
      })
      slideshowTimersRef.current.clear()
    }
  }, [
    store.slideshowRestartNonce,
    store.cells.map(c => `${c.id}:${c.slideshow.enabled}:${c.slideshow.intervalMs}`).join(',')
  ])

  useEffect(() => {
    const { cells, effectSyncNonce } = store
    cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) {
        cr.resetEffectTiming(cell.effects, false)
      }
    })
  }, [store.effectSyncNonce])

  useEffect(() => {
    const { cells, effectRandomNonce } = store
    cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) {
        cr.resetEffectTiming(cell.effects, true)
      }
    })
  }, [store.effectRandomNonce])

  useEffect(() => {
    const { cells, effectColumnSyncCol } = store
    if (effectColumnSyncCol === null) return

    cells.forEach(cell => {
      if (cell.col !== effectColumnSyncCol) return
      const hasActiveTimedEffect =
        (cell.effects.vignette.enabled && cell.effects.vignette.dynamic) ||
        (cell.effects.spiral.enabled && cell.effects.spiral.dynamic) ||
        (cell.effects.blur.enabled && cell.effects.blur.gradualEnabled) ||
        cell.effects.echo.enabled ||
        cell.effects.flash.enabled
      if (!hasActiveTimedEffect) return

      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) {
        cr.resetVignetteBlurEchoTiming(cell.effects)
      }
    })
  }, [store.effectColumnSyncNonce])

  useEffect(() => {
    const { timer, cells } = store
    const progress = timer.totalSec > 0 ? timer.elapsedSec / timer.totalSec : 0
    smoothTimerRef.current = {
      enabled: timer.enabled,
      running: timer.running,
      elapsedSec: timer.elapsedSec,
      totalSec: timer.totalSec,
      effectCompletionLeadSec: timer.effectCompletionLeadSec,
      baseElapsedSec: timer.elapsedSec,
      baseTimeMs: performance.now(),
    }
    cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) cr.applyTimerProgress(cell.effects, timer.enabled, timer.running, progress)
    })
  }, [store.timer.enabled, store.timer.running, store.timer.elapsedSec, store.timer.totalSec])

  const setCellImage = useCallback((cellId: string, imagePath: string) => {
    const cr = cellRenderersRef.current.get(cellId)
    if (cr) cr.setImage(imagePath, 'none')
  }, [])

  return { app: appRef, cellRenderers: cellRenderersRef, setCellImage }
}

function getSmoothTimerProgress(
  state: {
    enabled: boolean
    running: boolean
    elapsedSec: number
    totalSec: number
    effectCompletionLeadSec: number
    baseElapsedSec: number
    baseTimeMs: number
  },
  timer: ReturnType<typeof useAppStore.getState>['timer'],
  nowMs: number
): number {
  if (
    state.enabled !== timer.enabled ||
    state.running !== timer.running ||
    state.elapsedSec !== timer.elapsedSec ||
    state.totalSec !== timer.totalSec ||
    state.effectCompletionLeadSec !== timer.effectCompletionLeadSec
  ) {
    state.enabled = timer.enabled
    state.running = timer.running
    state.elapsedSec = timer.elapsedSec
    state.totalSec = timer.totalSec
    state.effectCompletionLeadSec = timer.effectCompletionLeadSec
    state.baseElapsedSec = timer.elapsedSec
    state.baseTimeMs = nowMs
  }

  if (!timer.enabled || timer.totalSec <= 0) return 0
  const elapsedSec = timer.running
    ? state.baseElapsedSec + (nowMs - state.baseTimeMs) / 1000
    : timer.elapsedSec

  const effectiveDuration = Math.max(1, timer.totalSec - (timer.effectCompletionLeadSec ?? 0))
  return clamp(elapsedSec / effectiveDuration, 0, 1)
}

function layoutCells(
  app: PIXI.Application,
  renderers: CellRendererMap,
  state: ReturnType<typeof useAppStore.getState>
) {
  const { grid, cells, blankColor, blankBackground } = state
  const totalW = app.screen.width
  const totalH = app.screen.height

  app.renderer.background.color = 0x000000

  const currentIds = new Set(cells.map(c => c.id))
  renderers.forEach((cr, id) => {
    if (!currentIds.has(id)) {
      app.stage.removeChild(cr.container)
      cr.destroy()
      renderers.delete(id)
    }
  })

  cells.forEach(cell => {
    const x = Math.round((cell.col * totalW) / grid.cols)
    const y = Math.round((cell.row * totalH) / grid.rows)
    const nextX = Math.round(((cell.col + 1) * totalW) / grid.cols)
    const nextY = Math.round(((cell.row + 1) * totalH) / grid.rows)
    const cellW = nextX - x
    const cellH = nextY - y

    let cr = renderers.get(cell.id)

    if (!cr) {
      cr = new CellRenderer(cell.id, cellW, cellH)
      cr.configureBlankBackground(blankBackground)
      app.stage.addChild(cr.container)
      renderers.set(cell.id, cr)

      cr.container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
        const state = useAppStore.getState()
        if (state.shakeTrailPositionPicking || state.spiralRadialPositionPicking) {
          return
        }
        state.selectCell(cell.id)
      })

      if (cell.folder && cell.folder.images[cell.currentImageIndex]) {
        cr.setImage(cell.folder.images[cell.currentImageIndex])
      }

      cr.setImageFit(cell.imageFit ?? 'cover')
      cr.updateEffects(cell.effects)
    } else {
      cr.resize(cellW, cellH)
    }

    cr.setImageFit(cell.imageFit ?? 'cover')
    cr.configureBlankBackground(blankBackground)
    cr.container.x = x
    cr.container.y = y
    drawCellBackground(cr.container, cellW, cellH, blankBackground.mode === 'color' ? blankColor : null)
  })
}

function drawCellBackground(
  container: PIXI.Container,
  w: number,
  h: number,
  color: { r: number; g: number; b: number; a: number } | null
) {
  const existing = container.getChildByName('__bg__') as PIXI.Graphics | null
  if (existing) {
    container.removeChild(existing)
    existing.destroy()
  }
  if (!color) return

  const bg = new PIXI.Graphics()
  bg.label = '__bg__'
  bg.rect(0, 0, w, h)
  bg.fill({ color: rgbaToHex(color), alpha: color.a })
  container.addChildAt(bg, 0)
}

function rgbaToHex(c: { r: number; g: number; b: number; a?: number }): number {
  return (c.r << 16) | (c.g << 8) | c.b
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
