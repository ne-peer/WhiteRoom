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
  setCellImageRenderer: (cellId: string, imagePath: string) => void
) {
  const { cells, addCellByDrop, setCellFolder, setCellImage: setCellImageStore, grid } = useAppStore()

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    // React sets e.currentTarget to null after the first await, so capture it now
    const canvasRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
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
            canvasRect,
            clientX,
            clientY,
            cells,
            addCellByDrop,
            setCellFolder,
            setCellImageRenderer,
            setCellImageStore,
            grid,
            undefined
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
          canvasRect,
          clientX,
          clientY,
          cells,
          addCellByDrop,
          setCellFolder,
          setCellImageRenderer,
          setCellImageStore,
          grid,
          filePath
        )
        break
      }
    }
  }, [cells, addCellByDrop, setCellFolder, setCellImageStore, grid, setCellImageRenderer])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDrop, handleDragOver }
}

function assignFolderToCell(
  folderPath: string,
  images: string[],
  canvasRect: DOMRect,
  clientX: number,
  clientY: number,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  addCellByDrop: () => void,
  setCellFolder: (cellId: string, folder: CellFolder) => void,
  setCellImageRenderer: (cellId: string, imagePath: string) => void,
  setCellImageStore: (cellId: string, index: number) => void,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  startImagePath: string | undefined,
) {
  const cellId = getAvailableCellIdAtDropPosition(canvasRect, clientX, clientY, cells, grid, addCellByDrop)
  if (!cellId) return

  const folder: CellFolder = {
    id: `folder-${Date.now()}-${Math.random()}`,
    path: folderPath,
    images,
  }

  setCellFolder(cellId, folder)

  const startIndex = startImagePath
    ? Math.max(0, images.indexOf(startImagePath))
    : 0

  if (startIndex > 0) {
    setCellImageStore(cellId, startIndex)
  }

  const displayPath = images[startIndex]
  if (displayPath) setCellImageRenderer(cellId, displayPath)
}

function getAvailableCellIdAtDropPosition(
  canvasRect: DOMRect,
  clientX: number,
  clientY: number,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  addCellByDrop: () => void,
): string | null {
  const targetCellId = getCellIdAtPosition(canvasRect, clientX, clientY, cells, grid)
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
  canvasRect: DOMRect,
  clientX: number,
  clientY: number,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  grid: ReturnType<typeof useAppStore.getState>['grid'],
): string | null {
  const relX = clientX - canvasRect.left
  const relY = clientY - canvasRect.top
  const cellW = canvasRect.width / grid.cols
  const cellH = canvasRect.height / grid.rows
  const col = Math.max(0, Math.min(Math.floor(relX / cellW), grid.cols - 1))
  const row = Math.max(0, Math.min(Math.floor(relY / cellH), grid.rows - 1))
  const cell = cells.find(c => c.col === col && c.row === row)
  return cell?.id ?? null
}

function getParentFolderPath(filePath: string): string | null {
  const match = filePath.match(/^(.*)[\\/][^\\/]+$/)
  return match?.[1] ?? null
}
