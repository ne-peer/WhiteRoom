import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { current } from 'immer'
import type {
  AppProfile, Cell, CellBaseline, CellEffects, CellFolder, GridLayout,
  BlankBackground, BlankColor, TimerConfig, TimerPosition, ImageFitMode, AppProfile as Profile,
  ImageEffectProfileDocument, TagEntry, TextEffect, UiLanguage, TextReaderConfig, ReadingConfigPayload,
} from '../../shared/types'
import { parseTextFile, insertOrReplaceTagBefore, insertTagAtCharPosition, insertOrReplaceReadConfigAtTop, resolveStoryboardImageReference } from '../utils/storyboardParser'

// ===== デフォルト値 =====

export const DEFAULT_BLANK_COLOR: BlankColor = { r: 255, g: 100, b: 150, a: 0.5 }
export const DEFAULT_BLANK_BACKGROUND: BlankBackground = { mode: 'color', dynamicBlur: 30 }
export const DEFAULT_SLIDESHOW: Cell['slideshow'] = {
  enabled: false,
  intervalMs: 3000,
  randomOrder: true,
  transition: 'fade',
  transitionDurationMs: 350,
}

export const DEFAULT_EFFECTS: CellEffects = {
  effectCenter: { x: 0.5, y: 0.5 },
  colorOverlay: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    alpha: 0.3,
    imageAdjustEnabled: false,
    saturationMax: 1.4,
    contrastMax: 1.35,
    dynamicAdjust: false,
    dynamicAdjustDurationMs: 1000,
    dynamicAdjustTimerSync: false,
  },
  vignette: {
    enabled: false,
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    dynamic: false,
    dynamicFrom: 0.4,
    dynamicTo: 0.7,
    dynamicDurationMs: 1000,
    dynamicTimerSync: false,
  },
  spiral: {
    enabled: false,
    color: { r: 255, g: 0, b: 128 },
    pattern: 'classic',
    dualColorEnabled: false,
    secondaryColor: { r: 82, g: 139, b: 255 },
    detail: 82,
    rotationSpeedDegPerSec: -330,
    alpha: 0.55,
    radialEnabled: true,
    radialMode: 'periphery',
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 0.6,
    radialFadeStrength: 0.25,
    dynamic: false,
    dynamicFrom: 0.2,
    dynamicTo: 0.8,
    dynamicDurationMs: 1200,
    dynamicTimerSync: false,
  },
  blur: {
    enabled: false,
    strength: 0,
    applyToAll: false,
    gradualEnabled: false,
    gradualDurationSec: 1,
    gradualStartStrength: 0,
    gradualEndStrength: 20,
    gradualTimerSync: false,
    radialEnabled: false,
    radialPattern: 'a',
    radialIntensity: 0.8,
    radialCenterX: 0.5,
    radialCenterY: 0.5,
    radialSize: 1,
    radialHeight: 1,
  },
  echo: {
    enabled: false,
    durationSec: 1,
    startAlpha: 0.45,
    startScale: 1,
    endScale: 1.2,
    timerSync: false,
  },
  flash: {
    enabled: false,
    imagePath: null,
    opacity: 1,
    displayDurationSec: 1,
    intervalSec: 1,
    startTransition: 'none',
    startTransitionDurationSec: 0.6,
    endTransition: 'fade',
    endTransitionDurationSec: 0.6,
  },
  breathing: {
    enabled: false,
    speedPxPerSec: 8,
    maxOffsetPx: 20,
    timerSync: false,
    scaleEnabled: false,
    scaleDurationSec: 8,
  },
  shake: {
    enabled: false,
    mode: 'once',
    repeatEnabled: false,
    repeatIntervalSec: 1.3,
    amplitudeFactor: 0.5,
    speedFactor: 0.6,
    loopAmplitudePx: 20,
    loopSpeedPxPerSec: 80,
    afterimageEnabled: false,
    afterimageDurationSec: 0.35,
    manualTriggerNonce: 0,
    trailEnabled: false,
    trailSecondStageEnabled: false,
    trailSecondStageSize: 0.62,
    trailSecondStageDelayFactor: 0.25,
    trailDelaySec: 0.01,
    trailAlpha: 0.8,
    trailBlurStrength: 0,
    trailCenterX: 0.5,
    trailCenterY: 0.5,
    trailSize: 0.7,
    trailHeight: 1,
    lockBaseImage: false,
  },
  squish: {
    enabled: false,
    mode: 'oneshot' as 'oneshot' | 'permanentA' | 'permanentB',
    organicEnabled: false,
    colorSource: 'manual',
    circleSizeRatio: 0.6,
    gapRatio: 0,
    color: { r: 222, g: 124, b: 155 },
    alpha: 0.45,
    opacity: 1,
    featherStrength: 10,
    speedFactor: 1,
    repeatEnabled: true,
    repeatIntervalSec: 0.8,
    randomPosition: false,
  },
  dynamicAsset: {
    enabled: false,
    pattern: 'rising' as const,
    assetPath: null,
    assetPaths: [],
    assetFolderPath: null,
    spawnIntervalMs: 800,
    riseSpeedPx: 2,
    maxParticles: 20,
    sizeRatio: 1.0,
    baseAlpha: 1.0,
    alphaTimerSync: false,
    emergenceSpeedFactor: 1.0,
    colorOverlayEnabled: false,
    colorOverlayColor: { r: 255, g: 100, b: 150 },
    colorOverlayAlpha: 0.5,
  },
  textEffect: {
    enabled: false,
    texts: ['', '', '', '', ''],
    font: 'Meiryo',
    color: { r: 255, g: 100, b: 150 },
    alpha: 0.5,
    alphaTimerSync: false,
    fontSize: 48,
    charIntervalMs: 300,
    displayDurationMs: 1000,
    intervalMs: 600,
    direction: 'vertical',
  } satisfies TextEffect,
}

export const DEFAULT_TIMER_PRE_OVERLAY: TimerConfig['preOverlay'] = {
  enabled: false,
  imagePath: null,
  displayStartSec: 10,
  startOpacity: 0,
  endOpacity: 80,
}

