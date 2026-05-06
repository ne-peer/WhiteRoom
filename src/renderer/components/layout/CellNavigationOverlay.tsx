import React from 'react'
import { useAppStore } from '../../stores/appStore'
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

  if (!hoveredCellId) return null

  const cell = cells.find(c => c.id === hoveredCellId)
  if (!cell || !cell.folder || cell.folder.images.length <= 1) return null

  // セル右下に配置（パーセンテージ + px のオフセット）
  const rightPct = ((cell.col + 1) / grid.cols) * 100
  const bottomPct = ((cell.row + 1) / grid.rows) * 100
  const groupWidth = BTN_WIDTH * 2 + BTN_GAP

  const stopDrag = (e: React.DragEvent) => e.preventDefault()

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
      </div>
    </div>
  )
}
