// ===== 基本型 =====

export type GridPosition = {
  col: number  // 0-indexed
  row: number  // 0-indexed
}

export type BlankColor = {
  r: number
  g: number
  b: number
  a: number  // 0.0 - 1.0
}

// ===== セル（各分割区画）=====

export type CellFolder = {
  id: string
  path: string
  images: string[]  // ファイルパス一覧
}

export type ImageFitMode = 'fitHeight' | 'fitWidth' | 'cover'

export type SlideShowTransition =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'

export type SlideShowConfig = {
  enabled: boolean
  intervalMs: number       // ミリ秒
  randomOrder: boolean
  transition: SlideShowTransition
  transitionDurationMs: number
}

export type Cell = {
  id: string
  col: number
  row: number
  folder: CellFolder | null
  imageFit: ImageFitMode
  currentImageIndex: number
  slideshow: SlideShowConfig
  effects: CellEffects
}

// ===== エフェクト型 =====

export type ColorOverlayEffect = {
  enabled: boolean
  color: { r: number; g: number; b: number }
  alpha: number  // 0.0 - 1.0
}

export type VignetteEffect = {
  enabled: boolean
  color: { r: number; g: number; b: number }  // デフォルト: ピンク
  alpha: number         // 0.0 - 1.0
  dynamic: boolean      // 動的ビネット有効
  dynamicFrom: number   // 開始透明度 0.0-1.0
  dynamicTo: number     // 終了透明度 0.0-1.0
  dynamicDurationMs: number  // 変化時間 ms
}

export type BlurEffect = {
  enabled: boolean
  strength: number          // 0 - 100
  applyToAll: boolean       // true=全エフェクトにかける, false=画像のみ
  gradualEnabled: boolean   // 徐々に強度増加
  gradualDurationSec: number  // 最大3600秒
  gradualStartStrength: number
  gradualEndStrength: number
  regionEnabled: boolean
  regionCenterX: number
  regionCenterY: number
  regionWidth: number
  regionHeight: number
}

export type AssetParticle = {
  id: string
  assetPath: string
  x: number
  y: number
  alpha: number
  vy: number  // 上昇速度
  startTime: number
}

export type DynamicAssetEffect = {
  enabled: boolean
  assetPath: string | null
  spawnIntervalMs: number    // 生成間隔
  riseSpeedPx: number        // 上昇速度 px/frame
  maxParticles: number
  colorOverlayEnabled: boolean
  colorOverlayColor: { r: number; g: number; b: number }
  colorOverlayAlpha: number
}

export type CellEffects = {
  colorOverlay: ColorOverlayEffect
  vignette: VignetteEffect
  blur: BlurEffect
  dynamicAsset: DynamicAssetEffect
}

// ===== タイマー =====

export type TimerPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type TimerConfig = {
  enabled: boolean
  totalSec: number
  elapsedSec: number
  running: boolean
  position: TimerPosition
  showBackground: boolean
}

// ===== グリッド全体 =====

export type GridLayout = {
  cols: number  // 1-15
  rows: number  // 1-15
}

// ===== アプリ全体状態（プロファイルと同一構造）=====

export type AppProfile = {
  version: string
  createdAt: string
  name: string
  blankColor: BlankColor
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
}

// ===== IPC チャンネル型 =====

export type OpenFolderResult = {
  canceled: boolean
  folderPath?: string
  images?: string[]
}

export type OpenAssetResult = {
  canceled: boolean
  filePath?: string
}

export type SaveProfileResult = {
  success: boolean
  filePath?: string
  error?: string
}

export type LoadProfileResult = {
  success: boolean
  profile?: AppProfile
  error?: string
}

export type IpcApi = {
  openFolder: () => Promise<OpenFolderResult>
  readFolderPath: (folderPath: string) => Promise<OpenFolderResult>
  openAsset: () => Promise<OpenAssetResult>
  readImageAsBase64: (filePath: string) => Promise<string>
  saveProfile: (profile: AppProfile) => Promise<SaveProfileResult>
  loadProfile: () => Promise<LoadProfileResult>
  setFullscreen: (flag: boolean) => Promise<void>
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}