export const DEFAULT_TIMER_AUTO_NEXT: TimerConfig['autoNext'] = {
  enabled: false,
  delaySec: 3,
}

export const DEFAULT_TIMER_PARTIAL: TimerConfig['partial'] = {
  enabled: false,
  startSec: 60,  // DEFAULT_TIMER.totalSec と同じ初期値
  endSec: 0,
}

export const DEFAULT_TIMER: TimerConfig = {
  enabled: false,
  totalSec: 60,
  elapsedSec: 0,
  running: false,
  position: 'bottom-center',
  showBackground: false,
  effectCompletionLeadSec: 3,
  endFlash: {
    enabled: true,
    color: { r: 255, g: 255, b: 255 },
    maxTransparency: 0,
    count: 3,
    intervalSec: 0.5,
  },
  preOverlay: { ...DEFAULT_TIMER_PRE_OVERLAY },
  autoNext: { ...DEFAULT_TIMER_AUTO_NEXT },
  partial: { ...DEFAULT_TIMER_PARTIAL },
}

export const DEFAULT_TEXT_READER_CONFIG: TextReaderConfig = {
  windowPosition: 'bottom',
  textDirection: 'horizontal',
  textWindowWidthPercent: 35,
  textWindowMaxWidthPx: 3840,
  fontFamily: 'Meiryo',
  fontSize: 20,
  charIntervalMs: 50,
  pageAdvanceSpeed: 'normal',
  backgroundOpacity: 70,
  overlayOnImage: true,
}

function normalizeTextReaderConfig(config: TextReaderConfig): TextReaderConfig {
  const isTopOrBottom = config.windowPosition === 'top' || config.windowPosition === 'bottom'
  const widthPercent = Number.isFinite(config.textWindowWidthPercent)
    ? config.textWindowWidthPercent
    : DEFAULT_TEXT_READER_CONFIG.textWindowWidthPercent
  const maxWidthPx = Number.isFinite(config.textWindowMaxWidthPx)
    ? config.textWindowMaxWidthPx
    : DEFAULT_TEXT_READER_CONFIG.textWindowMaxWidthPx
  return {
    ...config,
    textDirection: isTopOrBottom ? 'horizontal' : config.textDirection,
    textWindowWidthPercent: Math.max(20, Math.min(60, widthPercent)),
    textWindowMaxWidthPx: Math.max(240, Math.min(3840, Math.round(maxWidthPx))),
  }
}

function getInitialTextReaderConfig(): TextReaderConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_TEXT_READER_CONFIG }
  try {
    const stored = window.localStorage.getItem('whiteroom.textReaderConfig')
    if (stored) return normalizeTextReaderConfig({ ...DEFAULT_TEXT_READER_CONFIG, ...JSON.parse(stored) as Partial<TextReaderConfig> })
  } catch { /* ignore */ }
  return { ...DEFAULT_TEXT_READER_CONFIG }
}

const DEFAULT_LANGUAGE: UiLanguage = 'ja'

function getImageEffectProfileSuspendedMessage(language: UiLanguage): string {
  return language === 'en'
    ? 'Image effect profile auto-apply is suspended while the Text Reader is open.'
    : 'テキストリーダーを開いている間、画像別エフェクトの自動適用を停止します。'
}

function getInitialLanguage(): UiLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem('whiteroom.uiLanguage')
  return stored === 'en' || stored === 'ja' ? stored : DEFAULT_LANGUAGE
}

function normalizeShakePatch(
  value: Partial<CellEffects['shake']>
): Partial<CellEffects['shake']> {
  const patch = structuredClone(value)
  if (patch.trailSecondStageSize !== undefined) {
    if (patch.trailSecondStageSize > 1) {
      patch.trailSecondStageSize = 1
    } else if (patch.trailSecondStageSize < 0.1) {
      patch.trailSecondStageSize = 0.1
    }
  }
  return patch
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

function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/g, '')
}

function getRelativeImageProfileKey(folderPath: string, imagePath: string): string | null {
  const folder = normalizePathSeparators(folderPath)
  const image = normalizePathSeparators(imagePath)
  const prefix = `${folder}/`
  if (!image.toLowerCase().startsWith(prefix.toLowerCase())) return null
  return image.slice(prefix.length)
}

function mergeEffectsWithDefaults(effects: Partial<CellEffects> | undefined): CellEffects {
  return {
    ...structuredClone(DEFAULT_EFFECTS),
    ...effects,
    effectCenter: { ...DEFAULT_EFFECTS.effectCenter, ...effects?.effectCenter },
    colorOverlay: { ...DEFAULT_EFFECTS.colorOverlay, ...effects?.colorOverlay },
    vignette: { ...DEFAULT_EFFECTS.vignette, ...effects?.vignette },
    spiral: { ...DEFAULT_EFFECTS.spiral, ...effects?.spiral },
    blur: { ...DEFAULT_EFFECTS.blur, ...effects?.blur },
    echo: { ...DEFAULT_EFFECTS.echo, ...effects?.echo },
    flash: { ...DEFAULT_EFFECTS.flash, ...effects?.flash },
    breathing: { ...DEFAULT_EFFECTS.breathing, ...effects?.breathing },
    shake: { ...DEFAULT_EFFECTS.shake, ...effects?.shake },
    squish: { ...DEFAULT_EFFECTS.squish, ...effects?.squish },
    dynamicAsset: { ...DEFAULT_EFFECTS.dynamicAsset, ...effects?.dynamicAsset },
    textEffect: { ...DEFAULT_EFFECTS.textEffect, ...effects?.textEffect },
  }
}

