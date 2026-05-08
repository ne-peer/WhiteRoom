import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import type { IpcApi } from '../../../shared/types'
import { buildRichTagLine } from '../../utils/storyboardParser'
import styles from './StoryboardPanel.module.css'

const APP_VERSION = '1.4.0'

function getTimestamp(): string {
  const d = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

function buildSaveFilePath(originalPath: string): string {
  const lastDot = originalPath.lastIndexOf('.')
  const lastSlash = Math.max(originalPath.lastIndexOf('/'), originalPath.lastIndexOf('\\'))
  const base = lastDot > lastSlash ? originalPath.slice(0, lastDot) : originalPath
  const ext = lastDot > lastSlash ? originalPath.slice(lastDot) : ''
  return `${base}_WhiteRoom_${getTimestamp()}${ext}`
}

export const StoryboardPanel: React.FC = () => {
  const { t } = useTranslation()
  const [progressEnabled, setProgressEnabled] = useState(false)
  const [progressPages, setProgressPages] = useState(5)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStartMouse = useRef({ x: 0, y: 0 })
  const dragStartPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPos({
        x: dragStartPos.current.x + e.clientX - dragStartMouse.current.x,
        y: dragStartPos.current.y + e.clientY - dragStartMouse.current.y,
      })
    }
    const onMouseUp = () => { isDragging.current = false }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    isDragging.current = true
    dragStartMouse.current = { x: e.clientX, y: e.clientY }
    dragStartPos.current = { x: pos.x, y: pos.y }
    e.preventDefault()
  }

  const filePath = useAppStore(s => s.textReader.filePath)
  const currentSegmentIndex = useAppStore(s => s.textReader.currentSegmentIndex)
  const rawSegments = useAppStore(s => s.textReader.rawSegments)
  const segmentStartLines = useAppStore(s => s.textReader.segmentStartLines)
  const cells = useAppStore(s => s.cells)
  const cellTagOverrides = useAppStore(s => s.cellTagOverrides)
  const setStoryboardOpen = useAppStore(s => s.setStoryboardOpen)
  const insertTagAtCurrentPosition = useAppStore(s => s.insertTagAtCurrentPosition)

  const showStatus = (msg: string) => {
    setStatusMsg(msg)
    window.setTimeout(() => setStatusMsg(null), 2500)
  }

  // 現在表示中の画像パス（override 優先）
  const getCurrentImagePath = (): string | null => {
    const firstCell = cells[0]
    if (!firstCell) return null
    return cellTagOverrides[firstCell.id] ?? firstCell.folder?.images[firstCell.currentImageIndex] ?? null
  }

  const handleInsertImage = () => {
    const imagePath = getCurrentImagePath()
    if (!imagePath) { showStatus(t('storyboardNoFile')); return }
    const segIdx = currentSegmentIndex
    if (segmentStartLines[segIdx] === undefined) { showStatus(t('storyboardNoFile')); return }

    const firstCell = cells[0]
    const effects = firstCell?.effects ?? {}

    const tagLine = buildRichTagLine(
      APP_VERSION,
      imagePath,
      effects,
      progressEnabled ? { enabled: true, pages: progressPages } : undefined,
      undefined
    )

    const api = (window as unknown as { api: IpcApi }).api
    insertTagAtCurrentPosition(tagLine, segIdx, async (newText) => {
      const path = filePath!
      const result = await api.saveTextFile(path, newText)
      if (result.success) showStatus(t('storyboardInserted'))
      else showStatus(t('storyboardSaveFailed'))
    })
  }

  const handleInsertTimer = () => {
    const segIdx = currentSegmentIndex
    if (segmentStartLines[segIdx] === undefined) { showStatus(t('storyboardNoFile')); return }

    const firstCell = cells[0]
    const effects = firstCell ? firstCell.effects : undefined
    const imagePath = getCurrentImagePath()
    if (!imagePath || !effects) { showStatus(t('storyboardNoFile')); return }

    const tagLine = buildRichTagLine(
      APP_VERSION,
      imagePath,
      effects,
      undefined,
      { enabled: true }
    )

    const api = (window as unknown as { api: IpcApi }).api
    insertTagAtCurrentPosition(tagLine, segIdx, async (newText) => {
      const path = filePath!
      const result = await api.saveTextFile(path, newText)
      if (result.success) showStatus(t('storyboardInserted'))
      else showStatus(t('storyboardSaveFailed'))
    })
  }

  const handleSaveFile = async () => {
    if (!filePath) { showStatus(t('storyboardNoFile')); return }
    const rawText = useAppStore.getState().textReader.rawFileText
    if (!rawText) { showStatus(t('storyboardNoFile')); return }
    const savePath = buildSaveFilePath(filePath)
    const api = (window as unknown as { api: IpcApi }).api
    const result = await api.saveTextFile(savePath, rawText)
    if (result.success) showStatus(t('storyboardSaved'))
    else showStatus(t('storyboardSaveFailed'))
  }

  return (
    <div className={styles.panel} style={{ left: pos.x, top: pos.y }}>
      <div className={styles.header} onMouseDown={handleHeaderMouseDown}>
        <span className={styles.title}>{t('storyboardTitle')}</span>
        <button className={styles.closeBtn} onClick={() => setStoryboardOpen(false)}>×</button>
      </div>

      <div className={styles.body}>
        {/* 画像をここに差し込む */}
        <div className={styles.btnRow}>
          <button
            className={styles.actionBtn}
            onClick={handleInsertImage}
            title={t('storyboardInsertImageTooltip')}
          >
            {t('storyboardInsertImage')}
          </button>
        </div>

        {/* エフェクト徐々に適用オプション */}
        <div className={styles.progressRow}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={progressEnabled}
              onChange={e => setProgressEnabled(e.target.checked)}
            />
            {t('storyboardProgressEnabled')}
          </label>
          {progressEnabled && (
            <div className={styles.progressInputRow}>
              <input
                type="number"
                className={styles.numberInput}
                min={1}
                max={999}
                value={progressPages}
                onChange={e => setProgressPages(Math.max(1, Number(e.target.value)))}
              />
              <span className={styles.unit}>{t('storyboardProgressPages')}</span>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* タイマーをここに差し込む */}
        <div className={styles.btnRow}>
          <button
            className={styles.actionBtn}
            onClick={handleInsertTimer}
            title={t('storyboardInsertTimerTooltip')}
          >
            {t('storyboardInsertTimer')}
          </button>
        </div>

        <div className={styles.divider} />

        {/* ファイルを保存 */}
        <div className={styles.btnRow}>
          <button
            className={`${styles.actionBtn} ${styles.saveBtn}`}
            onClick={handleSaveFile}
            title={t('storyboardSaveFileTooltip')}
          >
            {t('storyboardSaveFile')}
          </button>
        </div>

        {/* ステータスメッセージ */}
        {statusMsg && <div className={styles.statusMsg}>{statusMsg}</div>}
      </div>

      <div className={styles.tip}>{t('storyboardTip')}</div>
    </div>
  )
}
