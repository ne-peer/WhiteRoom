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

  return (
    <div className={styles.dock} ref={menuRef}>
      <button
        className={`${styles.hamburgerBtn} ${menuOpen ? styles.hamburgerBtnOpen : ''}`}
        onClick={() => setMenuOpen(v => !v)}
        title="メニュー"
        aria-label="メニュー"
      >
        <span className={styles.hamburgerIcon}>≡</span>
      </button>

      {menuOpen && (
        <div className={styles.menu}>
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
