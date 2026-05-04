import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  AppProfile, Cell, CellEffects, CellFolder, GridLayout,
  BlankColor, TimerConfig, TimerPosition, ImageFitMode, AppProfile as Profile
} from '../../shared/types'

// ===== デフォルト値 =====

export const DEFAULT_BLANK_COLOR: BlankColor = { r: 10, g: 10, b: 10, a: 1 }
export const DEFAULT_SLIDESHOW: Cell['slideshow'] = {
  enabled: false,
  intervalMs: 3000,
  randomOrder: false,
  transition: 'fade',
  transitionDurationMs: 350,
}

export const DEFAULT_EFFECTS: CellEffects = {
  colorOverlay: { enabled: false, color: { r: 255, g: 0, b: 128 }, alpha: 0.3 },
  vignette: {
    enabled: false,
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    dynamic: false,
    dynamicFrom: 0.4,
    dynamicTo: 0.7,
    dynamicDurationMs: 1000,
  },
  blur: {
    enabled: false,
    strength: 0,
    applyToAll: false,
    gradualEnabled: false,
    gradualDurationSec: 60,
    gradualStartStrength: 0,
    gradualEndStrength: 20,
    regionEnabled: false,
    regionCenterX: 0.5,
    regionCenterY: 0.5,
    regionWidth: 0.35,
    regionHeight: 0.35,
  },
  dynamicAsset: {
    enabled: false,
    assetPath: null,
    spawnIntervalMs: 800,
    riseSpeedPx: 2,
    maxParticles: 20,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 100, b: 150 },
    colorOverlayAlpha: 0.5,
  }
}

export const DEFAULT_TIMER: TimerConfig = {
  enabled: false,
  totalSec: 300,
  elapsedSec: 0,
  running: false,
  position: 'bottom-center',
  showBackground: true,
}

