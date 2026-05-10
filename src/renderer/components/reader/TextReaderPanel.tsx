import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import { Section, Row, Toggle } from '../controls/UIKit'
import type { IpcApi, TextReaderWindowPosition, TextReaderPageAdvanceSpeed } from '../../../shared/types'
import { parseTextFile } from '../../utils/storyboardParser'
import styles from './TextReaderPanel.module.css'

type PendingLoad = { filePath: string; text: string; tempFilePath?: string }

export const TextReaderPanel: React.FC = () => {
  const { t, language } = useTranslation()
  const config = useAppStore(s => s.textReader.config)
  const visible = useAppStore(s => s.textReader.visible)
  const filePath = useAppStore(s => s.textReader.filePath)
  const rawSegments = useAppStore(s => s.textReader.rawSegments)
  const storyboardOpen = useAppStore(s => s.textReader.storyboardOpen)
  const storyboardFileActive = useAppStore(s => s.textReader.storyboardFileActive)
  const tempFilePath = useAppStore(s => s.textReader.tempFilePath)
  const pendingStoryboardLoad = useAppStore(s => s.pendingStoryboardLoad)
  const {
    setTextReaderConfig,
    setTextReaderVisible,
    loadTextReaderFile,
    closeTextReader,
    setStoryboardOpen,
    resetForStoryboard,
    setPendingStoryboardLoad,
    unlockStoryboard,
  } = useAppStore()

  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [pixivStats, setPixivStats] = useState({ count: 0, limit: 10 })

  useEffect(() => {
    const api = (window as unknown as { api: IpcApi }).api
    api.listSystemFonts().then(setSystemFonts)
  }, [])

  useEffect(() => {
    let cancelled = false
    const api = (window as unknown as { api: IpcApi }).api
    const refreshStats = async () => {
      const stats = await api.getRemoteImageStats()
      if (!cancelled) {
        setPixivStats({
          count: stats.pixivUniqueImageCount,
          limit: stats.pixivUniqueImageLimit,
        })
      }
    }

    refreshStats()
    const timer = window.setInterval(refreshStats, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const handleOpenFile = async () => {
    const api = (window as unknown as { api: IpcApi }).api
    const result = await api.openTextFile(language)
    if (!result.canceled && result.filePath && result.text !== undefined) {
      const parsed = parseTextFile(result.text)
      if (parsed.tagEntries.length > 0) {
        setPendingStoryboardLoad({
          filePath: result.filePath,
          text: result.text,
          tempFilePath: result.tempFilePath ?? undefined,
        })
        return
      }
      loadTextReaderFile(result.filePath, result.text, result.tempFilePath)
      // ファイルに埋め込まれた読書設定がある場合、ウィンドウサイズを復元
      const readingConfig = useAppStore.getState().textReader.readingConfig
      if (readingConfig) {
        await api.setWindowSize(readingConfig.windowSize.width, readingConfig.windowSize.height)
      }
    }
  }

  const handleStoryboardConfirm = async () => {
    if (!pendingStoryboardLoad) return
    const { filePath, text, tempFilePath: pendingTemp } = pendingStoryboardLoad
    setPendingStoryboardLoad(null)
    resetForStoryboard()
    loadTextReaderFile(filePath, text, pendingTemp)
    const api = (window as unknown as { api: IpcApi }).api
    const readingConfig = useAppStore.getState().textReader.readingConfig
    if (readingConfig) {
      await api.setWindowSize(readingConfig.windowSize.width, readingConfig.windowSize.height)
    }
  }

  const handleStoryboardCancel = () => {
    setPendingStoryboardLoad(null)
  }

  const handleUnlockStoryboard = () => {
    unlockStoryboard()
  }

  const handleCloseFile = async () => {
    const api = (window as unknown as { api: IpcApi }).api
    const closingTempFilePath = tempFilePath
    closeTextReader()
    if (closingTempFilePath) {
      await api.cleanupTextReaderTempFile(closingTempFilePath)
    }
  }

  const fileName = filePath ? filePath.split(/[\\/]/).pop() ?? filePath : null
  const hasFile = rawSegments.length > 0
  const isTopOrBottom = config.windowPosition === 'top' || config.windowPosition === 'bottom'
  const isSideHorizontal = (config.windowPosition === 'left' || config.windowPosition === 'right') && config.textDirection === 'horizontal'

  const positionOptions: { value: TextReaderWindowPosition; label: string }[] = [
    { value: 'bottom', label: t('textReaderPositionBottom') },
    { value: 'top',    label: t('textReaderPositionTop') },
    { value: 'left',   label: t('textReaderPositionLeft') },
    { value: 'right',  label: t('textReaderPositionRight') },
  ]

  const speedOptions: { value: TextReaderPageAdvanceSpeed; label: string }[] = [
    { value: 'slow',   label: t('textReaderSpeedSlow') },
    { value: 'normal', label: t('textReaderSpeedNormal') },
    { value: 'fast',   label: t('textReaderSpeedFast') },
  ]

  const fontSizeOptions: { value: 20 | 28 | 36; label: string }[] = [
    { value: 20, label: '20px' },
    { value: 28, label: '28px' },
    { value: 36, label: '36px' },
  ]

  return (
    <div className={styles.panel}>
      {/* ストーリーボードファイル確認ダイアログ */}
      {pendingStoryboardLoad && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <div className={styles.dialogTitle}>{t('storyboardFileConfirmTitle')}</div>
            <div className={styles.dialogMessage}>{t('storyboardFileConfirmMessage')}</div>
            <div className={styles.dialogButtons}>
              <button className={styles.dialogBtnCancel} onClick={handleStoryboardCancel}>
                {t('storyboardFileConfirmCancel')}
              </button>
              <button className={styles.dialogBtnOk} onClick={handleStoryboardConfirm}>
                {t('storyboardFileConfirmOk')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ファイル読み込みセクション */}
      <Section title={t('textReaderSection')}>
        <div className={styles.fileSection}>
          <div className={`${styles.fileName} ${!fileName ? styles.fileNameEmpty : ''}`}>
            {fileName ?? t('textReaderNoFile')}
          </div>
          <button className={styles.openBtn} onClick={handleOpenFile}>
            {t('textReaderOpenFile')}
          </button>
          {hasFile && (
            <button className={styles.closeBtn} onClick={handleCloseFile}>
              {t('textReaderClose')}
            </button>
          )}
          {hasFile && (
            <button
              className={`${styles.openBtn} ${storyboardOpen ? styles.storyboardBtnActive : ''}`}
              onClick={() => setStoryboardOpen(!storyboardOpen)}
              title={t('storyboardOpenTooltip')}
            >
              {t('storyboardOpen')}
            </button>
          )}
        </div>
      </Section>

      {/* 表示設定 */}
      <Section title={t('textReaderWindowSettings')}>
        <Row label={t('textReaderVisible')}>
          <Toggle
            value={visible && hasFile}
            onChange={(v) => setTextReaderVisible(v && hasFile)}
          />
        </Row>

        <Row label={t('textReaderOverlayOnImage')}>
          <Toggle
            value={config.overlayOnImage ?? true}
            onChange={(v) => setTextReaderConfig({ overlayOnImage: v })}
          />
        </Row>

        <Row label={t('textReaderWindowPosition')}>
          <select
            className={styles.select}
            value={config.windowPosition}
            onChange={e => setTextReaderConfig({ windowPosition: e.target.value as TextReaderWindowPosition })}
          >
            {positionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Row>

        <Row label={t('textReaderDirection')}>
          <select
            className={styles.select}
            value={config.textDirection}
            onChange={e => setTextReaderConfig({ textDirection: e.target.value as 'horizontal' | 'vertical' })}
          >
            <option value="horizontal">{t('horizontal')}</option>
            {!isTopOrBottom && <option value="vertical">{t('vertical')}</option>}
          </select>
        </Row>

        {isSideHorizontal && (
          <Row label={t('textReaderWindowWidth')}>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={20}
                max={60}
                step={5}
                value={config.textWindowWidthPercent}
                onChange={e => setTextReaderConfig({ textWindowWidthPercent: Number(e.target.value) })}
              />
              <span className={styles.sliderValue}>{config.textWindowWidthPercent}%</span>
            </div>
          </Row>
        )}

        {isTopOrBottom && (
          <Row label={t('textReaderWindowMaxWidth')}>
            <div className={styles.sliderInputRow}>
              <input
                type="range"
                className={styles.slider}
                min={240}
                max={3840}
                step={20}
                value={config.textWindowMaxWidthPx}
                onChange={e => setTextReaderConfig({ textWindowMaxWidthPx: Number(e.target.value) })}
              />
              <input
                type="number"
                className={styles.numberInput}
                min={240}
                max={3840}
                step={20}
                value={config.textWindowMaxWidthPx}
                onChange={e => setTextReaderConfig({ textWindowMaxWidthPx: Number(e.target.value) })}
              />
              <span className={styles.unit}>px</span>
            </div>
          </Row>
        )}
      </Section>

      {/* フォント設定 */}
      <Section title={t('textReaderFontSettings')}>
        <Row label={t('textReaderFont')}>
          <select
            className={styles.select}
            value={config.fontFamily}
            onChange={e => setTextReaderConfig({ fontFamily: e.target.value })}
          >
            {systemFonts.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Row>

        <Row label={t('textReaderFontSize')}>
          <select
            className={styles.select}
            value={config.fontSize}
            onChange={e => setTextReaderConfig({ fontSize: Number(e.target.value) as 20 | 28 | 36 })}
          >
            {fontSizeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Row>

        <Row label={t('textReaderBgOpacity')}>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={5}
              value={config.backgroundOpacity ?? 70}
              onChange={e => setTextReaderConfig({ backgroundOpacity: Number(e.target.value) })}
            />
            <span className={styles.sliderValue}>{config.backgroundOpacity ?? 70}%</span>
          </div>
        </Row>
      </Section>

      {/* 速度設定 */}
      <Section title={t('textReaderSpeedSettings')}>
        <Row label={t('textReaderCharSpeed')}>
          <div className={styles.inputRow}>
            <input
              type="number"
              className={styles.numberInput}
              value={config.charIntervalMs}
              min={0}
              max={2000}
              step={10}
              onChange={e => setTextReaderConfig({ charIntervalMs: Math.max(0, Number(e.target.value)) })}
            />
            <span className={styles.unit}>{t('msPerChar')}</span>
          </div>
        </Row>

        <Row label={t('textReaderPageAdvanceSpeed')}>
          <select
            className={styles.select}
            value={config.pageAdvanceSpeed}
            onChange={e => setTextReaderConfig({ pageAdvanceSpeed: e.target.value as TextReaderPageAdvanceSpeed })}
          >
            {speedOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* ショートカットヘルプ */}
      <div className={styles.shortcutHelp}>{t('textReaderShortcutHelp')}</div>
      <div className={styles.pixivCounter}>
        pixiv requests: {pixivStats.count}/{pixivStats.limit}
      </div>

      {/* ストーリーボードモード中の操作制限解除ボタン */}
      {storyboardFileActive && (
        <button className={styles.unlockBtn} onClick={handleUnlockStoryboard}>
          {t('storyboardUnlockControls')}
        </button>
      )}
    </div>
  )
}
