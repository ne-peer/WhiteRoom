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
  setCellImage: (cellId: string, imagePath: string) => void
) {
  const { cells, addCellByDrop, setCellFolder, grid } = useAppStore()

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[]

    for (const file of files) {
      const filePath = file.path
      if (!filePath) continue

      if (file.type === '' || !file.type) {
        const result = await getApi().readFolderPath(filePath)
        if (!result.canceled && result.folderPath && result.images && result.images.length > 0) {
          assignFolderToCell(
            result.folderPath,
            result.images,
            e,
            cells,
            addCellByDrop,
            setCellFolder,
            setCellImage,
            grid
          )
          break
        }
      }

      if (isImageFile(file.name)) {
        const parentFolderPath = getParentFolderPath(filePath)
        if (!parentFolderPath) continue

        const result = await getApi().readFolderPath(parentFolderPath)
        if (result.canceled || !result.folderPath || !result.images || result.images.length === 0) {
          continue
        }

        assignFolderToCell(
          result.folderPath,
          result.images,
          e,
          cells,
          addCellByDrop,
          setCellFolder,
          setCellImage,
          grid
        )
        break
      }
    }
  }, [cells, addCellByDrop, setCellFolder, grid, setCellImage])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDrop, handleDragOver }
}

function assignFolderToCell(
  folderPath: string,
  images: string[],
  e: React.DragEvent<HTMLDivElement>,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  addCellByDrop: () => void,
  setCellFolder: (cellId: string, folder: CellFolder) => void,
  setCellImage: (cellId: string, imagePath: string) => void,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
) {
  const cellId = getAvailableCellIdAtDropPosition(e, cells, grid, addCellByDrop)
  if (!cellId) return

  const folder: CellFolder = {
    id: `folder-${Date.now()}-${Math.random()}`,
    path: folderPath,
    images,
  }

  setCellFolder(cellId, folder)
  if (images[0]) setCellImage(cellId, images[0])
}

function getAvailableCellIdAtDropPosition(
  e: React.DragEvent<HTMLDivElement>,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  addCellByDrop: () => void,
): string | null {
  const targetCellId = getCellIdAtPosition(e, cells, grid)
  const targetCell = targetCellId ? cells.find(c => c.id === targetCellId) : null

  if (targetCell && !targetCell.folder) {
    return targetCell.id
  }

  addCellByDrop()
  const updated = useAppStore.getState()
  const newCol = updated.grid.cols - 1
  const newCell = updated.cells.find(c => c.col === newCol && c.row === 0)
  return newCell?.id ?? null
}

function getCellIdAtPosition(
  e: React.DragEvent<HTMLDivElement>,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  grid: ReturnType<typeof useAppStore.getState>['grid'],
): string | null {
  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
  const relX = e.clientX - rect.left
  const relY = e.clientY - rect.top
  const cellW = rect.width / grid.cols
  const cellH = rect.height / grid.rows
  const col = Math.max(0, Math.min(Math.floor(relX / cellW), grid.cols - 1))
  const row = Math.max(0, Math.min(Math.floor(relY / cellH), grid.rows - 1))
  const cell = cells.find(c => c.col === col && c.row === row)
  return cell?.id ?? null
}

function getParentFolderPath(filePath: string): string | null {
  const match = filePath.match(/^(.*)[\\/][^\\/]+$/)
  return match?.[1] ?? null
}
