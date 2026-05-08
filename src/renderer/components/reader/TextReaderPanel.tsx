import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import { Section, Row, Toggle } from '../controls/UIKit'
import type { IpcApi, TextReaderWindowPosition, TextReaderPageAdvanceSpeed } from '../../../shared/types'
import styles from './TextReaderPanel.module.css'

export const TextReaderPanel: React.FC = () => {
  const { t, language } = useTranslation()
  const config = useAppStore(s => s.textReader.config)
  const visible = useAppStore(s => s.textReader.visible)
  const filePath = useAppStore(s => s.textReader.filePath)
  const rawSegments = useAppStore(s => s.textReader.rawSegments)
  const storyboardOpen = useAppStore(s => s.textReader.storyboardOpen)
  const {
    setTextReaderConfig,
    setTextReaderVisible,
    loadTextReaderFile,
    closeTextReader,
    setStoryboardOpen,
  } = useAppStore()

  const [systemFonts, setSystemFonts] = useState<string[]>([])

  useEffect(() => {
    const api = (window as unknown as { api: IpcApi }).api
    api.listSystemFonts().then(setSystemFonts)
  }, [])

  const handleOpenFile = async () => {
    const api = (window as unknown as { api: IpcApi }).api
    const result = await api.openTextFile(language)
    if (!result.canceled && result.filePath && result.text !== undefined) {
      loadTextReaderFile(result.filePath, result.text)
    }
  }

  const fileName = filePath ? filePath.split(/[\\/]/).pop() ?? filePath : null
  const hasFile = rawSegments.length > 0

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
            <button className={styles.closeBtn} onClick={closeTextReader}>
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
            <option value="vertical">{t('vertical')}</option>
          </select>
        </Row>
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
    </div>
  )
}
