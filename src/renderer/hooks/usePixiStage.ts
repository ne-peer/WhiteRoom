import { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { useAppStore } from '../stores/appStore'
import { CellRenderer } from '../utils/CellRenderer'

type CellRendererMap = Map<string, CellRenderer>

export function usePixiStage(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const appRef = useRef<PIXI.Application | null>(null)
  const cellRenderersRef = useRef<CellRendererMap>(new Map())
  const slideshowTimersRef = useRef<Map<string, number>>(new Map())
  const lastRandomRestartNonceRef = useRef(0)

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
        backgroundColor: rgbaToHex(useAppStore.getState().blankColor),
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
        const { cells } = useAppStore.getState()
        cells.forEach(cell => {
          const cr = cellRenderersRef.current.get(cell.id)
          if (cr) cr.tick(ticker.deltaTime, cell.effects)
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
  }, [store.grid, store.cells.length, store.blankColor])

  const imageKey = store.cells
    .map(c => `${c.id}:${c.folder?.id ?? ''}:${c.currentImageIndex}`)
    .join(',')

  useEffect(() => {
    store.cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (!cr || !cell.folder) return
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

  const setCellImage = useCallback((cellId: string, imagePath: string) => {
    const cr = cellRenderersRef.current.get(cellId)
    if (cr) cr.setImage(imagePath, 'none')
  }, [])

  return { app: appRef, cellRenderers: cellRenderersRef, setCellImage }
}

function layoutCells(
  app: PIXI.Application,
  renderers: CellRendererMap,
  state: ReturnType<typeof useAppStore.getState>
) {
  const { grid, cells, blankColor } = state
  const totalW = app.canvas.clientWidth || app.screen.width
  const totalH = app.canvas.clientHeight || app.screen.height

  app.renderer.background.color = rgbaToHex(blankColor)

  const cellW = totalW / grid.cols
  const cellH = totalH / grid.rows

  const currentIds = new Set(cells.map(c => c.id))
  renderers.forEach((cr, id) => {
    if (!currentIds.has(id)) {
      app.stage.removeChild(cr.container)
      cr.destroy()
      renderers.delete(id)
    }
  })

  cells.forEach(cell => {
    const x = cell.col * cellW
    const y = cell.row * cellH

    let cr = renderers.get(cell.id)

    if (!cr) {
      cr = new CellRenderer(cell.id, cellW, cellH)
      app.stage.addChild(cr.container)
      renderers.set(cell.id, cr)

      cr.container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
        const state = useAppStore.getState()
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
    cr.container.x = x
    cr.container.y = y
    drawCellBackground(cr.container, cellW, cellH, blankColor)
  })
}

function drawCellBackground(
  container: PIXI.Container,
  w: number,
  h: number,
  color: { r: number; g: number; b: number; a: number }
) {
  const existing = container.getChildByName('__bg__') as PIXI.Graphics | null
  if (existing) {
    container.removeChild(existing)
    existing.destroy()
  }

  const bg = new PIXI.Graphics()
  bg.label = '__bg__'
  bg.rect(0, 0, w, h)
  bg.fill({ color: rgbaToHex(color), alpha: color.a })
  container.addChildAt(bg, 0)
}

function rgbaToHex(c: { r: number; g: number; b: number; a?: number }): number {
  return (c.r << 16) | (c.g << 8) | c.b
}
