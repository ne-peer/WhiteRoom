import { useEffect, useRef, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { useAppStore } from '../stores/appStore'
import { CellRenderer } from '../utils/CellRenderer'

type CellRendererMap = Map<string, CellRenderer>

export function usePixiStage(canvasRef: React.RefObject<HTMLDivElement | null>) {
  const appRef = useRef<PIXI.Application | null>(null)
  const cellRenderersRef = useRef<CellRendererMap>(new Map())
  const slideshowTimersRef = useRef<Map<string, number>>(new Map())

  const store = useAppStore()

  // PixiJSアプリ初期化
  useEffect(() => {
    if (!canvasRef.current) return

    const container = canvasRef.current
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight

    const app = new PIXI.Application()

    ;(async () => {
      await app.init({
        width: w,
        height: h,
        backgroundColor: rgbaToHex(store.blankColor),
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      container.appendChild(app.canvas)
      appRef.current = app

      // グローバルtickerにフレーム更新登録
      app.ticker.add((ticker) => {
        const { cells } = useAppStore.getState()
        cells.forEach(cell => {
          const cr = cellRenderersRef.current.get(cell.id)
          if (cr) cr.tick(ticker.deltaTime, cell.effects)
        })
      })

      // リサイズオブザーバー
      const ro = new ResizeObserver(() => {
        const { clientWidth: nw, clientHeight: nh } = container
        app.renderer.resize(nw, nh)
        layoutCells(app, cellRenderersRef.current, useAppStore.getState())
      })
      ro.observe(container)

      // 初期レイアウト
      layoutCells(app, cellRenderersRef.current, useAppStore.getState())

      return () => {
        ro.disconnect()
        app.destroy(true)
        appRef.current = null
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // グリッド・セル変更時にレイアウト再計算
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    layoutCells(app, cellRenderersRef.current, store)
  }, [store.grid, store.cells.length, store.blankColor])

  // フォルダ/表示インデックス変更時に画像を更新
  // （ダイアログ・D&D・スライドショー問わず、ストアが変わったら反映する）
  const imageKey = store.cells
    .map(c => `${c.id}:${c.folder?.id ?? ''}:${c.currentImageIndex}`)
    .join(',')

  useEffect(() => {
    store.cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (!cr || !cell.folder) return
      const imgPath = cell.folder.images[cell.currentImageIndex]
      if (imgPath) cr.setImage(imgPath)
    })
  }, [imageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 各セルのエフェクト変更を個別に反映
  useEffect(() => {
    store.cells.forEach(cell => {
      const cr = cellRenderersRef.current.get(cell.id)
      if (cr) cr.updateEffects(cell.effects)
    })
  }, [store.cells])

  // スライドショータイマー管理
  useEffect(() => {
    const { cells } = store

    // 既存タイマー全クリア
    slideshowTimersRef.current.forEach(id => clearInterval(id))
    slideshowTimersRef.current.clear()

    cells.forEach(cell => {
      if (!cell.slideshow.enabled || !cell.folder || cell.folder.images.length <= 1) return
      // nextCellImage でストアの currentImageIndex を変更 → imageKey の useEffect が setImage を呼ぶ
      const tid = window.setInterval(() => {
        useAppStore.getState().nextCellImage(cell.id)
      }, cell.slideshow.intervalMs)
      slideshowTimersRef.current.set(cell.id, tid)
    })

    return () => {
      slideshowTimersRef.current.forEach(id => clearInterval(id))
      slideshowTimersRef.current.clear()
    }
  }, [store.cells.map(c => `${c.id}:${c.slideshow.enabled}:${c.slideshow.intervalMs}`).join(',')])

  // セルへの画像セット（外部から呼び出し可能）
  const setCellImage = useCallback((cellId: string, imagePath: string) => {
    const cr = cellRenderersRef.current.get(cellId)
    if (cr) cr.setImage(imagePath)
  }, [])

  return { app: appRef, cellRenderers: cellRenderersRef, setCellImage }
}

// ===== レイアウト計算 =====

function layoutCells(
  app: PIXI.Application,
  renderers: CellRendererMap,
  state: ReturnType<typeof useAppStore.getState>
) {
  const { grid, cells, blankColor } = state
  const totalW = app.renderer.width
  const totalH = app.renderer.height

  // 背景色
  app.renderer.background.color = rgbaToHex(blankColor)

  // セルサイズ
  const cellW = totalW / grid.cols
  const cellH = totalH / grid.rows

  // 既存レンダラーのうち、現在セルにないものを破棄
  const currentIds = new Set(cells.map(c => c.id))
  renderers.forEach((cr, id) => {
    if (!currentIds.has(id)) {
      app.stage.removeChild(cr.container)
      cr.destroy()
      renderers.delete(id)
    }
  })

  // 各セルのレンダラーを生成・更新
  cells.forEach(cell => {
    const x = cell.col * cellW
    const y = cell.row * cellH

    let cr = renderers.get(cell.id)

    if (!cr) {
      cr = new CellRenderer(cell.id, cellW, cellH)
      app.stage.addChild(cr.container)
      renderers.set(cell.id, cr)

      // セルクリック → 選択
      cr.container.on('pointerdown', () => {
        useAppStore.getState().selectCell(cell.id)
      })

      // 既に画像があれば描画
      if (cell.folder && cell.folder.images[cell.currentImageIndex]) {
        cr.setImage(cell.folder.images[cell.currentImageIndex])
      }

      cr.updateEffects(cell.effects)
    } else {
      cr.resize(cellW, cellH)
    }

    cr.container.x = x
    cr.container.y = y

    // セル背景（ブランクカラー）
    drawCellBackground(cr.container, cellW, cellH, blankColor)
  })
}

function drawCellBackground(
  container: PIXI.Container,
  w: number,
  h: number,
  color: { r: number; g: number; b: number; a: number }
) {
  // 既存背景削除
  const existing = container.getChildByName('__bg__') as PIXI.Graphics | null
  if (existing) { container.removeChild(existing); existing.destroy() }

  const bg = new PIXI.Graphics()
  bg.label = '__bg__'
  bg.rect(0, 0, w, h)
  bg.fill({ color: rgbaToHex(color), alpha: color.a })
  container.addChildAt(bg, 0)
}

function rgbaToHex(c: { r: number; g: number; b: number; a?: number }): number {
  return (c.r << 16) | (c.g << 8) | c.b
}
