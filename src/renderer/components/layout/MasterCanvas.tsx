import React, { useRef, useEffect } from 'react'
import { usePixiStage } from '../../hooks/usePixiStage'
import { useDropHandler } from '../../hooks/useDropHandler'
import { useAppStore } from '../../stores/appStore'
import { TimerOverlay } from '../timer/TimerOverlay'
import styles from './MasterCanvas.module.css'

export const MasterCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const showControls = useAppStore(s => s.showControls)

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

  // Escapeキーでフルスクリーン解除
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useAppStore.getState().fullscreen) {
        const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
        useAppStore.getState().setFullscreen(false)
        api?.setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      ref={containerRef}
      className={`${styles.canvas} ${showControls ? styles.withPanel : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* タイマーオーバレイ（PixiJSの上にReactでレンダリング） */}
      <TimerOverlay />
    </div>
  )
}