function applyImageEffectProfileToCell(state: AppState, cell: Cell): boolean {
  if (state.imageEffectProfileAutoApplySuspended) return false
  if (!cell.folder || cell.folder.source === 'remote-image') return false
  if (state.cellTagOverrides[cell.id]) return false

  const imagePath = cell.folder.images[cell.currentImageIndex]
  if (!imagePath) return false

  const key = getRelativeImageProfileKey(cell.folder.path, imagePath)
  if (!key) return false

  const profile = state.imageEffectProfiles[cell.folder.path]
  const entry = profile?.entries[key]
  if (!entry) return false

  cell.effects = mergeEffectsWithDefaults(entry.effects)
  if (entry.timer) {
    const { endFlash, preOverlay, autoNext, partial, ...rest } = entry.timer
    Object.assign(state.timer, rest)
    if (endFlash) Object.assign(state.timer.endFlash, endFlash)
    if (preOverlay) Object.assign(state.timer.preOverlay, preOverlay)
    if (autoNext) Object.assign(state.timer.autoNext, autoNext)
    if (partial) Object.assign(state.timer.partial, partial)
    if (entry.timer.enabled) {
      state.timer.elapsedSec = state.timer.partial.enabled
        ? Math.max(0, state.timer.totalSec - state.timer.partial.startSec)
        : 0
      state.timer.running = true
      state.timerSuspendedSlideshow = true
    }
  }
  return true
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
  blankBackground: BlankBackground
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
  showNavigationBar: boolean

  // UI状態（プロファイル対象外）
  selectedCellId: string | null
  showControls: boolean
  isLoading: boolean
  language: UiLanguage
  timerCompletedNonce: number
  slideshowRestartNonce: number
  effectSyncNonce: number
  effectRandomNonce: number
  effectGuideNonce: number
  effectColumnSyncNonce: number
  effectColumnSyncCol: number | null
  applyEffectChangesToAllColumns: boolean
  shakeTrailPositionPicking: boolean
  spiralRadialPositionPicking: boolean
  squishColorPicking: boolean
  appNotification: { id: number; text: string; type: 'info' | 'warning' | 'error' } | null
  imageEffectProfiles: Record<string, ImageEffectProfileDocument | null>
  imageEffectProfileAutoApplySuspended: boolean
  timerSuspendedSlideshow: boolean  // タイマープロファイル適用中はスライドショーを停止

  // セルのタグ一時上書き（profile対象外・セッション専用）
  cellTagOverrides: Record<string, string | null>  // cellId → override image path

  // ストーリーボードファイル確認ダイアログ用の保留中読み込みデータ
  pendingStoryboardLoad: { filePath: string; text: string; tempFilePath?: string } | null

  // テキストリーダー
  textReader: {
    config: TextReaderConfig
    visible: boolean
    filePath: string | null
    tempFilePath: string | null
    rawFileText: string | null          // ファイル生テキスト（タグ込み）
    rawSegments: string[]
    currentPageIndex: number
    isAutoAdvancing: boolean
    autoSpeedMultiplier: 1 | 2 | 3
    showLog: boolean
    // ストーリーボード関連
    tagEntries: TagEntry[]
    segmentStartLines: number[]         // cleanSegments[i] の rawFileText 内開始行
    baselineSnapshot: CellBaseline[] | null
    activeTagIndex: number | null       // 現在適用中の tagEntries インデックス
    storyboardEffectProgress: number | null  // 0-1 or null（エフェクト徐々に適用）
    activeProgressPages: number         // タグトリガー後のページ進行数
    autoSuspendedForTimer: boolean      // タイマー待ち中に Auto を一時停止した
    storyboardOpen: boolean             // ストーリーボードパネル表示中
    currentSegmentIndex: number         // TextReaderWindow が計算した現在のセグメント
    currentPageSegCharOffset: number    // 現在ページ先頭の rawSegments[currentSegmentIndex] 内文字オフセット（0=セグメント先頭）
    readingConfig: ReadingConfigPayload | null  // ファイルから読み込んだ読書設定
    storyboardFileActive: boolean       // ストーリーボードタグを含むファイルが読み込み中
  }
}

export type AppActions = {
  // グリッド操作
  setGrid: (cols: number, rows: number) => void
  addColumn: () => void
  removeColumn: () => void
  addRow: () => void
  removeRow: () => void
  // セル操作
  setCellFolder: (cellId: string, folder: CellFolder) => void
  resetCellFolder: (cellId: string) => void
  resetAllCellFolders: () => void
  setAllCellsFolder: (folder: CellFolder) => void
  setCellImageFit: (cellId: string, imageFit: ImageFitMode) => void
  setAllCellsImageFit: (imageFit: ImageFitMode) => void
  setCellImage: (cellId: string, index: number) => void
  nextCellImage: (cellId: string, sequential?: boolean) => void
  prevCellImage: (cellId: string) => void
  setCellSlideshow: (cellId: string, config: Partial<Cell['slideshow']>) => void
  setAllCellsSlideshow: (config: Cell['slideshow']) => void
  restartSlideshowsRandomly: () => void
  applyEffectsToAll: () => void
  restartEffectsWithRandomTiming: () => void
  syncActiveEffectsInSelectedColumn: () => void
  resetEffectsInSelectedColumn: () => void
  enableAllTimerSyncForSelectedCell: () => void
  disableAllTimerSyncForSelectedCell: () => void
  setApplyEffectChangesToAllColumns: (flag: boolean) => void
  setShakeTrailPositionPicking: (flag: boolean) => void
  setSpiralRadialPositionPicking: (flag: boolean) => void
  setSquishColorPicking: (flag: boolean) => void

  // エフェクト操作
  setCellEffect: <K extends keyof CellEffects>(
    cellId: string, effectKey: K, value: Partial<CellEffects[K]>
  ) => void
  applyCellEffectPreset: (cellId: string, effects: Partial<CellEffects>) => void
  setCellSquishImageCenterColor: (cellId: string, color: { r: number; g: number; b: number }) => void
  setAllCellsEffect: <K extends keyof CellEffects>(
    effectKey: K, value: Partial<CellEffects[K]>
  ) => void

  // 表示設定
  setBlankColor: (color: BlankColor) => void
  setBlankBackground: (config: Partial<BlankBackground>) => void
  setFullscreen: (flag: boolean) => void
  setNavigationBarVisible: (flag: boolean) => void
  toggleNavigationBar: () => void

  // タイマー
  setTimer: (config: Partial<TimerConfig>) => void
  tickTimer: () => void
  timerAutoNextImages: () => void

  // UI
  selectCell: (cellId: string | null) => void
  setControlsVisible: (flag: boolean) => void
  toggleControls: () => void
  setLoading: (flag: boolean) => void
  setLanguage: (language: UiLanguage) => void
  showAppNotification: (text: string, type?: 'info' | 'warning' | 'error') => void
  clearAppNotification: (id?: number) => void
  setImageEffectProfile: (folderPath: string, profile: ImageEffectProfileDocument | null) => void
  applyImageEffectProfileForCell: (cellId: string) => void

  // プロファイル
  exportProfile: (name: string) => AppProfile
  importProfile: (profile: AppProfile) => void
  resetProfile: () => void

  // テキストリーダー
  setTextReaderConfig: (config: Partial<TextReaderConfig>) => void
  setTextReaderVisible: (visible: boolean) => void
  loadTextReaderFile: (filePath: string, text: string, tempFilePath?: string) => void
  closeTextReader: () => void
  resetForStoryboard: () => void
  setPendingStoryboardLoad: (load: { filePath: string; text: string; tempFilePath?: string } | null) => void
  unlockStoryboard: () => void
  setTextReaderPage: (index: number) => void
  setTextReaderAutoAdvancing: (flag: boolean) => void
  setTextReaderSpeedMultiplier: (multiplier: 1 | 2 | 3) => void
  setTextReaderShowLog: (flag: boolean) => void
  // ストーリーボード
  applyTagToAllCells: (tagIndex: number) => void
  restoreBaseline: () => void
  setStoryboardEffectProgress: (progress: number | null) => void
  incrementActiveProgressPages: () => void
  setAutoSuspendedForTimer: (flag: boolean) => void
  setStoryboardOpen: (open: boolean) => void
  setCurrentSegmentIndex: (index: number) => void
  setCurrentPageSegCharOffset: (offset: number) => void
  insertTagAtCurrentPosition: (
    tagLine: string,
    segmentIndex: number,
    onSave: (text: string) => void
  ) => void
  updateReadingConfigTag: (tagLine: string, onSave: (text: string) => void) => void
}

