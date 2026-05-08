import React, { useEffect, useState } from 'react'
import { MasterCanvas } from './components/layout/MasterCanvas'
import { TopBar } from './components/layout/TopBar'
import { ControlPanel } from './components/controls/ControlPanel'
import { StoryboardPanel } from './components/reader/StoryboardPanel'
import { useAppStore } from './stores/appStore'
import './global.css'

const CONTROL_PANEL_WIDTH = 300
const EDGE_REVEAL_THRESHOLD = 60
const FLOAT_HIDE_MARGIN = 48

const App: React.FC = () => {
  const showControls = useAppStore(s => s.showControls)
  const storyboardOpen = useAppStore(s => s.textReader.storyboardOpen)
  const appNotification = useAppStore(s => s.appNotification)
  const clearAppNotification = useAppStore(s => s.clearAppNotification)
  const [showFloatingControls, setShowFloatingControls] = useState(false)

  useEffect(() => {
    if (!appNotification) return
    const id = appNotification.id
    const timer = window.setTimeout(() => clearAppNotification(id), 5000)
    return () => window.clearTimeout(timer)
  }, [appNotification, clearAppNotification])

  useEffect(() => {
    if (showControls) {
      setShowFloatingControls(false)
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const revealX = window.innerWidth - EDGE_REVEAL_THRESHOLD
      const keepVisibleX = window.innerWidth - CONTROL_PANEL_WIDTH - FLOAT_HIDE_MARGIN

      const overReader = !!(event.target as Element | null)?.closest?.('[data-reader-window], [data-storyboard-window]')

      setShowFloatingControls(current => {
        if (overReader) return false
        if (event.clientX >= revealX) return true
        if (current && event.clientX >= keepVisibleX) return true
        return false
      })
    }

    const handleMouseOut = (event: MouseEvent) => {
      if (!event.relatedTarget) setShowFloatingControls(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
    }
  }, [showControls])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>
      <TopBar />
      <MasterCanvas />
      <ControlPanel floating={showFloatingControls} />
      {storyboardOpen && <StoryboardPanel />}
      {appNotification && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 700,
            maxWidth: 'min(720px, calc(100vw - 32px))',
            padding: '10px 14px',
            borderRadius: 6,
            background: appNotification.type === 'error'
              ? 'rgba(80, 20, 28, 0.94)'
              : appNotification.type === 'warning'
                ? 'rgba(80, 60, 20, 0.94)'
                : 'rgba(20, 40, 60, 0.94)',
            border: appNotification.type === 'error'
              ? '1px solid rgba(255, 110, 130, 0.50)'
              : appNotification.type === 'warning'
                ? '1px solid rgba(255, 210, 110, 0.50)'
                : '1px solid rgba(120, 180, 255, 0.45)',
            color: 'rgba(255, 255, 255, 0.94)',
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
          }}
        >
          {appNotification.text}
        </div>
      )}
    </div>
  )
}

export default App
