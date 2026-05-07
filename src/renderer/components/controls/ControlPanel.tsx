import React, { useState } from 'react'
import { useAppStore, selectSelectedCell } from '../../stores/appStore'
import { GridControls } from './GridControls'
import { EffectsPanel } from '../effects/EffectsPanel'
import { TimerControls } from '../timer/TimerControls'
import { ProfileControls } from './ProfileControls'
import { AppearanceControls } from './AppearanceControls'
import { TextReaderPanel } from '../reader/TextReaderPanel'
import { useTranslation } from '../../i18n'
import styles from './ControlPanel.module.css'

type Tab = 'grid' | 'effects' | 'timer' | 'appearance' | 'profile' | 'textreader'

const TABS: { id: Tab; labelKey: 'tabGrid' | 'tabEffects' | 'tabTimer' | 'tabAppearance' | 'tabProfile' | 'tabTextReader'; icon: string }[] = [
  { id: 'grid',       labelKey: 'tabGrid',       icon: '▦' },
  { id: 'effects',    labelKey: 'tabEffects',    icon: '✦' },
  { id: 'timer',      labelKey: 'tabTimer',      icon: '◷' },
  { id: 'appearance', labelKey: 'tabAppearance', icon: '◈' },
  { id: 'profile',    labelKey: 'tabProfile',    icon: '☁' },
  { id: 'textreader', labelKey: 'tabTextReader', icon: '📖' },
]

type ControlPanelProps = {
  floating?: boolean
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ floating = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('grid')
  const selectedCell = useAppStore(selectSelectedCell)
  const showControls = useAppStore(s => s.showControls)
  const { t } = useTranslation()

  if (!showControls && !floating) return null

  return (
    <div className={`${styles.panel} ${floating ? styles.panelFloating : ''}`}>
      {/* タブナビゲーション */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={t(tab.labelKey)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{t(tab.labelKey)}</span>
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
        {activeTab === 'textreader' && <TextReaderPanel />}
      </div>
    </div>
  )
}
