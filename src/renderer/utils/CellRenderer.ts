import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { BlankBackground, BlurEffect, BreathingEffect, CellEffects, ColorOverlayEffect, EchoEffect, ImageFitMode, IpcApi, FogEffect, ShakeEffect, SlideShowTransition, SquishEffect, ZoomEffect } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem,
  TextSystem,
  tintFromAssetColorOverlay,
} from './pixiEffects'
import {
  BUILTIN_VECTOR_FLASH_RASTER_GEOMETRY_SCALE,
  isBuiltinVectorDynamicAssetPreset,
  createVectorDynamicAssetDisplay,
} from './vectorStampRegistry'
import { createFlashRadialFadeFilter, setFlashRadialFadeUniforms } from './flashRadialFadeFilter'

/** ズームイン／アウトで新規レイヤーを完全透明から表示へ切り替える時間（秒） */
const ZOOM_TRANSITION_ALPHA_IN_SEC = 0.5

/** 維持時間が 0 のときの表示フェーズ下限（秒）。状態遷移用の極小値（開始トランジション長とは独立） */
const FLASH_DISPLAY_PHASE_MIN_SEC = 0.0001

type SquishOrganicShape = {
  radiusXScale: number
  radiusYScale: number
  sizeScale: number
}

type DrawableImageSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | OffscreenCanvas

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

  // 画像系レイヤーをまとめてカラーマトリクス（トーン）フィルタを掛けるラッパー。
  // この中身全体に対してフィルタを適用することで、シェイク追従や放射状ブラーなど
  // 画像から派生した描画にも均一にトーンフィルタが反映される。
  private imageRootLayer: PIXI.Container
  private dynamicBackgroundLayer: PIXI.Container
  private imageLayer: PIXI.Container
  private shakeTrailLayer: PIXI.Container
  private echoLayer: PIXI.Container
  private effectsLayer: PIXI.Container
  private overlayLayer: PIXI.Container
  private particleContainer: PIXI.Container
  private textLayer: PIXI.Container
  private vignetteLayer: PIXI.Container
  private spiralLayer: PIXI.Container
  private guideLayer: PIXI.Container
  private coverLayer: PIXI.Container

  private imageSprite: PIXI.Sprite | null = null
  private dynamicBackgroundSprite: PIXI.Sprite | null = null
  private dynamicBackgroundTransitionSprite: PIXI.Sprite | null = null
  private dynamicBackgroundTransitionTween: gsap.core.Tween | null = null
  private dynamicBackgroundBlurFilter: PIXI.BlurFilter | null = null
  private blankBackground: BlankBackground = { mode: 'color', dynamicBlur: 30 }
  private dynamicBackgroundMask: PIXI.Graphics
  private imageMask: PIXI.Graphics
  private echoMask: PIXI.Graphics
  private colorOverlayGraphics: PIXI.Graphics
  private squishGraphics: PIXI.Graphics
  private squishBlurFilter: PIXI.BlurFilter | null = null
  private echoSprite: PIXI.Sprite | null = null
  private flashOverlaySprite: PIXI.Sprite | null = null
  private flashOwnedTexture: PIXI.Texture | null = null
  private flashOverlayVisible = false
  private flashElapsedSec = 0
  private flashCycleDurationSec = 0
  private flashTextureKey: string | null = null
  private flashTextureLoadingKey: string | null = null
  private flashTextureRequestNonce = 0
  private flashCurrentShowNonce = 0
  private flashCurrentHideNonce = 0
  private flashStartTween: gsap.core.Tween | gsap.core.Timeline | null = null
  private flashEndTween: gsap.core.Tween | null = null
  private flashStartProxy:
    | {
        incomingOffsetX: number
        incomingOffsetY: number
        outgoingOffsetX: number
        outgoingOffsetY: number
        incomingScaleMultiplier: number
      }
    | null = null
  private flashEndProxy:
    | {
        incomingOffsetX: number
        incomingOffsetY: number
        outgoingOffsetX: number
        outgoingOffsetY: number
        outgoingScaleMultiplier: number
      }
    | null = null
  private flashOverlayEffect: import('../../shared/types').FlashEffect | null = null
  private flashBaseOpacity = 1
  private flashRadialFadeFilter: PIXI.Filter | null = null
  private flashBlurFilter: PIXI.BlurFilter | null = null
  private vignetteSprite: PIXI.Sprite | null = null
  private vignetteTextureKey: string | null = null
  private fogLayer: PIXI.Container
  private fogBlobContainer: PIXI.Container
  private fogKey: string | null = null
  private fogGradientTexture: PIXI.Texture | null = null
  private fogInstances: Array<{
    container: PIXI.Container
    blobContainer: PIXI.Container
    dropletGraphics: PIXI.Graphics
    centerXRatio: number
    centerYRatio: number
    elapsedSec: number
    blobs: Array<{ sprite: PIXI.Sprite; offsetX: number; offsetY: number; phaseDelaySec: number }>
    dropletPositions: Array<{ x: number; y: number; rx: number; ry: number; baseAlpha: number }>
    blobBlurFilter: PIXI.BlurFilter | null
    dropletBlurFilter: PIXI.BlurFilter | null
  }> = []
  private fogSpawnAccumulatorSec = 0

  private spiralGraphics: PIXI.Graphics
  private spiralMaskSprite: PIXI.Sprite | null = null
  private spiralMaskKey: string | null = null
  private spiralMaskFilter: PIXI.MaskFilter | null = null
  private spiralDrawKey: string | null = null
  private spiralRotationRad = 0
  private spiralAlphaDynamicProgress = 0
  private radialBlurLayers: PIXI.Container[] = []
  private radialBlurMaskSprites: PIXI.Sprite[] = []
  private radialBlurImageClones: PIXI.Sprite[] = []
  private shakeTrailSprite: PIXI.Sprite | null = null
  private shakeTrailMaskSprite: PIXI.Sprite | null = null
  private shakeTrailBlurFilter: PIXI.BlurFilter | null = null
  private shakeTrailFirstLayer: PIXI.Container | null = null
  private shakeTrailSecondLayer: PIXI.Container | null = null
  private shakeTrailSecondSprite: PIXI.Sprite | null = null
  private shakeTrailSecondMaskSprite: PIXI.Sprite | null = null
  private shakeTrailSecondBlurFilter: PIXI.BlurFilter | null = null
  private shakeTrailKey: string | null = null
  private radialBlurGuideKey: string | null = null
  private shakeTrailFirstGuideKey: string | null = null
  private shakeTrailSecondGuideKey: string | null = null
  private shakeTrailGuideGraphics: PIXI.Graphics | null = null
  private shakeTrailGuideRemainingSec = 0
  private shakeTrailGuideMode: 'radial' | 'first' | 'second' = 'first'
  private shakeTrailSamples: { timeSec: number; offsetY: number }[] = []
  private shakeTrailFirstStageSamples: { timeSec: number; offsetY: number }[] = []
  private shakeTrailElapsedSec = 0
  private shakeTrailSmoothedOffsetY: number | null = null
  private shakeTrailSecondSmoothedOffsetY: number | null = null
  private particleSystem: ParticleSystem
  private textSystem: TextSystem

  private width: number
  private height: number

  private vignetteGsapTween: gsap.core.Tween | null = null
  private vignetteAnimationKey: string | null = null
  private blurFilter: PIXI.BlurFilter | null = null
  private imageLayerBlurFilter: PIXI.BlurFilter | null = null
  private radialBlurFilters: { filter: PIXI.BlurFilter; multiplier: number }[] = []
  private blurGsapTween: gsap.core.Tween | null = null
  private blurAnimationKey: string | null = null
  private colorMatrixFilter: PIXI.ColorMatrixFilter | null = null
  private colorAdjustGsapTween: gsap.core.Tween | null = null
  private colorAdjustAnimationKey: string | null = null
  private colorTintGsapTween: gsap.core.Tween | null = null
  private colorTintAnimationKey: string | null = null
  private echoGsapTween: gsap.core.Tween | null = null
  private echoAnimationKey: string | null = null
  private echoProgressProxy: { progress: number } | null = null
  private breathingKey: string | null = null
  private breathingOffsetX = 0
  private breathingOffsetY = 0
  private breathingDirectionX = 1
  private breathingDirectionY = 1
  private breathingScalePhase = 0
  private shakeKey: string | null = null
  private shakeOffsetY = 0
  private shakeLoopDirection = -1
  private shakeOnceInitialized = false
  private shakeOnceSegmentElapsedSec = 0
  private shakeOnceSegmentStartY = 0
  private shakeOnceSegmentTargetY = 0
  private shakeOnceSegmentCount = 0
  private shakeRepeatElapsedSec = 0
  private shakeLoopSegmentElapsedSec = 0
  private shakeLoopSegmentStartY = 0
  private shakeAfterimages: { sprite: PIXI.Sprite; ageSec: number; durationSec: number }[] = []
  private shakeAfterimagePending = false
  private squishKey: string | null = null
  private squishElapsedSec = 0
  private squishCycleComplete = false
  private squishOrganicShape: SquishOrganicShape | null = null
  private squishPrevOrganicShape: SquishOrganicShape | null = null
  private squishRandomPosition: { x: number; y: number } | null = null
  private squishBurstGraphics: PIXI.Graphics
  private squishBurstActiveSec: number | null = null
  private squishBurstTriggeredThisCycle = false
  private squishBurstCenters: { x: number; y: number }[] = []
  private squishBurstRadius = 0
  private squishBurstBlurFilter: PIXI.BlurFilter | null = null
  private zoomKey: string | null = null
  private zoomElapsedSec = 0
  private zoomCycleComplete = false
  private zoomScaleMultiplier = 1
  private zoomCenterOffsetX = 0
  private zoomCenterOffsetY = 0
  private activeSlideTransition: {
    incoming: PIXI.Sprite
    outgoing: PIXI.Sprite
    incomingOffsetX: number
    incomingOffsetY: number
    outgoingOffsetX: number
    outgoingOffsetY: number
  } | null = null
  private activeZoomTransition: {
    incoming: PIXI.Sprite
    outgoing: PIXI.Sprite
    incomingScaleMultiplier: number
  } | null = null

  private assetTexture: PIXI.Texture | null = null
  private assetTexturesKey: string | null = null
  private assetPath: string | null = null
  private currentImageSrc: string | null = null
  private requestedImageSrc: string | null = null
  private imageFit: ImageFitMode = 'cover'
  private transitionSprite: PIXI.Sprite | null = null
  private imageTransitionTween: gsap.core.Tween | null = null
  private imageRequestToken = 0
  private latestEffects: CellEffects | null = null
  private effectResetTimeoutId: number | null = null

  // タイマー同期用
  private timerProgress = 0   // 0.0-1.0
  private timerEnabled = false
  private timerRunning = false

  // ストーリーボード進行スケール（null = 非アクティブ）
  private storyboardScale: number | null = null
  private storyboardScaleActive = false

  constructor(cellId: string, width: number, height: number, private readonly pixiRenderer: PIXI.Renderer) {
    this.cellId = cellId
    this.width = width
    this.height = height

    this.container = new PIXI.Container()
    this.container.eventMode = 'static'
    this.container.cursor = 'pointer'
    this.updateHitArea()

    this.imageRootLayer = new PIXI.Container()
    this.dynamicBackgroundLayer = new PIXI.Container()
    this.imageLayer = new PIXI.Container()
    this.shakeTrailLayer = new PIXI.Container()
    this.echoLayer = new PIXI.Container()
    this.effectsLayer = new PIXI.Container()
    this.overlayLayer = new PIXI.Container()
    this.particleContainer = new PIXI.Container()
    this.textLayer = new PIXI.Container()
    this.vignetteLayer = new PIXI.Container()
    this.spiralLayer = new PIXI.Container()
    this.fogLayer = new PIXI.Container()
    this.fogBlobContainer = new PIXI.Container()
    this.guideLayer = new PIXI.Container()
    this.coverLayer = new PIXI.Container()
    this.dynamicBackgroundMask = new PIXI.Graphics()
    this.imageMask = new PIXI.Graphics()
    this.echoMask = new PIXI.Graphics()

    // 画像系レイヤーは imageRootLayer 配下にまとめ、トーンフィルタを共通適用する。
    // シェイク追従や放射状ブラーなどの動的レイヤーも imageRootLayer に挿入する。
    this.imageRootLayer.addChild(this.dynamicBackgroundLayer)
    this.imageRootLayer.addChild(this.imageLayer)
    this.imageRootLayer.addChild(this.shakeTrailLayer)
    this.imageRootLayer.addChild(this.echoLayer)
    this.imageRootLayer.addChild(this.effectsLayer)
    this.imageRootLayer.addChild(this.echoMask)

    this.container.addChild(this.imageRootLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)
    this.container.addChild(this.textLayer)
    this.container.addChild(this.vignetteLayer)
    this.container.addChild(this.spiralLayer)
    this.container.addChild(this.fogLayer)
    this.container.addChild(this.guideLayer)
    this.container.addChild(this.coverLayer)

    this.dynamicBackgroundLayer.addChild(this.dynamicBackgroundMask)
    this.dynamicBackgroundLayer.mask = this.dynamicBackgroundMask
    this.imageLayer.addChild(this.imageMask)
    this.imageLayer.mask = this.imageMask
    this.echoLayer.mask = this.echoMask
    this.redrawDynamicBackgroundMask()
    this.redrawImageMask()
    this.redrawEchoMask()

    this.colorOverlayGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.colorOverlayGraphics)
    this.squishBurstGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.squishBurstGraphics)
    this.squishGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.squishGraphics)
    this.spiralGraphics = new PIXI.Graphics()
    this.spiralLayer.addChild(this.spiralGraphics)

    this.fogLayer.addChild(this.fogBlobContainer)

    this.particleSystem = new ParticleSystem(this.particleContainer, this.pixiRenderer)
    this.textSystem = new TextSystem(this.textLayer)
    this.textSystem.resizeMask(width, height)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.updateHitArea()
    this.redrawDynamicBackgroundMask()
    this.repositionDynamicBackground()
    this.repositionImage()
    this.redrawImageMask()
    this.redrawEchoMask()
    this.refreshEcho()
    this.refreshShakeTrailRegion()
    this.rebuildVignette()
    this.clearSpiralMask()
    this.refreshBlurRegion()
    this.setImageLayerFilters()
    // カラーフィルタ（オーバーレイ）のサイズはセルサイズに依存するため再描画する。
    // ウィンドウモード→フルスクリーン切り替え時に矩形が前のサイズで残るのを防ぐ。
    if (this.latestEffects) this.updateColorOverlay(this.latestEffects)
    this.textSystem.resizeMask(width, height)
    this.positionFlashOverlaySprite()
    if (this.latestEffects) this.updateSpiral(this.latestEffects)
  }

  private updateHitArea() {
    this.container.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height)
  }

  setImageFit(imageFit: ImageFitMode = 'cover') {
    if (this.imageFit === imageFit) return
    this.imageFit = imageFit
    this.repositionImage()
    this.refreshEcho()
    this.refreshShakeTrailRegion()
    this.refreshBlurRegion()
  }

  configureBlankBackground(blankBackground: BlankBackground) {
    const previousMode = this.blankBackground.mode
    this.blankBackground = {
      mode: blankBackground.mode,
      dynamicBlur: clamp(blankBackground.dynamicBlur, 0, 100),
    }

    this.dynamicBackgroundLayer.visible = this.blankBackground.mode === 'dynamic'
    this.updateDynamicBackgroundBlur()

    if (this.blankBackground.mode === 'dynamic') {
      if (!this.dynamicBackgroundSprite && this.imageSprite) {
        this.swapDynamicBackgroundSprite(new PIXI.Sprite(this.imageSprite.texture))
      }
      this.repositionDynamicBackground()
      return
    }

    if (previousMode === 'dynamic') {
      this.clearDynamicBackground()
    }
  }

  getNormalizedPointFromGlobal(global: PIXI.PointData) {
    const local = this.container.toLocal(global)
    return {
      x: clamp(local.x / this.width, 0, 1),
      y: clamp(local.y / this.height, 0, 1),
    }
  }

  isCurrentImage(src: string): boolean {
    return this.currentImageSrc === toFileUrl(src)
  }

  getImageCenterColor(): { r: number; g: number; b: number } | null {
    if (!this.imageSprite) return null
    return sampleTextureCenterColor(this.imageSprite.texture)
  }

  async setImage(src: string, transition: SlideShowTransition = 'none', transitionDurationMs = 350) {
    const url = toFileUrl(src)
    if (url === this.currentImageSrc || url === this.requestedImageSrc) return
    this.requestedImageSrc = url
    const requestToken = ++this.imageRequestToken

    if (!src) {
      this.clearTransitionSprite()
      this.swapImageSprite(null, null)
      this.clearDynamicBackground()
      this.resetShakeMotion()
      this.clearShakeAfterimages()
      this.clearShakeTrail()
      this.refreshEcho()
      this.refreshBlurRegion()
      return
    }

    let texture: PIXI.Texture
    try {
      const loadableUrl = await toLoadableImageUrl(url)
      if (this.requestedImageSrc !== url || requestToken !== this.imageRequestToken) return
      texture = await PIXI.Assets.load(loadableUrl)
    } catch {
      if (this.requestedImageSrc === url) this.requestedImageSrc = null
      return
    }
    if (this.requestedImageSrc !== url || requestToken !== this.imageRequestToken) return

    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)

    if (!this.imageSprite || transition === 'none') {
      this.clearTransitionSprite()
      this.swapImageSprite(sprite, url)
      if (this.blankBackground.mode === 'dynamic') {
        this.swapDynamicBackgroundSprite(new PIXI.Sprite(texture))
      }
      this.positionImageSprite(sprite)
      this.resetShakeMotion()
      this.refreshEcho()
      this.refreshShakeTrailRegion()
      this.refreshBlurRegion()
      return
    }

    this.startImageTransition(sprite, url, transition, transitionDurationMs)
  }

  updateEffects(effects: CellEffects, showCircleGuides = false) {
    this.latestEffects = effects
    this.updateBreathing(effects.breathing)
    this.updateShake(effects.shake, showCircleGuides)
    this.updateColorOverlay(effects)
    this.updateColorOverlayTint(effects)
    this.updateBlur(effects, showCircleGuides)
    this.updateColorAdjustment(effects.colorOverlay)
    this.updateVignette(effects)
    this.updateSpiral(effects)
    this.updateEcho(effects)
    this.updateFlash(effects)
    this.updateZoom(effects.zoom)
    this.updateSquish(effects.squish)
    this.updateFog(effects.fog)
    this.updateAsset(effects)
    this.updateText(effects)
  }

  resetEffectTiming(effects: CellEffects, withRandomDelay = false) {
    // ビネット・ブラー・エコー・ブリージング・テキストの開始タイミングをリセット
    const maxTextChars = effects.textEffect.enabled
      ? Math.max(0, ...effects.textEffect.texts.map(text => Array.from(text.trim()).length))
      : 0
    const textDurationMs = maxTextChars > 0
      ? maxTextChars * effects.textEffect.charIntervalMs +
        effects.textEffect.displayDurationMs +
        effects.textEffect.intervalMs
      : 0
    const durationMs = Math.max(
      effects.vignette.dynamicDurationMs,
      effects.spiral.dynamicDurationMs,
      effects.colorOverlay.dynamicDurationMs,
      effects.colorOverlay.dynamicAdjustDurationMs,
      effects.blur.gradualDurationSec * 1000,
      effects.echo.durationSec * 1000,
      (effects.breathing?.scaleDurationSec ?? 1) * 1000,
      this.getShakeCycleDurationMs(effects.shake),
      this.getSquishCycleDurationMs(effects.squish),
      this.getFogCycleDurationMs(effects.fog),
      textDurationMs,
      1000
    )
    const delay = withRandomDelay ? Math.random() * durationMs : 0
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.colorAdjustGsapTween?.kill()
    this.colorTintGsapTween?.kill()
    this.echoGsapTween?.kill()
    this.flashStartTween?.kill()
    this.flashEndTween?.kill()
    this.resetBreathingMotion(withRandomDelay)
    this.resetShakeMotion()
    this.resetSquishMotion()
    this.clearFog(false)
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }
    this.vignetteGsapTween = null
    this.blurGsapTween = null
    this.colorAdjustGsapTween = null
    this.colorTintGsapTween = null
    this.echoGsapTween = null
    this.flashStartTween = null
    this.flashEndTween = null
    this.vignetteAnimationKey = null
    this.spiralAlphaDynamicProgress = 0
    this.blurAnimationKey = null
    this.colorAdjustAnimationKey = null
    this.colorTintAnimationKey = null
    this.echoAnimationKey = null
    this.clearFlashOverlay()
    this.breathingKey = null
    this.shakeKey = null
    this.squishKey = null
    this.fogKey = null
    this.textSystem.stop()
    if (delay > 0) {
      const timeoutId = window.setTimeout(() => {
        this.effectResetTimeoutId = null
        this.updateEffects(effects)
      }, delay)
      this.effectResetTimeoutId = timeoutId
    } else {
      this.updateEffects(effects)
    }
  }

  resetVignetteBlurEchoTiming(effects: CellEffects) {
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }

    if (effects.vignette.enabled && effects.vignette.dynamic) {
      this.vignetteGsapTween?.kill()
      this.vignetteGsapTween = null
      this.vignetteAnimationKey = null
    }
    if (effects.spiral.enabled && effects.spiral.dynamic) {
      this.spiralAlphaDynamicProgress = 0
    }

    if (effects.colorOverlay.enabled && effects.colorOverlay.dynamic) {
      this.colorTintGsapTween?.kill()
      this.colorTintGsapTween = null
      this.colorTintAnimationKey = null
    }
    if (effects.colorOverlay.imageAdjustEnabled && effects.colorOverlay.dynamicAdjust) {
      this.colorAdjustGsapTween?.kill()
      this.colorAdjustGsapTween = null
      this.colorAdjustAnimationKey = null
    }

    if (effects.blur.enabled && effects.blur.gradualEnabled) {
      this.blurGsapTween?.kill()
      this.blurGsapTween = null
      this.blurAnimationKey = null
    }

    if (effects.echo.enabled) {
      this.echoGsapTween?.kill()
      this.echoGsapTween = null
      this.echoAnimationKey = null
    }

    this.latestEffects = effects
    this.updateVignette(effects)
    this.updateSpiral(effects)
    this.updateBlur(effects)
    this.updateColorAdjustment(effects.colorOverlay)
    this.updateEcho(effects)
    this.updateFlash(effects)
  }

  applyTimerProgress(effects: CellEffects, enabled: boolean, running: boolean, progress: number) {
    this.timerEnabled = enabled
    this.timerRunning = running
    this.timerProgress = progress

    // ビネット（動的ビネット＋タイマー同期）
    const vig = effects.vignette
    if (vig.enabled && vig.dynamic && vig.dynamicTimerSync && this.vignetteSprite?.visible) {
      this.vignetteSprite.alpha = vig.dynamicFrom + (vig.dynamicTo - vig.dynamicFrom) * progress
    }

    // カラーフィルタ（動的反映＋タイマー同期）
    const co = effects.colorOverlay
    if (co.enabled && co.dynamic && co.dynamicTimerSync) {
      this.colorOverlayGraphics.alpha =
        co.dynamicFrom + (co.dynamicTo - co.dynamicFrom) * progress
    }

    // 画像強調フィルタ（動的強調＋タイマー同期）
    const spiral = effects.spiral
    if (spiral.enabled && spiral.dynamic && spiral.dynamicTimerSync) {
      this.applySpiralAlpha(effects, progress)
    }

    if (co.imageAdjustEnabled && co.dynamicAdjust && co.dynamicAdjustTimerSync && this.colorMatrixFilter) {
      this.applyColorMatrix(co, progress)
    }

    // ブラー（徐々に増加＋タイマー同期）
    const blur = effects.blur
    if (blur.enabled && blur.gradualEnabled && blur.gradualTimerSync) {
      const strength = blur.gradualStartStrength + (blur.gradualEndStrength - blur.gradualStartStrength) * progress
      if (this.radialBlurFilters.length > 0) {
        this.radialBlurFilters.forEach(({ filter, multiplier }) => { filter.strength = strength * multiplier })
      } else if (this.blurFilter) {
        this.blurFilter.strength = strength
      }
    }

    // テキスト・アセット・エコー・ブリージングはtimerProgressを参照する各メソッドで反映
    this.textSystem.setTimerProgress(progress)
    this.particleSystem.setTimerProgress(progress)

    // タイマー同期なし効果へのストーリーボードスケール適用
    this.applyStoryboardScaleToEffects(effects)
  }

  // ストーリーボード進行スケールの設定（tickerから毎フレーム呼び出す）
  setStoryboardScale(scale: number | null) {
    if (!this.storyboardScaleActive && scale !== null) {
      // 開始: GSAP停止・アニメーションキーリセット（次のupdateEffectsでGSAPスキップ）
      this.storyboardScaleActive = true
      this.vignetteGsapTween?.kill()
      this.vignetteGsapTween = null
      this.blurGsapTween?.kill()
      this.blurGsapTween = null
      this.colorTintGsapTween?.kill()
      this.colorTintGsapTween = null
    } else if (this.storyboardScaleActive && scale === null) {
      // 終了: キーリセットで次のupdateEffects呼び出し時にGSAP再起動
      this.storyboardScaleActive = false
      this.vignetteAnimationKey = null
      this.blurAnimationKey = null
      this.colorTintAnimationKey = null
    }
    this.storyboardScale = scale
  }

  private applyStoryboardScaleToEffects(effects: CellEffects) {
    const scale = this.storyboardScale
    if (scale === null) return

    // ビネット（timerSync 以外）
    const vig = effects.vignette
    if (vig.enabled && this.vignetteSprite?.visible && !(vig.dynamic && vig.dynamicTimerSync)) {
      const target = vig.dynamic ? vig.dynamicTo : vig.alpha
      this.vignetteSprite.alpha = target * scale
    }
    if (effects.spiral.enabled && !(effects.spiral.dynamic && effects.spiral.dynamicTimerSync)) {
      const target = effects.spiral.dynamic ? effects.spiral.dynamicTo : effects.spiral.alpha
      this.spiralGraphics.alpha = clamp(target * scale, 0, 1)
    }

    // カラーフィルタ（タイマー同期の動的反映中はストーリーボードで上書きしない）
    const coSb = effects.colorOverlay
    if (coSb.enabled && !(coSb.dynamic && coSb.dynamicTimerSync)) {
      const target = coSb.dynamic ? coSb.dynamicTo : coSb.alpha
      this.colorOverlayGraphics.alpha = target * scale
    }

    // ブラー（timerSync 以外）
    const blur = effects.blur
    if (blur.enabled && !(blur.gradualEnabled && blur.gradualTimerSync)) {
      const target = blur.gradualEnabled ? blur.gradualEndStrength : blur.strength
      const s = target * scale
      if (this.radialBlurFilters.length > 0) {
        this.radialBlurFilters.forEach(({ filter, multiplier }) => { filter.strength = s * multiplier })
      } else if (this.blurFilter) {
        this.blurFilter.strength = s
      }
    }
  }

  tick(delta: number, effects: CellEffects) {
    this.tickBreathing(delta, effects.breathing)
    this.tickShake(delta, effects.shake)
    this.tickZoom(delta, effects.zoom)
    this.recordShakeTrailSample(delta, effects.shake)
    this.applyImageMotionTransform()
    this.syncShakeTrail(delta, effects.shake)
    this.updateShakeTrailGuide(delta)
    this.createPendingShakeAfterimage(effects.shake)
    this.updateShakeAfterimages(delta)
    this.tickSquish(delta, effects.squish)
    this.tickFog(delta, effects.fog)
    this.syncRadialBlurClones()
    this.syncEchoToImage()
    this.updateFlashCycle(delta)
    this.tickSpiral(delta, effects)
    this.particleSystem.update(
      delta,
      this.width,
      this.height,
      effects,
      performance.now()
    )
  }

  showImageCover(show: boolean) {
    this.coverLayer.removeChildren()
    if (!show || !this.imageSprite) return
    const sprite = new PIXI.Sprite(this.imageSprite.texture)
    sprite.anchor.set(0.5)
    sprite.x = this.imageSprite.x
    sprite.y = this.imageSprite.y
    sprite.scale.copyFrom(this.imageSprite.scale)
    this.coverLayer.addChild(sprite)
  }

  destroy() {
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.colorAdjustGsapTween?.kill()
    this.colorTintGsapTween?.kill()
    this.echoGsapTween?.kill()
    this.imageTransitionTween?.kill()
    this.dynamicBackgroundTransitionTween?.kill()
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }
    this.particleSystem.destroy()
    this.textSystem.destroy()
    this.clearShakeAfterimages()
    this.clearShakeTrail()
    this.clearShakeTrailGuide()
    this.clearFlashOverlay()
    this.clearSquish()
    this.clearFog()
    this.clearDynamicBackground()
    this.clearRadialBlurContents()
    this.clearSpiralMask()
    this.container.destroy({ children: true })
  }

  private startImageTransition(
    sprite: PIXI.Sprite,
    url: string,
    transition: SlideShowTransition,
    transitionDurationMs: number
  ) {
    const oldSprite = this.imageSprite
    if (!oldSprite) {
      this.swapImageSprite(sprite, url)
      this.positionImageSprite(sprite)
      this.resetShakeMotion()
      this.refreshEcho()
      this.refreshShakeTrailRegion()
      this.refreshBlurRegion()
      return
    }

    this.clearTransitionSprite()
    this.transitionSprite = oldSprite
    gsap.killTweensOf([sprite, oldSprite])
    this.imageLayer.addChild(sprite)
    this.imageSprite = sprite
    this.currentImageSrc = url
    this.requestedImageSrc = null

    this.positionImageSprite(oldSprite)
    this.positionImageSprite(sprite)
    this.resetShakeMotion()

    const duration = Math.max(0.05, transitionDurationMs / 1000)
    this.startDynamicBackgroundTransition(sprite.texture, transition, duration)

    const finish = () => {
      this.activeSlideTransition = null
      this.activeZoomTransition = null
      if (this.transitionSprite === oldSprite) {
        this.imageLayer.removeChild(oldSprite)
        oldSprite.destroy({ texture: false })
        this.transitionSprite = null
      }
      this.imageTransitionTween = null
      this.repositionImage()
      this.refreshEcho()
      this.refreshShakeTrailRegion()
      this.refreshBlurRegion()
    }

    switch (transition) {
      case 'fade':
        sprite.alpha = 0
        oldSprite.alpha = 1
        this.imageTransitionTween = gsap.to(sprite, {
          alpha: 1,
          duration,
          ease: 'sine.out',
          onComplete: finish,
        })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
        break
      case 'slide-left':
      case 'slide-right':
      case 'slide-up':
      case 'slide-down': {
        const offsetX = transition === 'slide-left' ? this.width : transition === 'slide-right' ? -this.width : 0
        const offsetY = transition === 'slide-up' ? this.height : transition === 'slide-down' ? -this.height : 0
        const proxy = {
          incomingOffsetX: offsetX,
          incomingOffsetY: offsetY,
          outgoingOffsetX: 0,
          outgoingOffsetY: 0,
        }
        this.activeSlideTransition = {
          incoming: sprite,
          outgoing: oldSprite,
          incomingOffsetX: proxy.incomingOffsetX,
          incomingOffsetY: proxy.incomingOffsetY,
          outgoingOffsetX: proxy.outgoingOffsetX,
          outgoingOffsetY: proxy.outgoingOffsetY,
        }
        this.applySlideTransitionPositions()
        this.imageTransitionTween = gsap.to(proxy, {
          incomingOffsetX: 0,
          incomingOffsetY: 0,
          outgoingOffsetX: -offsetX * 0.25,
          outgoingOffsetY: -offsetY * 0.25,
          duration,
          ease: 'sine.out',
          onUpdate: () => {
            if (!this.activeSlideTransition) return
            this.activeSlideTransition.incomingOffsetX = proxy.incomingOffsetX
            this.activeSlideTransition.incomingOffsetY = proxy.incomingOffsetY
            this.activeSlideTransition.outgoingOffsetX = proxy.outgoingOffsetX
            this.activeSlideTransition.outgoingOffsetY = proxy.outgoingOffsetY
            this.applySlideTransitionPositions()
          },
          onComplete: finish,
        })
        gsap.to(oldSprite, {
          alpha: 0,
          duration,
          ease: 'sine.out',
        })
        break
      }
      case 'zoom-in':
      case 'zoom-out': {
        const proxy = { incomingScaleMultiplier: transition === 'zoom-in' ? 1.12 : 0.88 }
        this.activeZoomTransition = {
          incoming: sprite,
          outgoing: oldSprite,
          incomingScaleMultiplier: proxy.incomingScaleMultiplier,
        }
        this.applyZoomTransitionTransforms()
        sprite.alpha = 0
        oldSprite.alpha = 1
        this.imageTransitionTween = gsap.to(proxy, {
          incomingScaleMultiplier: 1,
          duration,
          ease: 'sine.out',
          onUpdate: () => {
            if (!this.activeZoomTransition) return
            this.activeZoomTransition.incomingScaleMultiplier = proxy.incomingScaleMultiplier
            this.applyZoomTransitionTransforms()
          },
          onComplete: finish,
        })
        gsap.to(sprite, { alpha: 1, duration: ZOOM_TRANSITION_ALPHA_IN_SEC, ease: 'sine.out' })
        gsap.to(oldSprite, { alpha: 0, duration: ZOOM_TRANSITION_ALPHA_IN_SEC, ease: 'sine.out' })
        break
      }
      default:
        this.swapImageSprite(sprite, url)
        if (this.blankBackground.mode === 'dynamic') {
          this.swapDynamicBackgroundSprite(new PIXI.Sprite(sprite.texture))
        }
        this.positionImageSprite(sprite)
        this.refreshEcho()
        this.refreshShakeTrailRegion()
        this.refreshBlurRegion()
    }
  }

  clearImage() {
    this.clearTransitionSprite()
    this.swapImageSprite(null, null)
    this.clearDynamicBackground()
    this.clearShakeTrail()
    this.requestedImageSrc = null
  }

  private swapImageSprite(sprite: PIXI.Sprite | null, url: string | null) {
    const oldSprite = this.imageSprite
    if (oldSprite) gsap.killTweensOf(oldSprite)
    if (sprite) {
      sprite.visible = true
      this.imageLayer.addChild(sprite)
    }
    this.imageSprite = sprite
    this.currentImageSrc = url
    this.requestedImageSrc = null

    if (oldSprite) {
      this.imageLayer.removeChild(oldSprite)
      oldSprite.destroy({ texture: false })
    }
  }

  private clearTransitionSprite() {
    this.imageTransitionTween?.kill()
    this.imageTransitionTween = null
    this.activeSlideTransition = null
    this.activeZoomTransition = null

    if (!this.transitionSprite) return
    gsap.killTweensOf(this.transitionSprite)
    this.imageLayer.removeChild(this.transitionSprite)
    this.transitionSprite.destroy({ texture: false })
    this.transitionSprite = null
  }

  private startDynamicBackgroundTransition(
    texture: PIXI.Texture,
    transition: SlideShowTransition,
    duration: number
  ) {
    if (this.blankBackground.mode !== 'dynamic') return

    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    this.positionDynamicBackgroundSprite(sprite)

    const oldSprite = this.dynamicBackgroundSprite
    if (!oldSprite || transition === 'none') {
      this.swapDynamicBackgroundSprite(sprite)
      return
    }

    this.clearDynamicBackgroundTransitionSprite()
    this.dynamicBackgroundTransitionSprite = oldSprite
    this.dynamicBackgroundLayer.addChild(sprite)
    this.dynamicBackgroundSprite = sprite

    switch (transition) {
      case 'fade':
        sprite.alpha = 0
        oldSprite.alpha = 1
        this.dynamicBackgroundTransitionTween = gsap.to(sprite, {
          alpha: 1,
          duration,
          ease: 'sine.out',
          onComplete: () => this.finishDynamicBackgroundTransition(oldSprite),
        })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
        break
      case 'slide-left':
      case 'slide-right':
      case 'slide-up':
      case 'slide-down': {
        const offsetX = transition === 'slide-left' ? this.width : transition === 'slide-right' ? -this.width : 0
        const offsetY = transition === 'slide-up' ? this.height : transition === 'slide-down' ? -this.height : 0
        const proxy = { incomingX: offsetX, incomingY: offsetY, outgoingX: 0, outgoingY: 0 }
        const apply = () => {
          this.positionDynamicBackgroundSprite(sprite, proxy.incomingX, proxy.incomingY)
          this.positionDynamicBackgroundSprite(oldSprite, proxy.outgoingX, proxy.outgoingY)
        }
        apply()
        this.dynamicBackgroundTransitionTween = gsap.to(proxy, {
          incomingX: 0,
          incomingY: 0,
          outgoingX: -offsetX * 0.25,
          outgoingY: -offsetY * 0.25,
          duration,
          ease: 'sine.out',
          onUpdate: apply,
          onComplete: () => this.finishDynamicBackgroundTransition(oldSprite),
        })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
        break
      }
      case 'zoom-in':
      case 'zoom-out': {
        const proxy = { scaleMultiplier: transition === 'zoom-in' ? 1.12 : 0.88 }
        sprite.alpha = 0
        oldSprite.alpha = 1
        this.dynamicBackgroundTransitionTween = gsap.to(proxy, {
          scaleMultiplier: 1,
          duration,
          ease: 'sine.out',
          onUpdate: () => this.positionDynamicBackgroundSprite(sprite, 0, 0, proxy.scaleMultiplier),
          onComplete: () => this.finishDynamicBackgroundTransition(oldSprite),
        })
        this.positionDynamicBackgroundSprite(sprite, 0, 0, proxy.scaleMultiplier)
        gsap.to(sprite, { alpha: 1, duration: ZOOM_TRANSITION_ALPHA_IN_SEC, ease: 'sine.out' })
        gsap.to(oldSprite, { alpha: 0, duration: ZOOM_TRANSITION_ALPHA_IN_SEC, ease: 'sine.out' })
        break
      }
      default:
        this.swapDynamicBackgroundSprite(sprite)
    }
  }

  private finishDynamicBackgroundTransition(oldSprite: PIXI.Sprite) {
    if (this.dynamicBackgroundTransitionSprite === oldSprite) {
      this.dynamicBackgroundLayer.removeChild(oldSprite)
      oldSprite.destroy({ texture: false })
      this.dynamicBackgroundTransitionSprite = null
    }
    this.dynamicBackgroundTransitionTween = null
    this.repositionDynamicBackground()
  }

  private swapDynamicBackgroundSprite(sprite: PIXI.Sprite | null) {
    const oldSprite = this.dynamicBackgroundSprite
    this.clearDynamicBackgroundTransitionSprite()

    if (sprite) {
      sprite.anchor.set(0.5)
      this.positionDynamicBackgroundSprite(sprite)
      this.dynamicBackgroundLayer.addChild(sprite)
    }

    this.dynamicBackgroundSprite = sprite

    if (oldSprite && oldSprite !== sprite) {
      this.dynamicBackgroundLayer.removeChild(oldSprite)
      oldSprite.destroy({ texture: false })
    }
  }

  private clearDynamicBackgroundTransitionSprite() {
    this.dynamicBackgroundTransitionTween?.kill()
    this.dynamicBackgroundTransitionTween = null

    if (!this.dynamicBackgroundTransitionSprite) return
    gsap.killTweensOf(this.dynamicBackgroundTransitionSprite)
    this.dynamicBackgroundLayer.removeChild(this.dynamicBackgroundTransitionSprite)
    this.dynamicBackgroundTransitionSprite.destroy({ texture: false })
    this.dynamicBackgroundTransitionSprite = null
  }

  private clearDynamicBackground() {
    this.clearDynamicBackgroundTransitionSprite()
    if (this.dynamicBackgroundSprite) {
      this.dynamicBackgroundLayer.removeChild(this.dynamicBackgroundSprite)
      this.dynamicBackgroundSprite.destroy({ texture: false })
      this.dynamicBackgroundSprite = null
    }
  }

  private repositionDynamicBackground() {
    if (this.dynamicBackgroundSprite) this.positionDynamicBackgroundSprite(this.dynamicBackgroundSprite)
    if (this.dynamicBackgroundTransitionSprite) this.positionDynamicBackgroundSprite(this.dynamicBackgroundTransitionSprite)
    this.updateDynamicBackgroundBlur()
  }

  private positionDynamicBackgroundSprite(sprite: PIXI.Sprite, offsetX = 0, offsetY = 0, scaleMultiplier = 1) {
    const texW = sprite.texture.width
    const texH = sprite.texture.height
    const scale = Math.max(this.width / texW, this.height / texH) * scaleMultiplier
    sprite.scale.set(scale)
    sprite.x = this.width / 2 + offsetX
    sprite.y = this.height / 2 + offsetY
  }

  private updateDynamicBackgroundBlur() {
    if (this.blankBackground.mode !== 'dynamic' || this.blankBackground.dynamicBlur <= 0) {
      this.dynamicBackgroundLayer.filters = []
      this.dynamicBackgroundLayer.filterArea = undefined
      this.dynamicBackgroundBlurFilter = null
      return
    }

    if (!this.dynamicBackgroundBlurFilter) {
      this.dynamicBackgroundBlurFilter = new PIXI.BlurFilter({ quality: 4 })
    }
    this.dynamicBackgroundBlurFilter.strength = this.blankBackground.dynamicBlur
    this.dynamicBackgroundLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    this.dynamicBackgroundLayer.filters = [this.dynamicBackgroundBlurFilter]
  }

  private repositionImage() {
    if (!this.imageSprite) return
    this.positionImageSprite(this.imageSprite)
    if (this.transitionSprite && this.transitionSprite !== this.imageSprite) {
      this.positionImageSprite(this.transitionSprite)
    }
    this.redrawImageMask()
    this.syncRadialBlurClones()
  }

  private positionImageSprite(sprite: PIXI.Sprite) {
    const { offsetX, offsetY, scaleMultiplier } = this.getImageMotionTransform()
    this.positionSprite(sprite, offsetX, offsetY, scaleMultiplier)
  }

  private positionSprite(sprite: PIXI.Sprite, offsetX = 0, offsetY = 0, scaleMultiplier = 1) {
    const texW = sprite.texture.width
    const texH = sprite.texture.height
    const scale = this.getImageScale(texW, texH) * scaleMultiplier

    sprite.scale.set(scale)
    sprite.x = this.width / 2 + offsetX
    sprite.y = this.height / 2 + offsetY
  }

  private getImageScale(texW: number, texH: number) {
    if (this.imageFit === 'fitHeight') return this.height / texH
    if (this.imageFit === 'fitWidth') return this.width / texW
    return Math.min(this.width / texW, this.height / texH)
  }

  private redrawImageMask() {
    this.imageMask.clear()
    this.imageMask.rect(0, 0, this.width, this.height)
    this.imageMask.fill(0xffffff)
  }

  private redrawEchoMask() {
    this.echoMask.clear()
    this.echoMask.rect(0, 0, this.width, this.height)
    this.echoMask.fill(0xffffff)
  }

  private updateColorOverlay(effects: CellEffects) {
    updateColorOverlay(this.colorOverlayGraphics, this.width, this.height, effects)
  }

  /** カラーフィルタの不透明度（動的反映・タイマー同期はビネットと同仕様） */
  private updateColorOverlayTint(effects: CellEffects) {
    const co = effects.colorOverlay

    if (!co.enabled) {
      if (this.colorTintGsapTween) {
        this.colorTintGsapTween.kill()
        this.colorTintGsapTween = null
      }
      this.colorTintAnimationKey = null
      return
    }

    if (co.dynamic) {
      if (co.dynamicTimerSync) {
        const animationKey = `timer-sync:${co.dynamicFrom}:${co.dynamicTo}`
        if (this.colorTintAnimationKey !== animationKey) {
          this.colorTintGsapTween?.kill()
          this.colorTintGsapTween = null
          this.colorTintAnimationKey = animationKey
          this.colorOverlayGraphics.alpha =
            co.dynamicFrom + (co.dynamicTo - co.dynamicFrom) * this.timerProgress
        }
      } else if (this.storyboardScaleActive) {
        this.colorTintGsapTween?.kill()
        this.colorTintGsapTween = null
      } else {
        const animationKey = [co.dynamicFrom, co.dynamicTo, co.dynamicDurationMs].join(':')

        if (this.colorTintAnimationKey !== animationKey) {
          this.colorTintGsapTween?.kill()
          this.colorTintAnimationKey = animationKey
          const proxy = { alpha: co.dynamicFrom }
          this.colorOverlayGraphics.alpha = co.dynamicFrom
          this.colorTintGsapTween = gsap.to(proxy, {
            alpha: co.dynamicTo,
            duration: co.dynamicDurationMs / 1000,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: false,
            onComplete: () => { proxy.alpha = co.dynamicFrom },
            onUpdate: () => {
              this.colorOverlayGraphics.alpha = proxy.alpha
            },
          })
        }
      }
    } else {
      if (this.colorTintGsapTween) {
        this.colorTintGsapTween.kill()
        this.colorTintGsapTween = null
      }
      this.colorTintAnimationKey = null
      if (!this.storyboardScaleActive) {
        this.colorOverlayGraphics.alpha = co.alpha
      }
    }
  }

  private redrawDynamicBackgroundMask() {
    this.dynamicBackgroundMask.clear()
    this.dynamicBackgroundMask.rect(0, 0, this.width, this.height)
    this.dynamicBackgroundMask.fill(0xffffff)
  }

  private updateColorAdjustment(colorOverlay: ColorOverlayEffect) {
    const brightnessBase = colorOverlay.brightness ?? 1
    const enabled = colorOverlay.imageAdjustEnabled &&
      (colorOverlay.saturationMax > 1 ||
        colorOverlay.contrastMax > 1 ||
        Math.abs(brightnessBase - 1) > 1e-5)

    if (!enabled) {
      this.colorAdjustGsapTween?.kill()
      this.colorAdjustGsapTween = null
      this.colorAdjustAnimationKey = null
      this.colorMatrixFilter = null
      this.setImageLayerFilters()
      return
    }

    if (!this.colorMatrixFilter) {
      this.colorMatrixFilter = new PIXI.ColorMatrixFilter()
    }

    const isTimerSync = colorOverlay.dynamicAdjust && colorOverlay.dynamicAdjustTimerSync
    const animationKey = isTimerSync
      ? `timer-sync:${colorOverlay.saturationMax}:${colorOverlay.contrastMax}:${brightnessBase}`
      : [
          colorOverlay.saturationMax,
          colorOverlay.contrastMax,
          brightnessBase,
          colorOverlay.dynamicAdjust,
          colorOverlay.dynamicAdjustDurationMs,
        ].join(':')

    if (this.colorAdjustAnimationKey === animationKey) return

    this.colorAdjustGsapTween?.kill()
    this.colorAdjustGsapTween = null
    this.colorAdjustAnimationKey = animationKey
    this.setImageLayerFilters()

    if (colorOverlay.dynamicAdjust) {
      if (isTimerSync) {
        // タイマー同期: GSAPなし、timerProgressで直接適用
        this.applyColorMatrix(colorOverlay, this.timerProgress)
      } else {
        const proxy = { progress: 0 }
        this.applyColorMatrix(colorOverlay, proxy.progress)
        this.colorAdjustGsapTween = gsap.to(proxy, {
          progress: 1,
          duration: Math.max(0.001, colorOverlay.dynamicAdjustDurationMs / 1000),
          ease: 'sine.inOut',
          repeat: -1,
          onRepeat: () => {
            proxy.progress = 0
            this.applyColorMatrix(colorOverlay, proxy.progress)
          },
          onUpdate: () => this.applyColorMatrix(colorOverlay, proxy.progress),
        })
      }
    } else {
      this.applyColorMatrix(colorOverlay, 1)
    }
  }

  private applyColorMatrix(colorOverlay: ColorOverlayEffect, progress: number) {
    if (!this.colorMatrixFilter) return
    const p = clamp(progress, 0, 1)
    const saturation = 1 + (Math.max(1, colorOverlay.saturationMax) - 1) * p
    const contrast = 1 + (Math.max(1, colorOverlay.contrastMax) - 1) * p
    const bTarget = colorOverlay.brightness ?? 1
    const brightnessMul = clamp(1 + (bTarget - 1) * p, 0.05, 3)

    this.colorMatrixFilter.reset()
    this.colorMatrixFilter.brightness(brightnessMul, false)
    this.colorMatrixFilter.contrast(contrast - 1, true)
    this.colorMatrixFilter.saturate(saturation - 1, true)
  }

  private setImageLayerFilters() {
    // ブラー（applyToAll = false 時）は imageLayer 単体に適用する。
    const imageLayerFilters: PIXI.Filter[] = []
    if (this.imageLayerBlurFilter) imageLayerFilters.push(this.imageLayerBlurFilter)
    // filterArea は PixiJS v8 の挙動を踏まえ filters より先に設定する。
    this.imageLayer.filterArea = imageLayerFilters.length > 0 ? new PIXI.Rectangle(0, 0, this.width, this.height) : undefined
    this.imageLayer.filters = imageLayerFilters

    // トーンフィルタ（カラーマトリクス）は imageRootLayer 全体に適用する。
    // こうすることで imageLayer 単体だけでなく、シェイク追従・放射状ブラー・
    // エコーなど画像から派生した描画にも均一にトーンフィルタが反映される。
    const rootFilters: PIXI.Filter[] = []
    if (this.colorMatrixFilter) rootFilters.push(this.colorMatrixFilter)
    this.imageRootLayer.filterArea = rootFilters.length > 0 ? new PIXI.Rectangle(0, 0, this.width, this.height) : undefined
    this.imageRootLayer.filters = rootFilters
  }

  private updateBreathing(breathing?: BreathingEffect) {
    const key = breathing
      ? [
          breathing.enabled,
          breathing.speedPxPerSec,
          breathing.maxOffsetPx,
          breathing.timerSync ?? false,
          breathing.scaleEnabled,
          breathing.scaleDurationSec,
        ].join(':')
      : 'disabled'

    if (this.breathingKey === key) return
    const wasEnabled = this.breathingKey !== null && this.breathingKey !== 'disabled'
    this.breathingKey = key

    if (!breathing?.enabled) {
      this.resetBreathingMotion(false)
      if (wasEnabled) this.repositionImage()
      return
    }

    if (!wasEnabled) this.resetBreathingMotion(false)
  }

  private getImageMotionTransform() {
    const breathing = this.latestEffects?.breathing
    const shake = this.latestEffects?.shake
    const breathingEnabled = breathing?.enabled ?? false

    const shakeContributes = shake?.enabled && !(shake.lockBaseImage && shake.trailEnabled)
    return {
      offsetX: (breathingEnabled ? this.breathingOffsetX : 0) + this.zoomCenterOffsetX,
      offsetY: (breathingEnabled ? this.breathingOffsetY : 0) + (shakeContributes ? this.shakeOffsetY : 0) + this.zoomCenterOffsetY,
      scaleMultiplier: (breathingEnabled && breathing?.scaleEnabled ? this.getBreathingScaleMultiplier() : 1) * this.zoomScaleMultiplier,
    }
  }

  private getShakeTrailMotionTransform(trailOffsetY: number) {
    const breathing = this.latestEffects?.breathing
    const breathingEnabled = breathing?.enabled ?? false
    const baseOffsetX = breathingEnabled ? this.breathingOffsetX : 0
    const baseOffsetY = breathingEnabled ? this.breathingOffsetY : 0
    const breathingScaleMultiplier = breathingEnabled && breathing?.scaleEnabled
      ? this.getBreathingScaleMultiplier()
      : 1
    return {
      offsetX: baseOffsetX + this.zoomCenterOffsetX,
      offsetY: baseOffsetY + trailOffsetY + this.zoomCenterOffsetY,
      scaleMultiplier: breathingScaleMultiplier * this.zoomScaleMultiplier,
    }
  }

  private updateShake(shake?: ShakeEffect, showCircleGuides = false) {
    const key = shake
      ? [
          shake.enabled,
          shake.mode,
          shake.repeatEnabled,
          shake.repeatIntervalSec,
          shake.amplitudeFactor,
          shake.speedFactor,
          shake.timerSync ?? false,
          shake.loopAmplitudePx,
          shake.loopSpeedPxPerSec,
          shake.afterimageEnabled,
          shake.afterimageDurationSec,
          shake.manualTriggerNonce ?? 0,
        ].join(':')
      : 'disabled'

    const wasEnabled = this.shakeKey !== null && this.shakeKey !== 'disabled'

    if (!shake?.enabled) {
      this.shakeKey = key
      this.resetShakeMotion()
      this.clearShakeTrail()
      this.clearShakeTrailGuide()
      if (wasEnabled) this.repositionImage()
      return
    }

    this.updateShakeTrail(shake, showCircleGuides)

    if (this.shakeKey === key) return
    this.shakeKey = key
    this.resetShakeMotion()
    this.updateShakeTrail(shake, showCircleGuides)
  }

  private getBreathingScaleMultiplier() {
    const breathing = this.latestEffects?.breathing
    const timerP = (breathing?.timerSync && this.timerEnabled) ? this.timerProgress : 1
    return 1 + ((Math.sin(this.breathingScalePhase) + 1) / 2) * 0.05 * timerP
  }

  private tickBreathing(delta: number, breathing?: BreathingEffect) {
    if (!this.imageSprite || !breathing?.enabled) return

    const speed = Math.max(0, breathing.speedPxPerSec)
    const dtSec = Math.max(0, delta) / 60
    const timerP = (breathing.timerSync && this.timerEnabled) ? this.timerProgress : 1
    const threshold = clamp((breathing.maxOffsetPx ?? 20) * timerP, 0, 40)

    this.breathingOffsetX += this.breathingDirectionX * speed * dtSec
    this.breathingOffsetY += this.breathingDirectionY * speed * dtSec

    let hitBoundary = false
    if (this.breathingOffsetX > threshold) {
      this.breathingOffsetX = threshold
      hitBoundary = true
    } else if (this.breathingOffsetX < -threshold) {
      this.breathingOffsetX = -threshold
      hitBoundary = true
    }

    if (this.breathingOffsetY > threshold) {
      this.breathingOffsetY = threshold
      hitBoundary = true
    } else if (this.breathingOffsetY < -threshold) {
      this.breathingOffsetY = -threshold
      hitBoundary = true
    }
    if (hitBoundary) this.randomizeBreathingDirection(threshold)

    const duration = Math.max(0.001, breathing.scaleDurationSec)
    if (breathing.scaleEnabled) {
      this.breathingScalePhase = (this.breathingScalePhase + (Math.PI * 2 * dtSec) / duration) % (Math.PI * 2)
    }
    const scaleMultiplier = breathing.scaleEnabled ? this.getBreathingScaleMultiplier() : 1

    if (this.activeSlideTransition) {
      this.applySlideTransitionPositions()
      return
    }

    if (this.activeZoomTransition) {
      this.applyZoomTransitionTransforms()
      return
    }

    if (this.imageTransitionTween) {
      this.applyBreathingTransform(this.imageSprite, 1)
      if (this.transitionSprite) this.applyBreathingTransform(this.transitionSprite, 1)
      return
    }

    this.positionSprite(this.imageSprite, this.breathingOffsetX, this.breathingOffsetY, scaleMultiplier)
  }

  private tickShake(delta: number, shake?: ShakeEffect) {
    if (!this.imageSprite || !shake?.enabled) return

    const dtSec = Math.max(0, delta) / 60
    const timerScale = (shake.timerSync && this.timerEnabled)
      ? clamp(this.timerProgress, 0, 1)
      : 1
    if (shake.mode === 'loop') {
      const amplitude = Math.max(0, shake.loopAmplitudePx) * timerScale
      const speed = Math.max(0, shake.loopSpeedPxPerSec) * timerScale
      if (amplitude <= 0 || speed <= 0) {
        this.shakeOffsetY = 0
        this.shakeLoopSegmentElapsedSec = 0
        this.shakeLoopSegmentStartY = 0
        return
      }

      const target = this.shakeLoopDirection < 0 ? -amplitude : amplitude
      const distance = Math.abs(target - this.shakeLoopSegmentStartY)
      const durationSec = distance > 0 ? distance / speed : 0
      this.shakeLoopSegmentElapsedSec += dtSec
      const progress = durationSec > 0 ? clamp(this.shakeLoopSegmentElapsedSec / durationSec, 0, 1) : 1
      this.shakeOffsetY = lerp(this.shakeLoopSegmentStartY, target, easeInOutSine(progress))

      if (progress >= 1 && this.shakeLoopDirection < 0) {
        this.shakeOffsetY = target
        this.shakeLoopDirection = 1
        this.shakeLoopSegmentStartY = target
        this.shakeLoopSegmentElapsedSec = 0
        this.shakeAfterimagePending = true
      } else if (progress >= 1) {
        this.shakeOffsetY = target
        this.shakeLoopDirection = -1
        this.shakeLoopSegmentStartY = target
        this.shakeLoopSegmentElapsedSec = 0
        this.shakeAfterimagePending = true
      }
      return
    }

    const factor = Math.max(0, shake.amplitudeFactor) * timerScale
    if (factor <= 0) {
      this.shakeOffsetY = 0
      this.shakeOnceInitialized = true
      return
    }

    if (shake.repeatEnabled && this.shakeOnceInitialized) {
      this.shakeRepeatElapsedSec += dtSec
    }

    if (this.isShakeOnceIdle()) {
      if (shake.repeatEnabled) {
        const intervalSec = Math.max(0.1, shake.repeatIntervalSec)
        if (this.shakeRepeatElapsedSec >= intervalSec) {
          this.shakeRepeatElapsedSec %= intervalSec
          this.restartShakeOnceMotion()
        } else {
          return
        }
      } else {
        return
      }
    }

    if (!this.shakeOnceInitialized) {
      const initialTarget = -SHAKE_ONCE_INITIAL_UP_PX * factor
      if (Math.abs(initialTarget) < SHAKE_ONCE_STOP_THRESHOLD_PX) {
        this.shakeOffsetY = 0
        this.shakeOnceInitialized = true
        return
      }
      this.startShakeOnceSegment(0, initialTarget)
      this.shakeOnceInitialized = true
      this.shakeRepeatElapsedSec = 0
    }

    if (this.shakeOnceSegmentStartY === this.shakeOnceSegmentTargetY) return

    const speedFactor = Math.max(0.1, shake.speedFactor * timerScale)
    const start = this.shakeOnceSegmentStartY
    const target = this.shakeOnceSegmentTargetY
    const distance = Math.abs(target - start)
    const baseSpeed = start === 0 && target < 0 ? SHAKE_ONCE_INITIAL_LIFT_SPEED_PX_PER_SEC : SHAKE_ONCE_BOUNCE_SPEED_PX_PER_SEC
    const segmentSpeed = getShakeOnceSegmentSpeed(baseSpeed, speedFactor, this.shakeOnceSegmentCount)
    const durationSec = distance > 0 ? distance / segmentSpeed : 0
    this.shakeOnceSegmentElapsedSec += dtSec
    const progress = durationSec > 0 ? clamp(this.shakeOnceSegmentElapsedSec / durationSec, 0, 1) : 1
    this.shakeOffsetY = lerp(start, target, easeInOutSine(progress))

    if (progress >= 1) {
      this.shakeOffsetY = target
      this.shakeOnceSegmentElapsedSec = 0
      if (target !== 0) {
        this.shakeAfterimagePending = true
      }
      const nextTarget = getNextShakeOnceTarget(target)
      if (Math.abs(nextTarget) < SHAKE_ONCE_STOP_THRESHOLD_PX) {
        if (target === 0) {
          this.shakeOnceSegmentStartY = 0
          this.shakeOnceSegmentTargetY = 0
          return
        }
        this.startShakeOnceSegment(target, 0)
      } else {
        this.startShakeOnceSegment(target, nextTarget)
      }
      if (this.shakeOnceSegmentStartY === this.shakeOnceSegmentTargetY) {
        this.shakeOffsetY = 0
      }
    }
  }

  private applyImageMotionTransform() {
    if (!this.imageSprite) return

    if (this.activeSlideTransition) {
      this.applySlideTransitionPositions()
      return
    }

    if (this.activeZoomTransition) {
      this.applyZoomTransitionTransforms()
      return
    }

    if (this.imageTransitionTween) {
      this.applyBreathingTransform(this.imageSprite, 1)
      if (this.transitionSprite) this.applyBreathingTransform(this.transitionSprite, 1)
      return
    }

    this.positionImageSprite(this.imageSprite)
  }

  private resetShakeMotion() {
    this.shakeOffsetY = 0
    this.shakeLoopDirection = -1
    this.shakeOnceInitialized = false
    this.shakeOnceSegmentElapsedSec = 0
    this.shakeOnceSegmentStartY = 0
    this.shakeOnceSegmentTargetY = 0
    this.shakeOnceSegmentCount = 0
    this.shakeRepeatElapsedSec = 0
    this.shakeLoopSegmentElapsedSec = 0
    this.shakeLoopSegmentStartY = 0
    this.shakeAfterimagePending = false
    this.shakeTrailSamples = []
    this.shakeTrailFirstStageSamples = []
    this.shakeTrailElapsedSec = 0
    this.shakeTrailSmoothedOffsetY = null
    this.shakeTrailSecondSmoothedOffsetY = null
  }

  private getShakeCycleDurationMs(shake?: ShakeEffect) {
    if (!shake?.enabled) return 0
    if (shake.mode === 'loop') return 1000

    const factor = Math.max(0, shake.amplitudeFactor)
    const speedFactor = Math.max(0.1, shake.speedFactor)
    let durationSec = 0
    let start = 0
    let target = -SHAKE_ONCE_INITIAL_UP_PX * factor
    if (Math.abs(target) < SHAKE_ONCE_STOP_THRESHOLD_PX) return 0
    for (let i = 0; i < SHAKE_ONCE_MAX_SEGMENTS; i += 1) {
      const distance = Math.abs(target - start)
      const baseSpeed = start === 0 && target < 0 ? SHAKE_ONCE_INITIAL_LIFT_SPEED_PX_PER_SEC : SHAKE_ONCE_BOUNCE_SPEED_PX_PER_SEC
      const speed = getShakeOnceSegmentSpeed(baseSpeed, speedFactor, i + 1)
      durationSec += speed > 0 ? distance / speed : 0
      const nextTarget = getNextShakeOnceTarget(target)
      if (Math.abs(nextTarget) < SHAKE_ONCE_STOP_THRESHOLD_PX) {
        if (target !== 0) {
          start = target
          target = 0
          continue
        }
        break
      }
      start = target
      target = nextTarget
    }
    return durationSec * 1000
  }

  private startShakeOnceSegment(startY: number, targetY: number) {
    this.shakeOnceSegmentStartY = startY
    this.shakeOnceSegmentTargetY = targetY
    this.shakeOnceSegmentElapsedSec = 0
    if (startY !== targetY) this.shakeOnceSegmentCount += 1
  }

  private isShakeOnceIdle() {
    return this.shakeOnceInitialized && this.shakeOnceSegmentStartY === this.shakeOnceSegmentTargetY
  }

  private restartShakeOnceMotion() {
    this.shakeOffsetY = 0
    this.shakeOnceInitialized = false
    this.shakeOnceSegmentElapsedSec = 0
    this.shakeOnceSegmentStartY = 0
    this.shakeOnceSegmentTargetY = 0
    this.shakeOnceSegmentCount = 0
    this.shakeAfterimagePending = false
  }

  private createPendingShakeAfterimage(shake?: ShakeEffect) {
    if (!this.shakeAfterimagePending) return
    this.shakeAfterimagePending = false
    if (!shake?.afterimageEnabled || !this.imageSprite) return

    const durationSec = clamp(shake.afterimageDurationSec, 0.05, 3)
    const sprite = new PIXI.Sprite(this.imageSprite.texture)
    sprite.anchor.set(0.5)
    sprite.x = this.imageSprite.x
    sprite.y = this.imageSprite.y
    sprite.scale.copyFrom(this.imageSprite.scale)
    sprite.rotation = this.imageSprite.rotation
    sprite.alpha = SHAKE_AFTERIMAGE_START_ALPHA
    this.imageLayer.addChild(sprite)
    this.shakeAfterimages.push({ sprite, ageSec: 0, durationSec })
  }

  private updateShakeAfterimages(delta: number) {
    if (this.shakeAfterimages.length === 0) return

    const dtSec = Math.max(0, delta) / 60
    for (let i = this.shakeAfterimages.length - 1; i >= 0; i -= 1) {
      const item = this.shakeAfterimages[i]
      item.ageSec += dtSec
      const progress = clamp(item.ageSec / item.durationSec, 0, 1)
      item.sprite.alpha = SHAKE_AFTERIMAGE_START_ALPHA * (1 - progress)
      if (progress >= 1) {
        this.imageLayer.removeChild(item.sprite)
        item.sprite.destroy({ texture: false })
        this.shakeAfterimages.splice(i, 1)
      }
    }
  }

  private clearShakeAfterimages() {
    this.shakeAfterimages.forEach(item => {
      this.imageLayer.removeChild(item.sprite)
      item.sprite.destroy({ texture: false })
    })
    this.shakeAfterimages = []
  }

  private updateShakeTrail(shake?: ShakeEffect, showCircleGuides = false) {
    if (!shake?.enabled || !shake.trailEnabled || !this.imageSprite) {
      this.clearShakeTrail()
      return
    }

    const firstGuideKey = [
      this.width,
      this.height,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSize ?? 0.7,
      shake.trailHeight ?? 1,
      shake.trailDuplicateCirclesEnabled ?? false,
      shake.trailDuplicateSpacingShift ?? 0,
      shake.trailDuplicateVerticalSpacingShift ?? 0,
    ].join(':')
    const secondGuideKey = [
      this.width,
      this.height,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSecondStageEnabled ?? false,
      shake.trailSecondStageSize ?? 0.62,
      shake.trailDuplicateCirclesEnabled ?? false,
      shake.trailDuplicateSpacingShift ?? 0,
      shake.trailDuplicateVerticalSpacingShift ?? 0,
    ].join(':')
    const shouldShowFirstGuide = showCircleGuides && this.shakeTrailFirstGuideKey !== null && this.shakeTrailFirstGuideKey !== firstGuideKey
    const shouldShowSecondGuide = showCircleGuides
      && Boolean(shake.trailSecondStageEnabled)
      && this.shakeTrailSecondGuideKey !== null
      && this.shakeTrailSecondGuideKey !== secondGuideKey
    this.shakeTrailFirstGuideKey = firstGuideKey
    this.shakeTrailSecondGuideKey = secondGuideKey
    if (shouldShowSecondGuide) {
      this.showShakeTrailGuide(shake, 'second')
    } else if (shouldShowFirstGuide) {
      this.showShakeTrailGuide(shake, 'first')
    }

    const key = [
      this.width,
      this.height,
      shake.trailBlurStrength ?? 0,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSize ?? 0.7,
      shake.trailHeight ?? 1,
      shake.trailSecondStageEnabled ?? false,
      shake.trailSecondStageSize ?? 0.62,
      shake.trailSecondStageDelayFactor ?? 0.25,
      shake.trailDuplicateCirclesEnabled ?? false,
      shake.trailDuplicateSpacingShift ?? 0,
      shake.trailDuplicateVerticalSpacingShift ?? 0,
    ].join(':')
    if (this.shakeTrailKey === key && this.shakeTrailSprite) return

    this.clearShakeTrail()
    const sprite = new PIXI.Sprite(this.imageSprite.texture)
    sprite.anchor.set(0.5)
    const maskSprite = shake.trailDuplicateCirclesEnabled
      ? this.createDualEllipseMaskSprite(
        this.latestEffects?.effectCenter?.x ?? 0.5,
        this.latestEffects?.effectCenter?.y ?? 0.5,
        shake.trailSize ?? 0.7,
        shake.trailHeight ?? 1,
        shake.trailDuplicateSpacingShift ?? 0,
        shake.trailDuplicateVerticalSpacingShift ?? 0,
        0.18,
      )
      : this.createEllipseMaskSprite(
        this.latestEffects?.effectCenter?.x ?? 0.5,
        this.latestEffects?.effectCenter?.y ?? 0.5,
        shake.trailSize ?? 0.7,
        shake.trailHeight ?? 1,
        0.18,
      )
    const maskFilter = new PIXI.MaskFilter({ sprite: maskSprite, channel: 'alpha' })
    const blurFilter = new PIXI.BlurFilter({
      strength: clamp(shake.trailBlurStrength ?? 0, 0, 12),
      quality: 3,
    })

    const firstLayer = new PIXI.Container()
    firstLayer.addChild(sprite)
    firstLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    firstLayer.filters = [blurFilter, maskFilter]
    this.imageRootLayer.addChildAt(firstLayer, this.imageRootLayer.getChildIndex(this.shakeTrailLayer) + 1)
    this.imageRootLayer.addChildAt(maskSprite, this.imageRootLayer.getChildIndex(firstLayer) + 1)
    maskSprite.alpha = 0

    this.shakeTrailFirstLayer = firstLayer
    this.shakeTrailSprite = sprite
    this.shakeTrailMaskSprite = maskSprite
    this.shakeTrailBlurFilter = blurFilter

    if (shake.trailSecondStageEnabled) {
      const secondLayer = new PIXI.Container()
      const secondSprite = new PIXI.Sprite(this.imageSprite.texture)
      secondSprite.anchor.set(0.5)
      const secondSize = (shake.trailSize ?? 0.7) * clamp(shake.trailSecondStageSize ?? 0.62, 0.1, 1)
      const secondMaskSprite = shake.trailDuplicateCirclesEnabled
        ? this.createDualEllipseMaskSprite(
          this.latestEffects?.effectCenter?.x ?? 0.5,
          this.latestEffects?.effectCenter?.y ?? 0.5,
          secondSize,
          shake.trailHeight ?? 1,
          shake.trailDuplicateSpacingShift ?? 0,
          shake.trailDuplicateVerticalSpacingShift ?? 0,
          0.16,
        )
        : this.createEllipseMaskSprite(
          this.latestEffects?.effectCenter?.x ?? 0.5,
          this.latestEffects?.effectCenter?.y ?? 0.5,
          secondSize,
          shake.trailHeight ?? 1,
          0.16,
        )
      const secondMaskFilter = new PIXI.MaskFilter({ sprite: secondMaskSprite, channel: 'alpha' })
      const secondBlurFilter = new PIXI.BlurFilter({
        strength: clamp((shake.trailBlurStrength ?? 0) * 0.6, 0, 12),
        quality: 3,
      })

      secondLayer.addChild(secondSprite)
      secondLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
      secondLayer.filters = [secondBlurFilter, secondMaskFilter]
      secondMaskSprite.alpha = 0
      // Keep the second trail stage above the first stage for every shake-trail setting.
      this.imageRootLayer.addChildAt(secondLayer, this.imageRootLayer.getChildIndex(maskSprite) + 1)
      this.imageRootLayer.addChildAt(secondMaskSprite, this.imageRootLayer.getChildIndex(secondLayer) + 1)

      this.shakeTrailSecondLayer = secondLayer
      this.shakeTrailSecondSprite = secondSprite
      this.shakeTrailSecondMaskSprite = secondMaskSprite
      this.shakeTrailSecondBlurFilter = secondBlurFilter
    }

    this.shakeTrailKey = key
    this.syncShakeTrail(0, shake)
  }

  private recordShakeTrailSample(delta: number, shake?: ShakeEffect) {
    if (!shake?.enabled || !shake.trailEnabled) return
    const dtSec = Math.max(0, delta) / 60
    this.shakeTrailElapsedSec += dtSec
    this.shakeTrailSamples.push({ timeSec: this.shakeTrailElapsedSec, offsetY: this.shakeOffsetY })
    const delaySec = clamp(shake.trailDelaySec ?? 0.01, 0.01, 0.5)
    const secondDelaySec = delaySec * clamp(shake.trailSecondStageDelayFactor ?? 0.25, 0.25, 3)
    const keepAfterSec = this.shakeTrailElapsedSec - Math.max(delaySec, secondDelaySec) - 0.25
    while (this.shakeTrailSamples.length > 2 && this.shakeTrailSamples[0].timeSec < keepAfterSec) {
      this.shakeTrailSamples.shift()
    }
    while (this.shakeTrailFirstStageSamples.length > 2 && this.shakeTrailFirstStageSamples[0].timeSec < keepAfterSec) {
      this.shakeTrailFirstStageSamples.shift()
    }
  }

  private syncShakeTrail(delta: number, shake?: ShakeEffect) {
    if (!shake?.enabled || !shake.trailEnabled) {
      this.clearShakeTrail()
      return
    }
    this.updateShakeTrail(shake)
    if (!this.shakeTrailSprite || !this.imageSprite) return

    const delaySec = clamp(shake.trailDelaySec ?? 0.01, 0.01, 0.5)
    const targetTimeSec = this.shakeTrailElapsedSec - delaySec
    const delayedOffsetY = this.getDelayedShakeOffset(targetTimeSec)
    const dtSec = Math.max(0, delta) / 60
    const smoothFactor = delta <= 0 ? 1 : 1 - Math.exp(-dtSec * 14)
    this.shakeTrailSmoothedOffsetY = this.shakeTrailSmoothedOffsetY === null
      ? delayedOffsetY
      : lerp(this.shakeTrailSmoothedOffsetY, delayedOffsetY, smoothFactor)
    this.shakeTrailFirstStageSamples.push({
      timeSec: this.shakeTrailElapsedSec,
      offsetY: this.shakeTrailSmoothedOffsetY,
    })
    this.shakeTrailSprite.texture = this.imageSprite.texture
    const firstStageTransform = this.getShakeTrailMotionTransform(this.shakeTrailSmoothedOffsetY)
    this.positionSprite(
      this.shakeTrailSprite,
      firstStageTransform.offsetX,
      firstStageTransform.offsetY,
      firstStageTransform.scaleMultiplier
    )
    this.shakeTrailSprite.alpha = clamp(shake.trailAlpha ?? 0.8, 0, 1)

    if (shake.trailSecondStageEnabled && this.shakeTrailSecondSprite) {
      const secondDelaySec = delaySec * clamp(shake.trailSecondStageDelayFactor ?? 0.25, 0.25, 3)
      const secondTargetTimeSec = this.shakeTrailElapsedSec - secondDelaySec
      const secondDelayedOffsetY = this.getDelayedShakeTrailFirstStageOffset(secondTargetTimeSec)
      this.shakeTrailSecondSmoothedOffsetY = this.shakeTrailSecondSmoothedOffsetY === null
        ? secondDelayedOffsetY
        : lerp(this.shakeTrailSecondSmoothedOffsetY, secondDelayedOffsetY, smoothFactor)
      this.shakeTrailSecondSprite.texture = this.imageSprite.texture
      const secondStageTransform = this.getShakeTrailMotionTransform(this.shakeTrailSecondSmoothedOffsetY)
      this.positionSprite(
        this.shakeTrailSecondSprite,
        secondStageTransform.offsetX,
        secondStageTransform.offsetY,
        secondStageTransform.scaleMultiplier
      )
      this.shakeTrailSecondSprite.alpha = clamp((shake.trailAlpha ?? 0.8) + 0.12, 0, 1)
    }

    if (delta === 0 && this.shakeTrailSamples.length === 0) {
      this.shakeTrailSamples.push({ timeSec: this.shakeTrailElapsedSec, offsetY: this.shakeOffsetY })
    }
  }

  private getDelayedShakeOffset(targetTimeSec: number) {
    if (this.shakeTrailSamples.length === 0) return this.shakeOffsetY
    if (targetTimeSec <= this.shakeTrailSamples[0].timeSec) return this.shakeTrailSamples[0].offsetY

    for (let i = 1; i < this.shakeTrailSamples.length; i += 1) {
      const prev = this.shakeTrailSamples[i - 1]
      const next = this.shakeTrailSamples[i]
      if (targetTimeSec <= next.timeSec) {
        const span = next.timeSec - prev.timeSec
        const p = span > 0 ? clamp((targetTimeSec - prev.timeSec) / span, 0, 1) : 1
        return lerp(prev.offsetY, next.offsetY, p)
      }
    }

    return this.shakeTrailSamples[this.shakeTrailSamples.length - 1].offsetY
  }

  private getDelayedShakeTrailFirstStageOffset(targetTimeSec: number) {
    if (this.shakeTrailFirstStageSamples.length === 0) return this.shakeTrailSmoothedOffsetY ?? this.shakeOffsetY
    if (targetTimeSec <= this.shakeTrailFirstStageSamples[0].timeSec) return this.shakeTrailFirstStageSamples[0].offsetY

    for (let i = 1; i < this.shakeTrailFirstStageSamples.length; i += 1) {
      const prev = this.shakeTrailFirstStageSamples[i - 1]
      const next = this.shakeTrailFirstStageSamples[i]
      if (targetTimeSec <= next.timeSec) {
        const span = next.timeSec - prev.timeSec
        const p = span > 0 ? clamp((targetTimeSec - prev.timeSec) / span, 0, 1) : 1
        return lerp(prev.offsetY, next.offsetY, p)
      }
    }

    return this.shakeTrailFirstStageSamples[this.shakeTrailFirstStageSamples.length - 1].offsetY
  }

  private refreshShakeTrailRegion() {
    if (!this.latestEffects) return
    if (this.shakeTrailSprite && this.imageSprite) {
      this.shakeTrailSprite.texture = this.imageSprite.texture
      if (this.shakeTrailSecondSprite) {
        this.shakeTrailSecondSprite.texture = this.imageSprite.texture
      }
      this.syncShakeTrail(0, this.latestEffects.shake)
      return
    }
    this.shakeTrailKey = null
    this.updateShakeTrail(this.latestEffects.shake)
  }

  private clearShakeTrail() {
    this.shakeTrailLayer.filters = []
    this.shakeTrailLayer.filterArea = undefined
    this.shakeTrailBlurFilter = null
    this.shakeTrailSecondBlurFilter = null
    if (this.shakeTrailFirstLayer) {
      this.imageRootLayer.removeChild(this.shakeTrailFirstLayer)
      this.shakeTrailFirstLayer.destroy({ children: true })
      this.shakeTrailFirstLayer = null
      this.shakeTrailSprite = null
    }
    if (this.shakeTrailSprite) {
      this.shakeTrailLayer.removeChild(this.shakeTrailSprite)
      this.shakeTrailSprite.destroy({ texture: false })
      this.shakeTrailSprite = null
    }
    if (this.shakeTrailMaskSprite) {
      this.imageRootLayer.removeChild(this.shakeTrailMaskSprite)
      this.shakeTrailMaskSprite.texture.destroy(true)
      this.shakeTrailMaskSprite.destroy()
      this.shakeTrailMaskSprite = null
    }
    if (this.shakeTrailSecondLayer) {
      this.imageRootLayer.removeChild(this.shakeTrailSecondLayer)
      this.shakeTrailSecondLayer.destroy({ children: true })
      this.shakeTrailSecondLayer = null
      this.shakeTrailSecondSprite = null
    }
    if (this.shakeTrailSecondMaskSprite) {
      this.imageRootLayer.removeChild(this.shakeTrailSecondMaskSprite)
      this.shakeTrailSecondMaskSprite.texture.destroy(true)
      this.shakeTrailSecondMaskSprite.destroy()
      this.shakeTrailSecondMaskSprite = null
    }
    this.shakeTrailKey = null
    this.shakeTrailSmoothedOffsetY = null
    this.shakeTrailSecondSmoothedOffsetY = null
    this.shakeTrailFirstStageSamples = []
  }

  private showCircleGuide(
    mode: 'radial' | 'first' | 'second',
    centerXRatio: number,
    centerYRatio: number,
    size: number,
    heightRatio: number
  ) {
    if (!this.shakeTrailGuideGraphics) {
      this.shakeTrailGuideGraphics = new PIXI.Graphics()
      this.guideLayer.addChild(this.shakeTrailGuideGraphics)
    }

    this.shakeTrailGuideMode = mode
    const centerX = clamp(centerXRatio, 0, 1)
    const centerY = clamp(centerYRatio, 0, 1)
    const normalizedSize = clamp(size, 0.05, 3)
    const normalizedHeightRatio = clamp(heightRatio, 0.05, 3)
    const baseSize = Math.min(this.width, this.height)
    const cx = this.width * centerX
    const cy = this.height * centerY
    const rx = Math.max(1, baseSize * normalizedSize * 0.5)
    const ry = Math.max(1, baseSize * normalizedSize * normalizedHeightRatio * 0.5)

    this.shakeTrailGuideGraphics.clear()
    if (mode === 'radial') {
      this.shakeTrailGuideGraphics.ellipse(cx, cy, rx, ry)
      this.shakeTrailGuideGraphics.fill({ color: 0x60ff88, alpha: 0.12 })
      this.shakeTrailGuideGraphics.stroke({ color: 0x9cffb2, alpha: 0.96, width: 3 })
    }
    if (mode === 'first') {
      this.shakeTrailGuideGraphics.ellipse(cx, cy, rx, ry)
      this.shakeTrailGuideGraphics.fill({ color: 0x66ccff, alpha: 0.14 })
      this.shakeTrailGuideGraphics.stroke({ color: 0xb2e8ff, alpha: 0.96, width: 3 })
    }
    if (mode === 'second') {
      this.shakeTrailGuideGraphics.ellipse(cx, cy, rx, ry)
      this.shakeTrailGuideGraphics.fill({ color: 0xffe266, alpha: 0.22 })
      this.shakeTrailGuideGraphics.stroke({ color: 0xfff49a, alpha: 0.96, width: 3 })
    }
    this.shakeTrailGuideGraphics.alpha = 1
    this.shakeTrailGuideRemainingSec = 1
  }

  /** 追従遅延の左右2円ガイド（重なりは1回の塗りで結合）。縦方向は左右で交互オフセット可 */
  private showCircleGuideDuplicate(
    mode: 'first' | 'second',
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number,
    rx: number,
    ry: number,
  ) {
    if (!this.shakeTrailGuideGraphics) {
      this.shakeTrailGuideGraphics = new PIXI.Graphics()
      this.guideLayer.addChild(this.shakeTrailGuideGraphics)
    }

    this.shakeTrailGuideMode = mode
    this.shakeTrailGuideGraphics.clear()
    this.shakeTrailGuideGraphics.ellipse(cx1, cy1, rx, ry)
    this.shakeTrailGuideGraphics.ellipse(cx2, cy2, rx, ry)
    if (mode === 'first') {
      this.shakeTrailGuideGraphics.fill({ color: 0x66ccff, alpha: 0.14 })
      this.shakeTrailGuideGraphics.ellipse(cx1, cy1, rx, ry)
      this.shakeTrailGuideGraphics.stroke({ color: 0xb2e8ff, alpha: 0.96, width: 3 })
      this.shakeTrailGuideGraphics.ellipse(cx2, cy2, rx, ry)
      this.shakeTrailGuideGraphics.stroke({ color: 0xb2e8ff, alpha: 0.96, width: 3 })
    } else {
      this.shakeTrailGuideGraphics.fill({ color: 0xffe266, alpha: 0.22 })
      this.shakeTrailGuideGraphics.ellipse(cx1, cy1, rx, ry)
      this.shakeTrailGuideGraphics.stroke({ color: 0xfff49a, alpha: 0.96, width: 3 })
      this.shakeTrailGuideGraphics.ellipse(cx2, cy2, rx, ry)
      this.shakeTrailGuideGraphics.stroke({ color: 0xfff49a, alpha: 0.96, width: 3 })
    }
    this.shakeTrailGuideGraphics.alpha = 1
    this.shakeTrailGuideRemainingSec = 1
  }

  private showShakeTrailGuide(shake: ShakeEffect, mode: 'first' | 'second' = 'first') {
    const size = clamp(shake.trailSize ?? 0.7, 0.05, 3)
    const guideSize = mode === 'second'
      ? size * clamp(shake.trailSecondStageSize ?? 0.62, 0.1, 1)
      : size
    const heightRatio = clamp(shake.trailHeight ?? 1, 0.05, 3)
    if (shake.trailDuplicateCirclesEnabled) {
      const cx0 = this.width * clamp(this.latestEffects?.effectCenter?.x ?? 0.5, 0, 1)
      const cy0 = this.height * clamp(this.latestEffects?.effectCenter?.y ?? 0.5, 0, 1)
      const baseSize = Math.min(this.width, this.height)
      const rx = Math.max(1, baseSize * guideSize * 0.5)
      const ry = Math.max(1, baseSize * guideSize * heightRatio * 0.5)
      const shift = clamp(shake.trailDuplicateSpacingShift ?? 0, -0.5, 0.5)
      const halfSep = rx * (1 + shift)
      const vShift = clamp(shake.trailDuplicateVerticalSpacingShift ?? 0, -0.5, 0.5)
      const stagger = ry * vShift
      const cy1 = cy0 - stagger
      const cy2 = cy0 + stagger
      this.showCircleGuideDuplicate(mode, cx0 - halfSep, cy1, cx0 + halfSep, cy2, rx, ry)
      return
    }
    this.showCircleGuide(
      mode,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      guideSize,
      shake.trailHeight ?? 1
    )
  }

  private updateShakeTrailGuide(delta: number) {
    if (!this.shakeTrailGuideGraphics || this.shakeTrailGuideRemainingSec <= 0) return

    const dtSec = Math.max(0, delta) / 60
    this.shakeTrailGuideRemainingSec = Math.max(0, this.shakeTrailGuideRemainingSec - dtSec)
    this.shakeTrailGuideGraphics.alpha = clamp(this.shakeTrailGuideRemainingSec / 0.25, 0, 1)
    if (this.shakeTrailGuideRemainingSec <= 0) {
      this.clearShakeTrailGuide()
    }
  }

  private clearShakeTrailGuide() {
    this.shakeTrailGuideRemainingSec = 0
    this.shakeTrailGuideMode = 'first'
    if (!this.shakeTrailGuideGraphics) return
    this.guideLayer.removeChild(this.shakeTrailGuideGraphics)
    this.shakeTrailGuideGraphics.destroy()
    this.shakeTrailGuideGraphics = null
  }

  private resetBreathingMotion(randomize: boolean) {
    const breathing = this.latestEffects?.breathing
    const timerP = (breathing?.timerSync && this.timerEnabled) ? this.timerProgress : 1
    const threshold = clamp((breathing?.maxOffsetPx ?? 20) * timerP, 0, 40)
    this.breathingOffsetX = randomize ? Math.random() * threshold * 2 - threshold : 0
    this.breathingOffsetY = randomize ? Math.random() * threshold * 2 - threshold : 0
    this.randomizeBreathingDirection(threshold)
    this.breathingScalePhase = randomize ? Math.random() * Math.PI * 2 : -Math.PI / 2
  }

  private randomizeBreathingDirection(threshold: number) {
    if (threshold <= 0) {
      this.breathingDirectionX = 0
      this.breathingDirectionY = 0
      return
    }

    for (let i = 0; i < 32; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const x = Math.cos(angle)
      const y = Math.sin(angle)
      if (this.isBreathingDirectionInsideBounds(x, y, threshold)) {
        this.breathingDirectionX = x
        this.breathingDirectionY = y
        return
      }
    }

    const fallbackX = this.breathingOffsetX >= threshold ? -1 : this.breathingOffsetX <= -threshold ? 1 : 0
    const fallbackY = this.breathingOffsetY >= threshold ? -1 : this.breathingOffsetY <= -threshold ? 1 : 0
    const fallbackLength = Math.hypot(fallbackX, fallbackY) || 1
    this.breathingDirectionX = fallbackX / fallbackLength
    this.breathingDirectionY = fallbackY / fallbackLength
  }

  private isBreathingDirectionInsideBounds(x: number, y: number, threshold: number) {
    if (this.breathingOffsetX >= threshold && x > 0) return false
    if (this.breathingOffsetX <= -threshold && x < 0) return false
    if (this.breathingOffsetY >= threshold && y > 0) return false
    if (this.breathingOffsetY <= -threshold && y < 0) return false
    return true
  }

  private applyBreathingTransform(sprite: PIXI.Sprite, extraScaleMultiplier: number) {
    const transform = this.getImageMotionTransform()
    sprite.x = this.width / 2 + transform.offsetX
    sprite.y = this.height / 2 + transform.offsetY
    sprite.scale.set(this.getImageScale(sprite.texture.width, sprite.texture.height) * transform.scaleMultiplier * extraScaleMultiplier)
  }

  private applySlideTransitionPositions() {
    if (!this.activeSlideTransition) return
    const transform = this.getImageMotionTransform()
    const centerX = this.width / 2 + transform.offsetX
    const centerY = this.height / 2 + transform.offsetY
    const {
      incoming,
      outgoing,
      incomingOffsetX,
      incomingOffsetY,
      outgoingOffsetX,
      outgoingOffsetY,
    } = this.activeSlideTransition

    incoming.x = centerX + incomingOffsetX
    incoming.y = centerY + incomingOffsetY
    outgoing.x = centerX + outgoingOffsetX
    outgoing.y = centerY + outgoingOffsetY
    incoming.scale.set(this.getImageScale(incoming.texture.width, incoming.texture.height) * transform.scaleMultiplier)
    outgoing.scale.set(this.getImageScale(outgoing.texture.width, outgoing.texture.height) * transform.scaleMultiplier)
  }

  private applyZoomTransitionTransforms() {
    if (!this.activeZoomTransition) return
    const { incoming, outgoing, incomingScaleMultiplier } = this.activeZoomTransition
    this.applyBreathingTransform(incoming, incomingScaleMultiplier)
    this.applyBreathingTransform(outgoing, 1)
  }

  private updateEcho(effects: CellEffects) {
    const echo = effects.echo
    const animationKey = [
      echo.enabled,
      echo.durationSec,
      echo.startAlpha,
      echo.startScale,
      echo.endScale,
      echo.timerSync ?? false,
      this.currentImageSrc,
    ].join(':')

    if (!echo.enabled || !this.imageSprite) {
      this.clearEcho()
      return
    }

    if (this.echoAnimationKey === animationKey && this.echoSprite) {
      return
    }

    this.clearEcho()
    this.echoAnimationKey = animationKey

    const sprite = new PIXI.Sprite(this.imageSprite.texture)
    sprite.anchor.set(0.5)
    sprite.blendMode = 'normal'
    this.echoLayer.addChild(sprite)
    this.echoSprite = sprite

    this.echoProgressProxy = { progress: 0 }
    const proxy = this.echoProgressProxy
    this.syncEchoSprite(echo, proxy.progress)
    this.echoGsapTween = gsap.to(proxy, {
      progress: 1,
      duration: Math.max(0.1, echo.durationSec),
      ease: 'none',
      repeat: -1,
      onRepeat: () => {
        proxy.progress = 0
        if (this.echoSprite && this.imageSprite) {
          this.echoSprite.texture = this.imageSprite.texture
        }
        this.syncEchoSprite(echo, proxy.progress)
      },
      onUpdate: () => this.syncEchoSprite(echo, proxy.progress),
    })
  }

  private syncEchoSprite(echo: EchoEffect, progress: number) {
    if (!this.echoSprite || !this.imageSprite) return
    const p = clamp(progress, 0, 1)

    const timerP = (echo.timerSync && this.timerEnabled) ? this.timerProgress : 1
    const effectiveStartAlpha = clamp(echo.startAlpha, 0, 1) * timerP
    const effectiveEndScale = 1 + (echo.endScale - 1) * timerP

    const scale = echo.startScale + (effectiveEndScale - echo.startScale) * p
    this.echoSprite.x = this.imageSprite.x
    this.echoSprite.y = this.imageSprite.y
    this.echoSprite.rotation = this.imageSprite.rotation
    this.echoSprite.scale.set(this.imageSprite.scale.x * scale, this.imageSprite.scale.y * scale)

    if (effectiveStartAlpha <= 0) {
      this.echoSprite.alpha = 0
      return
    }
    this.echoSprite.alpha = effectiveStartAlpha * (1 - p)
  }

  private syncEchoToImage() {
    if (!this.latestEffects?.echo.enabled || !this.echoSprite || !this.echoProgressProxy) return
    const echo = this.latestEffects.echo
    const progress = clamp(this.echoProgressProxy.progress, 0, 1)
    this.syncEchoSprite(echo, progress)
  }

  private refreshEcho() {
    if (!this.latestEffects) return
    this.echoAnimationKey = null
    this.updateEcho(this.latestEffects)
  }

  private clearEcho() {
    this.echoGsapTween?.kill()
    this.echoGsapTween = null
    this.echoAnimationKey = null
    this.echoProgressProxy = null
    if (this.echoSprite) {
      this.echoLayer.removeChild(this.echoSprite)
      this.echoSprite.destroy({ texture: false })
      this.echoSprite = null
    }
  }

  private createFlashVectorTexture(presetId: string): PIXI.Texture | null {
    const holder = createVectorDynamicAssetDisplay(
      presetId,
      0xffffff,
      BUILTIN_VECTOR_FLASH_RASTER_GEOMETRY_SCALE,
    )
    if (!holder) return null
    try {
      const canvas = this.pixiRenderer.extract.canvas({
        target: holder,
        clearColor: [0, 0, 0, 0],
        antialias: true,
      }) as HTMLCanvasElement
      holder.destroy({ children: true })
      return PIXI.Texture.from(canvas)
    } catch {
      holder.destroy({ children: true })
      return null
    }
  }

  private async updateFlash(effects: CellEffects) {
    const flash = effects.flash
    this.flashOverlayEffect = flash
    this.flashBaseOpacity = clamp(flash.opacity ?? 1, 0, 1)
    this.flashCycleDurationSec = Math.max(
      0.2,
      this.flashResolvedDisplayPhaseSec(flash) +
      Math.max(0, flash.endTransitionDurationSec ?? 0) +
      Math.max(0, flash.intervalSec ?? 0)
    )

    const vectorId =
      flash.vectorPresetId && isBuiltinVectorDynamicAssetPreset(flash.vectorPresetId)
        ? flash.vectorPresetId
        : null
    const hasRaster = Boolean(flash.imagePath)
    if (!flash.enabled || (!vectorId && !hasRaster)) {
      this.clearFlashOverlay()
      return
    }

    const textureKey = vectorId ? `vector:${vectorId}` : toFileUrl(flash.imagePath!)

    if (this.flashTextureKey !== textureKey || !this.flashOverlaySprite) {
      const nonce = ++this.flashTextureRequestNonce
      this.flashTextureLoadingKey = textureKey

      if (vectorId) {
        try {
          if (this.flashOwnedTexture) {
            this.flashOwnedTexture.destroy(true)
            this.flashOwnedTexture = null
          }
          const texture = this.createFlashVectorTexture(vectorId)
          if (nonce !== this.flashTextureRequestNonce || this.flashTextureLoadingKey !== textureKey) {
            texture?.destroy(true)
            return
          }
          if (!texture) return
          this.flashOwnedTexture = texture
          this.ensureFlashOverlaySprite(texture)
          this.flashTextureKey = textureKey
          this.flashElapsedSec = 0
        } catch {
          // ignore
        }
        return
      }

      try {
        if (this.flashOwnedTexture) {
          this.flashOwnedTexture.destroy(true)
          this.flashOwnedTexture = null
        }
        const loadableUrl = await toLoadableImageUrl(toFileUrl(flash.imagePath!))
        if (nonce !== this.flashTextureRequestNonce || this.flashTextureLoadingKey !== textureKey) return
        const texture = await PIXI.Assets.load(loadableUrl)
        if (nonce !== this.flashTextureRequestNonce || this.flashTextureLoadingKey !== textureKey) return
        this.ensureFlashOverlaySprite(texture)
        this.flashTextureKey = textureKey
        this.flashElapsedSec = 0
      } catch {
        // ignore
      }
      return
    }
    this.applyFlashOverlayFilters()
    this.positionFlashOverlaySprite()
    this.syncFlashVectorTint(false)
  }

  private ensureFlashOverlaySprite(texture: PIXI.Texture) {
    if (!this.flashOverlaySprite) {
      this.flashOverlaySprite = new PIXI.Sprite(texture)
      this.flashOverlaySprite.anchor.set(0.5)
      this.flashOverlaySprite.alpha = 0
      this.flashOverlaySprite.visible = false
      this.overlayLayer.addChild(this.flashOverlaySprite)
    } else {
      this.flashOverlaySprite.texture = texture
    }
    const startTr = this.flashOverlayEffect?.startTransition ?? 'none'
    this.flashOverlaySprite.alpha =
      startTr === 'fade' || startTr === 'zoom-in' || startTr === 'zoom-out' ? 0 : this.flashBaseOpacity
    this.applyFlashOverlayFilters()
    this.positionFlashOverlaySprite()
    this.syncFlashVectorTint(false)
  }

  private applyFlashOverlayFilters() {
    const sprite = this.flashOverlaySprite
    if (!sprite) return
    const flash = this.flashOverlayEffect
    const surroundingTransparency = flash?.surroundingTransparency ?? 0
    const innerRadius = flash?.innerRadius ?? 0.5
    const blurStrength = clamp(flash?.blurStrength ?? 0, 0, 100)

    const filters: PIXI.Filter[] = []

    if (blurStrength > 0) {
      if (!this.flashBlurFilter) {
        this.flashBlurFilter = new PIXI.BlurFilter({ strength: blurStrength, quality: 4 })
      } else {
        this.flashBlurFilter.strength = blurStrength
      }
      filters.push(this.flashBlurFilter)
    } else if (this.flashBlurFilter) {
      this.flashBlurFilter.destroy()
      this.flashBlurFilter = null
    }

    if (surroundingTransparency > 0) {
      if (!this.flashRadialFadeFilter) {
        this.flashRadialFadeFilter = createFlashRadialFadeFilter()
      }
      setFlashRadialFadeUniforms(this.flashRadialFadeFilter, {
        uInnerRadius: innerRadius,
        uSurroundingTransparency: surroundingTransparency,
        uAspect: this.height > 0 ? this.width / this.height : 1,
        uRadialCenterX: 0.5,
        uRadialCenterY: 0.5,
      })
      filters.push(this.flashRadialFadeFilter)
    } else if (this.flashRadialFadeFilter) {
      this.flashRadialFadeFilter.destroy()
      this.flashRadialFadeFilter = null
    }

    sprite.filters = filters
  }

  private positionFlashOverlaySprite(offsetX = 0, offsetY = 0, scaleMultiplier = 1) {
    if (!this.flashOverlaySprite) return
    const texW = this.flashOverlaySprite.texture.width
    const texH = this.flashOverlaySprite.texture.height
    const ratio = clamp(this.flashOverlayEffect?.scaleRatio ?? 1, 0.1, 3)
    const scale = this.getImageScale(texW, texH) * scaleMultiplier * ratio
    this.flashOverlaySprite.scale.set(scale)
    this.flashOverlaySprite.x = this.width / 2 + offsetX
    this.flashOverlaySprite.y = this.height / 2 + offsetY
    if (this.flashRadialFadeFilter && this.flashOverlaySprite.filters?.length) {
      setFlashRadialFadeUniforms(this.flashRadialFadeFilter, {
        uInnerRadius: this.flashOverlayEffect?.innerRadius ?? 0.5,
        uSurroundingTransparency: this.flashOverlayEffect?.surroundingTransparency ?? 0,
        uAspect: this.height > 0 ? this.width / this.height : 1,
        uRadialCenterX: 0.5,
        uRadialCenterY: 0.5,
      })
    }
  }

  /** ベクターアセット用ティント。`fromCycleStart` が true のときのみ色適用度ランダムを再サンプル（動的アセットと同様）。 */
  private syncFlashVectorTint(fromCycleStart: boolean) {
    const sprite = this.flashOverlaySprite
    const flash = this.flashOverlayEffect
    if (!sprite || !flash) return
    const vectorId =
      flash.vectorPresetId && isBuiltinVectorDynamicAssetPreset(flash.vectorPresetId)
        ? flash.vectorPresetId
        : null
    if (!vectorId) {
      sprite.tint = 0xffffff
      return
    }
    if (flash.colorOverlayAlphaRandomEnabled) {
      if (fromCycleStart) {
        const alpha = 0.4 + Math.random() * 0.6
        sprite.tint = tintFromAssetColorOverlay(flash.colorOverlayColor, alpha)
      }
      return
    }
    if ((flash.colorOverlayAlpha ?? 0) <= 0) {
      sprite.tint = 0xffffff
      return
    }
    sprite.tint = tintFromAssetColorOverlay(flash.colorOverlayColor, flash.colorOverlayAlpha ?? 0)
  }

  /** UI の維持時間（0 可）に内部下限を足した「表示フェーズ」長。開始／終了トランジション時間とは加算しない */
  private flashResolvedDisplayPhaseSec(flash: CellEffects['flash']): number {
    return Math.max(Math.max(0, flash.displayDurationSec ?? 0), FLASH_DISPLAY_PHASE_MIN_SEC)
  }

  private updateFlashCycle(delta: number) {
    const flash = this.flashOverlayEffect
    if (!flash) return
    const vectorId =
      flash.vectorPresetId && isBuiltinVectorDynamicAssetPreset(flash.vectorPresetId)
        ? flash.vectorPresetId
        : null
    const hasRaster = Boolean(flash.imagePath)
    if (!flash?.enabled || (!vectorId && !hasRaster) || !this.flashOverlaySprite) return
    const dtSec = Math.max(0, delta) / 60
    this.flashElapsedSec += dtSec
    while (this.flashElapsedSec >= this.flashCycleDurationSec) {
      this.flashElapsedSec -= this.flashCycleDurationSec
      this.flashCurrentShowNonce += 1
      this.flashCurrentHideNonce += 1
      this.startFlashShow(this.flashCurrentShowNonce)
    }
    const displayPhaseSec = this.flashResolvedDisplayPhaseSec(flash)
    const shouldBeVisible = this.flashElapsedSec < displayPhaseSec
    if (shouldBeVisible !== this.flashOverlayVisible) {
      if (shouldBeVisible) {
        this.flashCurrentShowNonce += 1
        this.startFlashShow(this.flashCurrentShowNonce)
      } else {
        this.flashCurrentHideNonce += 1
        this.startFlashHide(this.flashCurrentHideNonce)
      }
    }
    if (this.flashOverlayVisible) this.syncFlashOverlayToImage()
  }

  private startFlashShow(nonce: number) {
    const flash = this.flashOverlayEffect
    const sprite = this.flashOverlaySprite
    if (!flash || !sprite) return
    this.flashOverlayVisible = true
    this.flashEndTween?.kill()
    this.flashEndTween = null
    this.flashStartTween?.kill()
    this.flashStartTween = null
    sprite.visible = true
    sprite.alpha = this.flashBaseOpacity
    this.positionFlashOverlaySprite()
    this.syncFlashVectorTint(true)
    if (flash.startTransition === 'none') return
    const duration = Math.max(0.05, flash.startTransitionDurationSec)
    const proxy = {
      incomingOffsetX: 0,
      incomingOffsetY: 0,
      outgoingOffsetX: 0,
      outgoingOffsetY: 0,
      incomingScaleMultiplier: flash.startTransition === 'zoom-in' ? 1.12 : 0.88,
    }
    if (flash.startTransition === 'fade') {
      sprite.alpha = 0
      this.flashStartTween = gsap.to(sprite, { alpha: this.flashBaseOpacity, duration, ease: 'sine.out' })
      return
    }
    if (flash.startTransition === 'slide-left' || flash.startTransition === 'slide-right' || flash.startTransition === 'slide-up' || flash.startTransition === 'slide-down') {
      proxy.incomingOffsetX = flash.startTransition === 'slide-left' ? this.width : flash.startTransition === 'slide-right' ? -this.width : 0
      proxy.incomingOffsetY = flash.startTransition === 'slide-up' ? this.height : flash.startTransition === 'slide-down' ? -this.height : 0
      this.positionFlashOverlaySprite(proxy.incomingOffsetX, proxy.incomingOffsetY, 1)
      this.flashStartProxy = proxy
      this.flashStartTween = gsap.to(proxy, {
        incomingOffsetX: 0,
        incomingOffsetY: 0,
        duration,
        ease: 'sine.out',
        onUpdate: () => {
          if (nonce !== this.flashCurrentShowNonce || !this.flashOverlayVisible || !this.flashOverlaySprite) return
          this.positionFlashOverlaySprite(proxy.incomingOffsetX, proxy.incomingOffsetY, 1)
        },
      })
      return
    }
    this.flashStartProxy = proxy
    sprite.alpha = 0
    const tl = gsap.timeline()
    tl.to(
      proxy,
      {
        incomingScaleMultiplier: 1,
        duration,
        ease: 'sine.out',
        onUpdate: () => {
          if (nonce !== this.flashCurrentShowNonce || !this.flashOverlayVisible || !this.flashOverlaySprite) return
          this.positionFlashOverlaySprite(0, 0, proxy.incomingScaleMultiplier)
        },
      },
      0,
    )
    tl.to(
      sprite,
      {
        alpha: this.flashBaseOpacity,
        duration: ZOOM_TRANSITION_ALPHA_IN_SEC,
        ease: 'sine.out',
      },
      0,
    )
    this.flashStartTween = tl
  }

  private startFlashHide(nonce: number) {
    const flash = this.flashOverlayEffect
    const sprite = this.flashOverlaySprite
    if (!flash || !sprite) return
    this.flashOverlayVisible = false
    this.flashStartTween?.kill()
    this.flashStartTween = null
    this.flashEndTween?.kill()
    this.flashEndTween = null
    const finish = () => {
      if (nonce !== this.flashCurrentHideNonce || this.flashOverlayVisible || !this.flashOverlaySprite) return
      this.flashOverlaySprite.visible = false
      this.flashOverlaySprite.alpha = 0
      this.positionFlashOverlaySprite()
    }
    if (flash.endTransition === 'none') {
      finish()
      return
    }
    const duration = Math.max(0.05, flash.endTransitionDurationSec)
    if (flash.endTransition === 'fade') {
      this.flashEndTween = gsap.to(sprite, { alpha: 0, duration, ease: 'sine.out', onComplete: finish })
      return
    }
    if (flash.endTransition === 'slide-left' || flash.endTransition === 'slide-right' || flash.endTransition === 'slide-up' || flash.endTransition === 'slide-down') {
      const proxy = {
        incomingOffsetX: 0,
        incomingOffsetY: 0,
        outgoingOffsetX: flash.endTransition === 'slide-left' ? -this.width * 0.25 : flash.endTransition === 'slide-right' ? this.width * 0.25 : 0,
        outgoingOffsetY: flash.endTransition === 'slide-up' ? -this.height * 0.25 : flash.endTransition === 'slide-down' ? this.height * 0.25 : 0,
        outgoingScaleMultiplier: 1,
      }
      this.flashEndProxy = proxy
      this.flashEndTween = gsap.to(proxy, {
        outgoingOffsetX: proxy.outgoingOffsetX,
        outgoingOffsetY: proxy.outgoingOffsetY,
        duration,
        ease: 'sine.out',
        onUpdate: () => {
          if (nonce !== this.flashCurrentHideNonce || this.flashOverlayVisible || !this.flashOverlaySprite) return
          this.flashOverlaySprite.alpha = Math.max(0, this.flashBaseOpacity * (1 - (this.flashEndTween?.progress() ?? 0)))
          this.positionFlashOverlaySprite(proxy.outgoingOffsetX, proxy.outgoingOffsetY, 1)
        },
        onComplete: finish,
      })
      return
    }
    const proxy = {
      incomingOffsetX: 0,
      incomingOffsetY: 0,
      outgoingOffsetX: 0,
      outgoingOffsetY: 0,
      outgoingScaleMultiplier: 1,
    }
    this.flashEndProxy = proxy
    this.flashEndTween = gsap.to(proxy, {
      outgoingScaleMultiplier: flash.endTransition === 'zoom-in' ? 1.2 : 0.8,
      duration,
      ease: 'sine.out',
      onUpdate: () => {
        if (nonce !== this.flashCurrentHideNonce || this.flashOverlayVisible || !this.flashOverlaySprite) return
        this.flashOverlaySprite.alpha = Math.max(0, this.flashBaseOpacity * (1 - (this.flashEndTween?.progress() ?? 0)))
        this.positionFlashOverlaySprite(0, 0, proxy.outgoingScaleMultiplier)
      },
      onComplete: finish,
    })
  }

  private syncFlashOverlayToImage() {
    if (!this.flashOverlaySprite || !this.flashOverlayVisible) return
    if (this.flashStartProxy) {
      this.positionFlashOverlaySprite(this.flashStartProxy.incomingOffsetX, this.flashStartProxy.incomingOffsetY, this.flashStartProxy.incomingScaleMultiplier)
      return
    }
    if (this.flashEndProxy) {
      this.positionFlashOverlaySprite(this.flashEndProxy.outgoingOffsetX, this.flashEndProxy.outgoingOffsetY, this.flashEndProxy.outgoingScaleMultiplier)
      return
    }
    this.positionFlashOverlaySprite()
  }

  private clearFlashOverlay() {
    this.flashStartTween?.kill()
    this.flashEndTween?.kill()
    this.flashStartTween = null
    this.flashEndTween = null
    this.flashStartProxy = null
    this.flashEndProxy = null
    this.flashOverlayVisible = false
    this.flashElapsedSec = 0
    this.flashTextureKey = null
    this.flashTextureLoadingKey = null
    this.flashOverlayEffect = null
    if (this.flashOverlaySprite) {
      this.flashOverlaySprite.filters = null
      this.overlayLayer.removeChild(this.flashOverlaySprite)
      this.flashOverlaySprite.destroy({ texture: false })
      this.flashOverlaySprite = null
    }
    if (this.flashOwnedTexture) {
      this.flashOwnedTexture.destroy(true)
      this.flashOwnedTexture = null
    }
    if (this.flashBlurFilter) {
      this.flashBlurFilter.destroy()
      this.flashBlurFilter = null
    }
    if (this.flashRadialFadeFilter) {
      this.flashRadialFadeFilter.destroy()
      this.flashRadialFadeFilter = null
    }
  }

  private normalizeOneshotMode(mode?: 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB') {
    return mode === 'oneshot' || mode == null ? 'oneshotA' : mode
  }

  private isOneshotMode(mode?: 'oneshot' | 'oneshotA' | 'oneshotB' | 'permanentA' | 'permanentB') {
    const normalizedMode = this.normalizeOneshotMode(mode)
    return normalizedMode === 'oneshotA' || normalizedMode === 'oneshotB'
  }

  private updateSquish(squish?: SquishEffect) {
    const normalizedMode = this.normalizeOneshotMode(squish?.mode)
    const key = squish
      ? [
          squish.enabled,
          normalizedMode,
          squish.organicEnabled,
          squish.colorSource,
          squish.circleSizeRatio,
          squish.gapRatio,
          squish.color.r,
          squish.color.g,
          squish.color.b,
          squish.alpha,
          squish.opacity,
          squish.featherStrength,
          squish.speedFactor,
          squish.repeatEnabled,
          squish.repeatIntervalSec,
          squish.timerSync ?? false,
          squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
          squish.timerSyncEndOpacity ?? 1,
          squish.randomPosition ?? false,
          squish.burstEnabled ?? false,
          squish.burstMaxOpacity ?? 0.8,
          squish.syncNonce ?? 0,
          squish.gapCorrectionEnabled ?? false,
          squish.gapCorrectionScale ?? 1.5,
          squish.circlePositionY ?? 0.5,
          squish.circleGapFactor ?? 1,
        ].join(':')
      : 'disabled'

    if (!squish?.enabled) {
      if (this.squishKey !== key) this.clearSquish(false)
      this.squishKey = key
      return
    }

    if (this.squishKey === key) return
    this.squishKey = key
    this.resetSquishMotion(squish)
    const mode = normalizedMode
    if (mode === 'permanentA') {
      this.drawSquishPermanent(squish, 0)
    } else if (mode === 'permanentB') {
      this.drawSquishPermanentB(squish, 0)
    } else {
      this.drawSquish(squish, 0, mode)
    }
  }

  private tickSquish(delta: number, squish?: SquishEffect) {
    if (!squish?.enabled) return

    const dtSec = Math.max(0, delta) / 60
    const mode = this.normalizeOneshotMode(squish.mode)

    if (mode === 'permanentA' || mode === 'permanentB') {
      const animationSec = this.getSquishAnimationDurationSec(squish)
      if (animationSec <= 0) return
      this.squishElapsedSec += dtSec
      if (this.squishElapsedSec >= animationSec) {
        this.squishElapsedSec %= animationSec
        this.resetSquishOrganicShapes()
        this.squishBurstTriggeredThisCycle = false
      }
      if (mode === 'permanentB') {
        this.drawSquishPermanentB(squish, this.squishElapsedSec)
      } else {
        this.drawSquishPermanent(squish, this.squishElapsedSec)
      }
      this.tickSquishBurst(dtSec, squish, this.squishElapsedSec, mode, animationSec, this.width / 2, this.height * (squish.circlePositionY ?? 0.5))
      return
    }

    const animationSec = this.getSquishAnimationDurationSec(squish)
    const intervalSec = Math.max(0, squish.repeatIntervalSec)
    const cycleSec = animationSec + (squish.repeatEnabled ? intervalSec : 0)

    if (this.squishCycleComplete && !squish.repeatEnabled) {
      this.tickSquishBurst(dtSec, squish, animationSec, mode, animationSec, this.width / 2, this.height * (squish.circlePositionY ?? 0.5))
      return
    }

    this.squishElapsedSec += dtSec
    if (squish.repeatEnabled && cycleSec > 0) {
      const didWrap = this.squishElapsedSec >= cycleSec
      this.squishElapsedSec %= cycleSec
      if (didWrap) {
        this.resetSquishOrganicShapes()
        if (squish.randomPosition) this.computeSquishRandomPosition(squish)
        this.squishBurstTriggeredThisCycle = false
      }
    } else if (this.squishElapsedSec >= animationSec) {
      this.squishElapsedSec = animationSec
      this.squishCycleComplete = true
    }

    const baseX = (squish.randomPosition && this.squishRandomPosition)
      ? this.squishRandomPosition.x : this.width / 2
    const baseY = (squish.randomPosition && this.squishRandomPosition)
      ? this.squishRandomPosition.y : this.height * (squish.circlePositionY ?? 0.5)
    this.drawSquish(squish, this.squishElapsedSec, mode)
    this.tickSquishBurst(dtSec, squish, this.squishElapsedSec, mode, animationSec, baseX, baseY)
  }

  private computeSquishScaleFromProgress(mode: string, progress: number): number {
    if (mode === 'permanentA') {
      const growEnd = 0.25
      const peakScale = 1.06
      const minScale = 0.35
      return progress < growEnd
        ? lerp(minScale, peakScale, easeOutBack(progress / growEnd))
        : lerp(peakScale, minScale, easeInOutSine((progress - growEnd) / (1 - growEnd)))
    }
    if (mode === 'permanentB') {
      const minScale = 0.35
      const maxScale = 1.0
      const expandEnd = 0.5
      return progress < expandEnd
        ? lerp(minScale, maxScale, easeInOutCubic(progress / expandEnd))
        : lerp(maxScale, minScale, easeInOutCubic((progress - expandEnd) / (1 - expandEnd)))
    }
    // oneshotA/oneshotB
    const growProgress = clamp(progress / 0.58, 0, 1)
    const settleProgress = clamp((progress - 0.58) / 0.34, 0, 1)
    const peakScale = 1.06
    const settledScale = 0.97
    return progress < 0.58
      ? (mode === 'oneshotB'
          ? peakScale * easeOutBack(growProgress)
          : lerp(0.0, peakScale, easeInOutSine(growProgress)))
      : lerp(peakScale, settledScale, easeInOutSine(settleProgress))
  }

  private tickSquishBurst(
    dtSec: number,
    squish: SquishEffect,
    elapsedSec: number,
    mode: string,
    animationSec: number,
    baseX: number,
    baseY: number
  ) {
    if (!squish.burstEnabled) {
      this.squishBurstGraphics.clear()
      return
    }

    if (!this.squishBurstTriggeredThisCycle && animationSec > 0) {
      const progress = clamp(elapsedSec / animationSec, 0, 1)
      const scale = this.computeSquishScaleFromProgress(mode, progress)
      if (scale >= 0.8) {
        this.squishBurstTriggeredThisCycle = true
        this.squishBurstActiveSec = 0
        const minSide = Math.max(1, Math.min(this.width, this.height))
        const finalDiameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5)
        const edgeGap = finalDiameter * clamp(squish.gapRatio, -0.5, 0.5) * (squish.circleGapFactor ?? 1)
        const centerOffset = this.applySquishGapCorrection((finalDiameter + edgeGap) / 2, squish)
        this.squishBurstRadius = finalDiameter / 2
        this.squishBurstCenters = [
          { x: baseX - centerOffset, y: baseY },
          { x: baseX + centerOffset, y: baseY },
        ]
      }
    }

    if (this.squishBurstActiveSec !== null) {
      this.squishBurstActiveSec += dtSec
      this.drawSquishBurst(squish)
    } else {
      this.squishBurstGraphics.clear()
    }
  }

  private drawSquishBurst(squish: SquishEffect) {
    this.squishBurstGraphics.clear()
    if (this.squishBurstActiveSec === null) return

    const overallOpacity = this.getTimerSyncedOpacity(
      clamp(squish.opacity ?? 1, 0, 1),
      squish.timerSync ?? false,
      squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
      squish.timerSyncEndOpacity ?? 1
    )
    const maxOpacity = this.getTimerSyncedOpacity(
      clamp(squish.burstMaxOpacity ?? 0.8, 0, 1) * overallOpacity,
      squish.timerSync ?? false,
      squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
      squish.timerSyncEndOpacity ?? 1
    )
    const fadeInSec = 0.10
    const totalSec = 0.9
    const elapsed = this.squishBurstActiveSec

    if (elapsed >= totalSec) {
      this.squishBurstActiveSec = null
      return
    }

    let fadeAlpha: number
    if (elapsed < fadeInSec) {
      fadeAlpha = easeOutSine(elapsed / fadeInSec)
    } else {
      fadeAlpha = easeOutSine(1 - (elapsed - fadeInSec) / (totalSec - fadeInSec))
    }
    if (fadeAlpha <= 0) return

    const innerR = this.squishBurstRadius * 1.0
    const outerR = this.squishBurstRadius * 1.5
    const steps = 16

    for (const center of this.squishBurstCenters) {
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps
        const t1 = (i + 1) / steps
        const r0 = innerR + (outerR - innerR) * t0
        const r1 = innerR + (outerR - innerR) * t1
        // 内側から外側へ向かって透明度が下がるグラデーション
        const ringAlpha = maxOpacity * fadeAlpha * (1 - t0)
        if (ringAlpha <= 0) continue
        this.squishBurstGraphics.circle(center.x, center.y, r1)
        this.squishBurstGraphics.cut()
        this.squishBurstGraphics.circle(center.x, center.y, r0)
        this.squishBurstGraphics.fill({ color: 0xffffff, alpha: ringAlpha })
      }
    }

    const strength = clamp(squish.featherStrength ?? 0, 0, 24)
    if (strength <= 0) {
      this.squishBurstGraphics.filters = []
      this.squishBurstBlurFilter = null
    } else {
      if (!this.squishBurstBlurFilter) {
        this.squishBurstBlurFilter = new PIXI.BlurFilter({ strength, quality: 4 })
        this.squishBurstGraphics.filters = [this.squishBurstBlurFilter]
      } else {
        this.squishBurstBlurFilter.strength = strength
      }
      this.squishBurstGraphics.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    }
  }

  private drawSquish(squish: SquishEffect, elapsedSec: number, mode: string) {
    this.squishGraphics.clear()
    const animationSec = this.getSquishAnimationDurationSec(squish)
    if (elapsedSec >= animationSec) return

    const progress = clamp(elapsedSec / animationSec, 0, 1)
    const growProgress = clamp(progress / 0.58, 0, 1)
    const settleProgress = clamp((progress - 0.58) / 0.34, 0, 1)
    const fadeProgress = clamp((progress - 0.8) / 0.2, 0, 1)
    const peakScale = 1.06
    const settledScale = 0.97
    const scale = progress < 0.58
      ? (mode === 'oneshotB'
          ? peakScale * easeOutBack(growProgress)
          : lerp(0.0, peakScale, easeInOutSine(growProgress)))
      : lerp(peakScale, settledScale, easeInOutSine(settleProgress))
    const drawAlpha = 1 - easeInSine(fadeProgress)
    if (scale <= 0 || drawAlpha <= 0) return

    this.updateSquishFeather(squish)

    const minSide = Math.max(1, Math.min(this.width, this.height))
    const diameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5) * scale
    const radius = diameter / 2
    const finalDiameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5)
    const edgeGap = finalDiameter * clamp(squish.gapRatio, -0.5, 0.5) * (squish.circleGapFactor ?? 1)
    const centerOffset = (finalDiameter + edgeGap) / 2
    const centerX = this.width / 2
    const color = rgbToHex(squish.color.r, squish.color.g, squish.color.b)
    const opacity = this.getTimerSyncedOpacity(
      clamp(squish.opacity ?? 1, 0, 1),
      squish.timerSync ?? false,
      squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
      squish.timerSyncEndOpacity ?? 1
    )
    const colorAlpha = clamp(squish.alpha, 0, 1) * drawAlpha * opacity
    const baseAlpha = clamp(0.42 + squish.alpha * 0.18, 0, 0.65) * drawAlpha * opacity
    const secondRadius = radius * 0.85
    const secondColor = darkenColor(color, 0.72)
    const secondBaseAlpha = clamp(baseAlpha + 0.12 * drawAlpha * opacity, 0, 0.8)
    const secondColorAlpha = clamp(colorAlpha + 0.16 * drawAlpha * opacity, 0, 1)
    const organicShape = squish.organicEnabled
      ? this.getSquishOrganicShape(elapsedSec)
      : undefined
    const effectiveRadius = radius * (organicShape?.sizeScale ?? 1)
    const effectiveSecondRadius = secondRadius * (organicShape?.sizeScale ?? 1)

    const baseX = (squish.randomPosition && this.squishRandomPosition)
      ? this.squishRandomPosition.x
      : this.width / 2
    const baseY = (squish.randomPosition && this.squishRandomPosition)
      ? this.squishRandomPosition.y
      : this.height * (squish.circlePositionY ?? 0.5)
    const correctedCenterOffset = this.applySquishGapCorrection(centerOffset, squish)
    const centers: [number, number] = [baseX - correctedCenterOffset, baseX + correctedCenterOffset]
    this.drawSquishBlobPair(centers, baseY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: baseAlpha })
    this.drawSquishBlobPair(centers, baseY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color, alpha: colorAlpha })
    this.drawSquishBlobPair(centers, baseY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: secondBaseAlpha })
    this.drawSquishBlobPair(centers, baseY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: secondColor, alpha: secondColorAlpha })
  }

  private drawSquishPermanent(squish: SquishEffect, elapsedSec: number) {
    this.squishGraphics.clear()
    const animationSec = this.getSquishAnimationDurationSec(squish)
    if (animationSec <= 0) return

    const progress = clamp(elapsedSec / animationSec, 0, 1)
    const growEnd = 0.25
    const peakScale = 1.06
    const minScale = 0.35
    const scale = progress < growEnd
      ? lerp(minScale, peakScale, easeOutBack(progress / growEnd))
      : lerp(peakScale, minScale, easeInOutSine((progress - growEnd) / (1 - growEnd)))

    if (scale <= 0) return

    this.updateSquishFeather(squish)

    const minSide = Math.max(1, Math.min(this.width, this.height))
    const diameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5) * scale
    const radius = diameter / 2
    const finalDiameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5)
    const edgeGap = finalDiameter * clamp(squish.gapRatio, -0.5, 0.5) * (squish.circleGapFactor ?? 1)
    const centerOffset = (finalDiameter + edgeGap) / 2
    const centerX = this.width / 2
    const centerY = this.height * (squish.circlePositionY ?? 0.5)
    const color = rgbToHex(squish.color.r, squish.color.g, squish.color.b)
    const opacity = this.getTimerSyncedOpacity(
      clamp(squish.opacity ?? 1, 0, 1),
      squish.timerSync ?? false,
      squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
      squish.timerSyncEndOpacity ?? 1
    )
    const colorAlpha = clamp(squish.alpha, 0, 1) * opacity
    const baseAlpha = clamp(0.42 + squish.alpha * 0.18, 0, 0.65) * opacity
    const secondRadius = radius * 0.85
    const secondColor = darkenColor(color, 0.72)
    const secondBaseAlpha = clamp(baseAlpha + 0.12 * opacity, 0, 0.8)
    const secondColorAlpha = clamp(colorAlpha + 0.16 * opacity, 0, 1)
    const organicShape = squish.organicEnabled
      ? this.getSquishOrganicShape(elapsedSec)
      : undefined
    const effectiveRadius = radius * (organicShape?.sizeScale ?? 1)
    const effectiveSecondRadius = secondRadius * (organicShape?.sizeScale ?? 1)

    const correctedCenterOffset = this.applySquishGapCorrection(centerOffset, squish)
    const centers: [number, number] = [centerX - correctedCenterOffset, centerX + correctedCenterOffset]
    this.drawSquishBlobPair(centers, centerY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: baseAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color, alpha: colorAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: secondBaseAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: secondColor, alpha: secondColorAlpha })
  }

  private drawSquishPermanentB(squish: SquishEffect, elapsedSec: number) {
    this.squishGraphics.clear()
    const animationSec = this.getSquishAnimationDurationSec(squish)
    if (animationSec <= 0) return

    const progress = clamp(elapsedSec / animationSec, 0, 1)
    const minScale = 0.35
    const maxScale = 1.0
    const expandEnd = 0.5
    const scale = progress < expandEnd
      ? lerp(minScale, maxScale, easeInOutCubic(progress / expandEnd))
      : lerp(maxScale, minScale, easeInOutCubic((progress - expandEnd) / (1 - expandEnd)))

    if (scale <= 0) return

    this.updateSquishFeather(squish)

    const minSide = Math.max(1, Math.min(this.width, this.height))
    const diameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5) * scale
    const radius = diameter / 2
    const finalDiameter = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5)
    const edgeGap = finalDiameter * clamp(squish.gapRatio, -0.5, 0.5) * (squish.circleGapFactor ?? 1)
    const centerOffset = (finalDiameter + edgeGap) / 2
    const centerX = this.width / 2
    const centerY = this.height * (squish.circlePositionY ?? 0.5)
    const color = rgbToHex(squish.color.r, squish.color.g, squish.color.b)
    const opacity = this.getTimerSyncedOpacity(
      clamp(squish.opacity ?? 1, 0, 1),
      squish.timerSync ?? false,
      squish.timerSyncStartOpacity ?? squish.opacity ?? 1,
      squish.timerSyncEndOpacity ?? 1
    )
    const colorAlpha = clamp(squish.alpha, 0, 1) * opacity
    const baseAlpha = clamp(0.42 + squish.alpha * 0.18, 0, 0.65) * opacity
    const secondRadius = radius * 0.85
    const secondColor = darkenColor(color, 0.72)
    const secondBaseAlpha = clamp(baseAlpha + 0.12 * opacity, 0, 0.8)
    const secondColorAlpha = clamp(colorAlpha + 0.16 * opacity, 0, 1)
    const organicShape = squish.organicEnabled
      ? this.getSquishOrganicShape(elapsedSec)
      : undefined
    const effectiveRadius = radius * (organicShape?.sizeScale ?? 1)
    const effectiveSecondRadius = secondRadius * (organicShape?.sizeScale ?? 1)

    const correctedCenterOffset = this.applySquishGapCorrection(centerOffset, squish)
    const centers: [number, number] = [centerX - correctedCenterOffset, centerX + correctedCenterOffset]
    this.drawSquishBlobPair(centers, centerY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: baseAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveRadius, organicShape)
    this.squishGraphics.fill({ color, alpha: colorAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: 0x000000, alpha: secondBaseAlpha })
    this.drawSquishBlobPair(centers, centerY, effectiveSecondRadius, organicShape)
    this.squishGraphics.fill({ color: secondColor, alpha: secondColorAlpha })
  }

  private computeSquishRandomPosition(squish: SquishEffect) {
    const minSide = Math.min(this.width, this.height)
    const radius = minSide * clamp(squish.circleSizeRatio, 0.05, 1.5) / 2
    const padding = Math.max(radius, minSide * 0.15)
    const minX = padding
    const maxX = this.width - padding
    const minY = padding
    const maxY = this.height - padding
    if (maxX <= minX || maxY <= minY) {
      this.squishRandomPosition = { x: this.width / 2, y: this.height / 2 }
      return
    }
    this.squishRandomPosition = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    }
  }

  private drawSquishBlobPair(
    centerXs: [number, number],
    centerY: number,
    radius: number,
    shape?: SquishOrganicShape
  ) {
    const [leftX, rightX] = centerXs[0] <= centerXs[1]
      ? centerXs
      : [centerXs[1], centerXs[0]]
    const radiusX = radius * (shape?.radiusXScale ?? 1)
    const radiusY = radius * (shape?.radiusYScale ?? 1)
    const distance = rightX - leftX

    if (radiusX <= 0 || radiusY <= 0) return
    if (distance <= 0) {
      this.drawSquishBlob(leftX, centerY, radius, shape)
      return
    }

    if (distance >= radiusX * 2) {
      this.drawSquishBlob(leftX, centerY, radius, shape)
      this.drawSquishBlob(rightX, centerY, radius, shape)
      return
    }

    this.drawMergedEllipsePair(leftX, rightX, centerY, radiusX, radiusY)
  }

  private drawSquishBlob(centerX: number, centerY: number, radius: number, shape?: SquishOrganicShape) {
    if (!shape) {
      this.squishGraphics.circle(centerX, centerY, radius)
      return
    }

    this.squishGraphics.ellipse(
      centerX,
      centerY,
      radius * shape.radiusXScale,
      radius * shape.radiusYScale
    )
  }

  private drawMergedEllipsePair(
    leftX: number,
    rightX: number,
    centerY: number,
    radiusX: number,
    radiusY: number
  ) {
    const halfNormalizedDistance = clamp((rightX - leftX) / (2 * radiusX), 0, 1)
    const intersectionAngle = Math.acos(halfNormalizedDistance)
    const leftStart = intersectionAngle
    const leftEnd = Math.PI * 2 - intersectionAngle
    const rightStart = Math.PI + intersectionAngle
    const rightEnd = Math.PI * 3 - intersectionAngle
    const steps = 40
    let firstPoint = true

    const addArc = (centerX: number, start: number, end: number) => {
      for (let i = 0; i <= steps; i += 1) {
        const angle = start + ((end - start) * i) / steps
        const x = centerX + Math.cos(angle) * radiusX
        const y = centerY + Math.sin(angle) * radiusY
        if (firstPoint) {
          this.squishGraphics.moveTo(x, y)
          firstPoint = false
        } else {
          this.squishGraphics.lineTo(x, y)
        }
      }
    }

    addArc(leftX, leftStart, leftEnd)
    addArc(rightX, rightStart, rightEnd)
  }

  private static readonly ORGANIC_TRANSITION_SEC = 0.25

  private getSquishOrganicShape(elapsedSec: number): SquishOrganicShape {
    if (!this.squishOrganicShape) {
      this.squishOrganicShape = createSquishOrganicShape()
    }
    const prev = this.squishPrevOrganicShape
    if (!prev || elapsedSec >= CellRenderer.ORGANIC_TRANSITION_SEC) {
      return this.squishOrganicShape
    }
    const t = easeInOutSine(elapsedSec / CellRenderer.ORGANIC_TRANSITION_SEC)
    return {
      radiusXScale: lerp(prev.radiusXScale, this.squishOrganicShape.radiusXScale, t),
      radiusYScale: lerp(prev.radiusYScale, this.squishOrganicShape.radiusYScale, t),
      sizeScale: lerp(prev.sizeScale, this.squishOrganicShape.sizeScale, t),
    }
  }

  private resetSquishOrganicShapes() {
    this.squishPrevOrganicShape = this.squishOrganicShape
    this.squishOrganicShape = null
  }

  private applySquishGapCorrection(centerOffset: number, squish: SquishEffect): number {
    if (!squish.gapCorrectionEnabled) return centerOffset
    const refScale = Math.max(1.001, squish.gapCorrectionScale ?? 1.5)
    const t = (this.zoomScaleMultiplier - 1) / (refScale - 1)
    return centerOffset * lerp(1, refScale, clamp(t, 0, 2))
  }

  private updateSquishFeather(squish: SquishEffect) {
    const strength = clamp(squish.featherStrength ?? 0, 0, 24)
    if (strength <= 0) {
      this.squishGraphics.filters = []
      this.squishGraphics.filterArea = undefined
      this.squishBlurFilter = null
      return
    }

    if (!this.squishBlurFilter) {
      this.squishBlurFilter = new PIXI.BlurFilter({ strength, quality: 4 })
      this.squishGraphics.filters = [this.squishBlurFilter]
    } else {
      this.squishBlurFilter.strength = strength
    }
    this.squishGraphics.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
  }

  private resetSquishMotion(squish?: SquishEffect) {
    this.squishElapsedSec = 0
    this.squishCycleComplete = false
    this.squishOrganicShape = null
    this.squishPrevOrganicShape = null
    if (squish && this.isOneshotMode(squish.mode) && squish.randomPosition) {
      this.computeSquishRandomPosition(squish)
    } else {
      this.squishRandomPosition = null
    }
    this.squishGraphics.clear()
    this.squishBurstActiveSec = null
    this.squishBurstTriggeredThisCycle = false
    this.squishBurstGraphics.clear()
  }

  private clearSquish(resetKey = true) {
    this.resetSquishMotion()
    this.squishGraphics.filters = []
    this.squishGraphics.filterArea = undefined
    this.squishBlurFilter = null
    this.squishBurstGraphics.clear()
    this.squishBurstGraphics.filters = []
    this.squishBurstBlurFilter = null
    if (resetKey) this.squishKey = null
  }

  private getSquishAnimationDurationSec(squish?: SquishEffect) {
    if (!squish?.enabled) return 0
    return 0.9 / clamp(squish.speedFactor, 0.1, 5)
  }

  private getSquishCycleDurationMs(squish?: SquishEffect) {
    if (!squish?.enabled) return 0
    const animSec = this.getSquishAnimationDurationSec(squish)
    const mode = this.normalizeOneshotMode(squish.mode)
    if (mode === 'permanentA' || mode === 'permanentB') return animSec * 1000
    return (animSec + (squish.repeatEnabled ? Math.max(0, squish.repeatIntervalSec) : 0)) * 1000
  }

  // ===== Mist Effect =====

  private getFogGradientTexture(): PIXI.Texture {
    if (this.fogGradientTexture) return this.fogGradientTexture
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const center = size / 2
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.65, 'rgba(255,255,255,0.5)')
    grad.addColorStop(0.85, 'rgba(255,255,255,0.15)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    this.fogGradientTexture = PIXI.Texture.from(canvas)
    return this.fogGradientTexture
  }

  private initFogBlobs(fog: FogEffect, instance: (typeof this.fogInstances)[0]) {
    instance.blobs = []
    const count = Math.max(1, Math.min(12, fog.fogCount))
    const texture = this.getFogGradientTexture()
    const tint = rgbToHex(fog.color.r, fog.color.g, fog.color.b)
    const minSide = Math.min(this.width, this.height)
    const spread = 0.14

    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.tint = tint
      sprite.alpha = 0
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * spread * minSide
      const offsetX = Math.cos(angle) * dist
      const offsetY = Math.sin(angle) * dist
      const phaseDelaySec = (i / count) * 0.35
      instance.blobs.push({ sprite, offsetX, offsetY, phaseDelaySec })
      instance.blobContainer.addChild(sprite)
    }
  }

  private initFogDroplets(fog: FogEffect, instance: (typeof this.fogInstances)[0]) {
    instance.dropletPositions = []
    if (!fog.dropletEnabled) return
    const count = Math.max(1, Math.min(150, fog.dropletCount))
    const halfDiag = Math.sqrt(this.width * this.width + this.height * this.height) / 2
    const spreadRatio = clamp(fog.dropletSpreadRatio ?? 0.85, 0.01, 1.0)
    const cx = instance.centerXRatio * this.width
    const cy = instance.centerYRatio * this.height
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = halfDiag * Math.random() * spreadRatio
      const x = cx + Math.cos(angle) * dist
      const y = cy + Math.sin(angle) * dist
      const rx = 1.5 + Math.random() * 3.5
      const ry = rx * (1.3 + Math.random() * 0.7)
      const baseAlpha = 0.35 + Math.random() * 0.45
      instance.dropletPositions.push({ x, y, rx, ry, baseAlpha })
    }
  }

  private drawFogDroplets(globalAlpha: number, instance: (typeof this.fogInstances)[0]) {
    const g = instance.dropletGraphics
    g.clear()
    // NOTE: 途中で描画を打ち切ると「ある薄さで急に消える」見え方になるため、
    // alpha=0 になるまで描き切る（0以下は何も描かれないので早期returnでOK）
    if (!instance.dropletPositions.length || globalAlpha <= 0) return
    for (const dp of instance.dropletPositions) {
      const a = dp.baseAlpha * globalAlpha
      if (a <= 0) continue
      g.ellipse(dp.x, dp.y, dp.rx, dp.ry)
      g.fill({ color: 0xffffff, alpha: a })
      // ハイライト（光沢感）
      g.ellipse(
        dp.x - dp.rx * 0.28,
        dp.y - dp.ry * 0.28,
        dp.rx * 0.32,
        dp.ry * 0.28
      )
      g.fill({ color: 0xffffff, alpha: Math.min(1, a + 0.25) })
    }
  }

  private renderFogFrame(fog: FogEffect, instance: (typeof this.fogInstances)[0]) {
    const elapsedSec = instance.elapsedSec
    const growSec = Math.max(0.1, fog.growDurationSec)
    const holdSec = Math.max(0, fog.holdDurationSec)
    const fadeSec = Math.max(0.1, fog.fadeDurationSec)
    const effectiveFadeSec = this.getFogEffectiveFadeDurationSec(fadeSec)
    const totalActiveSec = growSec + holdSec + effectiveFadeSec
    const globalAlpha = this.getTimerSyncedOpacity(
      clamp(fog.alpha, 0, 1),
      fog.timerSync ?? false,
      fog.timerSyncStartOpacity ?? fog.alpha,
      fog.timerSyncEndOpacity ?? 1
    )
    const minSide = Math.min(this.width, this.height)
    const maxRadius = minSide * clamp(fog.fogSizeRatio, 0.1, 0.8)
    const cx = instance.centerXRatio * this.width
    const cy = instance.centerYRatio * this.height

    for (const blob of instance.blobs) {
      const t = elapsedSec - blob.phaseDelaySec
      if (t <= 0) {
        blob.sprite.alpha = 0
        blob.sprite.scale.set(0)
        continue
      }

      let blobAlpha: number
      let blobScale: number

      if (t < growSec) {
        const p = t / growSec
        blobAlpha = easeOutSine(p)
        blobScale = easeOutCubic(p)
      } else if (t < growSec + holdSec) {
        blobAlpha = 1
        blobScale = 1
      } else if (t < totalActiveSec) {
        const fadeElapsedSec = t - growSec - holdSec
        const p = this.getFogFadeProgress(fadeElapsedSec, fadeSec)
        blobAlpha = this.getFogFadeAlpha(p)
        // 蒸発感: フェード中にわずかに拡大
        blobScale = 1 + easeInSine(p) * 0.09
      } else {
        blob.sprite.alpha = 0
        blob.sprite.scale.set(0)
        continue
      }

      blob.sprite.alpha = blobAlpha * globalAlpha
      // テクスチャの半分が128px: maxRadius / 128 でスケーリング
      blob.sprite.scale.set(blobScale * maxRadius / 128)
      blob.sprite.x = cx + blob.offsetX
      blob.sprite.y = cy + blob.offsetY
    }

    // 水滴: growing 75% 以降から出現
    const dropletStart = growSec * 0.75
    let dropletAlpha: number
    if (elapsedSec < dropletStart) {
      dropletAlpha = 0
    } else if (elapsedSec < growSec) {
      dropletAlpha = (elapsedSec - dropletStart) / (growSec - dropletStart)
    } else if (elapsedSec < growSec + holdSec) {
      dropletAlpha = 1
    } else {
      const fadeElapsedSec = elapsedSec - growSec - holdSec
      const p = this.getFogFadeProgress(fadeElapsedSec, fadeSec)
      dropletAlpha = this.getFogFadeAlpha(p)
    }
    this.drawFogDroplets(dropletAlpha * globalAlpha, instance)
  }

  private getFogEffectiveFadeDurationSec(fadeSec: number): number {
    const splitSec = fadeSec * FOG_FADE_LINEAR_TAIL_START
    const tailSec = fadeSec * (1 - FOG_FADE_LINEAR_TAIL_START)
    return splitSec + tailSec * FOG_FADE_LINEAR_TAIL_SLOW_FACTOR
  }

  private getFogFadeProgress(fadeElapsedSec: number, fadeSec: number): number {
    const splitSec = fadeSec * FOG_FADE_LINEAR_TAIL_START
    const effectiveTailSec = fadeSec * (1 - FOG_FADE_LINEAR_TAIL_START) * FOG_FADE_LINEAR_TAIL_SLOW_FACTOR
    if (fadeElapsedSec <= splitSec) {
      return clamp(fadeElapsedSec / fadeSec, 0, 1)
    }
    const tailElapsedSec = fadeElapsedSec - splitSec
    const tailProgress = clamp(tailElapsedSec / Math.max(0.0001, effectiveTailSec), 0, 1)
    return clamp(
      FOG_FADE_LINEAR_TAIL_START + tailProgress * (1 - FOG_FADE_LINEAR_TAIL_START),
      0,
      1
    )
  }

  private getFogFadeAlpha(progress: number): number {
    const p = clamp(progress, 0, 1)
    if (p <= FOG_FADE_LINEAR_TAIL_START) {
      return Math.max(0, 1 - easeInSine(p))
    }
    const tailProgress = (p - FOG_FADE_LINEAR_TAIL_START) / (1 - FOG_FADE_LINEAR_TAIL_START)
    const tailStartAlpha = Math.max(0, 1 - easeInSine(FOG_FADE_LINEAR_TAIL_START))
    return Math.max(0, tailStartAlpha * (1 - easeOutSine(tailProgress)))
  }

  private createFogInstance(fog: FogEffect) {
    const randomPos = fog.randomPositionEnabled
    const centerXRatio = randomPos ? (0.2 + Math.random() * 0.6) : 0.5
    const centerYRatio = randomPos ? (0.2 + Math.random() * 0.6) : 0.5

    const container = new PIXI.Container()
    const blobContainer = new PIXI.Container()
    const dropletGraphics = new PIXI.Graphics()
    container.addChild(blobContainer)
    container.addChild(dropletGraphics)

    const instance: (typeof this.fogInstances)[0] = {
      container,
      blobContainer,
      dropletGraphics,
      centerXRatio,
      centerYRatio,
      elapsedSec: 0,
      blobs: [],
      dropletPositions: [],
      blobBlurFilter: null,
      dropletBlurFilter: null,
    }

    this.initFogBlobs(fog, instance)
    this.initFogDroplets(fog, instance)
    this.configureFogInstanceFilters(fog, instance)

    this.fogBlobContainer.addChild(container)
    this.fogInstances.push(instance)
  }

  private configureFogInstanceFilters(fog: FogEffect, instance: (typeof this.fogInstances)[0]) {
    const blobBlurStrength = clamp(fog.blurStrength, 0, 60)
    if (blobBlurStrength <= 0) {
      instance.blobContainer.filters = []
      instance.blobContainer.filterArea = undefined
      instance.blobBlurFilter = null
    } else {
      if (!instance.blobBlurFilter) {
        instance.blobBlurFilter = new PIXI.BlurFilter({ strength: blobBlurStrength, quality: 4 })
        instance.blobContainer.filters = [instance.blobBlurFilter]
      } else {
        instance.blobBlurFilter.strength = blobBlurStrength
      }
      instance.blobContainer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    }

    const dropletBlur = Math.max(0, blobBlurStrength * 0.12)
    if (dropletBlur <= 0) {
      instance.dropletGraphics.filters = []
      instance.dropletGraphics.filterArea = undefined
      instance.dropletBlurFilter = null
    } else {
      if (!instance.dropletBlurFilter) {
        instance.dropletBlurFilter = new PIXI.BlurFilter({ strength: dropletBlur, quality: 2 })
        instance.dropletGraphics.filters = [instance.dropletBlurFilter]
      } else {
        instance.dropletBlurFilter.strength = dropletBlur
      }
      instance.dropletGraphics.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    }
  }

  private updateFog(fog?: FogEffect) {
    const key = fog
      ? [
          fog.enabled,
          fog.randomPositionEnabled,
          fog.color.r,
          fog.color.g,
          fog.color.b,
          fog.alpha,
          fog.timerSync ?? false,
          fog.timerSyncStartOpacity ?? fog.alpha,
          fog.timerSyncEndOpacity ?? 1,
          fog.fogCount,
          fog.fogSizeRatio,
          fog.blurStrength,
          fog.growDurationSec,
          fog.holdDurationSec,
          fog.fadeDurationSec,
          fog.dropletEnabled,
          fog.dropletCount,
          fog.dropletSpreadRatio,
          fog.repeatEnabled,
          fog.repeatIntervalSec,
        ].join(':')
      : 'disabled'

    if (!fog?.enabled) {
      if (this.fogKey !== key) this.clearFog(false)
      this.fogKey = key
      return
    }

    if (this.fogKey === key) return
    this.fogKey = key

    this.clearFog(false)
    this.fogSpawnAccumulatorSec = 0
    this.createFogInstance(fog)
  }

  private tickFog(delta: number, fog?: FogEffect) {
    if (!fog?.enabled) return

    const dtSec = Math.max(0, delta) / 60
    const growSec = Math.max(0.1, fog.growDurationSec)
    const holdSec = Math.max(0, fog.holdDurationSec)
    const fadeSec = Math.max(0.1, fog.fadeDurationSec)
    const totalActiveSec = growSec + holdSec + this.getFogEffectiveFadeDurationSec(fadeSec)

    // Spawn policy:
    // - repeatEnabled: start a new fog every repeatIntervalSec (allow overlap)
    // - repeatDisabled: keep a single fog instance (no overlap)
    const spawnPeriodSec = fog.repeatEnabled ? Math.max(0.05, fog.repeatIntervalSec) : 0

    if (fog.repeatEnabled) {
      this.fogSpawnAccumulatorSec += dtSec
      while (this.fogSpawnAccumulatorSec >= spawnPeriodSec) {
        this.fogSpawnAccumulatorSec -= spawnPeriodSec
        this.createFogInstance(fog)
      }
    } else if (this.fogInstances.length === 0) {
      this.createFogInstance(fog)
    }

    // Avoid unbounded growth if repeatIntervalSec is tiny.
    const MAX_FOG_INSTANCES = 6
    while (this.fogInstances.length > MAX_FOG_INSTANCES) {
      const victim = this.fogInstances.shift()
      if (victim) {
        this.fogBlobContainer.removeChild(victim.container)
        for (const blob of victim.blobs) blob.sprite.destroy()
        victim.dropletGraphics.destroy()
        victim.container.destroy()
      }
    }

    // Tick & render
    for (let i = this.fogInstances.length - 1; i >= 0; i--) {
      const inst = this.fogInstances[i]!
      inst.elapsedSec += dtSec

      if (!fog.repeatEnabled && inst.elapsedSec >= totalActiveSec) {
        // When not repeating, hold the final frame.
        inst.elapsedSec = totalActiveSec
      }

      this.renderFogFrame(fog, inst)

      if (fog.repeatEnabled && inst.elapsedSec >= totalActiveSec) {
        // Completed instances are removed when repeating.
        this.fogBlobContainer.removeChild(inst.container)
        for (const blob of inst.blobs) blob.sprite.destroy()
        inst.dropletGraphics.destroy()
        inst.container.destroy()
        this.fogInstances.splice(i, 1)
      }
    }
  }

  private clearFog(resetKey = true) {
    for (const inst of this.fogInstances) {
      this.fogBlobContainer.removeChild(inst.container)
      for (const blob of inst.blobs) blob.sprite.destroy()
      inst.dropletGraphics.destroy()
      inst.container.destroy()
    }
    this.fogInstances = []
    this.fogSpawnAccumulatorSec = 0
    if (resetKey) this.fogKey = null
  }

  private getFogCycleDurationMs(fog?: FogEffect) {
    if (!fog?.enabled) return 0
    const fadeSec = this.getFogEffectiveFadeDurationSec(Math.max(0.1, fog.fadeDurationSec))
    const activeSec = Math.max(0.1, fog.growDurationSec) +
      Math.max(0, fog.holdDurationSec) +
      fadeSec
    return (activeSec + (fog.repeatEnabled ? Math.max(0, fog.repeatIntervalSec) : 0)) * 1000
  }

  private updateZoom(zoom?: ZoomEffect) {
    const normalizedMode = this.normalizeOneshotMode(zoom?.mode)
    const key = zoom
      ? [
          zoom.enabled,
          normalizedMode,
          zoom.speedFactor,
          zoom.repeatEnabled,
          zoom.repeatIntervalSec,
          zoom.timerSync ?? false,
          zoom.zoomFactor,
          zoom.centerCorrection,
          zoom.syncNonce ?? 0,
        ].join(':')
      : 'disabled'

    if (!zoom?.enabled) {
      if (this.zoomKey !== key) this.clearZoom()
      this.zoomKey = key
      return
    }

    if (this.zoomKey === key) return
    this.zoomKey = key
    this.resetZoomMotion()
  }

  private clearZoom() {
    this.zoomScaleMultiplier = 1
    this.zoomCenterOffsetX = 0
    this.zoomCenterOffsetY = 0
    this.zoomElapsedSec = 0
    this.zoomCycleComplete = false
    if (this.imageSprite) this.positionImageSprite(this.imageSprite)
  }

  private resetZoomMotion() {
    this.zoomElapsedSec = 0
    this.zoomCycleComplete = false
    this.zoomScaleMultiplier = 1
    this.zoomCenterOffsetX = 0
    this.zoomCenterOffsetY = 0
  }

  private tickZoom(delta: number, zoom?: ZoomEffect) {
    if (!zoom?.enabled) {
      this.zoomScaleMultiplier = 1
      this.zoomCenterOffsetX = 0
      this.zoomCenterOffsetY = 0
      return
    }

    if (zoom.timerSync && this.timerEnabled) {
      this.applyZoomFromProgressLinear(zoom, clamp(this.timerProgress, 0, 1))
      return
    }

    const dtSec = Math.max(0, delta) / 60
    const mode = this.normalizeOneshotMode(zoom.mode)
    const animationSec = 0.9 / Math.max(0.01, zoom.speedFactor)

    if (mode === 'permanentA' || mode === 'permanentB') {
      if (animationSec <= 0) return
      this.zoomElapsedSec += dtSec
      if (this.zoomElapsedSec >= animationSec) {
        this.zoomElapsedSec %= animationSec
      }
      const progress = clamp(this.zoomElapsedSec / animationSec, 0, 1)
      this.applyZoomFromProgress(zoom, mode, progress)
      return
    }

    // oneshotA/oneshotB
    const intervalSec = Math.max(0, zoom.repeatIntervalSec)
    const cycleSec = animationSec + (zoom.repeatEnabled ? intervalSec : 0)

    if (this.zoomCycleComplete && !zoom.repeatEnabled) {
      this.zoomScaleMultiplier = 1
      this.zoomCenterOffsetX = 0
      this.zoomCenterOffsetY = 0
      return
    }

    this.zoomElapsedSec += dtSec
    if (zoom.repeatEnabled && cycleSec > 0) {
      this.zoomElapsedSec %= cycleSec
    } else if (this.zoomElapsedSec >= animationSec) {
      this.zoomElapsedSec = animationSec
      this.zoomCycleComplete = true
    }

    const progress = clamp(this.zoomElapsedSec / animationSec, 0, 1)
    this.applyZoomFromProgress(zoom, mode, progress)
  }

  private applyZoomFromProgress(zoom: ZoomEffect, mode: string, progress: number) {
    const zoomFactor = Math.max(1, zoom.zoomFactor ?? 1.5)
    let scale: number

    if (mode === 'permanentA') {
      const growEnd = 0.25
      scale = progress < growEnd
        ? lerp(1.0, zoomFactor, easeOutBack(progress / growEnd))
        : lerp(zoomFactor, 1.0, easeInOutSine((progress - growEnd) / (1 - growEnd)))
    } else if (mode === 'permanentB') {
      const expandEnd = 0.5
      scale = progress < expandEnd
        ? lerp(1.0, zoomFactor, easeInOutCubic(progress / expandEnd))
        : lerp(zoomFactor, 1.0, easeInOutCubic((progress - expandEnd) / (1 - expandEnd)))
    } else {
      // oneshotA/oneshotB: zoom in then back out
      const growEnd = 0.58
      scale = progress < growEnd
        ? (mode === 'oneshotB'
            ? lerp(1.0, zoomFactor, easeOutBack(progress / growEnd))
            : lerp(1.0, zoomFactor, easeInOutSine(progress / growEnd)))
        : lerp(zoomFactor, 1.0, easeInOutSine((progress - growEnd) / (1 - growEnd)))
    }

    this.zoomScaleMultiplier = scale

    if (zoom.centerCorrection) {
      const effectCenter = this.latestEffects?.effectCenter ?? { x: 0.5, y: 0.5 }
      this.zoomCenterOffsetX = (1 - scale) * (effectCenter.x - 0.5) * this.width
      this.zoomCenterOffsetY = (1 - scale) * (effectCenter.y - 0.5) * this.height
    } else {
      this.zoomCenterOffsetX = 0
      this.zoomCenterOffsetY = 0
    }
  }

  private applyZoomFromProgressLinear(zoom: ZoomEffect, progress: number) {
    const zoomFactor = Math.max(1, zoom.zoomFactor ?? 1.5)
    const scale = lerp(1.0, zoomFactor, progress)
    this.zoomScaleMultiplier = scale

    if (zoom.centerCorrection) {
      const effectCenter = this.latestEffects?.effectCenter ?? { x: 0.5, y: 0.5 }
      this.zoomCenterOffsetX = (1 - scale) * (effectCenter.x - 0.5) * this.width
      this.zoomCenterOffsetY = (1 - scale) * (effectCenter.y - 0.5) * this.height
    } else {
      this.zoomCenterOffsetX = 0
      this.zoomCenterOffsetY = 0
    }
  }

  private getTimerSyncedOpacity(
    baseOpacity: number,
    timerSyncEnabled: boolean,
    timerSyncStartOpacity?: number,
    timerSyncEndOpacity?: number
  ): number {
    if (!timerSyncEnabled || !this.timerEnabled) return baseOpacity
    const startOpacity = clamp(timerSyncStartOpacity ?? baseOpacity, 0, 1)
    const endOpacity = clamp(timerSyncEndOpacity ?? 1, 0, 1)
    return lerp(startOpacity, endOpacity, clamp(this.timerProgress, 0, 1))
  }

  private rebuildVignette() {
    if (this.vignetteSprite) {
      this.vignetteLayer.removeChild(this.vignetteSprite)
      this.vignetteSprite.destroy({ texture: true })
      this.vignetteSprite = null
    }
    this.vignetteTextureKey = null
  }

  private updateSpiral(effects: CellEffects) {
    const spiral = effects.spiral
    if (!spiral.enabled) {
      this.spiralGraphics.visible = false
      this.spiralGraphics.clear()
      this.spiralDrawKey = null
      this.clearSpiralMask()
      return
    }
    this.spiralGraphics.visible = true
    this.spiralLayer.visible = true
    const centerX = clamp(effects.effectCenter?.x ?? 0.5, 0, 1)
    const centerY = clamp(effects.effectCenter?.y ?? 0.5, 0, 1)
    this.spiralGraphics.position.set(this.width * centerX, this.height * centerY)
    this.redrawSpiralIfNeeded(spiral, centerX, centerY)
    this.updateSpiralRadialMask(spiral)
    if (spiral.dynamic && !spiral.dynamicTimerSync) {
      this.applySpiralAlpha(effects, (Math.sin(this.spiralAlphaDynamicProgress * Math.PI * 2) + 1) * 0.5)
    } else {
      this.applySpiralAlpha(effects, this.timerProgress)
    }
  }

  private tickSpiral(delta: number, effects: CellEffects) {
    const spiral = effects.spiral
    if (!spiral.enabled || !this.spiralGraphics.visible) return
    const dtSec = delta / 60
    const rotationSpeedScale = spiral.pattern === 'vortex' ? 1 / 7 : 1
    this.spiralRotationRad += (spiral.rotationSpeedDegPerSec * rotationSpeedScale * Math.PI / 180) * dtSec
    this.spiralGraphics.rotation = this.spiralRotationRad
    const centerX = clamp(effects.effectCenter?.x ?? 0.5, 0, 1)
    const centerY = clamp(effects.effectCenter?.y ?? 0.5, 0, 1)
    this.spiralGraphics.position.set(this.width * centerX, this.height * centerY)
    if (spiral.dynamic && !spiral.dynamicTimerSync) {
      const durationSec = Math.max(0.1, spiral.dynamicDurationMs / 1000)
      this.spiralAlphaDynamicProgress += dtSec / durationSec
      if (this.spiralAlphaDynamicProgress >= 1) this.spiralAlphaDynamicProgress -= Math.floor(this.spiralAlphaDynamicProgress)
      const p = (Math.sin(this.spiralAlphaDynamicProgress * Math.PI * 2 - Math.PI * 0.5) + 1) * 0.5
      this.applySpiralAlpha(effects, p)
    }
  }

  private applySpiralAlpha(effects: CellEffects, progress: number) {
    const spiral = effects.spiral
    const p = clamp(progress, 0, 1)
    if (spiral.dynamic) {
      this.spiralGraphics.alpha = clamp(spiral.dynamicFrom + (spiral.dynamicTo - spiral.dynamicFrom) * p, 0, 1)
      return
    }
    this.spiralGraphics.alpha = clamp(spiral.alpha, 0, 1)
  }

  private redrawSpiralIfNeeded(spiral: CellEffects['spiral'], centerX: number, centerY: number) {
    const drawKey = [
      this.width,
      this.height,
      centerX,
      centerY,
      spiral.pattern,
      spiral.detail,
      spiral.color.r,
      spiral.color.g,
      spiral.color.b,
      spiral.dualColorEnabled,
      spiral.secondaryColor.r,
      spiral.secondaryColor.g,
      spiral.secondaryColor.b,
    ].join(':')
    if (this.spiralDrawKey === drawKey) return
    this.spiralDrawKey = drawKey

    const g = this.spiralGraphics
    g.clear()
    const primaryColor = (spiral.color.r << 16) | (spiral.color.g << 8) | spiral.color.b
    const secondaryColor = (spiral.secondaryColor.r << 16) | (spiral.secondaryColor.g << 8) | spiral.secondaryColor.b
    const cx = this.width * centerX
    const cy = this.height * centerY
    const maxCornerDist = Math.sqrt(
      Math.max(cx * cx, (this.width - cx) * (this.width - cx)) +
      Math.max(cy * cy, (this.height - cy) * (this.height - cy))
    )
    const maxRadius = Math.max(Math.sqrt(this.width * this.width + this.height * this.height) * 0.6, maxCornerDist)
    const detail = clamp(spiral.detail, 6, 120)
    const loops = spiral.pattern === 'vortex' ? detail * 0.15 : detail * 0.6
    const a = maxRadius / (Math.PI * 2 * loops)
    const arms = spiral.pattern === 'vortex' ? 14 : 1
    const armPhaseStep = (Math.PI * 2) / arms
    const lineWidth = spiral.pattern === 'vortex'
      ? Math.max(2, Math.round(Math.min(this.width, this.height) * 0.02))
      : Math.max(2, Math.round(Math.min(this.width, this.height) * 0.012))
    const angleStep = spiral.pattern === 'vortex' ? 0.02 : 0.06
    const maxAngle = Math.PI * 2 * loops
    const drawSpiral = (color: number, basePhase = 0) => {
      for (let arm = 0; arm < arms; arm += 1) {
        const armPhase = arm * armPhaseStep + basePhase
        let started = false
        for (let theta = 0; theta <= maxAngle; theta += angleStep) {
          const r = a * theta
          const x = Math.cos(theta + armPhase) * r
          const y = Math.sin(theta + armPhase) * r
          if (!started) {
            g.moveTo(x, y)
            started = true
          } else {
            g.lineTo(x, y)
          }
        }
      }
      g.stroke({ color, width: lineWidth, alpha: 1, cap: 'round', join: 'round' })
    }

    drawSpiral(primaryColor, 0)
    if (spiral.pattern === 'classic' && spiral.dualColorEnabled) {
      drawSpiral(secondaryColor, Math.PI * 0.08)
    }
  }

  private updateSpiralRadialMask(spiral: CellEffects['spiral']) {
    if (!spiral.radialEnabled) {
      this.clearSpiralMask()
      return
    }
    const centerX = this.latestEffects?.effectCenter?.x ?? 0.5
    const centerY = this.latestEffects?.effectCenter?.y ?? 0.5
    const key = [
      this.width,
      this.height,
      spiral.radialMode,
      centerX,
      centerY,
      spiral.radialSize,
      spiral.radialFadeStrength ?? 1,
    ].join(':')
    if (this.spiralMaskKey !== key) {
      this.clearSpiralMask()
      const keepCenter = spiral.radialMode === 'center'
      this.spiralMaskSprite = this.createCenterPeripheryMaskSprite(
        keepCenter,
        spiral.radialSize,
        centerX,
        centerY,
        spiral.radialFadeStrength ?? 1
      )
      this.spiralMaskSprite.alpha = 0
      this.spiralLayer.addChild(this.spiralMaskSprite)
      this.spiralMaskFilter = new PIXI.MaskFilter({
        sprite: this.spiralMaskSprite,
        channel: 'alpha',
      })
      this.spiralMaskFilter.inverse = spiral.radialMode === 'periphery'
      this.spiralLayer.filters = [this.spiralMaskFilter]
      this.spiralLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
      this.spiralMaskKey = key
    }
  }

  private clearSpiralMask() {
    this.spiralLayer.filters = []
    this.spiralLayer.filterArea = undefined
    this.spiralMaskFilter = null
    if (this.spiralMaskSprite) {
      this.spiralLayer.removeChild(this.spiralMaskSprite)
      this.spiralMaskSprite.texture.destroy(true)
      this.spiralMaskSprite.destroy()
      this.spiralMaskSprite = null
    }
    this.spiralMaskKey = null
    this.spiralLayer.visible = true
  }

  private createCenterPeripheryMaskSprite(
    keepCenter: boolean,
    sizeRatio: number,
    centerXRatio = 0.5,
    centerYRatio = 0.5,
    fadeStrength = 1
  ): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const cx = this.width * clamp(centerXRatio, 0, 1)
    const cy = this.height * clamp(centerYRatio, 0, 1)
    const maxR = Math.sqrt(cx * cx + cy * cy)
    const cut = clamp(sizeRatio, 0.05, 0.95) * maxR
    const fadeScale = keepCenter ? 1 / 6 : 1 / 2
    const fade = clamp(fadeStrength, 0.01, 1.5) * fadeScale
    const feather = Math.max(1, maxR * 0.03 / fade)

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        let alpha01 = 1 - smoothstep(cut - feather, cut + feather, d)
        alpha01 = clamp(alpha01, 0, 1)
        const idx = (y * canvas.width + x) * 4
        image.data[idx] = 255
        image.data[idx + 1] = 255
        image.data[idx + 2] = 255
        image.data[idx + 3] = Math.round(alpha01 * 255)
      }
    }
    ctx.putImageData(image, 0, 0)
    return new PIXI.Sprite(PIXI.Texture.from(canvas))
  }

  private updateVignette(effects: CellEffects) {
    const vig = effects.vignette

    if (!vig.enabled) {
      if (this.vignetteSprite) this.vignetteSprite.visible = false
      if (this.vignetteGsapTween) {
        this.vignetteGsapTween.kill()
        this.vignetteGsapTween = null
      }
      this.vignetteAnimationKey = null
      return
    }

    const intensity = vig.intensity ?? 50
    const textureKey = [
      this.width,
      this.height,
      vig.color.r,
      vig.color.g,
      vig.color.b,
      Math.round(intensity),
    ].join(':')

    if (!this.vignetteSprite || this.vignetteTextureKey !== textureKey) {
      const previousAlpha = this.vignetteSprite?.alpha ?? (vig.dynamic ? vig.dynamicFrom : vig.alpha)
      if (this.vignetteSprite) {
        this.vignetteLayer.removeChild(this.vignetteSprite)
        this.vignetteSprite.destroy({ texture: true })
      }
      const tex = createVignetteTexture(this.width, this.height, vig.color, intensity)
      this.vignetteSprite = new PIXI.Sprite(tex)
      this.vignetteSprite.alpha = previousAlpha
      this.vignetteTextureKey = textureKey
      this.vignetteLayer.addChild(this.vignetteSprite)
    }

    this.vignetteSprite.visible = true

    if (vig.dynamic) {
      if (vig.dynamicTimerSync) {
        // タイマー同期: GSAPなし、timerProgressで直接alpha設定
        const animationKey = `timer-sync:${vig.dynamicFrom}:${vig.dynamicTo}`
        if (this.vignetteAnimationKey !== animationKey) {
          this.vignetteGsapTween?.kill()
          this.vignetteGsapTween = null
          this.vignetteAnimationKey = animationKey
          if (this.vignetteSprite) {
            this.vignetteSprite.alpha = vig.dynamicFrom + (vig.dynamicTo - vig.dynamicFrom) * this.timerProgress
          }
        }
      } else if (this.storyboardScaleActive) {
        // ストーリーボードモード: GSAPをスキップ（applyStoryboardScaleToEffects が制御）
        this.vignetteGsapTween?.kill()
        this.vignetteGsapTween = null
      } else {
        const animationKey = [
          vig.dynamicFrom,
          vig.dynamicTo,
          vig.dynamicDurationMs,
        ].join(':')

        if (this.vignetteAnimationKey !== animationKey) {
          this.vignetteGsapTween?.kill()
          this.vignetteAnimationKey = animationKey
          const proxy = { alpha: vig.dynamicFrom }
          if (this.vignetteSprite) this.vignetteSprite.alpha = vig.dynamicFrom
          this.vignetteGsapTween = gsap.to(proxy, {
            alpha: vig.dynamicTo,
            duration: vig.dynamicDurationMs / 1000,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: false,
            onComplete: () => { proxy.alpha = vig.dynamicFrom },
            onUpdate: () => {
              if (this.vignetteSprite) this.vignetteSprite.alpha = proxy.alpha
            },
          })
        }
      }
    } else {
      if (this.vignetteGsapTween) {
        this.vignetteGsapTween.kill()
        this.vignetteGsapTween = null
      }
      this.vignetteAnimationKey = null
      if (!this.storyboardScaleActive) {
        this.vignetteSprite.alpha = vig.alpha
      }
    }
  }

  private updateBlur(effects: CellEffects, showCircleGuides = false) {
    const blur = effects.blur

    const centerX = effects.effectCenter?.x ?? 0.5
    const centerY = effects.effectCenter?.y ?? 0.5
    // 設定キーを生成
    const radialGuideKey = [
      this.width,
      this.height,
      centerX,
      centerY,
      blur.radialEnabled,
      blur.radialSize ?? 1,
      blur.radialHeight ?? 1,
    ].join(':')
    const shouldShowRadialGuide = showCircleGuides && Boolean(blur.radialEnabled) && this.radialBlurGuideKey !== null && this.radialBlurGuideKey !== radialGuideKey
    this.radialBlurGuideKey = radialGuideKey
    if (shouldShowRadialGuide) {
      this.showCircleGuide('radial', centerX, centerY, blur.radialSize ?? 1, blur.radialHeight ?? 1)
    }

    const blurKey = [
      this.width,
      this.height,
      blur.enabled,
      blur.strength,
      blur.applyToAll,
      blur.gradualEnabled,
      blur.gradualStartStrength,
      blur.gradualEndStrength,
      blur.gradualDurationSec,
      blur.radialEnabled,
      blur.radialPattern ?? 'a',
      blur.radialIntensity,
      centerX,
      centerY,
      blur.radialSize ?? 1,
      blur.radialHeight ?? 1,
    ].join(':')

    // キーが同じ場合は、既存のアニメーションを継続
    if (this.blurAnimationKey === blurKey) {
      return
    }

    this.blurAnimationKey = blurKey

    this.effectsLayer.filters = []

    if (this.blurGsapTween) {
      this.blurGsapTween.kill()
      this.blurGsapTween = null
    }
    this.blurFilter = null
    this.imageLayerBlurFilter = null
    this.radialBlurFilters = []
    this.clearRadialBlurContents()
    this.effectsLayer.filterArea = undefined
    this.setImageLayerFilters()

    if (!blur.enabled || blur.strength <= 0) {
      return
    }

    if (blur.radialEnabled) {
      this.buildRadialGradientBlur(blur, centerX, centerY)
      if (this.radialBlurLayers.length === 0) return
      this.applyGradualBlur(this.radialBlurFilters, blur)
      return
    }

    const targetLayer = blur.applyToAll ? this.effectsLayer : this.imageLayer
    const blurFilter = new PIXI.BlurFilter({ strength: blur.strength, quality: 4 })
    this.blurFilter = blurFilter
    if (targetLayer === this.imageLayer) {
      this.imageLayerBlurFilter = blurFilter
      this.setImageLayerFilters()
    } else {
      targetLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
      targetLayer.filters = [blurFilter]
    }
    this.applyGradualBlur([{ filter: blurFilter, multiplier: 1 }], blur)
  }

  private applyGradualBlur(blurFilters: { filter: PIXI.BlurFilter; multiplier: number }[], blur: BlurEffect) {
    if (!blur.gradualEnabled) return

    if (blur.gradualTimerSync) {
      // タイマー同期: GSAPなし、timerProgressで直接強度設定
      const strength = blur.gradualStartStrength + (blur.gradualEndStrength - blur.gradualStartStrength) * this.timerProgress
      blurFilters.forEach(({ filter, multiplier }) => { filter.strength = strength * multiplier })
      return
    }

    if (this.storyboardScaleActive) {
      // ストーリーボードモード: GSAPをスキップ（applyStoryboardScaleToEffects が強度を制御）
      return
    }

    blurFilters.forEach(({ filter, multiplier }) => {
      filter.strength = blur.gradualStartStrength * multiplier
    })

    const proxy = { strength: blur.gradualStartStrength }
    const resetStrength = () => {
      proxy.strength = blur.gradualStartStrength
      blurFilters.forEach(({ filter, multiplier }) => {
        filter.strength = blur.gradualStartStrength * multiplier
      })
      // 放射線ブラー時、リセット時に画像クローンを更新（テクスチャ＆トランスフォーム）
      if (blur.radialEnabled && this.imageSprite) {
        this.radialBlurImageClones.forEach(clone => {
          if (clone.texture !== this.imageSprite!.texture) {
            clone.texture = this.imageSprite!.texture
          }
          this.copySpriteTransform(this.imageSprite!, clone)
        })
      }
    }

    this.blurGsapTween = gsap.to(proxy, {
      strength: blur.gradualEndStrength,
      duration: Math.max(0.001, blur.gradualDurationSec),
      ease: 'none',
      repeat: -1,
      onRepeat: resetStrength,
      onUpdate: () => {
        blurFilters.forEach(({ filter, multiplier }) => {
          filter.strength = proxy.strength * multiplier
        })
      },
    })
  }

  private buildRadialGradientBlur(blur: BlurEffect, centerXRatio: number, centerYRatio: number) {
    if (!this.imageSprite) return

    // 放射状ブラーのクローンが echoLayer を覆うとエコーが見えなくなるため、
    // 挿入位置は echoLayer の手前（背面側）に固定する。
    // imageRootLayer 配下なのでトーンフィルタの適用対象には引き続き含まれる。
    const insertIndex = this.imageRootLayer.getChildIndex(this.echoLayer)
    const pattern = blur.radialPattern ?? 'a'
    const centerX = clamp(centerXRatio, 0, 1)
    const centerY = clamp(centerYRatio, 0, 1)
    const radialSize = clamp(blur.radialSize ?? 1, 0.1, 3)
    const radialHeight = clamp(blur.radialHeight ?? 1, 0.1, 3)
    const regions = pattern === 'b'
      ? [
          {
            maskSprite: this.createRadialBandMaskSprite(0.5 * radialSize * radialHeight, 0.7 * radialSize, radialHeight, 1, true, centerX, centerY),
            multiplier: Math.max(0, blur.radialIntensity),
          },
          {
            maskSprite: this.createRadialBandMaskSprite(0.75 * radialSize * radialHeight, 0.85 * radialSize, radialHeight, 1, true, centerX, centerY),
            multiplier: Math.max(0, blur.radialIntensity) * 2,
          },
        ]
      : [
          {
            maskSprite: this.createRadialGradientMaskSprite(blur.radialIntensity, centerX, centerY, radialSize, radialHeight),
            multiplier: 1,
          },
        ]

    regions.forEach(({ maskSprite, multiplier }, index) => {
      const radialBlurLayer = new PIXI.Container()
      const imageClone = new PIXI.Sprite(this.imageSprite!.texture)
      imageClone.anchor.set(0.5)
      this.copySpriteTransform(this.imageSprite!, imageClone)
      radialBlurLayer.addChild(imageClone)

      const blurFilter = new PIXI.BlurFilter({ strength: blur.strength * multiplier, quality: 4 })
      const maskFilter = new PIXI.MaskFilter({
        sprite: maskSprite,
        channel: 'alpha',
      })
      radialBlurLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
      radialBlurLayer.filters = [blurFilter, maskFilter]

      maskSprite.alpha = 0
      this.imageRootLayer.addChildAt(radialBlurLayer, insertIndex + index * 2)
      this.imageRootLayer.addChildAt(maskSprite, insertIndex + index * 2 + 1)

      if (index === 0) this.blurFilter = blurFilter
      this.radialBlurLayers.push(radialBlurLayer)
      this.radialBlurMaskSprites.push(maskSprite)
      this.radialBlurImageClones.push(imageClone)
      this.radialBlurFilters.push({ filter: blurFilter, multiplier })
    })
  }

  private createRadialGradientMaskSprite(intensity: number, centerXRatio: number, centerYRatio: number, size: number, heightRatio: number): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const baseSize = Math.min(this.width, this.height)
    const cx = this.width * clamp(centerXRatio, 0, 1)
    const cy = this.height * centerYRatio
    const rx = Math.max(1, baseSize * size * 0.5)
    const ry = Math.max(1, baseSize * size * heightRatio * 0.5)
    const innerStop = clamp((1 - intensity) * size, 0, 0.9)

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        const distance = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        const alpha = Math.round(smoothstep(innerStop, 1, distance) * 255)
        const index = (y * canvas.width + x) * 4
        image.data[index] = 255
        image.data[index + 1] = 255
        image.data[index + 2] = 255
        image.data[index + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    const texture = PIXI.Texture.from(canvas)
    return new PIXI.Sprite(texture)
  }

  private createEllipseMaskSprite(centerXRatio: number, centerYRatio: number, size: number, heightRatio: number, feather = 0.08): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const baseSize = Math.min(this.width, this.height)
    const cx = this.width * clamp(centerXRatio, 0, 1)
    const cy = this.height * clamp(centerYRatio, 0, 1)
    const rx = Math.max(1, baseSize * clamp(size, 0.05, 3) * 0.5)
    const ry = Math.max(1, baseSize * clamp(size, 0.05, 3) * clamp(heightRatio, 0.05, 3) * 0.5)

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        const distance = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        const alpha = Math.round((1 - smoothstep(1, 1 + feather, distance)) * 255)
        const index = (y * canvas.width + x) * 4
        image.data[index] = 255
        image.data[index + 1] = 255
        image.data[index + 2] = 255
        image.data[index + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    const texture = PIXI.Texture.from(canvas)
    return new PIXI.Sprite(texture)
  }

  /** 同サイズの2楕円マスク（左右配置＋任意の上下交互オフセット）。重なりはアルファの max で結合 */
  private createDualEllipseMaskSprite(
    centerXRatio: number,
    centerYRatio: number,
    size: number,
    heightRatio: number,
    spacingShift: number,
    verticalSpacingShift: number,
    feather = 0.08,
  ): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const baseSize = Math.min(this.width, this.height)
    const cx0 = this.width * clamp(centerXRatio, 0, 1)
    const cy0 = this.height * clamp(centerYRatio, 0, 1)
    const rx = Math.max(1, baseSize * clamp(size, 0.05, 3) * 0.5)
    const ry = Math.max(1, baseSize * clamp(size, 0.05, 3) * clamp(heightRatio, 0.05, 3) * 0.5)
    const shift = clamp(spacingShift, -0.5, 0.5)
    const halfSep = rx * (1 + shift)
    const cx1 = cx0 - halfSep
    const cx2 = cx0 + halfSep
    const vShift = clamp(verticalSpacingShift, -0.5, 0.5)
    const stagger = ry * vShift
    const cy1 = cy0 - stagger
    const cy2 = cy0 + stagger

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const dx1 = x + 0.5 - cx1
        const dy1 = y + 0.5 - cy1
        const d1 = Math.sqrt((dx1 / rx) ** 2 + (dy1 / ry) ** 2)
        const a1 = 1 - smoothstep(1, 1 + feather, d1)
        const dx2 = x + 0.5 - cx2
        const dy2 = y + 0.5 - cy2
        const d2 = Math.sqrt((dx2 / rx) ** 2 + (dy2 / ry) ** 2)
        const a2 = 1 - smoothstep(1, 1 + feather, d2)
        const alpha = Math.round(Math.max(a1, a2) * 255)
        const index = (y * canvas.width + x) * 4
        image.data[index] = 255
        image.data[index + 1] = 255
        image.data[index + 2] = 255
        image.data[index + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    const texture = PIXI.Texture.from(canvas)
    return new PIXI.Sprite(texture)
  }

  private createRadialBandMaskSprite(
    innerHeightRatio: number,
    innerWidthRatio: number,
    outerHeightRatio: number,
    outerWidthRatio: number,
    extendsToEdge = false,
    centerXRatio = 0.5,
    centerYRatio = 0.5,
    softenInnerEdge = true,
    softenOuterEdge = true
  ): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(canvas.width, canvas.height)
    const baseSize = Math.min(this.width, this.height)
    const cx = this.width * clamp(centerXRatio, 0, 1)
    const cy = this.height * centerYRatio
    const innerRx = Math.max(1, baseSize * innerWidthRatio * 0.5)
    const innerRy = Math.max(1, baseSize * innerHeightRatio * 0.5)
    const outerRx = Math.max(1, baseSize * outerWidthRatio * 0.5)
    const outerRy = Math.max(1, baseSize * outerHeightRatio * 0.5)
    const feather = 0.08

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        const innerDistance = Math.sqrt((dx / innerRx) ** 2 + (dy / innerRy) ** 2)
        const outerDistance = Math.sqrt((dx / outerRx) ** 2 + (dy / outerRy) ** 2)
        const enterAlpha = softenInnerEdge
          ? smoothstep(1 - feather, 1 + feather, innerDistance)
          : (innerDistance >= 1 ? 1 : 0)
        const exitAlpha = extendsToEdge
          ? 1
          : (softenOuterEdge ? 1 - smoothstep(1 - feather, 1 + feather, outerDistance) : (outerDistance <= 1 ? 1 : 0))
        const alpha = Math.round(clamp(enterAlpha * exitAlpha, 0, 1) * 255)
        const index = (y * canvas.width + x) * 4
        image.data[index] = 255
        image.data[index + 1] = 255
        image.data[index + 2] = 255
        image.data[index + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    const texture = PIXI.Texture.from(canvas)
    return new PIXI.Sprite(texture)
  }

  private refreshBlurRegion() {
    if (!this.latestEffects) return
    if (this.latestEffects.blur.enabled && this.latestEffects.blur.radialEnabled) {
      this.blurAnimationKey = null
      this.updateBlur(this.latestEffects)
      return
    }
    if (this.radialBlurImageClones.length > 0 && this.imageSprite) {
      this.syncRadialBlurClones()
      return
    }
    this.blurAnimationKey = null
    this.updateBlur(this.latestEffects)
  }

  private syncRadialBlurClones() {
    if (this.imageSprite && this.radialBlurImageClones.length > 0) {
      this.radialBlurImageClones.forEach(clone => {
        if (clone.texture !== this.imageSprite!.texture) {
          clone.texture = this.imageSprite!.texture
        }
        this.copySpriteTransform(this.imageSprite!, clone)
      })
    }
  }

  private copySpriteTransform(from: PIXI.Sprite, to: PIXI.Sprite) {
    to.x = from.x
    to.y = from.y
    to.scale.set(from.scale.x, from.scale.y)
    to.alpha = from.alpha
    to.rotation = from.rotation
  }

  private clearRadialBlurContents() {
    this.radialBlurLayers.forEach(layer => {
      layer.filters = []
      layer.filterArea = undefined
      this.imageRootLayer.removeChild(layer)
      layer.destroy()
    })
    this.radialBlurMaskSprites.forEach(maskSprite => {
      this.imageRootLayer.removeChild(maskSprite)
      maskSprite.texture.destroy(true)
      maskSprite.destroy()
    })
    this.radialBlurImageClones.forEach(clone => {
      clone.destroy({ texture: false })
    })
    this.radialBlurLayers = []
    this.radialBlurMaskSprites = []
    this.radialBlurImageClones = []
    this.radialBlurFilters = []
  }

  private updateText(effects: CellEffects) {
    this.textSystem.update(effects.textEffect, this.width, this.height)
  }

  private async updateAsset(effects: CellEffects) {
    const da = effects.dynamicAsset
    const useVector =
      da.sourceKind === 'vector' &&
      da.vectorPresetId !== null &&
      isBuiltinVectorDynamicAssetPreset(da.vectorPresetId)

    const assetPaths = da.assetPaths?.length ? da.assetPaths : (da.assetPath ? [da.assetPath] : [])
    const assetKey = useVector ? `vector:${da.vectorPresetId}` : assetPaths.join('|')

    if (useVector) {
      if (assetKey !== this.assetTexturesKey) {
        this.assetTexturesKey = assetKey
        this.assetPath = null
        this.assetTexture = null
        this.particleSystem.setVectorPreset(da.vectorPresetId!)
      }
      return
    }

    if (assetPaths.length > 0 && assetKey !== this.assetTexturesKey) {
      this.assetPath = da.assetPath
      this.assetTexturesKey = assetKey
      const textures: PIXI.Texture[] = []
      for (const path of assetPaths) {
        try {
          textures.push(await PIXI.Assets.load(toFileUrl(path)))
        } catch {
          // skip unreadable assets
        }
      }
      this.assetTexture = textures[0] ?? null
      this.particleSystem.setTextures(textures)
    } else if (assetPaths.length === 0) {
      this.assetPath = null
      this.assetTexturesKey = null
      this.assetTexture = null
      this.particleSystem.setTextures([])
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function createSquishOrganicShape(): SquishOrganicShape {
  const stretch = 0.025 + Math.random() * 0.035
  const horizontal = Math.random() < 0.5
  const sizeScale = 0.96 + Math.random() * 0.08

  return {
    radiusXScale: horizontal ? 1 + stretch : 1 - stretch,
    radiusYScale: horizontal ? 1 - stretch : 1 + stretch,
    sizeScale,
  }
}

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2
}

function easeOutSine(x: number): number {
  return Math.sin((clamp(x, 0, 1) * Math.PI) / 2)
}

function easeInSine(x: number): number {
  return 1 - Math.cos((clamp(x, 0, 1) * Math.PI) / 2)
}

const FOG_FADE_LINEAR_TAIL_START = 0.8
const FOG_FADE_LINEAR_TAIL_SLOW_FACTOR = 1.75

function easeInOutCubic(x: number): number {
  const t = clamp(x, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - clamp(x, 0, 1), 3)
}

function easeInCubic(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * t
}

function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const t = clamp(x, 0, 1) - 1
  return 1 + c3 * Math.pow(t, 3) + c1 * Math.pow(t, 2)
}

