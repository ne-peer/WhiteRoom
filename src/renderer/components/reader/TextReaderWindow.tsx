import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { TextReaderPageAdvanceSpeed } from '../../../shared/types'
import styles from './TextReaderWindow.module.css'


const PAGE_ADVANCE_DELAYS: Record<TextReaderPageAdvanceSpeed, number> = {
  slow: 6000,
  normal: 3000,
  fast: 1200,
}

export const READER_CONTROL_BAR_HEIGHT = 38
export const READER_TEXT_AREA_PADDING_V = 24  // top 16px + bottom 8px
export const READER_TEXT_AREA_PADDING_H = 40  // left 20px + right 20px
export const READER_LINE_HEIGHT_RATIO = 1.8
export const READER_VERTICAL_LINE_HEIGHT_RATIO = 2
export const READER_WINDOW_MARGIN = 12
export const READER_MAX_LINES = 3

export function calcReaderAutoHeight(fontSize: number): number {
  return READER_CONTROL_BAR_HEIGHT + READER_TEXT_AREA_PADDING_V + Math.ceil(fontSize * READER_LINE_HEIGHT_RATIO * READER_MAX_LINES)
}

export function calcReaderAutoWidth(fontSize: number): number {
  return READER_TEXT_AREA_PADDING_H + Math.ceil(fontSize * READER_VERTICAL_LINE_HEIGHT_RATIO * READER_MAX_LINES)
}

// 表示エリアに収まる文字数を計算（改行考慮）
function calcMaxCharsForArea(
  text: string,
  areaWidth: number,
  areaHeight: number,
  fontSize: number,
  direction: 'horizontal' | 'vertical'
): number {
  if (areaWidth <= 0 || areaHeight <= 0) return text.length

  const lineHeight = fontSize * (direction === 'vertical' ? READER_VERTICAL_LINE_HEIGHT_RATIO : READER_LINE_HEIGHT_RATIO)
  const charSize = fontSize

  if (direction === 'horizontal') {
    const charsPerLine = Math.max(1, Math.floor(areaWidth / charSize))
    const linesAvailable = Math.max(1, Math.floor(areaHeight / lineHeight))
    let lineChars = 0
    let linesUsed = 0
    for (let i = 0; i < text.length; i++) {
      if (linesUsed >= linesAvailable) return i
      if (text[i] === '\n') {
        linesUsed++
        lineChars = 0
      } else {
        lineChars++
        if (lineChars > charsPerLine) {
          linesUsed++
          lineChars = 1
          if (linesUsed >= linesAvailable) return i + 1
        }
      }
    }
    return text.length
  } else {
    // 縦書き: 上→下で1列、右→左に列が増える
    const charsPerCol = Math.max(1, Math.floor(areaHeight / charSize))
    const colsAvailable = Math.max(1, Math.floor(areaWidth / lineHeight))
    let colChars = 0
    let colsUsed = 0
    for (let i = 0; i < text.length; i++) {
      if (colsUsed >= colsAvailable) return i
      if (text[i] === '\n') {
        colsUsed++
        colChars = 0
      } else {
        colChars++
        if (colChars > charsPerCol) {
          colsUsed++
          colChars = 1
          if (colsUsed >= colsAvailable) return i + 1
        }
      }
    }
    return text.length
  }
}

function splitSegmentToPages(
  segment: string,
  areaWidth: number,
  areaHeight: number,
  fontSize: number,
  direction: 'horizontal' | 'vertical'
): string[] {
  const pages: string[] = []
  let remaining = segment.trim()
  while (remaining.length > 0) {
    const maxChars = calcMaxCharsForArea(remaining, areaWidth, areaHeight, fontSize, direction)
    if (maxChars >= remaining.length) {
      pages.push(remaining)
      break
    }
    // 改行位置で区切れる場合は優先
    const slice = remaining.slice(0, maxChars)
    const lastNewline = slice.lastIndexOf('\n')
    const splitAt = lastNewline > maxChars * 0.4 ? lastNewline + 1 : maxChars
    pages.push(remaining.slice(0, splitAt).trimEnd())
    remaining = remaining.slice(splitAt).trimStart()
  }
  return pages.length > 0 ? pages : [segment]
}

