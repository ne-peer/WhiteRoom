import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import styles from './TopBar.module.css'

const ICON_FADE_DELAY_MS = 3000

export const TopBar: React.FC = () => {
  const {
    toggleControls,
    showControls,
    fullscreen,
    setFullscreen,
  } = useAppStore()
  const textReaderVisible = useAppStore(s => s.textReader.visible)
  const textReaderWindowPosition = useAppStore(s => s.textReader.config.windowPosition)
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [iconFaded, setIconFaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // テキストウィンドウが左下ハンバーガーと重なる位置にあるか
  const overlapsTextWindow = textReaderVisible &&
    (textReaderWindowPosition === 'bottom' || textReaderWindowPosition === 'left')

  const startFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setIconFaded(false)
    fadeTimerRef.current = setTimeout(() => {
      setIconFaded(true)
    }, ICON_FADE_DELAY_MS)
  }, [])

  // 初回マウント時にフェードタイマー開始
  useEffect(() => {
    startFadeTimer()
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current) }
  }, [startFadeTimer])

  const handleFullscreen = () => {
    const next = !fullscreen
    setFullscreen(next)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(next)
    setMenuOpen(false)
  }

  const handleToggleControls = () => {
    toggleControls()
    setMenuOpen(false)
  }

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [menuOpen])

  // マウス距離でメニューを閉じる（ドックとメニューパネル両方の周辺 24px バッファを確保）
  useEffect(() => {
    if (!menuOpen) return
    const CLOSE_DISTANCE = 24
    const distToRect = (mx: number, my: number, r: DOMRect) => {
      const dx = Math.max(r.left - mx, 0, mx - r.right)
      const dy = Math.max(r.top - my, 0, my - r.bottom)
      return Math.sqrt(dx * dx + dy * dy)
    }
    const onMouseMove = (e: MouseEvent) => {
      const rects: DOMRect[] = []
      if (menuRef.current) rects.push(menuRef.current.getBoundingClientRect())
      if (menuPanelRef.current) rects.push(menuPanelRef.current.getBoundingClientRect())
      const minDist = rects.reduce((min, r) => Math.min(min, distToRect(e.clientX, e.clientY, r)), Infinity)
      if (minDist > CLOSE_DISTANCE) {
        setMenuOpen(false)
        startFadeTimer()
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [menuOpen, startFadeTimer])

  const dockOpacity = (overlapsTextWindow && !isHovered) ? 0 : iconFaded ? 0.13 : 0.9

  return (
    <div
      className={styles.dock}
      ref={menuRef}
      style={{ opacity: dockOpacity }}
      onMouseEnter={() => {
        setIsHovered(true)
        setMenuOpen(true)
        setIconFaded(false)
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        startFadeTimer()
      }}
    >
      <button
        className={`${styles.hamburgerBtn} ${menuOpen ? styles.hamburgerBtnOpen : ''}`}
        onClick={() => setMenuOpen(v => !v)}
        title="メニュー"
        aria-label="メニュー"
      >
        <span className={styles.hamburgerIcon}>≡</span>
      </button>

      {menuOpen && (
        <div className={styles.menu} ref={menuPanelRef}>
          <button
            className={styles.menuItem}
            onClick={handleFullscreen}
            title={fullscreen ? t('fullscreenToWindowTitle') : t('fullscreenToFullscreenTitle')}
          >
            {fullscreen ? t('window') : t('fullscreen')}
          </button>
          <button
            className={`${styles.menuItem} ${!showControls ? styles.menuItemActive : ''}`}
            onClick={handleToggleControls}
            title={showControls ? t('hideControlsTitle') : t('showControlsTitle')}
          >
            {showControls ? t('hideUi') : t('showUi')}
          </button>
        </div>
      )}
    </div>
  )
}
