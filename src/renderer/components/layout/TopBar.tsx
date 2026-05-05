import React from 'react'
import { useAppStore } from '../../stores/appStore'
import styles from './TopBar.module.css'

export const TopBar: React.FC = () => {
  const {
    toggleControls,
    showControls,
    fullscreen,
    setFullscreen,
  } = useAppStore()

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
        title={fullscreen ? 'ウィンドウ表示に切り替え' : 'フルスクリーン表示に切り替え'}
      >
        {fullscreen ? 'ウィンドウ' : 'フルスクリーン'}
      </button>
      <button
        className={`${styles.dockBtn} ${showControls ? styles.dockBtnActive : ''}`}
        onClick={toggleControls}
        title={showControls ? '操作UIを非表示' : '操作UIを表示'}
      >
        {showControls ? 'UI非表示' : 'UI表示'}
      </button>
    </div>
  )
}
