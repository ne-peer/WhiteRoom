import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { CellFolder, IpcApi } from '../../shared/types'
import { parseTextFile } from '../utils/storyboardParser'
import { isRasterSourceListingFilename } from '../../shared/rasterSourceExtensions'
import { findColumnAtX } from '../utils/gridGeometry'

function isProfileFile(name: string): boolean {
  return name.toLowerCase().endsWith('.json')
}

function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

function getApi(): IpcApi {
  return (window as unknown as { api: IpcApi }).api
}

export function useDropHandler(
  setCellImageRenderer: (cellId: string, imagePath: string) => void
) {
  const {
    cells,
    setCellFolder,
    setCellImage: setCellImageStore,
    grid,
    setImageEffectProfile,
    showAppNotification,
    language,
    importProfile,
    loadTextReaderFile,
    setPendingStoryboardLoad,
    resetForStoryboard,
  } = useAppStore()

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    // React sets e.currentTarget to null after the first await, so capture it now
    const canvasRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[]

    for (const file of files) {
      const filePath = getFilePath(file)
      if (!filePath) continue

      // プロファイル JSON のD&D
      if (isProfileFile(file.name)) {
        const result = await getApi().loadProfileFromPath(filePath)
        if (result.success && result.profile) {
          importProfile(result.profile)
          if (result.profile.windowSize) {
            await getApi().setWindowSize(result.profile.windowSize.width, result.profile.windowSize.height)
          }
          const msg = language === 'en' ? '✓ Profile loaded' : '✓ プロファイルを読み込みました'
          showAppNotification(msg, 'info')
        } else if (result.error) {
          const msg = language === 'en'
            ? `✗ Failed to load profile: ${result.error}`
            : `✗ プロファイルの読み込みに失敗しました: ${result.error}`
          showAppNotification(msg, 'error')
        }
        break
      }

      // テキストファイル .txt のD&D
      if (isTextFile(file.name)) {
        const result = await getApi().openTextFileDirect(filePath)
        if (!result.canceled && result.filePath && result.text !== undefined) {
          const parsed = parseTextFile(result.text)
          if (parsed.tagEntries.length > 0) {
            setPendingStoryboardLoad({
              filePath: result.filePath,
              text: result.text,
              tempFilePath: result.tempFilePath,
            })
          } else {
            loadTextReaderFile(result.filePath, result.text, result.tempFilePath)
            const readingConfig = useAppStore.getState().textReader.readingConfig
            if (readingConfig) {
              await getApi().setWindowSize(readingConfig.windowSize.width, readingConfig.windowSize.height)
            }
          }
        }
        break
      }

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
            setCellFolder,
            setCellImageRenderer,
            setCellImageStore,
            grid,
            undefined
          )
          await loadImageEffectProfileForFolder(result.folderPath, setImageEffectProfile, showAppNotification, language)
          break
        }
      }

      if (isRasterSourceListingFilename(file.name)) {
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
          setCellFolder,
          setCellImageRenderer,
          setCellImageStore,
          grid,
          filePath
        )
        await loadImageEffectProfileForFolder(result.folderPath, setImageEffectProfile, showAppNotification, language)
        break
      }
    }
  }, [cells, setCellFolder, setCellImageStore, grid, setCellImageRenderer, setImageEffectProfile, showAppNotification, language, importProfile, loadTextReaderFile, setPendingStoryboardLoad, resetForStoryboard])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return { handleDrop, handleDragOver }
}

async function loadImageEffectProfileForFolder(
  folderPath: string,
  setImageEffectProfile: ReturnType<typeof useAppStore.getState>['setImageEffectProfile'],
  showAppNotification: ReturnType<typeof useAppStore.getState>['showAppNotification'],
  language: ReturnType<typeof useAppStore.getState>['language']
) {
  const result = await getApi().loadImageEffectProfile(folderPath)
  if (result.success) {
    setImageEffectProfile(folderPath, result.profile ?? null)
    return
  }
  const message = language === 'en'
    ? 'Failed to load image effect settings'
    : '画像別エフェクト設定の読み込みに失敗しました'
  showAppNotification(`${message}: ${result.error ?? ''}`, 'warning')
  setImageEffectProfile(folderPath, null)
}

function assignFolderToCell(
  folderPath: string,
  images: string[],
  canvasRect: DOMRect,
  clientX: number,
  clientY: number,
  cells: ReturnType<typeof useAppStore.getState>['cells'],
  setCellFolder: (cellId: string, folder: CellFolder) => void,
  setCellImageRenderer: (cellId: string, imagePath: string) => void,
  setCellImageStore: (cellId: string, index: number) => void,
  grid: ReturnType<typeof useAppStore.getState>['grid'],
  startImagePath: string | undefined,
) {
  const cellId = getCellIdAtPosition(canvasRect, clientX, clientY, cells, grid)
  if (!cellId) return

  const folder: CellFolder = {
    id: `folder-${Date.now()}-${Math.random()}`,
    path: folderPath,
    images,
  }

  setCellFolder(cellId, folder)

  const startIndex = startImagePath ? findImageIndex(images, startImagePath) : 0

  if (startIndex > 0) {
    setCellImageStore(cellId, startIndex)
  }

  const displayPath = images[startIndex]
  if (displayPath) setCellImageRenderer(cellId, displayPath)
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
  const cellH = canvasRect.height / grid.rows
  const col = findColumnAtX(relX, canvasRect.width, grid)
  const row = Math.max(0, Math.min(Math.floor(relY / cellH), grid.rows - 1))
  const cell = cells.find(c => c.col === col && c.row === row)
  return cell?.id ?? null
}

function getParentFolderPath(filePath: string): string | null {
  const match = filePath.match(/^(.*)[\\/][^\\/]+$/)
  return match?.[1] ?? null
}

function getFilePath(file: File & { path?: string }): string {
  return getApi().getPathForFile?.(file) || file.path || ''
}

function findImageIndex(images: string[], imagePath: string): number {
  const normalizedPath = normalizePath(imagePath)
  const index = images.findIndex(path => normalizePath(path) === normalizedPath)
  return Math.max(0, index)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}
