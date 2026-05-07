import React, { useEffect, useState } from 'react'
import { MasterCanvas } from './components/layout/MasterCanvas'
import { TopBar } from './components/layout/TopBar'
import { ControlPanel } from './components/controls/ControlPanel'
import { useAppStore } from './stores/appStore'
import './global.css'

const CONTROL_PANEL_WIDTH = 300
const EDGE_REVEAL_THRESHOLD = 60
const FLOAT_HIDE_MARGIN = 48

const App: React.FC = () => {
  const showControls = useAppStore(s => s.showControls)
  const [showFloatingControls, setShowFloatingControls] = useState(false)

  useEffect(() => {
    if (showControls) {
      setShowFloatingControls(false)
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const revealX = window.innerWidth - EDGE_REVEAL_THRESHOLD
      const keepVisibleX = window.innerWidth - CONTROL_PANEL_WIDTH - FLOAT_HIDE_MARGIN

      const overReader = !!(event.target as Element | null)?.closest?.('[data-reader-window]')

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
    </div>
  )
}

export default App