export type AppStore = AppState & AppActions

// ===== Store 実装 =====

export const useAppStore = create<AppStore>()(
  immer((set, get) => {
    const initialCells = buildCells(1, 1)

    return ({
    // 初期状態
    blankColor: DEFAULT_BLANK_COLOR,
    blankBackground: { ...DEFAULT_BLANK_BACKGROUND },
    grid: { cols: 1, rows: 1 },
    cells: initialCells,
    timer: DEFAULT_TIMER,
    fullscreen: false,
    showNavigationBar: true,
    selectedCellId: initialCells[0]?.id ?? null,
    showControls: true,
    isLoading: false,
    language: getInitialLanguage(),
    timerCompletedNonce: 0,
    slideshowRestartNonce: 0,
    effectSyncNonce: 0,
    effectRandomNonce: 0,
    effectGuideNonce: 0,
    effectColumnSyncNonce: 0,
    effectColumnSyncCol: null,
    applyEffectChangesToAllColumns: true,
    shakeTrailPositionPicking: false,
    spiralRadialPositionPicking: false,
    squishColorPicking: false,
    appNotification: null,
    imageEffectProfiles: {},
    imageEffectProfileAutoApplySuspended: false,
    timerSuspendedSlideshow: false,
    cellTagOverrides: {},
    pendingStoryboardLoad: null,
    textReader: {
      config: getInitialTextReaderConfig(),
      visible: false,
      filePath: null,
      tempFilePath: null,
      rawFileText: null,
      rawSegments: [],
      currentPageIndex: 0,
      isAutoAdvancing: false,
      autoSpeedMultiplier: 1,
      showLog: false,
      tagEntries: [],
      segmentStartLines: [],
      baselineSnapshot: null,
      activeTagIndex: null,
      storyboardEffectProgress: null,
      activeProgressPages: 0,
      autoSuspendedForTimer: false,
      storyboardOpen: false,
      currentSegmentIndex: 0,
      currentPageSegCharOffset: 0,
      readingConfig: null,
      storyboardFileActive: false,
    },

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

    // ===== セル操作 =====

    setCellFolder: (cellId, folder) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) {
        cell.folder = folder
        cell.currentImageIndex = 0
        delete s.cellTagOverrides[cellId]
        if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
      }
    }),

    resetCellFolder: (cellId) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) {
        cell.folder = null
        cell.currentImageIndex = 0
        delete s.cellTagOverrides[cellId]
      }
    }),

    resetAllCellFolders: () => set(s => {
      s.cells.forEach(cell => {
        cell.folder = null
        cell.currentImageIndex = 0
        delete s.cellTagOverrides[cell.id]
      })
    }),

    setAllCellsFolder: (folder) => set(s => {
      s.cells.forEach(cell => {
        cell.folder = structuredClone(folder)
        cell.currentImageIndex = 0
        delete s.cellTagOverrides[cell.id]
        if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
      })
    }),

    setCellImageFit: (cellId, imageFit) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell) cell.imageFit = imageFit
    }),

    setAllCellsImageFit: (imageFit) => set(s => {
      s.cells.forEach(cell => {
        cell.imageFit = imageFit
      })
    }),

    setCellImage: (cellId, index) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (cell && cell.folder) {
        const len = cell.folder.images.length
        cell.currentImageIndex = ((index % len) + len) % len
        if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
      }
    }),

    nextCellImage: (cellId, sequential) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (!cell || !cell.folder) return
      const len = cell.folder.images.length
      if (len === 0) return
      if (!sequential && cell.slideshow.randomOrder) {
        cell.currentImageIndex = Math.floor(Math.random() * len)
      } else {
        cell.currentImageIndex = (cell.currentImageIndex + 1) % len
      }
      if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
    }),

    prevCellImage: (cellId) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (!cell || !cell.folder) return
      const len = cell.folder.images.length
      if (len === 0) return
      cell.currentImageIndex = ((cell.currentImageIndex - 1) + len) % len
      if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
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
      if (!cell) return
      const patch = effectKey === 'shake'
        ? normalizeShakePatch(value)
        : value
      if (s.applyEffectChangesToAllColumns) {
        s.cells.forEach(targetCell => {
          const targetPatch = effectKey === 'shake'
            ? normalizeShakePatch(value)
            : structuredClone(value)
          Object.assign(targetCell.effects[effectKey], targetPatch)
        })
        s.effectGuideNonce += 1
        return
      }
      Object.assign(cell.effects[effectKey], patch)
      s.effectGuideNonce += 1
    }),

    applyCellEffectPreset: (cellId, effects) => set(s => {
      const applyToCell = (cell: (typeof s.cells)[0]) => {
        if (effects.effectCenter !== undefined) Object.assign(cell.effects.effectCenter, effects.effectCenter)
        if (effects.colorOverlay !== undefined) Object.assign(cell.effects.colorOverlay, effects.colorOverlay)
        if (effects.vignette !== undefined) Object.assign(cell.effects.vignette, effects.vignette)
        if (effects.spiral !== undefined) Object.assign(cell.effects.spiral, effects.spiral)
        if (effects.blur !== undefined) Object.assign(cell.effects.blur, effects.blur)
        if (effects.echo !== undefined) Object.assign(cell.effects.echo, effects.echo)
        if (effects.flash !== undefined) Object.assign(cell.effects.flash, effects.flash)
        if (effects.breathing !== undefined) Object.assign(cell.effects.breathing, effects.breathing)
        if (effects.shake !== undefined) Object.assign(cell.effects.shake, normalizeShakePatch(effects.shake))
        if (effects.squish !== undefined) Object.assign(cell.effects.squish, effects.squish)
        if (effects.dynamicAsset !== undefined) Object.assign(cell.effects.dynamicAsset, effects.dynamicAsset)
        if (effects.textEffect !== undefined) Object.assign(cell.effects.textEffect, effects.textEffect)
      }
      if (s.applyEffectChangesToAllColumns) {
        s.cells.forEach(applyToCell)
      } else {
        const cell = s.cells.find(c => c.id === cellId)
        if (cell) applyToCell(cell)
      }
      // effectGuideNonce は増やさない: プリセット適用でブラーエリアガイドを表示しない
    }),

    setCellSquishImageCenterColor: (cellId, color) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (!cell || cell.effects.squish.colorSource !== 'imageCenter') return
      const current = cell.effects.squish.color
      if (current.r === color.r && current.g === color.g && current.b === color.b) return
      cell.effects.squish.color = color
      s.effectGuideNonce += 1
    }),

    setAllCellsEffect: (effectKey, value) => set(s => {
      s.cells.forEach(cell => {
        const patch = effectKey === 'shake'
          ? normalizeShakePatch(value)
          : structuredClone(value)
        Object.assign(cell.effects[effectKey], patch)
      })
      s.effectGuideNonce += 1
    }),

    applyEffectsToAll: () => {
      const selectedCell = get().cells.find(c => c.id === get().selectedCellId)
      if (!selectedCell) return
      const effects = structuredClone(selectedCell.effects)
      set(s => {
        s.cells.forEach(cell => {
          cell.effects = structuredClone(effects)
        })
        s.effectSyncNonce += 1
      })
    },

    restartEffectsWithRandomTiming: () => set(s => {
      s.effectRandomNonce += 1
    }),

    syncActiveEffectsInSelectedColumn: () => set(s => {
      const selectedCell = s.cells.find(c => c.id === s.selectedCellId)
      if (!selectedCell) return
      s.effectColumnSyncCol = selectedCell.col
      s.effectColumnSyncNonce += 1
    }),

    resetEffectsInSelectedColumn: () => set(s => {
      const selectedCell = s.cells.find(c => c.id === s.selectedCellId)
      if (!selectedCell) return
      s.cells.forEach(cell => {
        if (cell.col === selectedCell.col) {
          cell.effects = structuredClone(DEFAULT_EFFECTS)
        }
      })
      s.effectSyncNonce += 1
    }),

    enableAllTimerSyncForSelectedCell: () => set(s => {
      const selectedCell = s.cells.find(c => c.id === s.selectedCellId)
      if (!selectedCell) return
      const targetCells = s.applyEffectChangesToAllColumns ? s.cells : [selectedCell]
      targetCells.forEach(cell => {
        cell.effects.colorOverlay.dynamicAdjustTimerSync = true
        cell.effects.vignette.dynamicTimerSync = true
        cell.effects.spiral.dynamicTimerSync = true
        cell.effects.blur.gradualTimerSync = true
        cell.effects.echo.timerSync = true
        cell.effects.breathing.timerSync = true
        cell.effects.dynamicAsset.alphaTimerSync = true
        cell.effects.textEffect.alphaTimerSync = true
      })
    }),

    disableAllTimerSyncForSelectedCell: () => set(s => {
      const selectedCell = s.cells.find(c => c.id === s.selectedCellId)
      if (!selectedCell) return
      const targetCells = s.applyEffectChangesToAllColumns ? s.cells : [selectedCell]
      targetCells.forEach(cell => {
        cell.effects.colorOverlay.dynamicAdjustTimerSync = false
        cell.effects.vignette.dynamicTimerSync = false
        cell.effects.spiral.dynamicTimerSync = false
        cell.effects.blur.gradualTimerSync = false
        cell.effects.echo.timerSync = false
        cell.effects.breathing.timerSync = false
        cell.effects.dynamicAsset.alphaTimerSync = false
        cell.effects.textEffect.alphaTimerSync = false
      })
    }),

    setApplyEffectChangesToAllColumns: (flag) => set(s => {
      s.applyEffectChangesToAllColumns = flag
    }),

    setShakeTrailPositionPicking: (flag) => set(s => {
      s.shakeTrailPositionPicking = flag
      if (flag) s.squishColorPicking = false
    }),

    setSpiralRadialPositionPicking: (flag) => set(s => {
      s.spiralRadialPositionPicking = flag
      if (flag) s.squishColorPicking = false
    }),

    setSquishColorPicking: (flag) => set(s => {
      s.squishColorPicking = flag
      if (flag) {
        s.shakeTrailPositionPicking = false
        s.spiralRadialPositionPicking = false
      }
    }),

    // ===== 表示設定 =====

    setBlankColor: (color) => set(s => { s.blankColor = color }),

    setBlankBackground: (config) => set(s => { Object.assign(s.blankBackground, config) }),

    setFullscreen: (flag) => set(s => {
      s.fullscreen = flag
      if (flag) s.showControls = false
      else s.showControls = true
    }),

    setNavigationBarVisible: (flag) => set(s => { s.showNavigationBar = flag }),

    toggleNavigationBar: () => set(s => { s.showNavigationBar = !s.showNavigationBar }),

    // ===== タイマー =====

    setTimer: (config) => set(s => { Object.assign(s.timer, config) }),

    tickTimer: () => set(s => {
      if (!s.timer.running || s.timer.elapsedSec >= s.timer.totalSec) return
      const completionElapsed = s.timer.partial.enabled && s.timer.partial.endSec > 0
        ? Math.max(0, s.timer.totalSec - s.timer.partial.endSec)
        : s.timer.totalSec
      s.timer.elapsedSec = Math.min(s.timer.elapsedSec + 1, completionElapsed)
      if (s.timer.elapsedSec >= completionElapsed) {
        s.timer.running = false
        s.timerCompletedNonce += 1
        // autoNext が無効の場合はここでスライドショーを再開
        if (s.timerSuspendedSlideshow && !s.timer.autoNext.enabled) {
          s.timerSuspendedSlideshow = false
        }
      }
    }),

    timerAutoNextImages: () => set(s => {
      // 新しい画像でタイマープロファイルが再設定されなければスライドショーを再開するためリセット
      s.timerSuspendedSlideshow = false

      s.cells.forEach(cell => {
        if (!cell.folder || cell.folder.images.length <= 1) return
        const len = cell.folder.images.length
        const useRandom = cell.slideshow.enabled && cell.slideshow.randomOrder
        if (useRandom) {
          cell.currentImageIndex = Math.floor(Math.random() * len)
        } else {
          cell.currentImageIndex = (cell.currentImageIndex + 1) % len
        }
        if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
      })

      // タイマープロファイルが再設定されなかった場合はスライドショーを再スタート
      if (!s.timerSuspendedSlideshow) {
        s.slideshowRestartNonce += 1
      }
    }),

    // ===== UI =====

    selectCell: (cellId) => set(s => { s.selectedCellId = cellId }),

    setControlsVisible: (flag) => set(s => { s.showControls = flag }),

    toggleControls: () => set(s => { s.showControls = !s.showControls }),

    setLoading: (flag) => set(s => { s.isLoading = flag }),

    setLanguage: (language) => set(s => {
      s.language = language
      window.localStorage.setItem('whiteroom.uiLanguage', language)
    }),

    showAppNotification: (text, type = 'info') => set(s => {
      s.appNotification = { id: Date.now(), text, type }
    }),

    clearAppNotification: (id) => set(s => {
      if (id !== undefined && s.appNotification?.id !== id) return
      s.appNotification = null
    }),

    // ===== プロファイル =====

    setImageEffectProfile: (folderPath, profile) => set(s => {
      s.imageEffectProfiles[folderPath] = profile
      let applied = false
      s.cells.forEach(cell => {
        if (cell.folder?.path === folderPath) {
          applied = applyImageEffectProfileToCell(s, cell) || applied
        }
      })
      if (applied) s.effectSyncNonce += 1
    }),

    applyImageEffectProfileForCell: (cellId) => set(s => {
      const cell = s.cells.find(c => c.id === cellId)
      if (!cell) return
      if (applyImageEffectProfileToCell(s, cell)) s.effectSyncNonce += 1
    }),

    exportProfile: (name) => {
      const s = get()
      const profile: AppProfile = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        name,
        blankColor: s.blankColor,
        blankBackground: s.blankBackground,
        grid: s.grid,
        cells: s.cells,
        timer: s.timer,
        fullscreen: s.fullscreen,
      }
      return profile
    },

    importProfile: (profile) => set(s => {
      s.blankColor = profile.blankColor
      s.blankBackground = { ...DEFAULT_BLANK_BACKGROUND, ...profile.blankBackground }
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
          spiral: { ...DEFAULT_EFFECTS.spiral, ...cell.effects?.spiral },
          blur: { ...DEFAULT_EFFECTS.blur, ...cell.effects?.blur },
          echo: { ...DEFAULT_EFFECTS.echo, ...cell.effects?.echo },
          flash: { ...DEFAULT_EFFECTS.flash, ...cell.effects?.flash },
          breathing: { ...DEFAULT_EFFECTS.breathing, ...cell.effects?.breathing },
          shake: { ...DEFAULT_EFFECTS.shake, ...cell.effects?.shake },
          squish: { ...DEFAULT_EFFECTS.squish, ...cell.effects?.squish },
          dynamicAsset: { ...DEFAULT_EFFECTS.dynamicAsset, ...cell.effects?.dynamicAsset },
          textEffect: { ...DEFAULT_EFFECTS.textEffect, ...cell.effects?.textEffect },
        },
      }))
      s.timer = {
        ...DEFAULT_TIMER,
        ...profile.timer,
        endFlash: { ...DEFAULT_TIMER.endFlash, ...profile.timer?.endFlash },
        preOverlay: { ...DEFAULT_TIMER_PRE_OVERLAY, ...profile.timer?.preOverlay },
        autoNext: { ...DEFAULT_TIMER_AUTO_NEXT, ...profile.timer?.autoNext },
      }
      s.fullscreen = profile.fullscreen
      s.showControls = profile.fullscreen ? false : (profile.showControls ?? true)
      s.showNavigationBar = true
      s.selectedCellId = null
      s.imageEffectProfiles = {}
      s.imageEffectProfileAutoApplySuspended = false
      s.timerSuspendedSlideshow = false
    }),

    resetProfile: () => set(s => {
      const cells = buildCells(1, 1)
      s.blankColor = DEFAULT_BLANK_COLOR
      s.blankBackground = { ...DEFAULT_BLANK_BACKGROUND }
      s.grid = { cols: 1, rows: 1 }
      s.cells = cells
      s.timer = { ...DEFAULT_TIMER }
      s.fullscreen = false
      s.showNavigationBar = true
      s.selectedCellId = cells[0]?.id ?? null
      s.applyEffectChangesToAllColumns = true
      s.imageEffectProfiles = {}
      s.imageEffectProfileAutoApplySuspended = false
      s.timerSuspendedSlideshow = false
    }),

    // ===== テキストリーダー =====

    setTextReaderConfig: (config) => set(s => {
      Object.assign(s.textReader.config, config)
      s.textReader.config = normalizeTextReaderConfig(s.textReader.config)
      try {
        window.localStorage.setItem('whiteroom.textReaderConfig', JSON.stringify(s.textReader.config))
      } catch { /* ignore */ }
    }),

    setTextReaderVisible: (visible) => set(s => {
      s.textReader.visible = visible
    }),

    loadTextReaderFile: (filePath, text, tempFilePath) => {
      // immer ドラフト外で非プロキシ状態からスナップショットを取得
      const current = get()
      const snapshot: CellBaseline[] = current.cells.map(cell => ({
        cellId: cell.id,
        overrideImage: current.cellTagOverrides[cell.id] ?? null,
        effects: structuredClone(cell.effects),
      }))
      const parsed = parseTextFile(text)
      set(s => {
        s.textReader.filePath = filePath
        s.textReader.tempFilePath = tempFilePath ?? null
        s.textReader.rawFileText = text
        s.textReader.rawSegments = parsed.cleanSegments
        s.textReader.tagEntries = parsed.tagEntries
        s.textReader.segmentStartLines = parsed.segmentStartLines
        s.textReader.baselineSnapshot = snapshot
        s.textReader.currentPageIndex = 0
        s.textReader.visible = true
        s.textReader.isAutoAdvancing = false
        s.textReader.showLog = false
        s.textReader.activeTagIndex = null
        s.textReader.storyboardEffectProgress = null
        s.textReader.activeProgressPages = 0
        s.textReader.autoSuspendedForTimer = false
        s.textReader.readingConfig = parsed.readingConfig ?? null
        s.textReader.storyboardFileActive = parsed.tagEntries.length > 0
        // ファイルに埋め込まれた読書設定を復元（ウィンドウサイズはIPC経由でコンポーネント側が適用）
        if (parsed.readingConfig) {
          const restored = normalizeTextReaderConfig({
            ...DEFAULT_TEXT_READER_CONFIG,
            ...parsed.readingConfig.textReader,
          })
          s.textReader.config = restored
          if (typeof parsed.readingConfig.showControls === 'boolean') {
            s.showControls = parsed.readingConfig.showControls
          }
          try {
            window.localStorage.setItem('whiteroom.textReaderConfig', JSON.stringify(restored))
          } catch { /* ignore */ }
        }
        s.imageEffectProfileAutoApplySuspended = true
        s.appNotification = {
          id: Date.now(),
          text: getImageEffectProfileSuspendedMessage(s.language),
          type: 'info',
        }
      })
    },

    closeTextReader: () => set(s => {
      // ベースラインを復元してからクリア
      if (s.textReader.baselineSnapshot) {
        for (const bl of s.textReader.baselineSnapshot) {
          const cell = s.cells.find(c => c.id === bl.cellId)
          if (cell) cell.effects = structuredClone(current(bl.effects))
          if (bl.overrideImage !== null) {
            s.cellTagOverrides[bl.cellId] = bl.overrideImage
          } else {
            delete s.cellTagOverrides[bl.cellId]
          }
        }
      }
      s.textReader.visible = false
      s.textReader.filePath = null
      s.textReader.tempFilePath = null
      s.textReader.rawFileText = null
      s.textReader.rawSegments = []
      s.textReader.tagEntries = []
      s.textReader.segmentStartLines = []
      s.textReader.baselineSnapshot = null
      s.textReader.currentPageIndex = 0
      s.textReader.isAutoAdvancing = false
      s.textReader.showLog = false
      s.textReader.activeTagIndex = null
      s.textReader.storyboardEffectProgress = null
      s.textReader.activeProgressPages = 0
      s.textReader.autoSuspendedForTimer = false
      s.textReader.storyboardOpen = false
      s.textReader.currentSegmentIndex = 0
      s.textReader.currentPageSegCharOffset = 0
      s.textReader.readingConfig = null
      s.textReader.storyboardFileActive = false
      s.imageEffectProfileAutoApplySuspended = false
      s.timerSuspendedSlideshow = false
      let applied = false
      s.cells.forEach(cell => {
        applied = applyImageEffectProfileToCell(s, cell) || applied
      })
      if (applied) s.effectSyncNonce += 1
    }),

    resetForStoryboard: () => set(s => {
      // グリッドを1x1にリセット
      s.grid = { cols: 1, rows: 1 }
      s.cells = rebuildCells(s.cells, 1, 1)
      // 全セルのエフェクトをデフォルトにリセット
      for (const cell of s.cells) {
        cell.effects = structuredClone(DEFAULT_EFFECTS)
      }
      // タイマーをデフォルトにリセット
      s.timer = structuredClone(DEFAULT_TIMER)
      s.effectSyncNonce += 1
    }),

    setPendingStoryboardLoad: (load) => set(s => {
      s.pendingStoryboardLoad = load
    }),

    unlockStoryboard: () => set(s => {
      s.textReader.storyboardFileActive = false
    }),

    setTextReaderPage: (index) => set(s => {
      s.textReader.currentPageIndex = index
    }),

    setTextReaderAutoAdvancing: (flag) => set(s => {
      s.textReader.isAutoAdvancing = flag
    }),

    setTextReaderSpeedMultiplier: (multiplier) => set(s => {
      s.textReader.autoSpeedMultiplier = multiplier
    }),

    setTextReaderShowLog: (flag) => set(s => {
      s.textReader.showLog = flag
    }),

    // ===== ストーリーボード =====

    applyTagToAllCells: (tagIndex) => set(s => {
      const entry = s.textReader.tagEntries[tagIndex]
      if (!entry) return

      const plainEntry = current(entry)
      const { tag } = plainEntry
      const image = resolveStoryboardImageReference(
        tag.kind === 'simple' ? tag.image : tag.payload.image,
        s.textReader.filePath
      )
      const effects = tag.kind === 'rich' ? tag.payload.effects : undefined

      // タイマーリセット（タグ優先）
      if (tag.kind === 'rich' && tag.payload.timer?.enabled) {
        const { endFlash, preOverlay, autoNext, partial, ...rest } = tag.payload.timer
        Object.assign(s.timer, rest)
        if (endFlash) Object.assign(s.timer.endFlash, endFlash)
        if (preOverlay) Object.assign(s.timer.preOverlay, preOverlay)
        if (autoNext) Object.assign(s.timer.autoNext, autoNext)
        if (partial) Object.assign(s.timer.partial, partial)
        s.timer.elapsedSec = s.timer.partial.enabled
          ? Math.max(0, s.timer.totalSec - s.timer.partial.startSec)
          : 0
        s.timer.running = true
        // Auto が動作中なら一時停止
        if (s.textReader.isAutoAdvancing) {
          s.textReader.isAutoAdvancing = false
          s.textReader.autoSuspendedForTimer = true
        }
      } else {
        // タイマー設定のないタグへ移行した場合は非表示にリセット
        s.timer.enabled = false
        s.timer.running = false
        s.timer.elapsedSec = 0
      }

      // 全セルに画像とエフェクトを適用
      s.cells.forEach(cell => {
        s.cellTagOverrides[cell.id] = image
        if (effects) {
          cell.effects = {
            ...current(cell.effects),
            ...effects,
          } as CellEffects
        }
      })

      // エフェクト進行率の初期化
      const progress = tag.kind === 'rich' ? tag.payload.progress : undefined
      s.textReader.activeTagIndex = tagIndex
      s.textReader.activeProgressPages = 0
      if (progress?.enabled) {
        s.textReader.storyboardEffectProgress = 0
      } else {
        s.textReader.storyboardEffectProgress = null
      }
    }),

    restoreBaseline: () => set(s => {
      const snapshot = s.textReader.baselineSnapshot
      if (!snapshot) return
      for (const bl of snapshot) {
        const cell = s.cells.find(c => c.id === bl.cellId)
        if (cell) cell.effects = structuredClone(current(bl.effects))
        if (bl.overrideImage !== null) {
          s.cellTagOverrides[bl.cellId] = bl.overrideImage
        } else {
          delete s.cellTagOverrides[bl.cellId]
        }
      }
      s.textReader.activeTagIndex = null
      s.textReader.storyboardEffectProgress = null
      s.textReader.activeProgressPages = 0
      s.timer.running = false
      s.timer.elapsedSec = 0
    }),

    setStoryboardEffectProgress: (progress) => set(s => {
      s.textReader.storyboardEffectProgress = progress
    }),

    incrementActiveProgressPages: () => set(s => {
      const entry = s.textReader.activeTagIndex !== null
        ? s.textReader.tagEntries[s.textReader.activeTagIndex]
        : null
      if (!entry || entry.tag.kind !== 'rich') return
      const prog = entry.tag.payload.progress
      if (!prog?.enabled) return

      s.textReader.activeProgressPages += 1
      const ratio = Math.min(1, s.textReader.activeProgressPages / prog.pages)
      s.textReader.storyboardEffectProgress = ratio
    }),

    setAutoSuspendedForTimer: (flag) => set(s => {
      s.textReader.autoSuspendedForTimer = flag
    }),

    setStoryboardOpen: (open) => set(s => {
      s.textReader.storyboardOpen = open
    }),

    setCurrentSegmentIndex: (index) => set(s => {
      s.textReader.currentSegmentIndex = index
    }),

    setCurrentPageSegCharOffset: (offset) => set(s => {
      s.textReader.currentPageSegCharOffset = offset
    }),

    insertTagAtCurrentPosition: (tagLine, segmentIndex, onSave) => {
      const state = get()
      const rawText = state.textReader.rawFileText
      const startLines = state.textReader.segmentStartLines
      const charOffset = state.textReader.currentPageSegCharOffset
      if (!rawText) return

      const startLine = startLines[segmentIndex]
      if (startLine === undefined) return

      let newText: string
      if (charOffset > 0) {
        // セグメント途中：raw ファイルの文字位置で段落を分割してタグを挿入
        const rawLines = rawText.split('\n')
        let rawCharPos = 0
        for (let i = 0; i < startLine; i++) {
          rawCharPos += (rawLines[i]?.length ?? 0) + 1  // +1 for '\n'
        }
        newText = insertTagAtCharPosition(rawText, rawCharPos + charOffset, tagLine)
      } else {
        // セグメント先頭：既存タグの置換も考慮した通常挿入
        newText = insertOrReplaceTagBefore(rawText, startLine, tagLine)
      }

      // テキストを再解析してストアを更新
      set(s => {
        const parsed = parseTextFile(newText)
        s.textReader.rawFileText = newText
        s.textReader.rawSegments = parsed.cleanSegments
        s.textReader.tagEntries = parsed.tagEntries
        s.textReader.segmentStartLines = parsed.segmentStartLines
      })

      onSave(newText)
    },

    updateReadingConfigTag: (tagLine, onSave) => {
      const state = get()
      const rawText = state.textReader.rawFileText
      if (!rawText) return

      const newText = insertOrReplaceReadConfigAtTop(rawText, tagLine)
      const parsed = parseTextFile(newText)

      set(s => {
        s.textReader.rawFileText = newText
        s.textReader.rawSegments = parsed.cleanSegments
        s.textReader.tagEntries = parsed.tagEntries
        s.textReader.segmentStartLines = parsed.segmentStartLines
        s.textReader.readingConfig = parsed.readingConfig ?? null
      })

      onSave(newText)
    },
  })})
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