function createCell(col: number, row: number): Cell {
  return {
    id: `cell-${col}-${row}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    col,
    row,
    folder: null,
    imageFit: 'cover',
    currentImageIndex: 0,
    slideshow: { ...DEFAULT_SLIDESHOW },
    effects: structuredClone(DEFAULT_EFFECTS),
  }
}

function buildCells(cols: number, rows: number): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(createCell(c, r))
    }
  }
  return cells
}

// ===== Store 型 =====

export type AppState = {
  // レイアウト
  blankColor: BlankColor
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
  showNavigationBar: boolean

  // UI状態（プロファイル対象外）
  selectedCellId: string | null
  showControls: boolean
  isLoading: boolean
  slideshowRestartNonce: number
  blurRegionPickerCellId: string | null
}

export type AppActions = {
  // グリッド操作
  setGrid: (cols: number, rows: number) => void
  addColumn: () => void
  removeColumn: () => void
  addRow: () => void
  removeRow: () => void
  addCellByDrop: () => void  // D&Dで列を追加

  // セル操作
  setCellFolder: (cellId: string, folder: CellFolder) => void
  setAllCellsFolder: (folder: CellFolder) => void
  setCellImageFit: (cellId: string, imageFit: ImageFitMode) => void
  setCellImage: (cellId: string, index: number) => void
  nextCellImage: (cellId: string) => void
  setCellSlideshow: (cellId: string, config: Partial<Cell['slideshow']>) => void
  setAllCellsSlideshow: (config: Cell['slideshow']) => void
  restartSlideshowsRandomly: () => void

  // エフェクト操作
  setCellEffect: <K extends keyof CellEffects>(
    cellId: string, effectKey: K, value: Partial<CellEffects[K]>
  ) => void
  setAllCellsEffect: <K extends keyof CellEffects>(
    effectKey: K, value: Partial<CellEffects[K]>
  ) => void

  // 表示設定
  setBlankColor: (color: BlankColor) => void
  setFullscreen: (flag: boolean) => void
  setNavigationBarVisible: (flag: boolean) => void
  toggleNavigationBar: () => void

  // タイマー
  setTimer: (config: Partial<TimerConfig>) => void
  tickTimer: () => void

  // UI
  selectCell: (cellId: string | null) => void
  toggleControls: () => void
  setLoading: (flag: boolean) => void
  setBlurRegionPickerCell: (cellId: string | null) => void

  // プロファイル
  exportProfile: (name: string) => AppProfile
  importProfile: (profile: AppProfile) => void
  resetProfile: () => void
}

export type AppStore = AppState & AppActions

// ===== Store 実装 =====

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // 初期状態
    blankColor: DEFAULT_BLANK_COLOR,
    grid: { cols: 1, rows: 1 },
    cells: buildCells(1, 1),
    timer: DEFAULT_TIMER,
    fullscreen: false,
    showNavigationBar: true,
    selectedCellId: null,
    showControls: true,
    isLoading: false,
    slideshowRestartNonce: 0,
    blurRegionPickerCellId: null,

    // ===== グリッド操作 =====

    setGrid: (cols, rows) => set(s => {
      const clampedCols = Math.max(1, Math.min(15, cols))
      const clampedRows = Math.max(1, Math.min(15, rows))
      s.grid = { cols: clampedCols, rows: clampedRows }
      s.cells = rebuildCells(s.cells, clampedCols, clampedRows)
    }),

    addColumn: () => set(s => {
      if (s.grid.cols >= 15) return
      const newCols = s.grid.cols + 1
      s.grid.cols = newCols
      s.cells = rebuildCells(s.cells, newCols, s.grid.rows)
    }),

    removeColumn: () => set(s => {
      if (s.grid.cols <= 1) return
      const newCols = s.grid.cols - 1
      s.grid.cols = newCols
      s.cells = s.cells.filter(c => c.col < newCols)
    }),

    addRow: () => set(s => {
      if (s.grid.rows >= 15) return
      const newRows = s.grid.rows + 1
      s.grid.rows = newRows
      s.cells = rebuildCells(s.cells, s.grid.cols, newRows)
    }),

    removeRow: () => set(s => {
      if (s.grid.rows <= 1) return
      const newRows = s.grid.rows - 1
      s.grid.rows = newRows
      s.cells = s.cells.filter(c => c.row < newRows)
    }),

    addCellByDrop: () => {
      const { grid, addColumn } = get()
      if (grid.cols < 15) addColumn()
    },

    // ===== セル操作 =====

    setCellFolder: (cellId, folder) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) {
        cell.folder = folder
        cell.currentImageIndex = 0
      }
    }),

    setAllCellsFolder: (folder) => set(s => {
      s.cells.forEach(cell => {
        cell.folder = structuredClone(folder)
        cell.currentImageIndex = 0
      })
    }),

    setCellImageFit: (cellId, imageFit) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) cell.imageFit = imageFit
    }),

    setCellImage: (cellId, index) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell && cell.folder) {
        const len = cell.folder.images.length
        cell.currentImageIndex = ((index % len) + len) % len
      }
    }),

    nextCellImage: (cellId) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (!cell || !cell.folder) return
      const len = cell.folder.images.length
      if (len === 0) return
      if (cell.slideshow.randomOrder) {
        cell.currentImageIndex = Math.floor(Math.random() * len)
      } else {
        cell.currentImageIndex = (cell.currentImageIndex + 1) % len
      }
    }),

    setCellSlideshow: (cellId, config) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) Object.assign(cell.slideshow, config)
    }),

    setAllCellsSlideshow: (config) => set(s => {
      s.cells.forEach(cell => {
        cell.slideshow = structuredClone(config)
      })
    }),

    restartSlideshowsRandomly: () => set(s => {
      s.slideshowRestartNonce += 1
    }),

    // ===== エフェクト =====

    setCellEffect: (cellId, effectKey, value) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) Object.assign(cell.effects[effectKey], value)
    }),

    setAllCellsEffect: (effectKey, value) => set(s => {
      s.cells.forEach(cell => Object.assign(cell.effects[effectKey], value))
    }),

    // ===== 表示設定 =====

    setBlankColor: (color) => set(s => { s.blankColor = color }),

    setFullscreen: (flag) => set(s => { s.fullscreen = flag }),

    setNavigationBarVisible: (flag) => set(s => { s.showNavigationBar = flag }),

    toggleNavigationBar: () => set(s => { s.showNavigationBar = !s.showNavigationBar }),

    // ===== タイマー =====

    setTimer: (config) => set(s => { Object.assign(s.timer, config) }),

    tickTimer: () => set(s => {
      if (!s.timer.running || s.timer.elapsedSec >= s.timer.totalSec) return
      s.timer.elapsedSec = Math.min(s.timer.elapsedSec + 1, s.timer.totalSec)
      if (s.timer.elapsedSec >= s.timer.totalSec) s.timer.running = false
    }),

    // ===== UI =====

    selectCell: (cellId) => set(s => { s.selectedCellId = cellId }),

    toggleControls: () => set(s => { s.showControls = !s.showControls }),

    setLoading: (flag) => set(s => { s.isLoading = flag }),

    setBlurRegionPickerCell: (cellId) => set(s => { s.blurRegionPickerCellId = cellId }),

    // ===== プロファイル =====

    exportProfile: (name) => {
      const s = get()
      const profile: AppProfile = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        name,
        blankColor: s.blankColor,
        grid: s.grid,
        cells: s.cells,
        timer: s.timer,
        fullscreen: s.fullscreen,
      }
      return profile
    },

    importProfile: (profile) => set(s => {
      s.blankColor = profile.blankColor
      s.grid = profile.grid
      s.cells = profile.cells.map(cell => ({
        ...cell,
        imageFit: cell.imageFit ?? 'cover',
        slideshow: { ...DEFAULT_SLIDESHOW, ...cell.slideshow },
        effects: {
          ...structuredClone(DEFAULT_EFFECTS),
          ...cell.effects,
          colorOverlay: { ...DEFAULT_EFFECTS.colorOverlay, ...cell.effects?.colorOverlay },
          vignette: { ...DEFAULT_EFFECTS.vignette, ...cell.effects?.vignette },
          blur: { ...DEFAULT_EFFECTS.blur, ...cell.effects?.blur },
          dynamicAsset: { ...DEFAULT_EFFECTS.dynamicAsset, ...cell.effects?.dynamicAsset },
        },
      }))
      s.timer = { ...DEFAULT_TIMER, ...profile.timer }
      s.fullscreen = profile.fullscreen
      s.showNavigationBar = true
      s.selectedCellId = null
      s.blurRegionPickerCellId = null
    }),

    resetProfile: () => set(s => {
      s.blankColor = DEFAULT_BLANK_COLOR
      s.grid = { cols: 1, rows: 1 }
      s.cells = buildCells(1, 1)
      s.timer = { ...DEFAULT_TIMER }
      s.fullscreen = false
      s.showNavigationBar = true
      s.selectedCellId = null
      s.blurRegionPickerCellId = null
    }),
  }))
)

// ===== ヘルパー: グリッド再構築（既存データを保持） =====

function rebuildCells(existing: Cell[], cols: number, rows: number): Cell[] {
  const result: Cell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const found = existing.find(cell => cell.col === c && cell.row === r)
      result.push(found ? { ...found, imageFit: found.imageFit ?? 'cover' } : createCell(c, r))
    }
  }
  return result
}

// ===== Selector helpers =====

export const selectCell = (state: AppStore, cellId: string) =>
  state.cells.find(c => c.id === cellId)

export const selectSelectedCell = (state: AppStore) =>
  state.selectedCellId ? state.cells.find(c => c.id === state.selectedCellId) : null