function rgbToHex(r: number, g: number, b: number): number {
  return (clamp(Math.round(r), 0, 255) << 16) |
    (clamp(Math.round(g), 0, 255) << 8) |
    clamp(Math.round(b), 0, 255)
}

function darkenColor(color: number, factor: number): number {
  const clampedFactor = clamp(factor, 0, 1)
  const r = ((color >> 16) & 0xff) * clampedFactor
  const g = ((color >> 8) & 0xff) * clampedFactor
  const b = (color & 0xff) * clampedFactor
  return rgbToHex(r, g, b)
}

function sampleTextureCenterColor(texture: PIXI.Texture): { r: number; g: number; b: number } | null {
  const resource = texture.source.resource as unknown
  if (!isCanvasImageSource(resource)) return null
  const size = getCanvasImageSourceSize(resource)
  if (!size || size.width <= 0 || size.height <= 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  try {
    const sx = Math.max(0, Math.min(size.width - 1, Math.floor(size.width / 2)))
    const sy = Math.max(0, Math.min(size.height - 1, Math.floor(size.height / 2)))
    context.drawImage(resource, sx, sy, 1, 1, 0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return { r, g, b }
  } catch {
    return null
  }
}

function isCanvasImageSource(resource: unknown): resource is DrawableImageSource {
  if (typeof HTMLImageElement !== 'undefined' && resource instanceof HTMLImageElement) return true
  if (typeof HTMLCanvasElement !== 'undefined' && resource instanceof HTMLCanvasElement) return true
  if (typeof HTMLVideoElement !== 'undefined' && resource instanceof HTMLVideoElement) return true
  if (typeof ImageBitmap !== 'undefined' && resource instanceof ImageBitmap) return true
  if (typeof OffscreenCanvas !== 'undefined' && resource instanceof OffscreenCanvas) return true
  return false
}

function getCanvasImageSourceSize(source: DrawableImageSource): { width: number; height: number } | null {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  return { width: source.width, height: source.height }
}

function getNextShakeOnceTarget(currentTarget: number): number {
  if (currentTarget < 0) return Math.abs(currentTarget) * SHAKE_ONCE_DECAY_RATIO
  if (currentTarget > 0) return -Math.abs(currentTarget)
  return 0
}

function getShakeOnceSegmentSpeed(baseSpeed: number, speedFactor: number, segmentCount: number): number {
  const completedSegments = Math.max(0, segmentCount - 1)
  return baseSpeed * speedFactor * Math.pow(SHAKE_ONCE_SPEED_DECAY_RATIO, completedSegments)
}

const SHAKE_ONCE_INITIAL_UP_PX = 40
const SHAKE_ONCE_DECAY_RATIO = 0.6
const SHAKE_ONCE_SPEED_DECAY_RATIO = 0.84
const SHAKE_ONCE_STOP_THRESHOLD_PX = 6
const SHAKE_ONCE_MAX_SEGMENTS = 32
const SHAKE_ONCE_INITIAL_LIFT_SPEED_PX_PER_SEC = 80
const SHAKE_ONCE_BOUNCE_SPEED_PX_PER_SEC = 180
const SHAKE_AFTERIMAGE_START_ALPHA = 0.38

function toFileUrl(src: string): string {
  if (src.startsWith('file://') || src.startsWith('http') || src.startsWith('data:')) {
    return src
  }
  const normalized = src.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

const remoteImageDataUrlCache = new Map<string, string>()
const remoteImageDataUrlInFlight = new Map<string, Promise<string>>()
let remoteImageLimitNotifier: ((message: string) => void) | null = null

export function configureRemoteImageLoading(
  limitNotifier: ((message: string) => void) | null
): void {
  remoteImageLimitNotifier = limitNotifier
}

function isHttpImageUrl(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

async function toLoadableImageUrl(url: string): Promise<string> {
  if (!isHttpImageUrl(url)) return url
  const cached = remoteImageDataUrlCache.get(url)
  if (cached) return cached
  const inFlight = remoteImageDataUrlInFlight.get(url)
  if (inFlight) return inFlight

  const api = (window as unknown as { api?: IpcApi }).api
  if (!api?.loadRemoteImageAsDataUrl) return url

  const request = api.loadRemoteImageAsDataUrl(url)
    .then(result => {
      if (result.limitExceeded) {
        remoteImageLimitNotifier?.(result.error ?? 'Pixiv image limit reached for this app session')
      }
      if (!result.success || !result.dataUrl) throw new Error(result.error ?? 'Remote image load failed')
      remoteImageDataUrlCache.set(url, result.dataUrl)
      return result.dataUrl
    })
    .finally(() => {
      remoteImageDataUrlInFlight.delete(url)
    })
  remoteImageDataUrlInFlight.set(url, request)
  return request
}
