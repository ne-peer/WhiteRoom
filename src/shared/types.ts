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
  source?: 'folder' | 'remote-image'
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
  /** 動的反映（開始／終了透明度と変化時間でオーバーレイ強度を変化） */
  dynamic: boolean
  dynamicFrom: number
  dynamicTo: number
  dynamicDurationMs: number
  dynamicTimerSync: boolean
  imageAdjustEnabled: boolean
  /** RGB 乗算。1.0 が無変更（暗く＜1、明るく＞1） */
  brightness: number
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
  /** 0-100。高いほど中央の透明域が狭くなり周辺が濃くなる */
  intensity: number
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
  radialCenterX: number     // 0.0 - 1.0
  radialCenterY: number     // 0.0 - 1.0
  radialSize: number        // 放射線状ブラー領域のサイズ係数
  radialHeight: number
}

export type EchoEffect = {
  enabled: boolean
  durationSec: number       // 繰り返し時間
  startAlpha: number        // 開始時の不透明度 0.0 - 1.0
  startScale: number        // 開始時の拡大率
  endScale: number          // 終了時の拡大率
  timerSync: boolean        // タイマー同期
}

export type FlashStartTransition = SlideShowTransition

/** フラッシュの開始／終了から削除済みの slide 系を旧データ互換でフェードへ読み替え */
export function normalizeDeprecatedFlashTransition(trans: SlideShowTransition): SlideShowTransition {
  if (trans === 'slide-left' || trans === 'slide-right' || trans === 'slide-up' || trans === 'slide-down') return 'fade'
  return trans
}

/** フラッシュの表示テクスチャの取得元（EffectsPanel の「表示ファイル」） */
export type FlashDisplayFileMode = 'pickFile' | 'displayCrop' | 'asset'

export function inferFlashDisplayFileMode(
  imagePath: string | null,
  vectorPresetId: string | null,
): FlashDisplayFileMode {
  if (vectorPresetId) return 'asset'
  if (imagePath?.startsWith('data:')) return 'displayCrop'
  return 'pickFile'
}

/** 同梱ベクター・プリセット ID（プロファイルにパスを書かない） */
export const DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART = 'builtin.heart.v1' as const

export type FlashEffect = {
  enabled: boolean
  /** UI: 表示ファイル。旧プロファイルは読み込み時に推定される */
  displayFileMode: FlashDisplayFileMode
  imagePath: string | null
  /** 非 null かつ対応プリセットのときは imagePath よりベクターアセットをフラッシュ表示に使用 */
  vectorPresetId: string | null
  /** 表示テクスチャの基準サイズに対する倍率（0.1–3.0） */
  scaleRatio: number
  colorOverlayColor: { r: number; g: number; b: number }
  colorOverlayAlpha: number
  colorOverlayAlphaRandomEnabled: boolean
  opacity: number
  /** フラッシュ表示中のブラー強度（0–100）。セルブラーと同様に Pixi BlurFilter の strength に渡す */
  blurStrength: number
  surroundingTransparency: number
  innerRadius: number
  /** オーバーレイ「表示フェーズ」の秒数（UI: 維持時間）。開始トランジションはこの区間の先頭で重なる。終了はこの区間の後。開始・終了アニメ時間からの減算とはしない。0 のときは CellRenderer が極小の内部下限を用いる */
  displayDurationSec: number
  intervalSec: number
  startTransition: FlashStartTransition
  startTransitionDurationSec: number
  endTransition: SlideShowTransition
  endTransitionDurationSec: number
}

