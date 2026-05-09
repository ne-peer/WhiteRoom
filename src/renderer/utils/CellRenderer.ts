import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { BlankBackground, BlurEffect, BreathingEffect, CellEffects, ColorOverlayEffect, EchoEffect, ImageFitMode, IpcApi, ShakeEffect, SlideShowTransition } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem,
  TextSystem,
} from './pixiEffects'

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

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
  private echoSprite: PIXI.Sprite | null = null
  private flashOverlaySprite: PIXI.Sprite | null = null
  private flashOverlayVisible = false
  private flashElapsedSec = 0
  private flashCycleDurationSec = 0
  private flashTextureKey: string | null = null
  private flashTextureLoadingKey: string | null = null
  private flashTextureRequestNonce = 0
  private flashCurrentShowNonce = 0
  private flashCurrentHideNonce = 0
  private flashStartTween: gsap.core.Tween | null = null
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
  private vignetteSprite: PIXI.Sprite | null = null
  private vignetteTextureKey: string | null = null
  private spiralGraphics: PIXI.Graphics
  private spiralMaskSprite: PIXI.Sprite | null = null
  private spiralMaskKey: string | null = null
  private spiralMaskFilter: PIXI.MaskFilter | null = null
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
  private echoGsapTween: gsap.core.Tween | null = null
  private echoAnimationKey: string | null = null
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

  constructor(cellId: string, width: number, height: number) {
    this.cellId = cellId
    this.width = width
    this.height = height

    this.container = new PIXI.Container()
    this.container.eventMode = 'static'
    this.container.cursor = 'pointer'
    this.updateHitArea()

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
    this.guideLayer = new PIXI.Container()
    this.dynamicBackgroundMask = new PIXI.Graphics()
    this.imageMask = new PIXI.Graphics()
    this.echoMask = new PIXI.Graphics()

    this.container.addChild(this.dynamicBackgroundLayer)
    this.container.addChild(this.imageLayer)
    this.container.addChild(this.shakeTrailLayer)
    this.container.addChild(this.echoLayer)
    this.container.addChild(this.effectsLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)
    this.container.addChild(this.textLayer)
    this.container.addChild(this.vignetteLayer)
    this.container.addChild(this.spiralLayer)
    this.container.addChild(this.guideLayer)
    this.container.addChild(this.echoMask)

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
    this.spiralGraphics = new PIXI.Graphics()
    this.spiralLayer.addChild(this.spiralGraphics)

    this.particleSystem = new ParticleSystem(this.particleContainer)
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

  updateEffects(effects: CellEffects) {
    this.latestEffects = effects
    this.updateBreathing(effects.breathing)
    this.updateShake(effects.shake)
    this.updateColorOverlay(effects)
    this.updateBlur(effects)
    this.updateColorAdjustment(effects.colorOverlay)
    this.updateVignette(effects)
    this.updateSpiral(effects)
    this.updateEcho(effects)
    this.updateFlash(effects)
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
      effects.colorOverlay.dynamicAdjustDurationMs,
      effects.blur.gradualDurationSec * 1000,
      effects.echo.durationSec * 1000,
      (effects.breathing?.scaleDurationSec ?? 1) * 1000,
      this.getShakeCycleDurationMs(effects.shake),
      textDurationMs,
      1000
    )
    const delay = withRandomDelay ? Math.random() * durationMs : 0
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.colorAdjustGsapTween?.kill()
    this.echoGsapTween?.kill()
    this.flashStartTween?.kill()
    this.flashEndTween?.kill()
    this.resetBreathingMotion(withRandomDelay)
    this.resetShakeMotion()
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }
    this.vignetteGsapTween = null
    this.blurGsapTween = null
    this.colorAdjustGsapTween = null
    this.echoGsapTween = null
    this.flashStartTween = null
    this.flashEndTween = null
    this.vignetteAnimationKey = null
    this.spiralAlphaDynamicProgress = 0
    this.blurAnimationKey = null
    this.colorAdjustAnimationKey = null
    this.echoAnimationKey = null
    this.clearFlashOverlay()
    this.breathingKey = null
    this.shakeKey = null
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

    // 画像強調フィルタ（動的強調＋タイマー同期）
    const co = effects.colorOverlay
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
    } else if (this.storyboardScaleActive && scale === null) {
      // 終了: キーリセットで次のupdateEffects呼び出し時にGSAP再起動
      this.storyboardScaleActive = false
      this.vignetteAnimationKey = null
      this.blurAnimationKey = null
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

    // カラーオーバーレイ
    if (effects.colorOverlay.enabled) {
      this.colorOverlayGraphics.alpha = scale
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
    this.recordShakeTrailSample(delta, effects.shake)
    this.applyImageMotionTransform()
    this.syncShakeTrail(delta, effects.shake)
    this.updateShakeTrailGuide(delta)
    this.createPendingShakeAfterimage(effects.shake)
    this.updateShakeAfterimages(delta)
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

  destroy() {
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.colorAdjustGsapTween?.kill()
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
        gsap.to(sprite, { alpha: 1, duration, ease: 'sine.out' })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
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
    if (sprite) this.imageLayer.addChild(sprite)
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
        gsap.to(sprite, { alpha: 1, duration, ease: 'sine.out' })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
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

  private redrawDynamicBackgroundMask() {
    this.dynamicBackgroundMask.clear()
    this.dynamicBackgroundMask.rect(0, 0, this.width, this.height)
    this.dynamicBackgroundMask.fill(0xffffff)
  }

  private updateColorAdjustment(colorOverlay: ColorOverlayEffect) {
    const enabled = colorOverlay.imageAdjustEnabled &&
      (colorOverlay.saturationMax > 1 || colorOverlay.contrastMax > 1)

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
      ? `timer-sync:${colorOverlay.saturationMax}:${colorOverlay.contrastMax}`
      : [
          colorOverlay.saturationMax,
          colorOverlay.contrastMax,
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

    this.colorMatrixFilter.reset()
    this.colorMatrixFilter.contrast(contrast - 1, false)
    this.colorMatrixFilter.saturate(saturation - 1, true)
  }

  private setImageLayerFilters() {
    const filters: PIXI.Filter[] = []
    if (this.imageLayerBlurFilter) filters.push(this.imageLayerBlurFilter)
    if (this.colorMatrixFilter) filters.push(this.colorMatrixFilter)
    this.imageLayer.filters = filters
    this.imageLayer.filterArea = filters.length > 0 ? new PIXI.Rectangle(0, 0, this.width, this.height) : undefined
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

    return {
      offsetX: breathingEnabled ? this.breathingOffsetX : 0,
      offsetY: (breathingEnabled ? this.breathingOffsetY : 0) + (shake?.enabled ? this.shakeOffsetY : 0),
      scaleMultiplier: breathingEnabled && breathing?.scaleEnabled ? this.getBreathingScaleMultiplier() : 1,
    }
  }

  private updateShake(shake?: ShakeEffect) {
    const key = shake
      ? [
          shake.enabled,
          shake.mode,
          shake.repeatEnabled,
          shake.repeatIntervalSec,
          shake.amplitudeFactor,
          shake.speedFactor,
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

    this.updateShakeTrail(shake)

    if (this.shakeKey === key) return
    this.shakeKey = key
    this.resetShakeMotion()
    this.updateShakeTrail(shake)
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
    if (shake.mode === 'loop') {
      const amplitude = Math.max(0, shake.loopAmplitudePx)
      const speed = Math.max(0, shake.loopSpeedPxPerSec)
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

    const factor = Math.max(0, shake.amplitudeFactor)
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

    const speedFactor = Math.max(0.1, shake.speedFactor)
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

  private updateShakeTrail(shake?: ShakeEffect) {
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
    ].join(':')
    const secondGuideKey = [
      this.width,
      this.height,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSecondStageEnabled ?? false,
      shake.trailSecondStageSize ?? 0.62,
    ].join(':')
    const shouldShowFirstGuide = this.shakeTrailFirstGuideKey !== null && this.shakeTrailFirstGuideKey !== firstGuideKey
    const shouldShowSecondGuide = Boolean(shake.trailSecondStageEnabled) && this.shakeTrailSecondGuideKey !== null && this.shakeTrailSecondGuideKey !== secondGuideKey
    this.shakeTrailFirstGuideKey = firstGuideKey
    this.shakeTrailSecondGuideKey = secondGuideKey
    if (shouldShowSecondGuide) {
      this.showShakeTrailGuide(shake, 'second')
    } else if (shouldShowFirstGuide) {
      this.showShakeTrailGuide(shake, 'first')
    }

    const key = [
      this.currentImageSrc,
      this.width,
      this.height,
      shake.trailBlurStrength ?? 2,
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSize ?? 0.7,
      shake.trailHeight ?? 1,
      shake.trailSecondStageEnabled ?? false,
      shake.trailSecondStageSize ?? 0.62,
      shake.trailSecondStageDelayFactor ?? 1,
    ].join(':')
    if (this.shakeTrailKey === key && this.shakeTrailSprite) return

    this.clearShakeTrail()
    const sprite = new PIXI.Sprite(this.imageSprite.texture)
    sprite.anchor.set(0.5)
    const maskSprite = this.createEllipseMaskSprite(
      this.latestEffects?.effectCenter?.x ?? 0.5,
      this.latestEffects?.effectCenter?.y ?? 0.5,
      shake.trailSize ?? 0.7,
      shake.trailHeight ?? 1,
      0.18
    )
    const maskFilter = new PIXI.MaskFilter({ sprite: maskSprite, channel: 'alpha' })
    const blurFilter = new PIXI.BlurFilter({
      strength: clamp(shake.trailBlurStrength ?? 2, 0, 12),
      quality: 3,
    })

    const firstLayer = new PIXI.Container()
    firstLayer.addChild(sprite)
    firstLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    firstLayer.filters = [blurFilter, maskFilter]
    this.container.addChildAt(firstLayer, this.container.getChildIndex(this.shakeTrailLayer) + 1)
    this.container.addChildAt(maskSprite, this.container.getChildIndex(firstLayer) + 1)
    maskSprite.alpha = 0

    this.shakeTrailFirstLayer = firstLayer
    this.shakeTrailSprite = sprite
    this.shakeTrailMaskSprite = maskSprite
    this.shakeTrailBlurFilter = blurFilter

    if (shake.trailSecondStageEnabled) {
      const secondLayer = new PIXI.Container()
      const secondSprite = new PIXI.Sprite(this.imageSprite.texture)
      secondSprite.anchor.set(0.5)
      const secondMaskSprite = this.createEllipseMaskSprite(
        this.latestEffects?.effectCenter?.x ?? 0.5,
        this.latestEffects?.effectCenter?.y ?? 0.5,
        (shake.trailSize ?? 0.7) * clamp(shake.trailSecondStageSize ?? 0.62, 0.1, 1),
        shake.trailHeight ?? 1,
        0.16
      )
      const secondMaskFilter = new PIXI.MaskFilter({ sprite: secondMaskSprite, channel: 'alpha' })
      const secondBlurFilter = new PIXI.BlurFilter({
        strength: clamp((shake.trailBlurStrength ?? 2) * 0.6, 0, 12),
        quality: 3,
      })

      secondLayer.addChild(secondSprite)
      secondLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
      secondLayer.filters = [secondBlurFilter, secondMaskFilter]
      secondMaskSprite.alpha = 0
      this.container.addChildAt(secondLayer, this.container.getChildIndex(firstLayer))
      this.container.addChildAt(secondMaskSprite, this.container.getChildIndex(secondLayer) + 1)

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
    const delaySec = clamp(shake.trailDelaySec ?? 0.12, 0.01, 0.5)
    const secondDelaySec = delaySec * clamp(shake.trailSecondStageDelayFactor ?? 1, 0.25, 3)
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

    const delaySec = clamp(shake.trailDelaySec ?? 0.12, 0.01, 0.5)
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
    const breathing = this.latestEffects?.breathing
    const breathingEnabled = breathing?.enabled ?? false
    const scaleMultiplier = breathingEnabled && breathing?.scaleEnabled ? this.getBreathingScaleMultiplier() : 1
    this.shakeTrailSprite.texture = this.imageSprite.texture
    this.positionSprite(
      this.shakeTrailSprite,
      breathingEnabled ? this.breathingOffsetX : 0,
      (breathingEnabled ? this.breathingOffsetY : 0) + this.shakeTrailSmoothedOffsetY,
      scaleMultiplier
    )
    this.shakeTrailSprite.alpha = clamp(shake.trailAlpha ?? 0.55, 0, 1)

    if (shake.trailSecondStageEnabled && this.shakeTrailSecondSprite) {
      const secondDelaySec = delaySec * clamp(shake.trailSecondStageDelayFactor ?? 1, 0.25, 3)
      const secondTargetTimeSec = this.shakeTrailElapsedSec - secondDelaySec
      const secondDelayedOffsetY = this.getDelayedShakeTrailFirstStageOffset(secondTargetTimeSec)
      this.shakeTrailSecondSmoothedOffsetY = this.shakeTrailSecondSmoothedOffsetY === null
        ? secondDelayedOffsetY
        : lerp(this.shakeTrailSecondSmoothedOffsetY, secondDelayedOffsetY, smoothFactor)
      this.shakeTrailSecondSprite.texture = this.imageSprite.texture
      this.positionSprite(
        this.shakeTrailSecondSprite,
        breathingEnabled ? this.breathingOffsetX : 0,
        (breathingEnabled ? this.breathingOffsetY : 0) + this.shakeTrailSecondSmoothedOffsetY,
        scaleMultiplier
      )
      this.shakeTrailSecondSprite.alpha = clamp((shake.trailAlpha ?? 0.55) + 0.12, 0, 1)
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
    this.shakeTrailKey = null
    this.updateShakeTrail(this.latestEffects.shake)
  }

  private clearShakeTrail() {
    this.shakeTrailLayer.filters = []
    this.shakeTrailLayer.filterArea = undefined
    this.shakeTrailBlurFilter = null
    this.shakeTrailSecondBlurFilter = null
    if (this.shakeTrailFirstLayer) {
      this.container.removeChild(this.shakeTrailFirstLayer)
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
      this.container.removeChild(this.shakeTrailMaskSprite)
      this.shakeTrailMaskSprite.texture.destroy(true)
      this.shakeTrailMaskSprite.destroy()
      this.shakeTrailMaskSprite = null
    }
    if (this.shakeTrailSecondLayer) {
      this.container.removeChild(this.shakeTrailSecondLayer)
      this.shakeTrailSecondLayer.destroy({ children: true })
      this.shakeTrailSecondLayer = null
      this.shakeTrailSecondSprite = null
    }
    if (this.shakeTrailSecondMaskSprite) {
      this.container.removeChild(this.shakeTrailSecondMaskSprite)
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

  private showShakeTrailGuide(shake: ShakeEffect, mode: 'first' | 'second' = 'first') {
    const size = clamp(shake.trailSize ?? 0.7, 0.05, 3)
    const guideSize = mode === 'second'
      ? size * clamp(shake.trailSecondStageSize ?? 0.62, 0.1, 1)
      : size
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
    this.echoLayer.addChild(sprite)
    this.echoSprite = sprite

    const proxy = { progress: 0 }
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
    this.echoSprite.alpha = effectiveStartAlpha * (1 - p)
  }

  private syncEchoToImage() {
    if (!this.latestEffects?.echo.enabled || !this.echoSprite) return
    const echo = this.latestEffects.echo
    const currentAlpha = this.echoSprite.alpha
    const baseAlpha = clamp(echo.startAlpha, 0, 1)
    const progress = baseAlpha > 0 ? clamp(1 - currentAlpha / baseAlpha, 0, 1) : 1
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
    if (this.echoSprite) {
      this.echoLayer.removeChild(this.echoSprite)
      this.echoSprite.destroy({ texture: false })
      this.echoSprite = null
    }
  }

  private async updateFlash(effects: CellEffects) {
    const flash = effects.flash
    this.flashOverlayEffect = flash
    this.flashBaseOpacity = clamp(flash.opacity ?? 1, 0, 1)
    this.flashCycleDurationSec = Math.max(
      0.2,
      (flash.displayDurationSec ?? 1) +
      Math.max(0, flash.endTransitionDurationSec ?? 0) +
      Math.max(0, flash.intervalSec ?? 0)
    )
    if (!flash.enabled || !flash.imagePath) {
      this.clearFlashOverlay()
      return
    }

    const textureKey = toFileUrl(flash.imagePath)
    if (this.flashTextureKey !== textureKey || !this.flashOverlaySprite) {
      const nonce = ++this.flashTextureRequestNonce
      this.flashTextureLoadingKey = textureKey
      try {
        const loadableUrl = await toLoadableImageUrl(textureKey)
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
    this.flashOverlaySprite.alpha = this.flashBaseOpacity
    this.positionFlashOverlaySprite()
  }

  private positionFlashOverlaySprite(offsetX = 0, offsetY = 0, scaleMultiplier = 1) {
    if (!this.flashOverlaySprite) return
    const texW = this.flashOverlaySprite.texture.width
    const texH = this.flashOverlaySprite.texture.height
    const scale = this.getImageScale(texW, texH) * scaleMultiplier
    this.flashOverlaySprite.scale.set(scale)
    this.flashOverlaySprite.x = this.width / 2 + offsetX
    this.flashOverlaySprite.y = this.height / 2 + offsetY
  }

  private updateFlashCycle(delta: number) {
    const flash = this.flashOverlayEffect
    if (!flash?.enabled || !flash.imagePath || !this.flashOverlaySprite) return
    const dtSec = Math.max(0, delta) / 60
    this.flashElapsedSec += dtSec
    while (this.flashElapsedSec >= this.flashCycleDurationSec) {
      this.flashElapsedSec -= this.flashCycleDurationSec
      this.flashCurrentShowNonce += 1
      this.flashCurrentHideNonce += 1
      this.startFlashShow(this.flashCurrentShowNonce)
    }
    const shouldBeVisible = this.flashElapsedSec < Math.max(0.2, flash.displayDurationSec ?? 1)
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
    this.flashStartTween = gsap.to(proxy, {
      incomingScaleMultiplier: 1,
      duration,
      ease: 'sine.out',
      onUpdate: () => {
        if (nonce !== this.flashCurrentShowNonce || !this.flashOverlayVisible || !this.flashOverlaySprite) return
        this.positionFlashOverlaySprite(0, 0, proxy.incomingScaleMultiplier)
      },
    })
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
      outgoingScaleMultiplier: flash.endTransition === 'zoom-in' ? 1.12 : 0.88,
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
      this.overlayLayer.removeChild(this.flashOverlaySprite)
      this.flashOverlaySprite.destroy({ texture: false })
      this.flashOverlaySprite = null
    }
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
      this.clearSpiralMask()
      return
    }
    this.spiralGraphics.visible = true
    this.spiralLayer.visible = true
    const centerX = clamp(effects.effectCenter?.x ?? 0.5, 0, 1)
    const centerY = clamp(effects.effectCenter?.y ?? 0.5, 0, 1)
    this.spiralGraphics.position.set(this.width * centerX, this.height * centerY)
    this.redrawSpiral(spiral)
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

  private redrawSpiral(spiral: CellEffects['spiral']) {
    const g = this.spiralGraphics
    g.clear()
    const primaryColor = (spiral.color.r << 16) | (spiral.color.g << 8) | spiral.color.b
    const secondaryColor = (spiral.secondaryColor.r << 16) | (spiral.secondaryColor.g << 8) | spiral.secondaryColor.b
    const maxRadius = Math.sqrt(this.width * this.width + this.height * this.height) * 0.6
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

    const textureKey = [
      this.width,
      this.height,
      vig.color.r,
      vig.color.g,
      vig.color.b,
    ].join(':')

    if (!this.vignetteSprite || this.vignetteTextureKey !== textureKey) {
      const previousAlpha = this.vignetteSprite?.alpha ?? (vig.dynamic ? vig.dynamicFrom : vig.alpha)
      if (this.vignetteSprite) {
        this.vignetteLayer.removeChild(this.vignetteSprite)
        this.vignetteSprite.destroy({ texture: true })
      }
      const tex = createVignetteTexture(this.width, this.height, vig.color)
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

  private updateBlur(effects: CellEffects) {
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
    const shouldShowRadialGuide = Boolean(blur.radialEnabled) && this.radialBlurGuideKey !== null && this.radialBlurGuideKey !== radialGuideKey
    this.radialBlurGuideKey = radialGuideKey
    if (shouldShowRadialGuide) {
      this.showCircleGuide('radial', centerX, centerY, blur.radialSize ?? 1, blur.radialHeight ?? 1)
    }

    const blurKey = [
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
          clone.texture = this.imageSprite!.texture
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

    const insertIndex = this.container.getChildIndex(this.overlayLayer)
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
      this.container.addChildAt(radialBlurLayer, insertIndex + index * 2)
      this.container.addChildAt(maskSprite, insertIndex + index * 2 + 1)

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
    this.blurAnimationKey = null
    this.updateBlur(this.latestEffects)
  }

  private syncRadialBlurClones() {
    if (this.imageSprite && this.radialBlurImageClones.length > 0) {
      this.radialBlurImageClones.forEach(clone => {
        clone.texture = this.imageSprite!.texture
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
      this.container.removeChild(layer)
      layer.destroy()
    })
    this.radialBlurMaskSprites.forEach(maskSprite => {
      this.container.removeChild(maskSprite)
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
    const assetPaths = da.assetPaths?.length ? da.assetPaths : (da.assetPath ? [da.assetPath] : [])
    const assetKey = assetPaths.join('|')

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

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2
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
