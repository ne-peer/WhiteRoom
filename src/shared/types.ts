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

export type BlankBackgroundMode = 'color' | 'dynamic'

export type BlankBackground = {
  mode: BlankBackgroundMode
  dynamicBlur: number  // 0 - 100
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
  imageAdjustEnabled: boolean
  saturationMax: number  // 1.0 = normal
  contrastMax: number    // 1.0 = normal
  dynamicAdjust: boolean
  dynamicAdjustDurationMs: number
  dynamicAdjustTimerSync: boolean  // タイマー同期
}

export type VignetteEffect = {
  enabled: boolean
  color: { r: number; g: number; b: number }  // デフォルト: ピンク
  alpha: number         // 0.0 - 1.0
  dynamic: boolean      // 動的ビネット有効
  dynamicFrom: number   // 開始透明度 0.0-1.0
  dynamicTo: number     // 終了透明度 0.0-1.0
  dynamicDurationMs: number  // 変化時間 ms
  dynamicTimerSync: boolean  // タイマー同期
}

export type BlurEffect = {
  enabled: boolean
  strength: number          // 0 - 100
  applyToAll: boolean       // true=全エフェクトにかける, false=画像のみ
  gradualEnabled: boolean   // 徐々に強度増加
  gradualDurationSec: number  // 最大3600秒
  gradualStartStrength: number
  gradualEndStrength: number
  gradualTimerSync: boolean  // タイマー同期
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
  timerSync: boolean        // タイマー同期
}

export type BreathingEffect = {
  enabled: boolean
  speedPxPerSec: number
  maxOffsetPx: number
  timerSync: boolean        // タイマー同期（移動上限をタイマー進捗に比例して適用）
  scaleEnabled: boolean
  scaleDurationSec: number
}

export type AssetDrawPattern = 'rising' | 'emergence'

export type AssetParticle = {
  id: string
  assetPath: string
  x: number
  y: number
  alpha: number
  vy: number  // 上昇速度（risingパターン用）
  startTime: number
  // emergenceパターン用フィールド
  baseScale?: number
  phase1DurationMs?: number
  phase2DurationMs?: number
}

export type DynamicAssetEffect = {
  enabled: boolean
  pattern: AssetDrawPattern
  assetPath: string | null
  assetPaths: string[]
  assetFolderPath: string | null
  spawnIntervalMs: number    // 生成間隔
  riseSpeedPx: number        // 上昇速度 px/frame
  maxParticles: number
  sizeRatio: number          // アセットサイズ倍率 0.1 - 3.0
  baseAlpha: number          // 初期透明度 0.0 - 1.0
  alphaTimerSync: boolean    // タイマー同期（透明度をタイマー進捗に比例して適用）
  emergenceSpeedFactor: number  // 発生パターンの速度係数 0.1 - 5.0 (1.0 = 標準)
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
  alphaTimerSync: boolean                   // タイマー同期（透明度をタイマー進捗に比例して適用）
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
  effectCompletionLeadSec: number
  endFlash: TimerEndFlashConfig
  preOverlay: TimerPreOverlayConfig
}

export type TimerEndFlashConfig = {
  enabled: boolean
  color: { r: number; g: number; b: number }
  maxTransparency: number
  count: number
  intervalSec: number
}

export type TimerPreOverlayConfig = {
  enabled: boolean
  imagePath: string | null
  displayStartSec: number  // タイマー終了x秒前から表示開始
  startOpacity: number     // 表示開始時の不透明度 (0-100)
  endOpacity: number       // 表示完了時の不透明度 (0-100)
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
  blankBackground?: BlankBackground
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  fullscreen: boolean
}

// ===== テキストリーダー =====

export type TextReaderWindowPosition = 'top' | 'bottom' | 'left' | 'right'
export type TextReaderPageAdvanceSpeed = 'slow' | 'normal' | 'fast'

export type TextReaderConfig = {
  windowPosition: TextReaderWindowPosition
  textDirection: 'horizontal' | 'vertical'
  fontFamily: string
  fontSize: 20 | 28 | 36
  charIntervalMs: number
  pageAdvanceSpeed: TextReaderPageAdvanceSpeed
  backgroundOpacity: number  // 0-100
  overlayOnImage: boolean    // false=画像エリアを縮小して重ならないように表示
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

export type AssetEffectFolder = {
  name: string
  path: string
  images: string[]
}

export type AssetEffectFoldersResult = {
  basePath?: string
  folders: AssetEffectFolder[]
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

export type OpenTextFileResult = {
  canceled: boolean
  filePath?: string
  text?: string
}

export type IpcApi = {
  openFolder: (language?: UiLanguage) => Promise<OpenFolderResult>
  readFolderPath: (folderPath: string) => Promise<OpenFolderResult>
  getPathForFile: (file: File) => string
  openAsset: (language?: UiLanguage) => Promise<OpenAssetResult>
  openOverlayImage: (language?: UiLanguage) => Promise<OpenAssetResult>
  openAssetFolder: (language?: UiLanguage) => Promise<OpenAssetResult>
  listAssetEffectFolders: () => Promise<AssetEffectFoldersResult>
  readImageAsBase64: (filePath: string) => Promise<string>
  saveProfile: (profile: AppProfile, language?: UiLanguage) => Promise<SaveProfileResult>
  loadProfile: (language?: UiLanguage) => Promise<LoadProfileResult>
  setFullscreen: (flag: boolean) => Promise<void>
  openDevTools: () => Promise<void>
  listSystemFonts: () => Promise<string[]>
  openTextFile: (language?: UiLanguage) => Promise<OpenTextFileResult>
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}