export function normalizeFlashEffectTransitionFields(flash: FlashEffect): FlashEffect {
  const incoming = { ...(flash as unknown as Record<string, unknown>) }
  delete incoming.colorOverlayEnabled
  const base = incoming as FlashEffect

  const displayFileMode: FlashDisplayFileMode =
    base.displayFileMode === 'pickFile' ||
    base.displayFileMode === 'displayCrop' ||
    base.displayFileMode === 'asset'
      ? base.displayFileMode
      : inferFlashDisplayFileMode(base.imagePath, base.vectorPresetId)

  let vectorPresetId = base.vectorPresetId
  if (
    displayFileMode === 'asset' &&
    (vectorPresetId === null || vectorPresetId === undefined || vectorPresetId === '')
  ) {
    vectorPresetId = DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART
  }

  return {
    ...base,
    displayFileMode,
    vectorPresetId,
    startTransition: normalizeDeprecatedFlashTransition(base.startTransition) as FlashStartTransition,
    endTransition: normalizeDeprecatedFlashTransition(base.endTransition),
  }
}

export function sanitizeFlashEffectTransitionsInPlace(flash: FlashEffect): void {
  flash.startTransition = normalizeDeprecatedFlashTransition(flash.startTransition) as FlashStartTransition
  flash.endTransition = normalizeDeprecatedFlashTransition(flash.endTransition)
}

export function sanitizeFlashEffectInPlace(flash: FlashEffect): void {
  sanitizeFlashEffectTransitionsInPlace(flash)
  if (
    flash.displayFileMode !== 'pickFile' &&
    flash.displayFileMode !== 'displayCrop' &&
    flash.displayFileMode !== 'asset'
  ) {
    flash.displayFileMode = inferFlashDisplayFileMode(flash.imagePath, flash.vectorPresetId)
  }
  delete (flash as unknown as Record<string, unknown>).colorOverlayEnabled
  if (flash.displayFileMode === 'asset' && !flash.vectorPresetId) {
    flash.vectorPresetId = DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART
  }
}

export type BreathingEffect = {
  enabled: boolean
  speedPxPerSec: number
  maxOffsetPx: number
  timerSync: boolean        // タイマー同期（移動上限をタイマー進捗に比例して適用）
  scaleEnabled: boolean
  scaleDurationSec: number
}

export type ShakeEffect = {
  enabled: boolean
  mode: 'once' | 'loop'
  repeatEnabled: boolean
  repeatIntervalSec: number
  amplitudeFactor: number
  speedFactor: number
  timerSync: boolean
  loopAmplitudePx: number
  loopSpeedPxPerSec: number
  afterimageEnabled: boolean
  afterimageDurationSec: number
  manualTriggerNonce: number
  trailEnabled: boolean
  trailSecondStageEnabled: boolean
  trailSecondStageSize: number
  trailSecondStageDelayFactor: number
  trailDelaySec: number
  trailAlpha: number
  trailBlurStrength: number
  trailCenterX: number
  trailCenterY: number
  trailSize: number
  trailHeight: number
  /** 追従遅延の円エリアを、共通中心の左右に同サイズの2円として扱う */
  trailDuplicateCirclesEnabled: boolean
  /**
   * 左右の円中心までの距離の微調整。基準は外接配置（中心から各円中心までの距離 = 横半径 rx）とし、
   * その距離に対して -50%〜+50%（-0.5〜+0.5）を加味する（実距離 = rx × (1 + 値)）。
   */
  trailDuplicateSpacingShift: number
  /**
   * 複製した左右の円を上下交互にずらす量の調整。縦半径 ry を基準に -50%〜+50%（-0.5〜+0.5）。
   * 左円中心の Y オフセット = -ry×値、右円中心 = +ry×値（ピクセル）。
   */
  trailDuplicateVerticalSpacingShift: number
  lockBaseImage?: boolean
}

export type SquishEffect = {
  enabled: boolean
  mode: 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB'
  organicEnabled: boolean
  colorSource?: 'manual' | 'imageCenter'
  circleSizeRatio: number
  gapRatio: number
  color: { r: number; g: number; b: number }
  alpha: number
  opacity: number
  featherStrength: number
  speedFactor: number
  repeatEnabled: boolean
  repeatIntervalSec: number
  timerSync: boolean
  timerSyncStartOpacity: number
  timerSyncEndOpacity: number
  randomPosition: boolean
  burstEnabled?: boolean
  burstMaxOpacity?: number
  syncNonce?: number
  gapCorrectionEnabled?: boolean
  gapCorrectionScale?: number
  circlePositionY?: number
  circleGapFactor?: number
}

