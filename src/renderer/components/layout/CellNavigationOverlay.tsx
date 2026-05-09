import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { useTranslation } from '../../i18n'
import type { IpcApi } from '../../../shared/types'
import styles from './CellNavigationOverlay.module.css'

const BTN_HEIGHT = 32
const BTN_WIDTH = 44
const BTN_GAP = 4
const MARGIN = 8

interface Props {
  hoveredCellId: string | null
}

export const CellNavigationOverlay: React.FC<Props> = ({ hoveredCellId }) => {
  const cells = useAppStore(s => s.cells)
  const grid = useAppStore(s => s.grid)
  const prevCellImage = useAppStore(s => s.prevCellImage)
  const nextCellImage = useAppStore(s => s.nextCellImage)
  const setImageEffectProfile = useAppStore(s => s.setImageEffectProfile)
  const showAppNotification = useAppStore(s => s.showAppNotification)
  const { t } = useTranslation()

  if (!hoveredCellId) return null

  const cell = cells.find(c => c.id === hoveredCellId)
  if (!cell || !cell.folder || cell.folder.images.length === 0) return null

  const rightPct = ((cell.col + 1) / grid.cols) * 100
  const bottomPct = ((cell.row + 1) / grid.rows) * 100
  const showNavButtons = cell.folder.images.length > 1
  const groupWidth = showNavButtons ? BTN_WIDTH * 3 + BTN_GAP * 2 : BTN_WIDTH

  const stopDrag = (e: React.DragEvent) => e.preventDefault()
  const api: IpcApi = (window as unknown as { api: IpcApi }).api

  const saveImageEffects = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const imagePath = cell.folder?.images[cell.currentImageIndex]
    if (!cell.folder || !imagePath) return
    if (cell.folder.source === 'remote-image' || /^https?:\/\//i.test(imagePath)) {
      showAppNotification(t('imageEffectProfileRemoteUnsupported'), 'error')
      return
    }

    const result = await api.saveImageEffectProfile(cell.folder.path, imagePath, cell.effects)
    if (result.success) {
      setImageEffectProfile(cell.folder.path, result.profile ?? null)
      showAppNotification(t('imageEffectProfileSaved'), 'info')
      return
    }
    showAppNotification(`${t('imageEffectProfileSaveFailed')}: ${result.error ?? ''}`, 'error')
  }

  return (
    <div className={styles.overlay} onDragOver={stopDrag}>
      <div
        className={styles.btnGroup}
        onDragOver={stopDrag}
        style={{
          left: `calc(${rightPct}% - ${MARGIN + groupWidth}px)`,
          top: `calc(${bottomPct}% - ${MARGIN + BTN_HEIGHT}px)`,
        }}
      >
        <button
          className={`${styles.navBtn} ${styles.saveBtn}`}
          title={t('saveImageEffectProfile')}
          aria-label={t('saveImageEffectProfile')}
          onDragOver={stopDrag}
          onClick={saveImageEffects}
        >
          FX
        </button>
        {showNavButtons && (
          <>
            <button
              className={styles.navBtn}
              onDragOver={stopDrag}
              onClick={e => {
                e.stopPropagation()
                prevCellImage(hoveredCellId)
              }}
            >
              ‹
            </button>
            <button
              className={styles.navBtn}
              onDragOver={stopDrag}
              onClick={e => {
                e.stopPropagation()
                nextCellImage(hoveredCellId, true)
              }}
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  )
}
