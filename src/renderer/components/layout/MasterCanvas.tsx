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
import { emptyCellShortcutTipSections, useTranslation, type TranslationKey } from '../../i18n'
import type { Cell, ImageFitMode } from '../../../shared/types'
import { getTimerCompletionElapsed } from '../../utils/timerProgress'
import {
  trailDuplicateHalfSeparationNormX,
  trailDuplicateVerticalStaggerOffsetsNormY,
} from '../../utils/shakeTrailDuplicateGeometry'
import styles from './MasterCanvas.module.css'

type CircleGuideKind = 'radialBlur' | 'shakeTrail' | 'shakeTrailSecondStage'

type CircleGuideItem = {
  key: string
  kind: CircleGuideKind
  style: React.CSSProperties
  dupGroupId?: string
}
type PickCenterPoint = {
  cellId: string
  x: number
  y: number
}
type FlashRangeDrag = {
  column: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

/** 1 列あたりの幅がこの値以下なら空セルの Tips 文言を出さない */
const EMPTY_CELL_TIPS_MAX_COLUMN_WIDTH_PX = 300
/** 1 行あたりの高さがこの値以下なら空セルの Tips 文言を出さない */
const EMPTY_CELL_TIPS_MAX_ROW_HEIGHT_PX = 500

/** StashWindow のデフォルト左上と揃える（mousemove 前の [s] フォールバック） */
const STASH_POINTER_FALLBACK = { x: 8, y: 48 }
/** StashWindow のスロット長押し（LONG_PRESS_MS）と揃える */
const STASH_RMB_LONG_PRESS_MS = 400

export const MasterCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastClientPointerRef = useRef(STASH_POINTER_FALLBACK)
  const stashRmbLongPressTimerRef = useRef<number | null>(null)
  const stashRmbOpenAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const stashRmbSuppressNextContextMenuRef = useRef(false)
  const centerPickDragRef = useRef<PickCenterPoint | null>(null)
  const trailSizeDragRef = useRef<{
    cellId: string
    startX: number
    startY: number
    startSize: number
    startTrailHeight: number
    startRadialHeight: number
  } | null>(null)
  const flashRangeDragRef = useRef<FlashRangeDrag | null>(null)
  const showControls = useAppStore(s => s.showControls)
  const grid = useAppStore(s => s.grid)
  const cells = useAppStore(s => s.cells)
  const cellTagOverrides = useAppStore(s => s.cellTagOverrides)
  const shakeTrailPositionPicking = useAppStore(s => s.shakeTrailPositionPicking)
  const spiralRadialPositionPicking = useAppStore(s => s.spiralRadialPositionPicking)
  const squishColorPicking = useAppStore(s => s.squishColorPicking)
  const flashRangePicking = useAppStore(s => s.flashRangePicking)
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
  const [pickPreviewCenter, setPickPreviewCenter] = useState<PickCenterPoint | null>(null)
  const [flashRangeDrag, setFlashRangeDrag] = useState<FlashRangeDrag | null>(null)
  const [lockedPickColumn, setLockedPickColumn] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const { t, language } = useTranslation()

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
  const anyPickModeActive = pickingActive || squishColorPicking || flashRangePicking
  const selectedCell = cells.find(cell => cell.id === selectedCellId) ?? null
  const pickColumn = pickingActive ? lockedPickColumn ?? selectedCell?.col ?? null : null
  const flashRangeColumn = flashRangePicking ? lockedPickColumn ?? selectedCell?.col ?? null : null
  const pickColumnBounds = React.useMemo((): React.CSSProperties | null => {
    if (!pickingActive || pickColumn === null || grid.cols <= 0) return null
    const left = Math.round((pickColumn * canvasSize.width) / grid.cols)
    const nextLeft = Math.round(((pickColumn + 1) * canvasSize.width) / grid.cols)
    return {
      left,
      top: 0,
      width: nextLeft - left,
      height: canvasSize.height,
    }
  }, [canvasSize.height, canvasSize.width, grid.cols, pickColumn, pickingActive])
  const flashRangeColumnBounds = React.useMemo((): React.CSSProperties | null => {
    if (!flashRangePicking || flashRangeColumn === null || grid.cols <= 0) return null
    const left = Math.round((flashRangeColumn * canvasSize.width) / grid.cols)
    const nextLeft = Math.round(((flashRangeColumn + 1) * canvasSize.width) / grid.cols)
    return {
      left,
      top: 0,
      width: nextLeft - left,
      height: canvasSize.height,
    }
  }, [canvasSize.height, canvasSize.width, flashRangeColumn, flashRangePicking, grid.cols])
  const guideCellSize = {
    width: grid.cols > 0 ? canvasSize.width / grid.cols : 0,
    height: grid.rows > 0 ? canvasSize.height / grid.rows : 0,
  }
  const showEmptyCellTips =
    grid.cols > 0 &&
    grid.rows > 0 &&
    guideCellSize.width > EMPTY_CELL_TIPS_MAX_COLUMN_WIDTH_PX &&
    guideCellSize.height > EMPTY_CELL_TIPS_MAX_ROW_HEIGHT_PX
  const pickColumnOverlays = pickingActive && pickColumn !== null
    ? cells.filter(cell => cell.col === pickColumn).map(cell => ({
      cell,
      imageSrc: cellTagOverrides[cell.id] ?? cell.folder?.images[cell.currentImageIndex] ?? null,
    }))
    : []
  const cancelPickMode = useCallback(() => {
    const state = useAppStore.getState()
    state.setShakeTrailPositionPicking(false)
    state.setSpiralRadialPositionPicking(false)
    state.setSquishColorPicking(false)
    state.setFlashRangePicking(false)
    centerPickDragRef.current = null
    trailSizeDragRef.current = null
    flashRangeDragRef.current = null
    setLockedPickColumn(null)
    setPickPreviewCenter(null)
    setPickGuide(null)
    setFlashRangeDrag(null)
  }, [])

  const clearStashRmbLongPressTimer = useCallback(() => {
    if (stashRmbLongPressTimerRef.current != null) {
      window.clearTimeout(stashRmbLongPressTimerRef.current)
      stashRmbLongPressTimerRef.current = null
    }
  }, [])

  React.useLayoutEffect(() => {
    if (!pickingActive && !flashRangePicking) {
      setLockedPickColumn(null)
      return
    }
    setLockedPickColumn(current => {
      if (current !== null) return current
      const state = useAppStore.getState()
      return state.cells.find(cell => cell.id === state.selectedCellId)?.col ?? null
    })
  }, [flashRangePicking, pickingActive, selectedCell?.col])

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        trailSizeDragRef.current = null
        clearStashRmbLongPressTimer()
      }
      if (e.button !== 0) return

      const rangeDrag = flashRangeDragRef.current
      const rangeEl = containerRef.current
      if (rangeDrag && rangeEl) {
        flashRangeDragRef.current = null
        setFlashRangeDrag(null)
        void finalizeFlashRangeSelection(rangeDrag, rangeEl.getBoundingClientRect(), e.clientX, e.clientY, t)
        return
      }

      const drag = centerPickDragRef.current
      const el = containerRef.current
      if (!drag || !el) return

      const rect = el.getBoundingClientRect()
      const point = getNormalizedPointInCell(e.clientX, e.clientY, rect, drag.cellId, useAppStore.getState())
        ?? { cellId: drag.cellId, x: drag.x, y: drag.y }
      const state = useAppStore.getState()
      state.setCellEffect(point.cellId, 'effectCenter', { x: point.x, y: point.y })
      state.setShakeTrailPositionPicking(false)
      state.setSpiralRadialPositionPicking(false)
      centerPickDragRef.current = null
      setPickPreviewCenter(null)
      setPickGuide(null)
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [clearStashRmbLongPressTimer])

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

  // スタッシュ [s] 用: 直近のビューポート内ポインタ位置
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      lastClientPointerRef.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener('mousemove', onMove, { passive: true })
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  // Escapeキーで中心位置指定キャンセル or フルスクリーン解除 / スペースキーでタイマー操作
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      const state = useAppStore.getState()
      const centerPickModeActive = state.shakeTrailPositionPicking || state.spiralRadialPositionPicking
      if (e.key === 'Escape' && (centerPickModeActive || state.flashRangePicking)) {
        e.preventDefault()
        e.stopPropagation()
        cancelPickMode()
        return
      }
      if (e.key === 'Escape' && state.fullscreen) {
        e.preventDefault()
        const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
        state.setFullscreen(false)
        api?.setFullscreen(false)
        return
      }
      if (e.key.toLowerCase() === 'u' && !e.repeat && !isEditable) {
        e.preventDefault()
        state.toggleControls()
      }
      if (e.key.toLowerCase() === 's' && !e.repeat && !isEditable) {
        e.preventDefault()
        const p = lastClientPointerRef.current
        state.setStashWindowOpen(true, { x: p.x, y: p.y })
      }
      if (e.key.toLowerCase() === 'p' && !e.repeat && !isEditable) {
        e.preventDefault()
        const state = useAppStore.getState()
        const next = !(state.shakeTrailPositionPicking || state.spiralRadialPositionPicking)
        state.setShakeTrailPositionPicking(next)
        state.setSpiralRadialPositionPicking(next)
        centerPickDragRef.current = null
        trailSizeDragRef.current = null
        setLockedPickColumn(next ? state.cells.find(c => c.id === state.selectedCellId)?.col ?? null : null)
        setPickPreviewCenter(null)
        setPickGuide(null)
      }
      if (!e.repeat && !isEditable && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x')) {
        const state = useAppStore.getState()
        if (state.textReader.storyboardFileActive) return
        const targetIds = [hoveredCellId, state.selectedCellId].filter((id): id is string => Boolean(id))
        const cell = targetIds
          .map(id => state.cells.find(c => c.id === id) ?? null)
          .find(c => c?.folder && c.folder.images.length > 1)
        if (cell?.folder && cell.folder.images.length > 1) {
          e.preventDefault()
          if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'z') {
            state.prevCellImage(cell.id)
          } else {
            state.nextCellImage(cell.id, true)
          }
        }
      }
      if (e.key === ' ' && !e.repeat) {
        if (isEditable) return
        e.preventDefault()
        const { timer, setTimer } = useAppStore.getState()
        if (!timer.enabled) return
        const completionElapsed = getTimerCompletionElapsed(timer)
        const isEnded = !timer.running && timer.elapsedSec >= completionElapsed && timer.elapsedSec > 0
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
  }, [cancelPickMode, hoveredCellId])

  // マウスホイールで画像ナビゲーション（non-passiveで preventDefault を使用）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null
      if (target?.closest('[data-reader-window], [data-storyboard-window], [data-stash-window]')) return
      const rect = el.getBoundingClientRect()
      const { grid, cells, nextCellImage, prevCellImage, textReader } = useAppStore.getState()
      if (textReader.storyboardFileActive) return
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
    const { grid, cells, selectedCellId, shakeTrailPositionPicking, spiralRadialPositionPicking, squishColorPicking, flashRangePicking } = useAppStore.getState()
    const activePickColumn = lockedPickColumn ?? cells.find(c => c.id === selectedCellId)?.col ?? null
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const col = Math.max(0, Math.min(Math.floor(relX / (rect.width / grid.cols)), grid.cols - 1))
    const row = Math.max(0, Math.min(Math.floor(relY / (rect.height / grid.rows)), grid.rows - 1))
    const cell = cells.find(c => c.col === col && c.row === row)
    setHoveredCellId(
      ((shakeTrailPositionPicking || spiralRadialPositionPicking || flashRangePicking) && cell?.col !== activePickColumn)
        ? null
        : cell?.id ?? null
    )

    const rangeDrag = flashRangeDragRef.current
    if (rangeDrag && flashRangePicking) {
      const bounds = getColumnGuideRect(rect, rangeDrag.column, grid)
      const nextDrag = {
        ...rangeDrag,
        currentX: clamp(e.clientX - rect.left, bounds.left, bounds.left + bounds.width),
        currentY: clamp(e.clientY - rect.top, bounds.top, bounds.top + bounds.height),
      }
      flashRangeDragRef.current = nextDrag
      setFlashRangeDrag(nextDrag)
      setPickGuide(null)
      return
    }

    if (flashRangePicking) {
      setPickGuide(null)
      return
    }

    if (squishColorPicking) {
      setPickGuide(null)
      return
    }

    const trailSizeDrag = trailSizeDragRef.current
    if (trailSizeDrag && (shakeTrailPositionPicking || spiralRadialPositionPicking)) {
      e.preventDefault()
      const nextSize = clamp(trailSizeDrag.startSize + (e.clientX - trailSizeDrag.startX) * 0.003, 0.25, 1.5)
      const nextTrailHeight = clamp(trailSizeDrag.startTrailHeight + (e.clientY - trailSizeDrag.startY) * 0.003, 0.25, 2)
      const nextRadialHeight = clamp(trailSizeDrag.startRadialHeight + (e.clientY - trailSizeDrag.startY) * 0.003, 0.25, 2)
      const state = useAppStore.getState()
      state.setCellEffect(trailSizeDrag.cellId, 'shake', { trailSize: nextSize, trailHeight: nextTrailHeight })
      state.setCellEffect(trailSizeDrag.cellId, 'blur', { radialHeight: nextRadialHeight })
    }

    const centerPickDrag = centerPickDragRef.current
    if (centerPickDrag && (shakeTrailPositionPicking || spiralRadialPositionPicking)) {
      const point = getNormalizedPointInCell(e.clientX, e.clientY, rect, centerPickDrag.cellId, useAppStore.getState())
      if (point) {
        centerPickDragRef.current = point
        setPickPreviewCenter(point)
        const guideRect = getCellGuideRect(rect, point.cellId, useAppStore.getState())
        if (guideRect) {
          setPickGuide({
            ...guideRect,
            x: point.x * guideRect.width,
            y: point.y * guideRect.height,
          })
        }
      }
      return
    }

    if (
      (!shakeTrailPositionPicking && !spiralRadialPositionPicking) ||
      !cell ||
      activePickColumn === null ||
      cell.col !== activePickColumn
    ) {
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
    clearStashRmbLongPressTimer()
  }, [clearStashRmbLongPressTimer])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const state = useAppStore.getState()
    if (state.flashRangePicking) {
      e.preventDefault()
      if (e.button !== 0) return
      const cell = getCellAtClientPoint(e.clientX, e.clientY, rect, state.grid, state.cells)
      const activePickColumn = lockedPickColumn ?? state.cells.find(c => c.id === state.selectedCellId)?.col ?? null
      if (!cell || activePickColumn === null || cell.col !== activePickColumn) {
        cancelPickMode()
        return
      }
      state.selectCell(cell.id)
      const bounds = getColumnGuideRect(rect, activePickColumn, state.grid)
      const drag = {
        column: activePickColumn,
        startX: clamp(e.clientX - rect.left, bounds.left, bounds.left + bounds.width),
        startY: clamp(e.clientY - rect.top, bounds.top, bounds.top + bounds.height),
        currentX: clamp(e.clientX - rect.left, bounds.left, bounds.left + bounds.width),
        currentY: clamp(e.clientY - rect.top, bounds.top, bounds.top + bounds.height),
      }
      flashRangeDragRef.current = drag
      setFlashRangeDrag(drag)
      return
    }
    if (state.squishColorPicking) {
      e.preventDefault()
      const cell = getCellAtClientPoint(e.clientX, e.clientY, rect, state.grid, state.cells)
      const imageSrc = cell ? state.cellTagOverrides[cell.id] ?? cell.folder?.images[cell.currentImageIndex] ?? null : null
      if (!cell || !imageSrc) {
        state.showAppNotification(t('squishColorPickFailed'), 'warning')
        state.setSquishColorPicking(false)
        return
      }
      const clientX = e.clientX
      const clientY = e.clientY
      void pickColorFromCellImage(imageSrc, cell, state.grid, rect, clientX, clientY)
        .then(color => {
          const latest = useAppStore.getState()
          if (!color) {
            latest.showAppNotification(t('squishColorPickFailed'), 'warning')
            latest.setSquishColorPicking(false)
            return
          }
          latest.selectCell(cell.id)
          latest.setCellEffect(cell.id, 'squish', { color, colorSource: 'manual' })
          latest.setSquishColorPicking(false)
        })
        .catch(() => {
          const latest = useAppStore.getState()
          latest.showAppNotification(t('squishColorPickFailed'), 'warning')
          latest.setSquishColorPicking(false)
        })
      return
    }
    // [P] 中心位置指定モード中は無効（右ドラッグが円サイズ変更のため）
    if (
      e.button === 2 &&
      !state.shakeTrailPositionPicking &&
      !state.spiralRadialPositionPicking
    ) {
      stashRmbSuppressNextContextMenuRef.current = false
      clearStashRmbLongPressTimer()
      stashRmbOpenAnchorRef.current = { x: e.clientX, y: e.clientY }
      stashRmbLongPressTimerRef.current = window.setTimeout(() => {
        stashRmbLongPressTimerRef.current = null
        const anchor = stashRmbOpenAnchorRef.current
        if (!anchor) return
        stashRmbSuppressNextContextMenuRef.current = true
        useAppStore.getState().setStashWindowOpen(true, anchor)
      }, STASH_RMB_LONG_PRESS_MS)
      return
    }
    if (!state.shakeTrailPositionPicking && !state.spiralRadialPositionPicking) return
    const cell = getCellAtClientPoint(e.clientX, e.clientY, rect, state.grid, state.cells)
    const activePickColumn = lockedPickColumn
    if (!cell || activePickColumn === null || cell.col !== activePickColumn) {
      e.preventDefault()
      cancelPickMode()
      return
    }
    e.preventDefault()
    state.selectCell(cell.id)
    if (e.button === 0) {
      const point = getNormalizedPointInCell(e.clientX, e.clientY, rect, cell.id, state)
      if (!point) return
      centerPickDragRef.current = point
      setPickPreviewCenter(point)
      const guideRect = getCellGuideRect(rect, point.cellId, state)
      if (guideRect) {
        setPickGuide({
          ...guideRect,
          x: point.x * guideRect.width,
          y: point.y * guideRect.height,
        })
      }
      return
    }
    if (e.button !== 2) return
    trailSizeDragRef.current = {
      cellId: cell.id,
      startX: e.clientX,
      startY: e.clientY,
      startSize: cell.effects.shake.trailSize ?? 0.7,
      startTrailHeight: cell.effects.shake.trailHeight ?? 1,
      startRadialHeight: cell.effects.blur.radialHeight ?? 1,
    }
  }, [cancelPickMode, clearStashRmbLongPressTimer, lockedPickColumn, t])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      trailSizeDragRef.current = null
      clearStashRmbLongPressTimer()
    }
    if (e.button !== 0) return
    const rangeDrag = flashRangeDragRef.current
    if (rangeDrag) {
      flashRangeDragRef.current = null
      setFlashRangeDrag(null)
      void finalizeFlashRangeSelection(rangeDrag, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY, t)
      return
    }
    const drag = centerPickDragRef.current
    if (!drag) return
    const rect = e.currentTarget.getBoundingClientRect()
    const point = getNormalizedPointInCell(e.clientX, e.clientY, rect, drag.cellId, useAppStore.getState())
      ?? { cellId: drag.cellId, x: drag.x, y: drag.y }
    const state = useAppStore.getState()
    state.setCellEffect(point.cellId, 'effectCenter', { x: point.x, y: point.y })
    state.setShakeTrailPositionPicking(false)
    state.setSpiralRadialPositionPicking(false)
    centerPickDragRef.current = null
    setPickPreviewCenter(null)
    setPickGuide(null)
  }, [clearStashRmbLongPressTimer])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (stashRmbSuppressNextContextMenuRef.current) {
      e.preventDefault()
      stashRmbSuppressNextContextMenuRef.current = false
      return
    }
    const state = useAppStore.getState()
    if (state.shakeTrailPositionPicking || state.spiralRadialPositionPicking || state.squishColorPicking || state.flashRangePicking) {
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
      className={`${styles.canvas} ${showControls ? styles.withPanel : ''} ${anyPickModeActive ? styles.pickMode : ''}`}
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
                {showEmptyCellTips && (
                  <div className={styles.emptyCellTips}>
                    <div className={styles.emptyCellTipsGroup}>
                      <div className={styles.emptyCellTipsTitle}>{t('emptyCellShortcutsTitle')}</div>
                      <div className={styles.emptyCellTipsSections}>
                        {emptyCellShortcutTipSections[language].map(section => (
                          <section key={section.title} className={styles.emptyCellTipsSection}>
                            <h3 className={styles.emptyCellTipsSectionTitle}>{section.title}</h3>
                            <ul className={styles.emptyCellTipsSectionList}>
                              {section.lines.map(line => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <TimerPreOverlay />
      {pickingActive && pickColumnBounds && (
        <div
          className={styles.pickFreezeLayer}
          style={{
            ...pickColumnBounds,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          }}
        >
          {pickColumnOverlays.map(({ cell, imageSrc }) => (
            <div
              key={cell.id}
              className={styles.pickFreezeCell}
              style={{
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
      {pickingActive && pickColumnBounds && (
        <div
          className={styles.pickCircleGuideLayer}
          style={{
            ...pickColumnBounds,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          }}
        >
          {pickColumnOverlays.map(({ cell }) => (
            <div
              key={cell.id}
              className={styles.pickCircleGuideCell}
              style={{
                gridRow: cell.row + 1,
              }}
            >
              {groupCircleGuides(
                toCircleGuides(
                  cell.effects,
                  guideCellSize,
                  pickPreviewCenter?.cellId === cell.id ? pickPreviewCenter : null,
                ),
              ).map(group =>
                group.length === 1 ? (
                  <div
                    key={group[0].key}
                    className={`${styles.pickCircleGuideEllipse} ${toCircleGuideClassName(group[0].kind)}`}
                    style={group[0].style}
                  />
                ) : (
                  <div key={group[0].dupGroupId ?? group[0].key} className={styles.pickCircleGuideDupGroup}>
                    {group.map(g => (
                      <div
                        key={g.key}
                        className={`${styles.pickCircleGuideEllipse} ${toCircleGuideClassName(g.kind)}`}
                        style={g.style}
                      />
                    ))}
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      )}
      {pickingActive && pickColumnBounds && (
        <div className={styles.pickUiLayer} style={pickColumnBounds}>
          <div className={styles.pickHint}>
            <div>{t('effectCenterSetting')}</div>
            <div className={styles.pickHintTip}>{t('effectCenterPickTip')}</div>
          </div>
        </div>
      )}
      {squishColorPicking && (
        <div className={styles.pickUiLayer} style={{ left: 0, top: 0, width: canvasSize.width, height: canvasSize.height }}>
          <div className={styles.pickHint}>{t('squishColorPickHint')}</div>
        </div>
      )}
      {flashRangePicking && flashRangeColumnBounds && (
        <div className={styles.pickUiLayer} style={flashRangeColumnBounds}>
          <div className={styles.pickHint}>
            <div>{t('flashRangePickHint')}</div>
            <div className={styles.pickHintTip}>{t('flashRangePickTip')}</div>
          </div>
        </div>
      )}
      {flashRangePicking && flashRangeColumnBounds && (
        <div className={styles.flashRangeColumnMask} style={flashRangeColumnBounds} />
      )}
      {flashRangePicking && flashRangeDrag && (
        <div
          className={styles.flashRangeSelection}
          style={toFlashRangeSelectionStyle(flashRangeDrag)}
        />
      )}
      {pickingActive && pickColumnBounds && (
        <div className={styles.pickUiLayer} style={pickColumnBounds}>
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

function getNormalizedPointInCell(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cellId: string,
  state: ReturnType<typeof useAppStore.getState>
): PickCenterPoint | null {
  const cell = state.cells.find(c => c.id === cellId)
  if (!cell) return null
  const cellLeft = rect.left + (cell.col * rect.width) / state.grid.cols
  const cellTop = rect.top + (cell.row * rect.height) / state.grid.rows
  const cellWidth = rect.width / state.grid.cols
  const cellHeight = rect.height / state.grid.rows
  return {
    cellId,
    x: clamp((clientX - cellLeft) / cellWidth, 0, 1),
    y: clamp((clientY - cellTop) / cellHeight, 0, 1),
  }
}

function getCellGuideRect(
  rect: DOMRect,
  cellId: string,
  state: ReturnType<typeof useAppStore.getState>
): { left: number; top: number; width: number; height: number } | null {
  const cell = state.cells.find(c => c.id === cellId)
  if (!cell) return null
  const left = Math.round((cell.col * rect.width) / state.grid.cols)
  const top = Math.round((cell.row * rect.height) / state.grid.rows)
  const nextLeft = Math.round(((cell.col + 1) * rect.width) / state.grid.cols)
  const nextTop = Math.round(((cell.row + 1) * rect.height) / state.grid.rows)
  return {
    left,
    top,
    width: nextLeft - left,
    height: nextTop - top,
  }
}

function getColumnGuideRect(
  rect: DOMRect,
  column: number,
  grid: ReturnType<typeof useAppStore.getState>['grid']
): { left: number; top: number; width: number; height: number } {
  const left = Math.round((column * rect.width) / grid.cols)
  const nextLeft = Math.round(((column + 1) * rect.width) / grid.cols)
  return {
    left,
    top: 0,
    width: nextLeft - left,
    height: rect.height,
  }
}

function toFlashRangeSelectionStyle(drag: FlashRangeDrag): React.CSSProperties {
  const left = Math.min(drag.startX, drag.currentX)
  const top = Math.min(drag.startY, drag.currentY)
  const width = Math.abs(drag.currentX - drag.startX)
  const height = Math.abs(drag.currentY - drag.startY)
  return {
    left,
    top,
    width,
    height,
  }
}

async function finalizeFlashRangeSelection(
  drag: FlashRangeDrag,
  rect: DOMRect,
  clientX: number,
  clientY: number,
  t: (key: TranslationKey) => string
): Promise<void> {
  const state = useAppStore.getState()
  const bounds = getColumnGuideRect(rect, drag.column, state.grid)
  const completedDrag: FlashRangeDrag = {
    ...drag,
    currentX: clamp(clientX - rect.left, bounds.left, bounds.left + bounds.width),
    currentY: clamp(clientY - rect.top, bounds.top, bounds.top + bounds.height),
  }
  const selection = toAbsoluteSelectionRect(completedDrag)
  if (selection.width < 4 || selection.height < 4) {
    state.setFlashRangePicking(false)
    return
  }

  try {
    const dataUrl = await createFlashRangeSnapshot(completedDrag, rect)
    const latest = useAppStore.getState()
    const targetCell = latest.cells.find(cell => cell.id === latest.selectedCellId && cell.col === completedDrag.column)
      ?? latest.cells.find(cell => cell.col === completedDrag.column)
    if (!targetCell) throw new Error('No target cell')
    latest.setCellEffect(targetCell.id, 'flash', {
      imagePath: dataUrl,
      vectorPresetId: null,
      displayFileMode: 'displayCrop',
    })
    latest.setFlashRangePicking(false)
  } catch {
    const latest = useAppStore.getState()
    latest.showAppNotification(t('flashRangePickFailed'), 'warning')
    latest.setFlashRangePicking(false)
  }
}

function toAbsoluteSelectionRect(drag: FlashRangeDrag): { left: number; top: number; width: number; height: number } {
  const left = Math.min(drag.startX, drag.currentX)
  const top = Math.min(drag.startY, drag.currentY)
  return {
    left,
    top,
    width: Math.abs(drag.currentX - drag.startX),
    height: Math.abs(drag.currentY - drag.startY),
  }
}

async function createFlashRangeSnapshot(drag: FlashRangeDrag, rect: DOMRect): Promise<string> {
  const state = useAppStore.getState()
  const columnBounds = getColumnGuideRect(rect, drag.column, state.grid)
  const selection = toAbsoluteSelectionRect(drag)
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const columnCanvas = document.createElement('canvas')
  columnCanvas.width = Math.max(1, Math.round(columnBounds.width * pixelRatio))
  columnCanvas.height = Math.max(1, Math.round(columnBounds.height * pixelRatio))
  const columnContext = columnCanvas.getContext('2d')
  if (!columnContext) throw new Error('Canvas is unavailable')
  columnContext.scale(pixelRatio, pixelRatio)

  const cellsInColumn = state.cells
    .filter(cell => cell.col === drag.column)
    .sort((a, b) => a.row - b.row)

  for (const cell of cellsInColumn) {
    const imageSrc = state.cellTagOverrides[cell.id] ?? cell.folder?.images[cell.currentImageIndex] ?? null
    if (!imageSrc) continue
    const image = await loadSnapshotImage(imageSrc)
    drawCellImageToColumnCanvas(columnContext, image, cell, state.grid, columnBounds.width, columnBounds.height)
  }

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = Math.max(1, Math.round(selection.width * pixelRatio))
  outputCanvas.height = Math.max(1, Math.round(selection.height * pixelRatio))
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) throw new Error('Canvas is unavailable')
  outputContext.drawImage(
    columnCanvas,
    Math.round((selection.left - columnBounds.left) * pixelRatio),
    Math.round(selection.top * pixelRatio),
    Math.round(selection.width * pixelRatio),
    Math.round(selection.height * pixelRatio),
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  )
  return outputCanvas.toDataURL('image/png')
}

function drawCellImageToColumnCanvas(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cell: Cell,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  columnWidth: number,
  columnHeight: number
): void {
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0 || grid.rows <= 0) return
  const cellWidth = columnWidth
  const cellHeight = columnHeight / grid.rows
  const cellTop = cell.row * cellHeight
  const scale = getImageFitScale(cell.imageFit, cellWidth, cellHeight, image.naturalWidth, image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  const imageLeft = (cellWidth - drawnWidth) / 2
  const imageTop = cellTop + (cellHeight - drawnHeight) / 2

  context.save()
  context.beginPath()
  context.rect(0, cellTop, cellWidth, cellHeight)
  context.clip()
  context.drawImage(image, imageLeft, imageTop, drawnWidth, drawnHeight)
  context.restore()
}

async function loadSnapshotImage(src: string): Promise<HTMLImageElement> {
  if (!/^https?:\/\//i.test(src)) return loadHtmlImage(toImageSrc(src))
  const result = await window.api.loadRemoteImageAsDataUrl(src)
  if (!result.success || !result.dataUrl) throw new Error(result.error ?? 'Remote image load failed')
  return loadHtmlImage(result.dataUrl)
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

async function pickColorFromCellImage(
  imageSrc: string,
  cell: Cell,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  rect: DOMRect,
  clientX: number,
  clientY: number
): Promise<{ r: number; g: number; b: number } | null> {
  const image = await loadHtmlImage(toImageSrc(imageSrc))
  const sourcePoint = getImageSourcePoint(cell, grid, rect, clientX, clientY, image.naturalWidth, image.naturalHeight)
  if (!sourcePoint) return null

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(
    image,
    sourcePoint.x,
    sourcePoint.y,
    1,
    1,
    0,
    0,
    1,
    1,
  )
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return { r, g, b }
}

function getImageSourcePoint(
  cell: Cell,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  rect: DOMRect,
  clientX: number,
  clientY: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } | null {
  if (imageWidth <= 0 || imageHeight <= 0 || grid.cols <= 0 || grid.rows <= 0) return null
  const cellWidth = rect.width / grid.cols
  const cellHeight = rect.height / grid.rows
  const cellLeft = rect.left + cell.col * cellWidth
  const cellTop = rect.top + cell.row * cellHeight
  const localX = clientX - cellLeft
  const localY = clientY - cellTop
  const scale = getImageFitScale(cell.imageFit, cellWidth, cellHeight, imageWidth, imageHeight)
  const drawnWidth = imageWidth * scale
  const drawnHeight = imageHeight * scale
  const imageLeft = (cellWidth - drawnWidth) / 2
  const imageTop = (cellHeight - drawnHeight) / 2
  const sourceX = Math.floor((localX - imageLeft) / scale)
  const sourceY = Math.floor((localY - imageTop) / scale)
  if (sourceX < 0 || sourceY < 0 || sourceX >= imageWidth || sourceY >= imageHeight) return null
  return {
    x: clamp(sourceX, 0, imageWidth - 1),
    y: clamp(sourceY, 0, imageHeight - 1),
  }
}

function getImageFitScale(
  imageFit: ImageFitMode,
  cellWidth: number,
  cellHeight: number,
  imageWidth: number,
  imageHeight: number
): number {
  if (imageFit === 'fitHeight') return cellHeight / imageHeight
  if (imageFit === 'fitWidth') return cellWidth / imageWidth
  return Math.min(cellWidth / imageWidth, cellHeight / imageHeight)
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = src
  })
}

function groupCircleGuides(guides: CircleGuideItem[]): CircleGuideItem[][] {
  const out: CircleGuideItem[][] = []
  let i = 0
  while (i < guides.length) {
    const g = guides[i]
    const next = guides[i + 1]
    if (g.dupGroupId !== undefined && next?.dupGroupId === g.dupGroupId) {
      out.push([g, next])
      i += 2
    } else {
      out.push([g])
      i += 1
    }
  }
  return out
}

function toCircleGuides(
  effects: ReturnType<typeof useAppStore.getState>['cells'][number]['effects'],
  cellSize: { width: number; height: number },
  previewCenter: PickCenterPoint | null = null,
): CircleGuideItem[] {
  const guides: CircleGuideItem[] = []

  if (effects.blur?.radialEnabled) {
    guides.push({
      key: 'radialBlur',
      kind: 'radialBlur',
      style: toCircleGuideStyle(effects, 'radialBlur', cellSize, previewCenter),
    })
  }

  if (effects.shake?.trailEnabled) {
    const baseX = previewCenter?.x ?? effects.effectCenter?.x ?? 0.5
    const baseY = previewCenter?.y ?? effects.effectCenter?.y ?? 0.5
    const shakeSize = clamp(effects.shake?.trailSize ?? 0.7, 0.05, 3)
    const dupEnabled = effects.shake.trailDuplicateCirclesEnabled ?? false

    if (dupEnabled) {
      const halfNorm = trailDuplicateHalfSeparationNormX(
        cellSize.width,
        cellSize.height,
        shakeSize,
        effects.shake.trailDuplicateSpacingShift ?? 0,
      )
      const staggerY = trailDuplicateVerticalStaggerOffsetsNormY(
        cellSize.width,
        cellSize.height,
        shakeSize,
        effects.shake?.trailHeight ?? 1,
        effects.shake.trailDuplicateVerticalSpacingShift ?? 0,
      )
      guides.push({
        key: 'shakeTrailDupL',
        kind: 'shakeTrail',
        dupGroupId: 'shakeTrail',
        style: toCircleGuideStyle(effects, 'shakeTrail', cellSize, previewCenter, {
          x: baseX - halfNorm,
          y: baseY + staggerY.left,
        }),
      })
      guides.push({
        key: 'shakeTrailDupR',
        kind: 'shakeTrail',
        dupGroupId: 'shakeTrail',
        style: toCircleGuideStyle(effects, 'shakeTrail', cellSize, previewCenter, {
          x: baseX + halfNorm,
          y: baseY + staggerY.right,
        }),
      })
    } else {
      guides.push({
        key: 'shakeTrail',
        kind: 'shakeTrail',
        style: toCircleGuideStyle(effects, 'shakeTrail', cellSize, previewCenter),
      })
    }

    if (effects.shake.trailSecondStageEnabled) {
      const secondSize = shakeSize * clamp(effects.shake?.trailSecondStageSize ?? 0.62, 0.1, 1)
      if (dupEnabled) {
        const halfNorm2 = trailDuplicateHalfSeparationNormX(
          cellSize.width,
          cellSize.height,
          secondSize,
          effects.shake.trailDuplicateSpacingShift ?? 0,
        )
        const staggerY2 = trailDuplicateVerticalStaggerOffsetsNormY(
          cellSize.width,
          cellSize.height,
          secondSize,
          effects.shake?.trailHeight ?? 1,
          effects.shake.trailDuplicateVerticalSpacingShift ?? 0,
        )
        guides.push({
          key: 'shakeTrailSecDupL',
          kind: 'shakeTrailSecondStage',
          dupGroupId: 'shakeTrailSecond',
          style: toCircleGuideStyle(effects, 'shakeTrailSecondStage', cellSize, previewCenter, {
            x: baseX - halfNorm2,
            y: baseY + staggerY2.left,
          }),
        })
        guides.push({
          key: 'shakeTrailSecDupR',
          kind: 'shakeTrailSecondStage',
          dupGroupId: 'shakeTrailSecond',
          style: toCircleGuideStyle(effects, 'shakeTrailSecondStage', cellSize, previewCenter, {
            x: baseX + halfNorm2,
            y: baseY + staggerY2.right,
          }),
        })
      } else {
        guides.push({
          key: 'shakeTrailSecond',
          kind: 'shakeTrailSecondStage',
          style: toCircleGuideStyle(effects, 'shakeTrailSecondStage', cellSize, previewCenter),
        })
      }
    }
  }

  return guides
}

function toCircleGuideStyle(
  effects: ReturnType<typeof useAppStore.getState>['cells'][number]['effects'],
  kind: CircleGuideKind,
  cellSize: { width: number; height: number },
  previewCenter: PickCenterPoint | null,
  centerNormOverride?: { x: number; y: number },
): React.CSSProperties {
  const centerX = centerNormOverride
    ? centerNormOverride.x
    : clamp(previewCenter?.x ?? effects.effectCenter?.x ?? 0.5, 0, 1)
  const centerY = centerNormOverride
    ? centerNormOverride.y
    : clamp(previewCenter?.y ?? effects.effectCenter?.y ?? 0.5, 0, 1)
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