export type ZoomEffect = {
  enabled: boolean
  mode: 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB'
  speedFactor: number
  repeatEnabled: boolean
  repeatIntervalSec: number
  timerSync: boolean
  zoomFactor: number
  centerCorrection: boolean
  syncNonce?: number
}

export type FogEffect = {
  enabled: boolean
  color: { r: number; g: number; b: number }
  alpha: number
  timerSync: boolean
  timerSyncStartOpacity: number
  timerSyncEndOpacity: number
  fogCount: number
  fogSizeRatio: number
  blurStrength: number
  growDurationSec: number
  holdDurationSec: number
  fadeDurationSec: number
  dropletEnabled: boolean
  dropletCount: number
  dropletSpreadRatio: number
  repeatEnabled: boolean
  repeatIntervalSec: number
  randomPositionEnabled: boolean
}

export type AssetDrawPattern = 'rising' | 'emergence'
export type DynamicAssetAdditionalEffect = 'none' | 'jiggle' | 'bounce' | 'wiggle'

/** `.sut` に複数ティップがあるときのプール化（アセットエフェクトのラスタのみ）。 */
export type DynamicAssetSutTipMode = 'allTipsRandom' | 'firstTipOnly'

export type DynamicAssetSourceKind = 'raster' | 'vector'

/** アセットエフェクトの表示テクスチャ取得元（EffectsPanel の「表示ファイル」） */
export type DynamicAssetDisplayFileMode = 'asset' | 'pickImage'

export type AssetParticle = {
  id: string
  assetPath: string
  x: number
  y: number
  alpha: number
  vy: number  // 上昇速度（risingパターン用）
  startTime: number
  /** スポーン時に固定（アセット色・ランダム適用度をパーティクル存続中も一定に保つ） */
  particleTint: number
  rotationRad: number
  // emergenceパターン用フィールド
  baseScale?: number
  phase1DurationMs?: number
  phase2DurationMs?: number
}

export type DynamicAssetEffect = {
  enabled: boolean
  pattern: AssetDrawPattern
  /** UI: 表示ファイル。旧プロファイルは読み込み時に推定 */
  displayFileMode: DynamicAssetDisplayFileMode
  /** raster: assetPath(s) を使用。vector: vectorPresetId のみ（パスは保存・参照に使わない） */
  sourceKind: DynamicAssetSourceKind
  /** sourceKind === 'vector' のとき必須想定（未対応 ID は描画スキップ） */
  vectorPresetId: string | null
  assetPath: string | null
  assetPaths: string[]
  assetFolderPath: string | null
  spawnIntervalMs: number    // 生成間隔
  riseSpeedPx: number        // 上昇速度 px/frame
  riseSpeedFactor: number
  maxParticles: number
  featherStrength: number    // 0 - 100
  sizeRatio: number          // アセットサイズ倍率 0.1 - 3.0
  /** 表示サイズを基準としたランダム幅 ±0〜200%（0 でサイズランダムなし） */
  sizeRandomPercent: number
  baseAlpha: number          // 初期透明度 0.0 - 1.0
  alphaTimerSync: boolean    // タイマー同期（透明度をタイマー進捗に比例して適用）
  emergenceSpeedFactor: number  // 発生パターンの速度係数 0.1 - 5.0 (1.0 = 標準)
  additionalEffect: DynamicAssetAdditionalEffect
  additionalEffectSpeedFactor: number
  randomRotationEnabled: boolean
  colorOverlayEnabled: boolean
  colorOverlayColor: { r: number; g: number; b: number }
  colorOverlayAlpha: number
  /** アセット色 ON 時、色適用度をパーティクルごとにランダム（範囲は min/max） */
  colorOverlayAlphaRandomEnabled: boolean
  /** `colorOverlayAlphaRandomEnabled` 時の適用度ランダム下限 0–1 */
  colorOverlayAlphaRandomMin: number
  /** `colorOverlayAlphaRandomEnabled` 時の適用度ランダム上限 0–1 */
  colorOverlayAlphaRandomMax: number
  /**
   * `sourceKind === 'raster'` のとき、読み込んだ画像の RGB を反転（各チャンネル 255−値）。
   * アルファは変更しない（白文字↔黒文字の切り替え向け）。
   */
  rasterColorInvertEnabled: boolean
  /** `sourceKind === 'raster'` かつ `.sut` を含むとき、複数ティップをどうテクスチャプールに載せるか */
  sutTipMode: DynamicAssetSutTipMode
  /** true のとき、中心円の外側にのみエフェクトを描画する */
  peripheralOnlyEnabled: boolean
  /** 周辺のみモードの除外円半径。0–1（1 = min(w,h)/2 に相当） */
  peripheralOnlyRadius: number
}

