import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import styles from './TopBar.module.css'

export const TopBar: React.FC = () => {
  const {
    toggleControls,
    showControls,
    fullscreen,
    setFullscreen,
    setStashWindowOpen,
  } = useAppStore()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

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

  const handleStash = () => {
    setStashWindowOpen(true)
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
      if (minDist > CLOSE_DISTANCE) setMenuOpen(false)
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [menuOpen])

  return (
    <div
      className={styles.dock}
      ref={menuRef}
      onMouseEnter={() => setMenuOpen(true)}
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
            onClick={handleStash}
            title={t('stashMenuTitle')}
          >
            📦 {t('stashMenuLabel')}
          </button>
          <div className={styles.menuDivider} />
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
