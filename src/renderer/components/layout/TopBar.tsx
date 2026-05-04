import React from 'react'
import { useAppStore } from '../../stores/appStore'
import styles from './TopBar.module.css'

export const TopBar: React.FC = () => {
  const { toggleControls, showControls, grid, fullscreen, setFullscreen } = useAppStore()

  const handleFullscreen = () => {
    const next = !fullscreen
    setFullscreen(next)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(next)
  }

  // フルスクリーン時は解除ボタンのみ表示
  if (fullscreen) {
    return (
      <button className={styles.exitFullscreen} onClick={handleFullscreen} title="フルスクリーン解除 (Esc)">
        ✕
      </button>
    )
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.logo}>WhiteRoom</span>
        <span className={styles.info}>
          {grid.cols} × {grid.rows}
        </span>
      </div>
      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={handleFullscreen} title="フルスクリーン">
          ⛶
        </button>
        <button
          className={`${styles.iconBtn} ${showControls ? styles.iconBtnActive : ''}`}
          onClick={toggleControls}
          title="コントロールパネル"
        >
          ☰
        </button>
      </div>
    </div>
  )
}