export function normalizeDynamicAssetSutTipMode(mode: unknown): DynamicAssetSutTipMode {
  return mode === 'firstTipOnly' ? 'firstTipOnly' : 'allTipsRandom'
}

export function inferDynamicAssetDisplayFileMode(
  da: Pick<DynamicAssetEffect, 'sourceKind' | 'vectorPresetId' | 'assetPath' | 'assetFolderPath'> & {
    displayFileMode?: DynamicAssetDisplayFileMode
  },
  presetFolderBasenames: readonly string[],
): DynamicAssetDisplayFileMode {
  if (da.displayFileMode === 'asset' || da.displayFileMode === 'pickImage') return da.displayFileMode
  if (da.sourceKind === 'vector') return 'asset'
  if (da.sourceKind === 'raster' && da.assetPath && da.assetFolderPath) {
    const base = da.assetFolderPath.split(/[/\\]/).filter(Boolean).pop() ?? ''
    if (presetFolderBasenames.includes(base)) return 'asset'
    return 'pickImage'
  }
  if (da.sourceKind === 'raster' && da.assetPath) return 'pickImage'
  return 'asset'
}

/** プリセットフォルダ名一覧はビルド時の同梱アセットに依存するため、レンダラーから渡す */
export function normalizeDynamicAssetEffect(
  da: DynamicAssetEffect,
  presetFolderBasenames: readonly string[],
): DynamicAssetEffect {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const rawMin =
    typeof da.colorOverlayAlphaRandomMin === 'number' ? da.colorOverlayAlphaRandomMin : 0.4
  const rawMax =
    typeof da.colorOverlayAlphaRandomMax === 'number' ? da.colorOverlayAlphaRandomMax : 1
  let colorOverlayAlphaRandomMin = clamp01(rawMin)
  let colorOverlayAlphaRandomMax = clamp01(rawMax)
  if (colorOverlayAlphaRandomMin > colorOverlayAlphaRandomMax) {
    const t = colorOverlayAlphaRandomMin
    colorOverlayAlphaRandomMin = colorOverlayAlphaRandomMax
    colorOverlayAlphaRandomMax = t
  }

  const displayFileMode = inferDynamicAssetDisplayFileMode(da, presetFolderBasenames)
  const base: DynamicAssetEffect = {
    ...da,
    displayFileMode,
    sutTipMode: normalizeDynamicAssetSutTipMode(da.sutTipMode),
    colorOverlayAlphaRandomMin,
    colorOverlayAlphaRandomMax,
    rasterColorInvertEnabled: da.rasterColorInvertEnabled === true,
  }
  if (displayFileMode === 'pickImage') return base
  const folderBase = base.assetFolderPath?.split(/[/\\]/).filter(Boolean).pop() ?? ''
  const isVectorOk = base.sourceKind === 'vector' && !!base.vectorPresetId
  const isPresetRasterOk =
    base.sourceKind === 'raster' &&
    !!base.assetPath &&
    !!base.assetFolderPath &&
    presetFolderBasenames.includes(folderBase)
  if (isVectorOk || isPresetRasterOk) return base
  return {
    ...base,
    sourceKind: 'vector',
    vectorPresetId: base.vectorPresetId ?? DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART,
    assetPath: null,
    assetPaths: [],
    assetFolderPath: null,
  }
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
  effectCenter: {
    x: number
    y: number
  }
  colorOverlay: ColorOverlayEffect
  vignette: VignetteEffect
  spiral: {
    enabled: boolean
    color: { r: number; g: number; b: number }
    pattern: 'classic' | 'vortex'
    dualColorEnabled: boolean
    secondaryColor: { r: number; g: number; b: number }
    detail: number
    rotationSpeedDegPerSec: number
    alpha: number
    radialEnabled: boolean
    radialMode: 'center' | 'periphery'
    radialCenterX: number
    radialCenterY: number
    radialSize: number
    radialFadeStrength: number
    dynamic: boolean
    dynamicFrom: number
    dynamicTo: number
    dynamicDurationMs: number
    dynamicTimerSync: boolean
  }
  blur: BlurEffect
  echo: EchoEffect
  flash: FlashEffect
  breathing: BreathingEffect
  shake: ShakeEffect
  zoom: ZoomEffect
  squish: SquishEffect
  fog: FogEffect
  dynamicAsset: DynamicAssetEffect
  textEffect: TextEffect
}

