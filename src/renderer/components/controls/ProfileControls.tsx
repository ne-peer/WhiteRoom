import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Button } from '../controls/UIKit'
import { formatCount, useTranslation } from '../../i18n'
import { APP_INFO } from '../../appInfo'
import type { IpcApi } from '../../../shared/types'
import styles from './ProfileControls.module.css'

export const ProfileControls: React.FC = () => {
  const { exportProfile, importProfile, resetProfile, showControls, showAppNotification } = useAppStore()
  const { language, t } = useTranslation()
  const [profileName, setProfileName] = useState('MyProfile')
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [defaultProfilePath, setDefaultProfilePath] = useState<string | null>(null)

  const api = (window as unknown as { api: IpcApi }).api

  useEffect(() => {
    api.getDefaultProfilePath().then(setDefaultProfilePath)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = async () => {
    const windowSize = await api.getWindowSize()
    const profile = exportProfile(profileName)
    const fullProfile: typeof profile = { ...profile, windowSize, showControls }
    const result = await api.saveProfile(fullProfile, language)
    if (result.success) showMsg('ok', t('saveDone'))
    else showMsg('err', `${t('saveFailed')}: ${result.error ?? ''}`)
  }

  const handleSaveAsDefault = async () => {
    const windowSize = await api.getWindowSize()
    const profile = exportProfile(profileName)
    const defaultProfile: typeof profile = {
      ...profile,
      windowSize,
      showControls,
      fullscreen: false,
      stashes: undefined,
    }
    const result = await api.saveDefaultProfile(defaultProfile)
    if (result.success) showAppNotification(t('saveDefaultDone'), 'info', 'top')
    else showAppNotification(`${t('saveDefaultFailed')}: ${result.error ?? ''}`, 'error', 'top')
  }

  const handleLoad = async () => {
    const result = await api.loadProfile(language)
    if (result.success && result.profile) {
      const fileName = result.filePath?.split(/[\\/]/).pop() ?? null
      importProfile(result.profile)
      if (result.profile.windowSize) {
        await api.setWindowSize(result.profile.windowSize.width, result.profile.windowSize.height)
      }
      if (fileName) {
        setProfileName(fileName.replace(/\.json$/i, ''))
        setImportedFileName(fileName)
      }
      showMsg('ok', t('loadDone'))
    } else if (!result.success && result.error) {
      showMsg('err', `${t('loadFailed')}: ${result.error}`)
    }
  }

  const handleReset = () => {
    if (confirm(t('resetConfirm'))) {
      resetProfile()
      setProfileName('MyProfile')
      setImportedFileName(null)
      showMsg('ok', t('resetDone'))
    }
  }

  const handleOpenRepository = () => {
    api.openExternal(APP_INFO.repositoryUrl)
  }

  return (
    <div className={styles.profilePanel}>
      <div>
        {importedFileName && (
          <Section title={t('profileName')}>
            <input
              type="text"
              value={importedFileName}
              readOnly
              disabled
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                opacity: 0.75,
                cursor: 'not-allowed',
              }}
            />
          </Section>
        )}

        <Section title={t('startupDefaults')}>
          <Button variant="secondary" onClick={handleSaveAsDefault}>
            {t('saveAsDefault')}
          </Button>
          {defaultProfilePath && (
            <div style={{
              marginTop: 6,
              fontSize: 10,
              color: 'rgba(255,255,255,0.28)',
              lineHeight: 1.5,
              wordBreak: 'break-all',
            }}>
              {defaultProfilePath}
            </div>
          )}
        </Section>

        <Section title={t('exportImport')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="secondary" onClick={handleLoad}>
              {t('loadJson')}
            </Button>
            <Button variant="secondary" onClick={handleSave}>
              {t('saveJson')}
            </Button>
            <Button variant="danger" onClick={handleReset}>
              {t('resetSettings')}
            </Button>
          </div>
        </Section>

        {message && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            background: message.type === 'ok' ? 'rgba(80,200,120,0.15)' : 'rgba(255,80,80,0.15)',
            color: message.type === 'ok' ? '#80e8a0' : '#ff8080',
            border: `1px solid ${message.type === 'ok' ? 'rgba(80,200,120,0.3)' : 'rgba(255,80,80,0.3)'}`,
          }}>
            {message.text}
          </div>
        )}

        <Section title={t('currentProfileInfo')}>
          <ProfileInfo />
        </Section>
      </div>

      <div className={styles.appInfo} aria-label="Application information">
        <div className={styles.appInfoName}>
          {APP_INFO.name} v{APP_INFO.version}
        </div>
        <div>Developed by {APP_INFO.developer}</div>
        <div>&copy; {APP_INFO.copyright}</div>
        <button type="button" className={styles.repositoryLink} onClick={handleOpenRepository}>
          {APP_INFO.repositoryLabel}
        </button>
      </div>
    </div>
  )
}

const ProfileInfo: React.FC = () => {
  const { grid, cells } = useAppStore()
  const { language, t } = useTranslation()
  const activeCells = cells.filter(c => c.folder !== null)

  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 2 }}>
      <div>{t('grid')}: {grid.cols} × {grid.rows}</div>
      <div>{t('activeCells')}: {activeCells.length} / {cells.length}</div>
      <div>{t('slideshow')}: {formatCount(language, cells.filter(c => c.slideshow.enabled).length, t('cell'))}</div>
    </div>
  )
}
