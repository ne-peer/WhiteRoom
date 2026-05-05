import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import styles from './TopBar.module.css'

export const TopBar: React.FC = () => {
  const {
    toggleControls,
    showControls,
    fullscreen,
    setFullscreen,
  } = useAppStore()
  const { t } = useTranslation()

  const handleFullscreen = () => {
    const next = !fullscreen
    setFullscreen(next)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(next)
  }

  return (
    <div className={styles.dock}>
      <button
        className={styles.dockBtn}
        onClick={handleFullscreen}
        title={fullscreen ? t('fullscreenToWindowTitle') : t('fullscreenToFullscreenTitle')}
      >
        {fullscreen ? t('window') : t('fullscreen')}
      </button>
      <button
        className={`${styles.dockBtn} ${showControls ? styles.dockBtnActive : ''}`}
        onClick={toggleControls}
        title={showControls ? t('hideControlsTitle') : t('showControlsTitle')}
      >
        {showControls ? t('hideUi') : t('showUi')}
      </button>
    </div>
  )
}