// ===== タイマー =====

export type TimerPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type TimerPartialConfig = {
  enabled: boolean
  startSec: number   // カウントダウン開始秒数（合計時間の残り秒数）
  endSec: number     // カウントダウン終了秒数（残り秒数、0=最後まで）
}

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
  autoNext: TimerAutoNextConfig
  partial: TimerPartialConfig
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

export type TimerAutoNextConfig = {
  enabled: boolean
  delaySec: number  // タイマー終了後、自動遷移するまでの待機時間 (秒)
}

// ===== グリッド全体 =====

export type GridLayout = {
  cols: number  // 1-15
  rows: number  // 1-15
}

// ===== アプリ全体状態（プロファイルと同一構造）=====

export type StashItem = {
  id: string
  emoji: string
  color: string        // hex アクセントカラー（例: '#f59e0b'）
  savedAt: string      // ISO 日時
  blankColor: BlankColor
  blankBackground?: BlankBackground
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  textReaderConfig: TextReaderConfig
  textReaderFilePath: string | null
  textReaderPageIndex: number
}

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
  windowSize?: WindowSize
  showControls?: boolean
  stashes?: StashItem[]
}

// ===== ストーリーボードタグ =====

export type StoryboardSimpleTag = {
  kind: 'simple'
  // Absolute path, text-file-relative path, file URL, data URL, or direct http(s) image URL.
  image: string
}

export type StoryboardRichTagPayload = {
  // Absolute path, text-file-relative path, file URL, data URL, or direct http(s) image URL.
  image: string
  effects: Partial<CellEffects>
  progress?: { enabled: boolean; pages: number }
  timer?: Partial<SavedTimerConfig>
}

export type StoryboardRichTag = {
  kind: 'rich'
  version: string
  payload: StoryboardRichTagPayload
}

export type StoryboardTag = StoryboardSimpleTag | StoryboardRichTag

export type TagEntry = {
  segmentIndex: number   // トリガーする cleanSegments のインデックス
  tag: StoryboardTag
}

export type CellBaseline = {
  cellId: string
  overrideImage: string | null
  effects: CellEffects
}

// ===== テキストリーダー =====

export type TextReaderWindowPosition = 'top' | 'bottom' | 'left' | 'right'
export type TextReaderPageAdvanceSpeed = 'slow' | 'normal' | 'fast'

export type TextReaderConfig = {
  windowPosition: TextReaderWindowPosition
  textDirection: 'horizontal' | 'vertical'
  textWindowWidthPercent: number
  textWindowMaxWidthPx: number
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
  tempFilePath?: string
  text?: string
}

