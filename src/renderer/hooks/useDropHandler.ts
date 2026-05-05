import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { CellFolder, IpcApi } from '../../shared/types'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']

function isImageFile(name: string): boolean {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0) return false
  return IMAGE_EXTENSIONS.includes(name.slice(dotIndex).toLowerCase())
}

function getApi(): IpcApi {
  return (window as unknown as { api: IpcApi }).api
}

export function useDropHandler(
  setCellImage: (cellId: string, imagePath: string) => void,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const { cells, addCellByDrop, setCellFolder, grid } = useAppStore()

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    // containerRef から rect を取得（e.currentTarget は async 前後で null になる）
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[]

    const getCellId = () => {
      const currentCells = useAppStore.getState().cells
      const currentGrid = useAppStore.getState().grid
      const cellW = rect.width / currentGrid.cols
      const cellH = rect.height / currentGrid.rows
      const col = Math.max(0, Math.min(Math.floor((clientX - rect.left) / cellW), currentGrid.cols - 1))
      const row = Math.max(0, Math.min(Math.floor((clientY - rect.top) / cellH), currentGrid.rows - 1))
      return currentCells.find(c => c.col === col && c.row === row)?.id ?? null
    }

    // ドロップ先セルを決定（空きがなければ列追加）
    let targetCellId = getCellId()
    const targetCell = targetCellId ? cells.find(c => c.id === targetCellId) : null
    if (!targetCell || targetCell.folder) {
      addCellByDrop()
      const newState = useAppStore.getState()
      const newCol = newState.grid.cols - 1
      targetCellId = newState.cells.find(c => c.col === newCol && c.row === 0)?.id ?? null
    }

    if (!targetCellId) return

    const cellId = targetCellId

    for (const file of files) {
      const filePath = file.path
      if (!filePath) continue

      if (file.type === '' || !file.type) {
        const result = await getApi().readFolderPath(filePath)
        if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
          setCellFolder(cellId, {
            id: `folder-${Date.now()}-${Math.random()}`,
            path: result.folderPath,
            images: result.images,
          })
          if (result.images[0]) setCellImage(cellId, result.images[0])
          continue
        }
      }

      if (isImageFile(file.name)) {
        setCellFolder(cellId, {
          id: `folder-${Date.now()}-${Math.random()}`,
          path: filePath.replace(/[/\\][^/\\]+$/, ''),
          images: [filePath],
        })
        setCellImage(cellId, filePath)
      }
    }
  }, [cells, addCellByDrop, setCellFolder, grid, setCellImage, containerRef])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDrop, handleDragOver }
}
