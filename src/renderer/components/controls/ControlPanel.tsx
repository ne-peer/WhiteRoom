import React, { useState, useRef, useEffect } from 'react'
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

const MAIN_TABS: { id: Tab; labelKey: 'tabGrid' | 'tabEffects' | 'tabTimer' | 'tabTextReader'; icon: string }[] = [
  { id: 'grid',       labelKey: 'tabGrid',       icon: '▦' },
  { id: 'effects',    labelKey: 'tabEffects',    icon: '✦' },
  { id: 'timer',      labelKey: 'tabTimer',      icon: '◷' },
  { id: 'textreader', labelKey: 'tabTextReader', icon: '📖' },
]

const MENU_TABS: { id: Tab; labelKey: 'tabAppearance' | 'tabProfile'; icon: string }[] = [
  { id: 'appearance', labelKey: 'tabAppearance', icon: '◈' },
  { id: 'profile',    labelKey: 'tabProfile',    icon: '☁' },
]

type ControlPanelProps = {
  floating?: boolean
}

const STORYBOARD_LOCKED_TABS: Tab[] = ['grid', 'effects', 'timer']

export const ControlPanel: React.FC<ControlPanelProps> = ({ floating = false }) => {
  const [activeTab, setActiveTab] = useState<Tab>('grid')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedCell = useAppStore(selectSelectedCell)
  const showControls = useAppStore(s => s.showControls)
  const storyboardFileActive = useAppStore(s => s.textReader.storyboardFileActive)
  const pendingStoryboardLoad = useAppStore(s => s.pendingStoryboardLoad)
  const { t } = useTranslation()

  useEffect(() => {
    if (pendingStoryboardLoad !== null) {
      setActiveTab('textreader')
    }
  }, [pendingStoryboardLoad])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const isHidden = !showControls && !floating

  const isMenuTabActive = MENU_TABS.some(tab => tab.id === activeTab)

  const handleMenuTabSelect = (id: Tab) => {
    setActiveTab(id)
    setMenuOpen(false)
  }

  const activeMenuTab = MENU_TABS.find(tab => tab.id === activeTab)

  return (
    <div className={`${styles.panel} ${floating ? styles.panelFloating : ''} ${isHidden ? styles.panelHidden : ''}`}>
      {/* タブナビゲーション — ラッパーで overflow visible を確保 */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          {MAIN_TABS.map(tab => {
            const locked = storyboardFileActive && STORYBOARD_LOCKED_TABS.includes(tab.id)
            return (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''} ${locked ? styles.tabLocked : ''}`}
                onClick={() => { if (!locked) setActiveTab(tab.id) }}
                title={locked ? t('storyboardModeActiveNotice') : t(tab.labelKey)}
                aria-disabled={locked}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabLabel}>{t(tab.labelKey)}</span>
              </button>
            )
          })}

          {/* その他: ホバーでメニュー表示（タッチはクリックでトグル） */}
          <div
            className={styles.menuPopover}
            ref={menuRef}
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              className={`${styles.tab} ${styles.menuTrigger} ${isMenuTabActive ? styles.tabActive : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="外観 / プロファイル"
            >
              <span className={styles.tabIcon}>≡</span>
              <span className={styles.tabLabel}>
                {activeMenuTab ? t(activeMenuTab.labelKey) : 'その他'}
              </span>
            </button>
            {menuOpen && (
              <div className={styles.menuDropdown} role="menu">
                {MENU_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${activeTab === tab.id ? styles.menuItemActive : ''}`}
                    onClick={() => handleMenuTabSelect(tab.id)}
                  >
                    <span className={styles.menuItemIcon}>{tab.icon}</span>
                    <span>{t(tab.labelKey)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className={styles.content}>
        {activeTab === 'grid'       && <GridControls />}
        {activeTab === 'effects'    && <EffectsPanel selectedCell={selectedCell} />}
        {activeTab === 'timer'      && <TimerControls />}
        {activeTab === 'appearance' && <AppearanceControls />}
        {activeTab === 'profile'    && <ProfileControls />}
        {activeTab === 'textreader' && <TextReaderPanel />}
        {storyboardFileActive && STORYBOARD_LOCKED_TABS.includes(activeTab) && (
          <div className={styles.storyboardLockOverlay}>
            <span className={styles.storyboardLockMsg}>{t('storyboardModeActiveNotice')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
