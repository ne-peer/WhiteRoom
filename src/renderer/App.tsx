import React from 'react'
import { MasterCanvas } from './components/layout/MasterCanvas'
import { TopBar } from './components/layout/TopBar'
import { ControlPanel } from './components/controls/ControlPanel'
import './global.css'

const App: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>
      <TopBar />
      <MasterCanvas />
      <ControlPanel />
    </div>
  )
}

export default App