export const TextReaderWindow: React.FC = () => {
  const visible = useAppStore(s => s.textReader.visible)
  const config = useAppStore(s => s.textReader.config)
  const rawSegments = useAppStore(s => s.textReader.rawSegments)
  const currentPageIndex = useAppStore(s => s.textReader.currentPageIndex)
  const isAutoAdvancing = useAppStore(s => s.textReader.isAutoAdvancing)
  const autoSpeedMultiplier = useAppStore(s => s.textReader.autoSpeedMultiplier)
  const showLog = useAppStore(s => s.textReader.showLog)
  const tagEntries = useAppStore(s => s.textReader.tagEntries)
  const autoSuspendedForTimer = useAppStore(s => s.textReader.autoSuspendedForTimer)
  const timer = useAppStore(s => s.timer)
  const {
    setTextReaderPage,
    setTextReaderAutoAdvancing,
    setTextReaderSpeedMultiplier,
    setTextReaderShowLog,
    applyTagToAllCells,
    restoreBaseline,
    incrementActiveProgressPages,
    setAutoSuspendedForTimer,
    setCurrentSegmentIndex,
  } = useAppStore()

  const textAreaRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const logCurrentRef = useRef<HTMLDivElement>(null)
  const [textAreaSize, setTextAreaSize] = useState({ width: 0, height: 0 })
  const [charDisplayCount, setCharDisplayCount] = useState(0)

  // テキストエリアのサイズを監視
  useEffect(() => {
    const el = textAreaRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setTextAreaSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  // rawSegments をページ配列に変換（segmentPageStarts も算出）
  const { pages, segmentPageStarts } = useMemo(() => {
    if (rawSegments.length === 0) return { pages: [] as string[], segmentPageStarts: [] as number[] }
    const { width, height } = textAreaSize
    if (width === 0 || height === 0) {
      return {
        pages: rawSegments,
        segmentPageStarts: rawSegments.map((_, i) => i),
      }
    }
    const allPages: string[] = []
    const starts: number[] = []
    for (const seg of rawSegments) {
      if (seg.length === 0) continue
      starts.push(allPages.length)
      allPages.push(...splitSegmentToPages(seg, width, height, config.fontSize, config.textDirection))
    }
    return { pages: allPages.length > 0 ? allPages : [], segmentPageStarts: starts }
  }, [rawSegments, textAreaSize, config.fontSize, config.textDirection])

  const currentPage = pages[currentPageIndex] ?? ''
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  const pagesRef = useRef(pages)
  pagesRef.current = pages

  const segmentPageStartsRef = useRef(segmentPageStarts)
  segmentPageStartsRef.current = segmentPageStarts

  // ページ変更時のタグ評価・ロールバック
  const prevPageIndexRef = useRef<number>(-1)
  useEffect(() => {
    if (!visible || tagEntries.length === 0 || segmentPageStarts.length === 0) return
    const prev = prevPageIndexRef.current
    prevPageIndexRef.current = currentPageIndex

    // 現在ページに対応するセグメントを特定（最後の segmentPageStarts[i] <= currentPageIndex）
    let currentSegIdx = -1
    for (let i = 0; i < segmentPageStarts.length; i++) {
      if ((segmentPageStarts[i] ?? 0) <= currentPageIndex) currentSegIdx = i
      else break
    }

    // 現在セグメントに対して有効な最後のタグを探す
    let newTagIndex: number | null = null
    for (let i = 0; i < tagEntries.length; i++) {
      const e = tagEntries[i]!
      if (e.segmentIndex <= currentSegIdx) newTagIndex = i
    }

    const storeState = useAppStore.getState()
    const currentTagIndex = storeState.textReader.activeTagIndex

    setCurrentSegmentIndex(currentSegIdx)

    if (newTagIndex !== currentTagIndex) {
      if (newTagIndex === null) {
        restoreBaseline()
      } else {
        // ページが前進してタグが変わった場合のみ進行ページをインクリメント
        if (currentTagIndex !== null && newTagIndex === currentTagIndex && currentPageIndex > prev) {
          incrementActiveProgressPages()
        } else {
          applyTagToAllCells(newTagIndex)
        }
      }
    } else if (newTagIndex !== null && currentPageIndex > prev) {
      // 同じタグのまま前進 → エフェクト進行率を更新
      incrementActiveProgressPages()
    }
  }, [currentPageIndex, visible, tagEntries, segmentPageStarts]) // eslint-disable-line react-hooks/exhaustive-deps

  // タイマー完了後に Auto を再開
  useEffect(() => {
    if (!autoSuspendedForTimer) return
    if (timer.enabled && !timer.running && timer.elapsedSec >= timer.totalSec) {
      setAutoSuspendedForTimer(false)
      setTextReaderAutoAdvancing(true)
    }
  }, [timer.running, timer.elapsedSec, autoSuspendedForTimer]) // eslint-disable-line react-hooks/exhaustive-deps

  // ページ変更・設定変更時にアニメーションをリセット＆開始
  useEffect(() => {
    setCharDisplayCount(0)
    if (!visible || currentPageRef.current.length === 0) return

    const effectiveInterval = config.charIntervalMs / autoSpeedMultiplier
    if (effectiveInterval <= 0) {
      setCharDisplayCount(currentPageRef.current.length)
      return
    }

    const interval = Math.max(16, effectiveInterval)
    const timer = window.setInterval(() => {
      setCharDisplayCount(prev => {
        if (prev >= currentPageRef.current.length) {
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, interval)

    return () => clearInterval(timer)
  // charDisplayCount を依存から外すことで setInterval が page 変更時のみ再作成される
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pages, currentPageIndex, config.charIntervalMs, autoSpeedMultiplier])

  // 自動ページ送り
  useEffect(() => {
    if (!visible || !isAutoAdvancing || pages.length === 0) return
    if (charDisplayCount < currentPage.length) return
    if (currentPageIndex >= pages.length - 1) return

    const baseDelay = PAGE_ADVANCE_DELAYS[config.pageAdvanceSpeed]
    const delay = Math.max(400, baseDelay / autoSpeedMultiplier)
    const timer = window.setTimeout(() => {
      const idx = useAppStore.getState().textReader.currentPageIndex
      const total = pagesRef.current.length
      if (idx < total - 1) setTextReaderPage(idx + 1)
    }, delay)
    return () => clearTimeout(timer)
  }, [visible, isAutoAdvancing, pages, currentPageIndex, charDisplayCount, config.pageAdvanceSpeed, autoSpeedMultiplier, setTextReaderPage])

  // ページ移動ヘルパー（bounds 付き）
  const goToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(pagesRef.current.length - 1, index))
    setTextReaderPage(clamped)
  }, [setTextReaderPage])

  const goToPrevPage = useCallback(() => {
    goToPage(useAppStore.getState().textReader.currentPageIndex - 1)
  }, [goToPage])

  const goToNextPage = useCallback(() => {
    goToPage(useAppStore.getState().textReader.currentPageIndex + 1)
  }, [goToPage])

  // キーボードショートカット
  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n') {
        e.preventDefault()
        goToPrevPage()
      } else if (e.key === 'm') {
        e.preventDefault()
        goToNextPage()
      } else if (e.key === 'Escape') {
        if (useAppStore.getState().textReader.showLog) {
          setTextReaderShowLog(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, goToPrevPage, goToNextPage, setTextReaderShowLog])

  // ホイールイベントをインターセプト（画像ナビゲーションに伝播させない）
  useEffect(() => {
    const el = windowRef.current
    if (!el || !visible) return
    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (e.deltaY > 0) goToNextPage()
      else goToPrevPage()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [visible, goToNextPage, goToPrevPage])

  // ログ表示時に現在ページへスクロール
  useEffect(() => {
    if (showLog && logCurrentRef.current) {
      logCurrentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [showLog, currentPageIndex])

  if (!visible || pages.length === 0) return null

  const displayedText = currentPage.slice(0, charDisplayCount)
  const allCharsShown = charDisplayCount >= currentPage.length

  const windowPositionClass = {
    top: styles.positionTop,
    bottom: styles.positionBottom,
    left: styles.positionLeft,
    right: styles.positionRight,
  }[config.windowPosition]

  const isVerticalWindow = config.windowPosition === 'top' || config.windowPosition === 'bottom'
  const autoHeight = isVerticalWindow ? calcReaderAutoHeight(config.fontSize) : undefined
  const maxWidth = isVerticalWindow
    ? `min(${config.textWindowMaxWidthPx}px, calc(100% - ${READER_WINDOW_MARGIN * 2}px))`
    : undefined
  const isSideWindow = config.windowPosition === 'left' || config.windowPosition === 'right'
  const autoWidth = isSideWindow && config.textDirection === 'vertical'
    ? calcReaderAutoWidth(config.fontSize)
    : undefined
  const configuredWidth = isSideWindow && config.textDirection === 'horizontal'
    ? `${config.textWindowWidthPercent}%`
    : undefined

  const windowStyle: React.CSSProperties = {
    background: `rgba(12, 12, 30, ${(config.backgroundOpacity ?? 70) / 100})`,
    ...(autoHeight !== undefined ? { height: autoHeight } : {}),
    ...(maxWidth !== undefined ? { left: '50%', right: 'auto', width: maxWidth, transform: 'translateX(-50%)' } : {}),
    ...(autoWidth !== undefined ? { width: autoWidth, minWidth: autoWidth } : {}),
    ...(configuredWidth !== undefined ? { width: configuredWidth } : {}),
  }

  const handleSpeedMultiplier = (mult: 1 | 2 | 3) => {
    setTextReaderSpeedMultiplier(autoSpeedMultiplier === mult ? 1 : mult)
  }

  const overlayStyle: React.CSSProperties | undefined =
    !(config.overlayOnImage ?? true) ? { position: 'fixed', inset: 0 } : undefined

  const controlBar = (
    <div
      className={[
        styles.controlBar,
        config.windowPosition === 'top' ? styles.controlBarTop : '',
        isSideWindow ? styles.controlBarSide : '',
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.controlGroup}>
        <span className={styles.pageInfo}>{currentPageIndex + 1} / {pages.length}</span>
      </div>

      <div className={styles.controlGroup}>
        <button
          className={`${styles.controlBtn} ${showLog ? styles.controlBtnActive : ''}`}
          onClick={() => setTextReaderShowLog(!showLog)}
          title="Text log"
        >
          ≡
        </button>
        <div className={styles.controlDivider} />
        <button className={styles.controlBtn} onClick={goToPrevPage} title="Previous page (n)">&lt;</button>
        <button className={styles.controlBtn} onClick={goToNextPage} title="Next page (m)">&gt;</button>
      </div>

      <div className={styles.controlGroup}>
        <button
          className={`${styles.controlBtn} ${isAutoAdvancing ? styles.controlBtnActive : ''}`}
          onClick={() => setTextReaderAutoAdvancing(!isAutoAdvancing)}
          title="Auto page advance"
        >
          Auto
        </button>

        <button
          className={`${styles.controlBtn} ${autoSpeedMultiplier === 2 ? styles.speedBtnActive : ''}`}
          onClick={() => handleSpeedMultiplier(2)}
          title="x2 speed"
        >
          x2
        </button>
        <button
          className={`${styles.controlBtn} ${autoSpeedMultiplier === 3 ? styles.speedBtnActive : ''}`}
          onClick={() => handleSpeedMultiplier(3)}
          title="x3 speed"
        >
          x3
        </button>
      </div>
    </div>
  )

  return (
    <div className={styles.overlay} style={overlayStyle}>
      {/* ログビュー */}
      {showLog && (
        <div data-reader-window className={styles.logOverlay}>
          <div className={styles.logHeader}>
            <span className={styles.logTitle}>テキストログ</span>
            <button className={styles.logCloseBtn} onClick={() => setTextReaderShowLog(false)}>Close</button>
          </div>
          <div className={styles.logContent}>
            {pages.map((page, i) => (
              <div
                key={i}
                ref={i === currentPageIndex ? logCurrentRef : undefined}
                className={`${styles.logPage} ${i === currentPageIndex ? styles.logPageCurrent : ''}`}
                style={{ fontFamily: config.fontFamily, fontSize: 14 }}
                onClick={() => { goToPage(i); setTextReaderShowLog(false) }}
              >
                <div className={styles.logPageNum}>{i + 1}</div>
                {page}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メインテキストウィンドウ */}
      <div ref={windowRef} data-reader-window className={`${styles.window} ${windowPositionClass}`} style={windowStyle}>
        {config.windowPosition === 'top' && controlBar}

        {/* テキスト表示エリア */}
        <div ref={textAreaRef} className={styles.textArea}>
          <div
            className={`${styles.textContent} ${config.textDirection === 'vertical' ? styles.textContentVertical : ''}`}
            style={{ fontFamily: config.fontFamily, fontSize: config.fontSize }}
          >
            {displayedText}
            {allCharsShown && <span className={styles.cursor}>▼</span>}
          </div>
        </div>

        {config.windowPosition !== 'top' && controlBar}
      </div>
    </div>
  )
}
