import React, { useRef, useEffect, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { usePixiStage } from '../../hooks/usePixiStage'
import { useDropHandler } from '../../hooks/useDropHandler'
import { useAppStore } from '../../stores/appStore'
import { TimerOverlay } from '../timer/TimerOverlay'
import { TimerEndFlashOverlay } from '../timer/TimerEndFlashOverlay'
import { TimerPreOverlay } from '../timer/TimerPreOverlay'
import { CellNavigationOverlay } from './CellNavigationOverlay'
import { TextReaderWindow, calcReaderAutoHeight, READER_WINDOW_MARGIN } from '../reader/TextReaderWindow'
import { useTranslation } from '../../i18n'
import styles from './MasterCanvas.module.css'

export const MasterCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const showControls = useAppStore(s => s.showControls)
  const grid = useAppStore(s => s.grid)
  const cells = useAppStore(s => s.cells)
  const textReaderVisible = useAppStore(s => s.textReader.visible)
  const textReaderConfig = useAppStore(s => s.textReader.config)
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null)
  const { t } = useTranslation()

  const canvasShrinkStyle = React.useMemo((): React.CSSProperties => {
    if (!textReaderVisible || (textReaderConfig.overlayOnImage ?? true)) return {}
    const { windowPosition, fontSize } = textReaderConfig
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
      return { width: `calc(65% - ${margin2}px)` }
    }
    if (windowPosition === 'left') {
      const offset = `calc(35% + ${margin2}px)`
      return { left: offset, width: `calc(65% - ${margin2}px)` }
    }
    return {}
  }, [textReaderVisible, textReaderConfig])

  const { setCellImage } = usePixiStage(containerRef)
  const { handleDrop, handleDragOver } = useDropHandler(setCellImage)

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
    const { grid, cells } = useAppStore.getState()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    const col = Math.max(0, Math.min(Math.floor(relX / (rect.width / grid.cols)), grid.cols - 1))
    const row = Math.max(0, Math.min(Math.floor(relY / (rect.height / grid.rows)), grid.rows - 1))
    const cell = cells.find(c => c.col === col && c.row === row)
    setHoveredCellId(cell?.id ?? null)
  }, [])

  const handleMouseLeave = useCallback(() => setHoveredCellId(null), [])

  // ドラッグ中はナビゲーションオーバーレイを非表示（flushSync で同期的に DOM から除去し dragover 干渉を防ぐ）
  const handleDragEnter = useCallback(() => {
    flushSync(() => setHoveredCellId(null))
  }, [])

  return (
    <div
      ref={containerRef}
      className={`${styles.canvas} ${showControls ? styles.withPanel : ''}`}
      style={canvasShrinkStyle}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
            {(!cell.folder || cell.folder.images.length === 0) && (
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
      <TimerEndFlashOverlay />
      <TimerOverlay />
      <TextReaderWindow />
      {/* セルナビゲーションオーバーレイ（前/次画像ボタン） */}
      <CellNavigationOverlay hoveredCellId={hoveredCellId} />
    </div>
  )
}
