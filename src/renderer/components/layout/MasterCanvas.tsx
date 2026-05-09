import React, { useRef, useEffect, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { usePixiStage } from '../../hooks/usePixiStage'
import { useDropHandler } from '../../hooks/useDropHandler'
import { useAppStore } from '../../stores/appStore'
import { TimerOverlay } from '../timer/TimerOverlay'
import { TimerEndFlashOverlay } from '../timer/TimerEndFlashOverlay'
import { TimerPreOverlay } from '../timer/TimerPreOverlay'
import { CellNavigationOverlay } from './CellNavigationOverlay'
import { TextReaderWindow, calcReaderAutoHeight, calcReaderAutoWidth, READER_WINDOW_MARGIN } from '../reader/TextReaderWindow'
import { useTranslation } from '../../i18n'
import styles from './MasterCanvas.module.css'

type CircleGuideKind = 'radialBlur' | 'shakeTrail' | 'shakeTrailSecondStage'

export const MasterCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const trailSizeDragRef = useRef<{
    cellId: string
    startX: number
    startSize: number
  } | null>(null)
  const showControls = useAppStore(s => s.showControls)
  const grid = useAppStore(s => s.grid)
  const cells = useAppStore(s => s.cells)
  const cellTagOverrides = useAppStore(s => s.cellTagOverrides)
  const shakeTrailPositionPicking = useAppStore(s => s.shakeTrailPositionPicking)
  const spiralRadialPositionPicking = useAppStore(s => s.spiralRadialPositionPicking)
  const selectedCellId = useAppStore(s => s.selectedCellId)
  const textReaderVisible = useAppStore(s => s.textReader.visible)
  const textReaderConfig = useAppStore(s => s.textReader.config)
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null)
  const [pickGuide, setPickGuide] = useState<{
    left: number
    top: number
    width: number
    height: number
    x: number
    y: number
  } | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const { t } = useTranslation()

  const canvasShrinkStyle = React.useMemo((): React.CSSProperties => {
    if (!textReaderVisible || (textReaderConfig.overlayOnImage ?? true)) return {}
    const { windowPosition, fontSize, textDirection, textWindowWidthPercent } = textReaderConfig
    const margin2 = READER_WINDOW_MARGIN * 2
    if (windowPosition === 'bottom') {
      const h = calcReaderAutoHeight(fontSize)
      return { height: `calc(100vh - ${h + margin2}px)` }
    }
    if (windowPosition === 'top') {
      const h = calcReaderAutoHeight(fontSize)
      const offset = h + margin2
      return { top: `${offset}px`, height: `calc(100vh - ${offset}px)` }
    }
    if (windowPosition === 'right') {
      if (textDirection === 'vertical') {
        const w = calcReaderAutoWidth(fontSize)
        return { width: `calc(100vw - ${w + margin2}px)` }
      }
      return { width: `calc(${100 - textWindowWidthPercent}% - ${margin2}px)` }
    }
    if (windowPosition === 'left') {
      if (textDirection === 'vertical') {
        const w = calcReaderAutoWidth(fontSize)
        return { left: `${w + margin2}px`, width: `calc(100vw - ${w + margin2}px)` }
      }
      const offset = `calc(${textWindowWidthPercent}% + ${margin2}px)`
      return { left: offset, width: `calc(${100 - textWindowWidthPercent}% - ${margin2}px)` }
    }
    return {}
  }, [textReaderVisible, textReaderConfig])

  const { setCellImage } = usePixiStage(containerRef)
  const { handleDrop, handleDragOver } = useDropHandler(setCellImage)
  const pickingActive = shakeTrailPositionPicking || spiralRadialPositionPicking
  const selectedCell = cells.find(cell => cell.id === selectedCellId) ?? null
  const pickColumn = selectedCell?.col ?? 0
  const guideCellSize = {
    width: grid.cols > 0 ? canvasSize.width / grid.cols : 0,
    height: grid.rows > 0 ? canvasSize.height / grid.rows : 0,
  }
  const pickColumnOverlays = pickingActive
    ? cells.filter(cell => cell.col === pickColumn).map(cell => ({
      cell,
      imageSrc: cellTagOverrides[cell.id] ?? cell.folder?.images[cell.currentImageIndex] ?? null,
    }))
    : []

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) trailSizeDragRef.current = null
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // フルスクリーン変更をElectronから受け取り
  useEffect(() => {
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    if (!api?.onFullscreenChange) return
    const unsubscribe = api.onFullscreenChange((isFs) => {
      useAppStore.getState().setFullscreen(isFs)
    })
    return unsubscribe
  }, [])

  // Escapeキーでフルスクリーン解除 / スペースキーでタイマー操作
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      if (e.key === 'Escape' && useAppStore.getState().fullscreen) {
        e.preventDefault()
        const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
        useAppStore.getState().setFullscreen(false)
        api?.setFullscreen(false)
      }
      if (e.key.toLowerCase() === 'u' && !e.repeat && !isEditable) {
        e.preventDefault()
        useAppStore.getState().toggleControls()
      }
      if (e.key.toLowerCase() === 'p' && !e.repeat && !isEditable) {
        e.preventDefault()
        const state = useAppStore.getState()
        const next = !(state.shakeTrailPositionPicking || state.spiralRadialPositionPicking)
        state.setShakeTrailPositionPicking(next)
        state.setSpiralRadialPositionPicking(next)
        trailSizeDragRef.current = null
      }
      if (e.key === ' ' && !e.repeat) {
        if (isEditable) return
        e.preventDefault()
        const { timer, setTimer } = useAppStore.getState()
        if (!timer.enabled) return
        const isEnded = !timer.running && timer.elapsedSec >= timer.totalSec && timer.elapsedSec > 0
        if (isEnded) {
          setTimer({ running: false, elapsedSec: 0 })
        } else if (timer.running) {
          setTimer({ running: false })
        } else {
          setTimer({ running: true })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // マウスホイールで画像ナビゲーション（non-passiveで preventDefault を使用）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null
      if (target?.closest('[data-reader-window], [data-storyboard-window]')) return
      const rect = el.getBoundingClientRect()
      const { grid, cells, nextCellImage, prevCellImage } = useAppStore.getState()
      const relX = e.clientX - rect.left
      const relY = e.clientY - rect.top
      const col = Math.max(0, Math.min(Math.floor(relX / (rect.width / grid.cols)), grid.cols - 1))
      const row = Math.max(0, Math.min(Math.floor(relY / (rect.height / grid.rows)), grid.rows - 1))
      const cell = cells.find(c => c.col === col && c.row === row)
      if (!cell || !cell.folder || cell.folder.images.length <= 1) return
      e.preventDefault()
      if (e.deltaY > 0) {
        nextCellImage(cell.id, true)
      } else {
        prevCellImage(cell.id)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const { grid, cells, shakeTrailPositionPicking, spiralRadialPositionPicking } = useAppStore.getState()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const col = Math.max(0, Math.min(Math.floor(relX / (rect.width / grid.cols)), grid.cols - 1))
    const row = Math.max(0, Math.min(Math.floor(relY / (rect.height / grid.rows)), grid.rows - 1))
    const cell = cells.find(c => c.col === col && c.row === row)
    setHoveredCellId(cell?.id ?? null)

    const trailSizeDrag = trailSizeDragRef.current
    if (trailSizeDrag && (shakeTrailPositionPicking || spiralRadialPositionPicking)) {
      e.preventDefault()
      const nextSize = clamp(trailSizeDrag.startSize + (e.clientX - trailSizeDrag.startX) * 0.003, 0.25, 1.5)
      useAppStore.getState().setCellEffect(trailSizeDrag.cellId, 'shake', { trailSize: nextSize })
    }

    if ((!shakeTrailPositionPicking && !spiralRadialPositionPicking) || !cell) {
      setPickGuide(null)
      return
    }

    const left = Math.round((cell.col * rect.width) / grid.cols)
    const top = Math.round((cell.row * rect.height) / grid.rows)
    const nextLeft = Math.round(((cell.col + 1) * rect.width) / grid.cols)
    const nextTop = Math.round(((cell.row + 1) * rect.height) / grid.rows)
    setPickGuide({
      left,
      top,
      width: nextLeft - left,
      height: nextTop - top,
      x: relX - left,
      y: relY - top,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredCellId(null)
    setPickGuide(null)
    trailSizeDragRef.current = null
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const state = useAppStore.getState()
    if (!state.shakeTrailPositionPicking && !state.spiralRadialPositionPicking) return
    const cell = getCellAtClientPoint(e.clientX, e.clientY, rect, state.grid, state.cells)
    if (!cell) return
    e.preventDefault()
    state.selectCell(cell.id)
    trailSizeDragRef.current = {
      cellId: cell.id,
      startX: e.clientX,
      startSize: cell.effects.shake.trailSize ?? 0.7,
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) trailSizeDragRef.current = null
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const state = useAppStore.getState()
    if (state.shakeTrailPositionPicking || state.spiralRadialPositionPicking) {
      e.preventDefault()
    }
  }, [])

  // ドラッグ中はナビゲーションオーバーレイを非表示（flushSync で同期的に DOM から除去し dragover 干渉を防ぐ）
  const handleDragEnter = useCallback(() => {
    flushSync(() => setHoveredCellId(null))
  }, [])

  return (
    <div
      ref={containerRef}
      className={`${styles.canvas} ${showControls ? styles.withPanel : ''} ${(shakeTrailPositionPicking || spiralRadialPositionPicking) ? styles.pickMode : ''}`}
      style={canvasShrinkStyle}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {/* タイマーオーバレイ（PixiJSの上にReactでレンダリング） */}
      <div
        className={styles.emptyCellHints}
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map(cell => (
          <div key={cell.id} className={styles.emptyCellHintSlot}>
            {(!cell.folder || cell.folder.images.length === 0) && !cellTagOverrides[cell.id] && (
              <div className={styles.emptyCellContent}>
                <span className={styles.emptyCellHint}>{t('dropImageOrFolderHere')}</span>
                <div className={styles.emptyCellTips}>
                  <div className={styles.emptyCellTipsGroup}>
                    <div className={styles.emptyCellTipsTitle}>Shortcuts:</div>
                    <ul className={styles.emptyCellTipsList}>
                      <li>{t('shortcutImageControls')}</li>
                      <li>{t('shortcutUiControls')}</li>
                      <li>{t('shortcutTimerControls')}</li>
                      <li>{t('shortcutTextReaderControls')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <TimerPreOverlay />
      {pickingActive && (
        <div
          className={styles.pickFreezeLayer}
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          }}
        >
          {pickColumnOverlays.map(({ cell, imageSrc }) => (
            <div
              key={cell.id}
              className={styles.pickFreezeCell}
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
              }}
            >
              {imageSrc && (
                <img
                  src={toImageSrc(imageSrc)}
                  className={styles.pickFreezeImage}
                  style={toFreezeImageStyle(cell.imageFit)}
                  alt=""
                  draggable={false}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {pickingActive && (
        <div
          className={styles.pickCircleGuideLayer}
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          }}
        >
          {pickColumnOverlays.map(({ cell }) => (
            <div
              key={cell.id}
              className={styles.pickCircleGuideCell}
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
              }}
            >
              {toCircleGuides(cell.effects, guideCellSize).map(guide => (
                <div
                  key={guide.kind}
                  className={`${styles.pickCircleGuideEllipse} ${toCircleGuideClassName(guide.kind)}`}
                  style={guide.style}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {pickingActive && (
        <div className={styles.pickHint}>
          <div>{t('effectCenterSetting')}</div>
          <div className={styles.pickHintTip}>{t('effectCenterPickTip')}</div>
        </div>
      )}
      {pickingActive && (
        <div className={styles.pickLegend}>
          <div className={`${styles.pickLegendItem} ${styles.pickLegendGreen}`}>
            <span>{t('pickLegendGreen')}</span>
            <span className={styles.pickLegendSeparator}>-</span>
            <span>{t('pickLegendBlurAreaSize')}</span>
          </div>
          <div className={`${styles.pickLegendItem} ${styles.pickLegendBlue}`}>
            <span>{t('pickLegendBlue')}</span>
            <span className={styles.pickLegendSeparator}>-</span>
            <span>{t('pickLegendShakeAreaSize')}</span>
          </div>
          <div className={`${styles.pickLegendItem} ${styles.pickLegendYellow}`}>
            <span>{t('pickLegendYellow')}</span>
            <span className={styles.pickLegendSeparator}>-</span>
            <span>{t('pickLegendShakeTrailDelayArea')}</span>
          </div>
        </div>
      )}
      {pickingActive && pickGuide && (
        <div
          className={styles.pickGuide}
          style={{
            left: pickGuide.left,
            top: pickGuide.top,
            width: pickGuide.width,
            height: pickGuide.height,
          }}
        >
          <div className={styles.pickGuideV} style={{ left: pickGuide.x }} />
          <div className={styles.pickGuideH} style={{ top: pickGuide.y }} />
        </div>
      )}
      <TimerEndFlashOverlay />
      <TimerOverlay />
      <TextReaderWindow />
      {/* セルナビゲーションオーバーレイ（前/次画像ボタン） */}
      <CellNavigationOverlay hoveredCellId={hoveredCellId} />
    </div>
  )
}

function getCellAtClientPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  cells: ReturnType<typeof useAppStore.getState>['cells']
) {
  const relX = clientX - rect.left
  const relY = clientY - rect.top
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null
  const col = Math.max(0, Math.min(Math.floor(relX / (rect.width / grid.cols)), grid.cols - 1))
  const row = Math.max(0, Math.min(Math.floor(relY / (rect.height / grid.rows)), grid.rows - 1))
  return cells.find(c => c.col === col && c.row === row) ?? null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toImageSrc(src: string): string {
  if (src.startsWith('file://') || src.startsWith('http') || src.startsWith('data:')) return src
  const normalized = src.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

function toFreezeImageStyle(imageFit: ReturnType<typeof useAppStore.getState>['cells'][number]['imageFit']): React.CSSProperties {
  if (imageFit === 'fitHeight') return { width: 'auto', height: '100%', maxWidth: 'none' }
  if (imageFit === 'fitWidth') return { width: '100%', height: 'auto', maxHeight: 'none' }
  return { width: '100%', height: '100%', objectFit: 'contain' }
}

function toCircleGuides(
  effects: ReturnType<typeof useAppStore.getState>['cells'][number]['effects'],
  cellSize: { width: number; height: number }
): { kind: CircleGuideKind; style: React.CSSProperties }[] {
  const guides: { kind: CircleGuideKind; style: React.CSSProperties }[] = []

  if (effects.blur?.radialEnabled) {
    guides.push({ kind: 'radialBlur', style: toCircleGuideStyle(effects, 'radialBlur', cellSize) })
  }

  if (effects.shake?.trailEnabled) {
    guides.push({ kind: 'shakeTrail', style: toCircleGuideStyle(effects, 'shakeTrail', cellSize) })
    if (effects.shake.trailSecondStageEnabled) {
      guides.push({ kind: 'shakeTrailSecondStage', style: toCircleGuideStyle(effects, 'shakeTrailSecondStage', cellSize) })
    }
  }

  return guides
}

function toCircleGuideStyle(
  effects: ReturnType<typeof useAppStore.getState>['cells'][number]['effects'],
  kind: CircleGuideKind,
  cellSize: { width: number; height: number }
): React.CSSProperties {
  const centerX = clamp(effects.effectCenter?.x ?? 0.5, 0, 1)
  const centerY = clamp(effects.effectCenter?.y ?? 0.5, 0, 1)
  const shakeSize = clamp(effects.shake?.trailSize ?? 0.7, 0.05, 3)
  const size = kind === 'radialBlur'
    ? clamp(effects.blur?.radialSize ?? 1, 0.05, 3)
    : kind === 'shakeTrailSecondStage'
      ? shakeSize * clamp(effects.shake?.trailSecondStageSize ?? 0.62, 0.1, 1)
      : shakeSize
  const height = kind === 'radialBlur'
    ? clamp(effects.blur?.radialHeight ?? 1, 0.05, 3)
    : clamp(effects.shake?.trailHeight ?? 1, 0.05, 3)
  const basePercent = cellSize.width > 0
    ? (Math.min(cellSize.width, cellSize.height) / cellSize.width) * 100
    : 100
  return {
    left: `${centerX * 100}%`,
    top: `${centerY * 100}%`,
    width: `${size * basePercent}%`,
    aspectRatio: `${1} / ${height}`,
  }
}

function toCircleGuideClassName(kind: CircleGuideKind): string {
  if (kind === 'radialBlur') return styles.pickCircleGuideEllipseRadialBlur
  if (kind === 'shakeTrailSecondStage') return styles.pickCircleGuideEllipseSecondStage
  return styles.pickCircleGuideEllipseShakeTrail
}
