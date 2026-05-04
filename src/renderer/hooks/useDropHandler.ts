import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { CellFolder, IpcApi } from '../../shared/types'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']

function isImageFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
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

    // Electron では dataTransfer.files の File.path が実OSパスを返す
    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[]

    for (const file of files) {
      const filePath = file.path
      if (!filePath) continue

      if (file.type === '' || !file.type) {
        // type が空 = フォルダの可能性が高い → IPC経由で中身を読む
        const result = await getApi().readFolderPath(filePath)
        if (!result.canceled && result.images && result.images.length > 0) {
          await assignFolderToCell(result.folderPath!, result.images, e, cells, addCellByDrop, setCellFolder, setCellImage, grid)
          continue
        }
      }

      // 単一画像ファイル
      if (isImageFile(file.name)) {
        const cellId = getCellIdAtPosition(e, cells, grid)
        if (cellId) {
          const folder: CellFolder = {
            id: `folder-${Date.now()}`,
            path: filePath.replace(/[/\\][^/\\]+$/, ''),
            images: [filePath],
          }
          setCellFolder(cellId, folder)
          setCellImage(cellId, filePath)
        }
      }
    }
  }, [cells, addCellByDrop, setCellFolder, grid, setCellImage])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDrop, handleDragOver }
}

// フォルダをセルに割り当てる
async function assignFolderToCell(
  folderPath: string,
  images: string[],
  e: React.DragEvent<HTMLDivElement>,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  addCellByDrop: () => void,
  setCellFolder: (cellId: string, folder: CellFolder) => void,
  setCellImage: (cellId: string, imagePath: string) => void,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
) {
  let cellId = getCellIdAtPosition(e, cells, grid)

  if (!cellId) {
    addCellByDrop()
    const updated = useAppStore.getState()
    const newCol = updated.grid.cols - 1
    const newCell = updated.cells.find(c => c.col === newCol && c.row === 0)
    if (!newCell) return
    cellId = newCell.id
  }

  const folder: CellFolder = {
    id: `folder-${Date.now()}-${Math.random()}`,
    path: folderPath,
    images,
  }

  setCellFolder(cellId, folder)
  if (images[0]) setCellImage(cellId, images[0])
}

// ドロップ位置からセルIDを計算
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
  const col = Math.min(Math.floor(relX / cellW), grid.cols - 1)
  const row = Math.min(Math.floor(relY / cellH), grid.rows - 1)
  const cell = cells.find(c => c.col === col && c.row === row)
  return cell?.id ?? null
}
