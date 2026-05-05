import React from 'react'
import { useAppStore } from '../../stores/appStore'
import styles from './TopBar.module.css'

export const TopBar: React.FC = () => {
  const {
    toggleControls,
    showControls,
    grid,
    fullscreen,
    setFullscreen,
    showNavigationBar,
    toggleNavigationBar,
  } = useAppStore()

  const handleFullscreen = () => {
    const next = !fullscreen
    setFullscreen(next)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(next)
  }

  if (!fullscreen && showNavigationBar) {
    return (
      <div className={styles.bar} style={{ right: showControls ? 300 : 0 }}>
        <div className={styles.left}>
          <span className={styles.logo}>WhiteRoom</span>
          <span className={styles.info}>
            {grid.cols} x {grid.rows}
          </span>
        </div>
        <div className={styles.right}>
          <button className={styles.iconBtn} onClick={handleFullscreen} title="フルスクリーン">
            フルスクリーン
          </button>
          <button className={styles.iconBtn} onClick={toggleNavigationBar} title="ナビゲーションバーを表示切替">
            UI切替
          </button>
          <button
            className={`${styles.iconBtn} ${showControls ? styles.iconBtnActive : ''}`}
            onClick={toggleControls}
            title="右の操作UIを表示/非表示"
          >
            操作UI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dock}>
      <button className={styles.dockBtn} onClick={handleFullscreen} title="ウィンドウ表示に戻す">
        ウィンドウ
      </button>
      <button
        className={`${styles.dockBtn} ${showControls ? styles.dockBtnActive : ''}`}
        onClick={toggleControls}
        title="右の操作UIを表示/非表示"
      >
        操作UI
      </button>
      <button className={styles.dockBtn} onClick={toggleNavigationBar} title="ナビゲーションバーを表示切替">
        UI切替
      </button>
    </div>
  )
}
