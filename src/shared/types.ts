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

export type UiLanguage = 'ja' | 'en'

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
  radialEnabled: boolean    // 放射線状ブラー（中心から周辺に向かって強くなる）
  radialPattern: 'a' | 'b'
  radialIntensity: number   // 放射線状の強度係数 0.0 - 1.0
  radialCenterY: number     // 0.0 - 1.0
  radialSize: number        // 放射線状ブラー領域のサイズ係数
}

export type EchoEffect = {
  enabled: boolean
  durationSec: number       // 繰り返し時間
  startAlpha: number        // 開始時の不透明度 0.0 - 1.0
  startScale: number        // 開始時の拡大率
  endScale: number          // 終了時の拡大率
}

export type BreathingEffect = {
  enabled: boolean
  speedPxPerSec: number
  maxOffsetPx: number
  scaleEnabled: boolean
  scaleDurationSec: number
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
  assetPaths: string[]
  assetFolderPath: string | null
  spawnMaxHeightRatio: number
  spawnIntervalMs: number    // 生成間隔
  riseSpeedPx: number        // 上昇速度 px/frame
  maxParticles: number
  sizeRatio: number          // アセットサイズ倍率 0.1 - 3.0
  baseAlpha: number          // 初期透明度 0.0 - 1.0
  colorOverlayEnabled: boolean
  colorOverlayColor: { r: number; g: number; b: number }
  colorOverlayAlpha: number
}

export type TextEffect = {
  enabled: boolean
  texts: string[]                           // 最大5件
  font: string                              // フォントファミリー名
  color: { r: number; g: number; b: number }
  alpha: number                             // 0.0 - 1.0
  fontSize: number                          // px
  charIntervalMs: number                    // 描画速度: 1文字ごとの間隔 ms
  displayDurationMs: number                 // 表示時間: 全文字表示後にフェードアウトするまでの時間 ms
  intervalMs: number                        // 表示間隔: 次のテキスト表示までの時間 ms
  direction: 'horizontal' | 'vertical'
}

export type CellEffects = {
  colorOverlay: ColorOverlayEffect
  vignette: VignetteEffect
  blur: BlurEffect
  echo: EchoEffect
  breathing: BreathingEffect
  dynamicAsset: DynamicAssetEffect
  textEffect: TextEffect
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
  folderPath?: string
  images?: string[]
}

export type SaveProfileResult = {
  success: boolean
  filePath?: string
  error?: string
}

export type LoadProfileResult = {
  success: boolean
  profile?: AppProfile
  filePath?: string
  error?: string
}

export type IpcApi = {
  openFolder: (language?: UiLanguage) => Promise<OpenFolderResult>
  readFolderPath: (folderPath: string) => Promise<OpenFolderResult>
  getPathForFile: (file: File) => string
  openAsset: (language?: UiLanguage) => Promise<OpenAssetResult>
  openAssetFolder: (language?: UiLanguage) => Promise<OpenAssetResult>
  readImageAsBase64: (filePath: string) => Promise<string>
  saveProfile: (profile: AppProfile, language?: UiLanguage) => Promise<SaveProfileResult>
  loadProfile: (language?: UiLanguage) => Promise<LoadProfileResult>
  setFullscreen: (flag: boolean) => Promise<void>
  listSystemFonts: () => Promise<string[]>
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}