export type SaveTextFileResult = {
  success: boolean
  error?: string
}

// タイマー設定のうち保存対象（elapsedSec・running はセッション状態のため除外）
export type SavedTimerConfig = Omit<TimerConfig, 'elapsedSec' | 'running'>

export type ImageEffectProfileEntry = {
  image: string
  effects: Partial<CellEffects>
  timer?: Partial<SavedTimerConfig>
}

export type ImageEffectProfileDocument = {
  version: string
  updatedAt: string
  entries: Record<string, ImageEffectProfileEntry>
}

export type LoadImageEffectProfileResult = {
  success: boolean
  profile?: ImageEffectProfileDocument
  exists: boolean
  error?: string
}

export type SaveImageEffectProfileResult = {
  success: boolean
  profile?: ImageEffectProfileDocument
  filePath?: string
  error?: string
}

export type CleanupTextReaderTempFileResult = {
  success: boolean
  error?: string
}

export type RemoteImageResult = {
  success: boolean
  dataUrl?: string
  contentType?: string
  limitExceeded?: boolean
  error?: string
}

export type RemoteImageStatsResult = {
  pixivUniqueImageCount: number
  pixivUniqueImageLimit: number
}

export type WindowSize = {
  width: number
  height: number
}

export type ReadingConfigPayload = {
  windowSize: WindowSize
  textReader: TextReaderConfig
  showControls: boolean
}

export type ResolveRasterSourceEntry = {
  loadablePaths: string[]
  sourceFingerprint: string
}

export type ResolveRasterSourcePathsResult =
  | { kind: 'ok'; entries: ResolveRasterSourceEntry[] }
  | { kind: 'error'; message: string }

export type IpcApi = {
  openFolder: (language?: UiLanguage) => Promise<OpenFolderResult>
  readFolderPath: (folderPath: string) => Promise<OpenFolderResult>
  getPathForFile: (file: File) => string
  openAsset: (language?: UiLanguage) => Promise<OpenAssetResult>
  openOverlayImage: (language?: UiLanguage) => Promise<OpenAssetResult>
  openAssetFolder: (language?: UiLanguage) => Promise<OpenAssetResult>
  listAssetEffectFolders: () => Promise<AssetEffectFoldersResult>
  readImageAsBase64: (filePath: string) => Promise<string>
  resolveRasterSourcePaths: (paths: string[]) => Promise<ResolveRasterSourcePathsResult>
  saveProfile: (profile: AppProfile, language?: UiLanguage) => Promise<SaveProfileResult>
  loadProfile: (language?: UiLanguage) => Promise<LoadProfileResult>
  loadProfileFromPath: (filePath: string) => Promise<LoadProfileResult>
  openTextFileDirect: (filePath: string) => Promise<OpenTextFileResult>
  setFullscreen: (flag: boolean) => Promise<void>
  resetWindowSize: () => Promise<void>
  getWindowSize: () => Promise<WindowSize>
  setWindowSize: (width: number, height: number) => Promise<void>
  openExternal: (url: string) => Promise<void>
  openDevTools: () => Promise<void>
  listSystemFonts: () => Promise<string[]>
  openTextFile: (language?: UiLanguage) => Promise<OpenTextFileResult>
  saveTextFile: (filePath: string, content: string) => Promise<SaveTextFileResult>
  loadImageEffectProfile: (folderPath: string) => Promise<LoadImageEffectProfileResult>
  saveImageEffectProfile: (
    folderPath: string,
    imagePath: string,
    effects: Partial<CellEffects>,
    timer?: Partial<SavedTimerConfig>
  ) => Promise<SaveImageEffectProfileResult>
  cleanupTextReaderTempFile: (tempFilePath: string) => Promise<CleanupTextReaderTempFileResult>
  loadRemoteImageAsDataUrl: (url: string) => Promise<RemoteImageResult>
  getRemoteImageStats: () => Promise<RemoteImageStatsResult>
  checkHasStash: () => Promise<boolean>
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void
}
