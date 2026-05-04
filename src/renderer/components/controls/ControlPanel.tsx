import React, { useState } from 'react'
import { useAppStore, selectSelectedCell } from '../../stores/appStore'
import { GridControls } from './GridControls'
import { EffectsPanel } from '../effects/EffectsPanel'
import { TimerControls } from '../timer/TimerControls'
import { ProfileControls } from './ProfileControls'
import { AppearanceControls } from './AppearanceControls'
import styles from './ControlPanel.module.css'

type Tab = 'grid' | 'effects' | 'timer' | 'appearance' | 'profile'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'grid',       label: 'グリッド',   icon: '▦' },
  { id: 'effects',    label: 'エフェクト', icon: '✦' },
  { id: 'timer',      label: 'タイマー',   icon: '◷' },
  { id: 'appearance', label: '外観',       icon: '◈' },
  { id: 'profile',    label: 'プロファイル', icon: '☁' },
]

export const ControlPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('grid')
  const selectedCell = useAppStore(selectSelectedCell)
  const showControls = useAppStore(s => s.showControls)

  if (!showControls) return null

  return (
    <div className={styles.panel}>
      {/* タブナビゲーション */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className={styles.content}>
        {activeTab === 'grid'       && <GridControls />}
        {activeTab === 'effects'    && <EffectsPanel selectedCell={selectedCell} />}
        {activeTab === 'timer'      && <TimerControls />}
        {activeTab === 'appearance' && <AppearanceControls />}
        {activeTab === 'profile'    && <ProfileControls />}
      </div>
    </div>
  )
}
