import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, STASH_MAX_COUNT, STASH_MIN_SLOT_COUNT } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import styles from './StashWindow.module.css'

const WINDOW_DEFAULT_X = 8
const WINDOW_DEFAULT_Y = 48
const ICON_POS_X = 8
const ICON_POS_Y = 8
const MOUSE_COLLAPSE_DISTANCE = 100
const ICON_FADE_DELAY_MS = 3000

function getDistanceToRect(mx: number, my: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - mx, 0, mx - rect.right)
  const dy = Math.max(rect.top - my, 0, my - rect.bottom)
  return Math.sqrt(dx * dx + dy * dy)
}

export const StashWindow: React.FC = () => {
  const { t } = useTranslation()
  const {
    stashes,
    stashSlotCount,
    stashWindowOpen,
    saveStash,
    popStash,
    deleteStash,
    addStashSlot,
    setStashWindowOpen,
  } = useAppStore()

  const [expanded, setExpanded] = useState(false)
  const [iconVisible, setIconVisible] = useState(true)
  const [iconFaded, setIconFaded] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [pos, setPos] = useState({ x: WINDOW_DEFAULT_X, y: WINDOW_DEFAULT_Y })

  const panelRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLButtonElement>(null)
  const isDragging = useRef(false)
  const dragStartMouse = useRef({ x: 0, y: 0 })
  const dragStartPos = useRef({ x: 0, y: 0 })
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // stashWindowOpen の変化でウィンドウを開く
  useEffect(() => {
    if (stashWindowOpen) {
      setExpanded(true)
      setIconFaded(false)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [stashWindowOpen])

  // アイコン縮小時のフェードタイマー
  const startFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setIconFaded(false)
    fadeTimerRef.current = setTimeout(() => {
      setIconFaded(true)
    }, ICON_FADE_DELAY_MS)
  }, [])

  const collapse = useCallback(() => {
    setExpanded(false)
    setIconVisible(true)
    setPos({ x: WINDOW_DEFAULT_X, y: WINDOW_DEFAULT_Y })
    setStashWindowOpen(false)
    startFadeTimer()
  }, [setStashWindowOpen, startFadeTimer])

  const expand = useCallback(() => {
    setExpanded(true)
    setIconFaded(false)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setStashWindowOpen(false)
  }, [setStashWindowOpen])

  // マウス距離によるコラプス
  useEffect(() => {
    if (!expanded) return
    const onMouseMove = (e: MouseEvent) => {
      if (!panelRef.current || isDragging.current) return
      const rect = panelRef.current.getBoundingClientRect()
      const dist = getDistanceToRect(e.clientX, e.clientY, rect)
      if (dist > MOUSE_COLLAPSE_DISTANCE) {
        collapse()
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [expanded, collapse])

  // ドラッグ
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPos({
        x: dragStartPos.current.x + e.clientX - dragStartMouse.current.x,
        y: dragStartPos.current.y + e.clientY - dragStartMouse.current.y,
      })
    }
    const onMouseUp = () => { isDragging.current = false }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    isDragging.current = true
    dragStartMouse.current = { x: e.clientX, y: e.clientY }
    dragStartPos.current = { x: pos.x, y: pos.y }
    e.preventDefault()
  }

  // window.__whiteroom_hasStash を公開
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__whiteroom_hasStash = () => stashes.length > 0
  }, [stashes])

  // 初回マウント時にフェードタイマー開始
  useEffect(() => {
    startFadeTimer()
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current) }
  }, [startFadeTimer])

  const handleSave = (index: number) => {
    saveStash(index)
  }

  const handlePop = (index: number) => {
    const item = stashes[index]
    if (!item) return
    if (!confirm(t('stashPopConfirm'))) return
    const filePath = item.textReaderFilePath
    const pageIndex = item.textReaderPageIndex
    popStash(index)
    if (filePath) {
      const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
      api.openTextFileDirect(filePath).then(res => {
        if (!res.canceled && res.filePath && res.text) {
          const store = useAppStore.getState()
          store.loadTextReaderFile(res.filePath, res.text, res.tempFilePath)
          if (pageIndex > 0) store.setTextReaderPage(pageIndex)
        }
      }).catch(() => { /* ignore */ })
    }
  }

  const handleDelete = (index: number) => {
    if (!confirm(t('stashDeleteConfirm'))) return
    deleteStash(index)
  }

  const rowCount = Math.max(STASH_MIN_SLOT_COUNT, stashSlotCount)
  const showAddButton = rowCount < STASH_MAX_COUNT

  if (!iconVisible && !expanded) return null

  return (
    <>
      {/* 縮小アイコン */}
      {!expanded && (
        <button
          ref={iconRef}
          className={styles.collapseIcon}
          style={{
            left: ICON_POS_X,
            top: ICON_POS_Y,
            opacity: iconFaded ? 0.13 : 0.9,
          }}
          onClick={expand}
          title={t('stashMenuTitle')}
          data-stash-window
        >
          📦
        </button>
      )}

      {/* フロートウィンドウ */}
      {expanded && (
        <div
          ref={panelRef}
          className={styles.panel}
          style={{ left: pos.x, top: pos.y }}
          data-stash-window=""
        >
          <div
            className={styles.header}
            onMouseDown={handleHeaderMouseDown}
          >
            <span className={styles.title}>📦 {t('stashWindowTitle')}</span>
            <button className={styles.closeBtn} onClick={collapse} title="閉じる">×</button>
          </div>

          <div className={styles.body}>
            {Array.from({ length: rowCount }, (_, i) => {
              const item = stashes[i]
              const isHovering = hoverIdx === i
              return (
                <div
                  key={i}
                  className={styles.stashRow}
                  style={item ? {
                    borderLeft: `3px solid ${item.color}`,
                  } : undefined}
                >
                  {/* スタッシュラベル / スタッシュするボタン */}
                  <button
                    className={styles.stashLabelBtn}
                    style={item ? {
                      color: item.color,
                      borderColor: `${item.color}55`,
                    } : undefined}
                    onMouseEnter={() => !item && setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onClick={() => !item && handleSave(i)}
                    title={item ? item.savedAt : t('stashSaveButton')}
                  >
                    {item
                      ? `${item.emoji} スタッシュ`
                      : (isHovering ? t('stashSaveButton') : t('stashEmptySlot'))
                    }
                  </button>

                  {/* POP ボタン */}
                  <button
                    className={`${styles.actionSmBtn} ${styles.popBtn}`}
                    style={item ? {
                      color: item.color,
                      borderColor: `${item.color}55`,
                    } : undefined}
                    onClick={() => handlePop(i)}
                    disabled={!item}
                    title={t('stashPopButton')}
                  >
                    {t('stashPopButton')}
                  </button>

                  {/* 削除ボタン */}
                  <button
                    className={`${styles.actionSmBtn} ${styles.delBtn}`}
                    onClick={() => handleDelete(i)}
                    disabled={!item}
                    title={t('stashDeleteButton')}
                  >
                    {t('stashDeleteButton')}
                  </button>
                </div>
              )
            })}

            {/* + ボタン */}
            {showAddButton && (
              <div className={styles.addRow}>
                <button
                  className={styles.addBtn}
                  onClick={addStashSlot}
                  title="スロットを追加"
                >
                  {t('stashAddSlot')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
