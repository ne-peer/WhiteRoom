import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { BlurEffect, BreathingEffect, CellEffects, EchoEffect, ImageFitMode, SlideShowTransition } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem,
  TextSystem,
} from './pixiEffects'

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

  private imageLayer: PIXI.Container
  private echoLayer: PIXI.Container
  private effectsLayer: PIXI.Container
  private overlayLayer: PIXI.Container
  private particleContainer: PIXI.Container
  private textLayer: PIXI.Container
  private vignetteLayer: PIXI.Container

  private imageSprite: PIXI.Sprite | null = null
  private imageMask: PIXI.Graphics
  private echoMask: PIXI.Graphics
  private colorOverlayGraphics: PIXI.Graphics
  private echoSprite: PIXI.Sprite | null = null
  private vignetteSprite: PIXI.Sprite | null = null
  private radialBlurLayer: PIXI.Container | null = null
  private radialBlurMaskSprite: PIXI.Sprite | null = null
  private radialBlurImageClone: PIXI.Sprite | null = null
  private particleSystem: ParticleSystem
  private textSystem: TextSystem

  private width: number
  private height: number

  private vignetteGsapTween: gsap.core.Tween | null = null
  private vignetteAnimationKey: string | null = null
  private blurFilter: PIXI.BlurFilter | null = null
  private blurGsapTween: gsap.core.Tween | null = null
  private blurAnimationKey: string | null = null
  private echoGsapTween: gsap.core.Tween | null = null
  private echoAnimationKey: string | null = null
  private breathingKey: string | null = null
  private breathingOffsetX = 0
  private breathingOffsetY = 0
  private breathingDirectionX = 1
  private breathingDirectionY = 1
  private breathingScalePhase = 0
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

  constructor(cellId: string, width: number, height: number) {
    this.cellId = cellId
    this.width = width
    this.height = height

    this.container = new PIXI.Container()
    this.container.eventMode = 'static'
    this.container.cursor = 'pointer'

    this.imageLayer = new PIXI.Container()
    this.echoLayer = new PIXI.Container()
    this.effectsLayer = new PIXI.Container()
    this.overlayLayer = new PIXI.Container()
    this.particleContainer = new PIXI.Container()
    this.textLayer = new PIXI.Container()
    this.vignetteLayer = new PIXI.Container()
    this.imageMask = new PIXI.Graphics()
    this.echoMask = new PIXI.Graphics()

    this.container.addChild(this.imageLayer)
    this.container.addChild(this.echoLayer)
    this.container.addChild(this.effectsLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)
    this.container.addChild(this.textLayer)
    this.container.addChild(this.vignetteLayer)
    this.container.addChild(this.echoMask)

    this.imageLayer.addChild(this.imageMask)
    this.imageLayer.mask = this.imageMask
    this.echoLayer.mask = this.echoMask
    this.redrawImageMask()
    this.redrawEchoMask()

    this.colorOverlayGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.colorOverlayGraphics)

    this.particleSystem = new ParticleSystem(this.particleContainer)
    this.textSystem = new TextSystem(this.textLayer)
    this.textSystem.resizeMask(width, height)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.repositionImage()
    this.redrawImageMask()
    this.redrawEchoMask()
    this.refreshEcho()
    this.rebuildVignette()
    this.refreshBlurRegion()
    this.textSystem.resizeMask(width, height)
  }

  setImageFit(imageFit: ImageFitMode = 'cover') {
    if (this.imageFit === imageFit) return
    this.imageFit = imageFit
    this.repositionImage()
    this.refreshEcho()
    this.refreshBlurRegion()
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
      this.refreshEcho()
      this.refreshBlurRegion()
      return
    }

    let texture: PIXI.Texture
    try {
      texture = await PIXI.Assets.load(url)
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
      this.positionImageSprite(sprite)
      this.refreshEcho()
      this.refreshBlurRegion()
      return
    }

    this.startImageTransition(sprite, url, transition, transitionDurationMs)
  }

  updateEffects(effects: CellEffects) {
    this.latestEffects = effects
    this.updateBreathing(effects.breathing)
    this.updateColorOverlay(effects)
    this.updateVignette(effects)
    this.updateBlur(effects)
    this.updateEcho(effects)
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
      effects.blur.gradualDurationSec * 1000,
      effects.echo.durationSec * 1000,
      (effects.breathing?.scaleDurationSec ?? 1) * 1000,
      textDurationMs,
      1000
    )
    const delay = withRandomDelay ? Math.random() * durationMs : 0
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.echoGsapTween?.kill()
    this.resetBreathingMotion(withRandomDelay)
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }
    this.vignetteGsapTween = null
    this.blurGsapTween = null
    this.echoGsapTween = null
    this.vignetteAnimationKey = null
    this.blurAnimationKey = null
    this.echoAnimationKey = null
    this.breathingKey = null
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

  tick(delta: number, effects: CellEffects) {
    this.tickBreathing(delta, effects.breathing)
    this.syncRadialBlurClones()
    this.syncEchoToImage()
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
    this.echoGsapTween?.kill()
    this.imageTransitionTween?.kill()
    if (this.effectResetTimeoutId !== null) {
      clearTimeout(this.effectResetTimeoutId)
      this.effectResetTimeoutId = null
    }
    this.particleSystem.destroy()
    this.textSystem.destroy()
    this.clearRadialBlurContents()
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
      this.refreshEcho()
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

    const duration = Math.max(0.05, transitionDurationMs / 1000)

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
        this.positionImageSprite(sprite)
        this.refreshEcho()
        this.refreshBlurRegion()
    }
  }

  clearImage() {
    this.clearTransitionSprite()
    this.swapImageSprite(null, null)
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
    const { offsetX, offsetY, scaleMultiplier } = this.getBreathingTransform()
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
    return Math.max(this.width / texW, this.height / texH)
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

  private updateBreathing(breathing?: BreathingEffect) {
    const key = breathing
      ? [
          breathing.enabled,
          breathing.speedPxPerSec,
          breathing.maxOffsetPx,
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

  private getBreathingTransform() {
    const breathing = this.latestEffects?.breathing
    if (!breathing?.enabled) {
      return { offsetX: 0, offsetY: 0, scaleMultiplier: 1 }
    }

    return {
      offsetX: this.breathingOffsetX,
      offsetY: this.breathingOffsetY,
      scaleMultiplier: breathing.scaleEnabled ? this.getBreathingScaleMultiplier() : 1,
    }
  }

  private getBreathingScaleMultiplier() {
    return 1 + ((Math.sin(this.breathingScalePhase) + 1) / 2) * 0.05
  }

  private tickBreathing(delta: number, breathing?: BreathingEffect) {
    if (!this.imageSprite || !breathing?.enabled) return

    const speed = Math.max(0, breathing.speedPxPerSec)
    const dtSec = Math.max(0, delta) / 60
    const threshold = clamp(breathing.maxOffsetPx ?? 20, 0, 40)

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

  private resetBreathingMotion(randomize: boolean) {
    const threshold = clamp(this.latestEffects?.breathing?.maxOffsetPx ?? 20, 0, 40)
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
    const breathingScale = this.latestEffects?.breathing?.scaleEnabled ? this.getBreathingScaleMultiplier() : 1
    sprite.x = this.width / 2 + this.breathingOffsetX
    sprite.y = this.height / 2 + this.breathingOffsetY
    sprite.scale.set(this.getImageScale(sprite.texture.width, sprite.texture.height) * breathingScale * extraScaleMultiplier)
  }

  private applySlideTransitionPositions() {
    if (!this.activeSlideTransition) return
    const transform = this.getBreathingTransform()
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
    const scale = echo.startScale + (echo.endScale - echo.startScale) * p
    this.echoSprite.x = this.imageSprite.x
    this.echoSprite.y = this.imageSprite.y
    this.echoSprite.rotation = this.imageSprite.rotation
    this.echoSprite.scale.set(this.imageSprite.scale.x * scale, this.imageSprite.scale.y * scale)
    this.echoSprite.alpha = clamp(echo.startAlpha, 0, 1) * (1 - p)
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

  private rebuildVignette() {
    if (this.vignetteSprite) {
      this.vignetteLayer.removeChild(this.vignetteSprite)
      this.vignetteSprite.destroy({ texture: true })
      this.vignetteSprite = null
    }
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

    if (!this.vignetteSprite) {
      const tex = createVignetteTexture(this.width, this.height, vig.color)
      this.vignetteSprite = new PIXI.Sprite(tex)
      this.vignetteLayer.addChild(this.vignetteSprite)
    }

    this.vignetteSprite.visible = true

    if (vig.dynamic) {
      // ブラー同期モードを判定
      const isSyncMode = effects.blur.enabled &&
                         effects.blur.gradualEnabled &&
                         effects.blur.gradualDurationSec > 0

      // 同期モード時、ビネットのアニメーション時間をブラーに合わせる
      const vignetteAnimDurationMs = isSyncMode
        ? effects.blur.gradualDurationSec * 1000
        : vig.dynamicDurationMs

      const animationKey = [
        vig.dynamicFrom,
        vig.dynamicTo,
        vignetteAnimDurationMs,
        isSyncMode ? 'sync-blur' : 'solo',
      ].join(':')

      if (this.vignetteAnimationKey !== animationKey) {
        this.vignetteGsapTween?.kill()
        this.vignetteAnimationKey = animationKey
        const proxy = { alpha: vig.dynamicFrom }
        if (this.vignetteSprite) this.vignetteSprite.alpha = vig.dynamicFrom
        this.vignetteGsapTween = gsap.to(proxy, {
          alpha: vig.dynamicTo,
          duration: vignetteAnimDurationMs / 1000,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: false,
          onComplete: () => { proxy.alpha = vig.dynamicFrom },
          onUpdate: () => {
            if (this.vignetteSprite) this.vignetteSprite.alpha = proxy.alpha
          },
        })
      }
    } else {
      if (this.vignetteGsapTween) {
        this.vignetteGsapTween.kill()
        this.vignetteGsapTween = null
      }
      this.vignetteAnimationKey = null
      this.vignetteSprite.alpha = vig.alpha
    }
  }

  private updateBlur(effects: CellEffects) {
    const blur = effects.blur

    // 設定キーを生成
    const blurKey = [
      blur.enabled,
      blur.strength,
      blur.applyToAll,
      blur.gradualEnabled,
      blur.gradualStartStrength,
      blur.gradualEndStrength,
      blur.gradualDurationSec,
      blur.radialEnabled,
      blur.radialIntensity,
    ].join(':')

    // キーが同じ場合は、既存のアニメーションを継続
    if (this.blurAnimationKey === blurKey) {
      return
    }

    this.blurAnimationKey = blurKey

    this.imageLayer.filters = []
    this.effectsLayer.filters = []

    if (this.blurGsapTween) {
      this.blurGsapTween.kill()
      this.blurGsapTween = null
    }
    this.blurFilter = null
    this.clearRadialBlurContents()
    this.imageLayer.filterArea = null
    this.effectsLayer.filterArea = null

    if (!blur.enabled || blur.strength <= 0) {
      return
    }

    if (blur.radialEnabled) {
      this.buildRadialGradientBlur(blur)
      if (!this.radialBlurLayer) return
      this.applyGradualBlur(this.blurFilter, blur)
      return
    }

    const targetLayer = blur.applyToAll ? this.effectsLayer : this.imageLayer
    const blurFilter = new PIXI.BlurFilter({ strength: blur.strength, quality: 4 })
    this.blurFilter = blurFilter
    targetLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    targetLayer.filters = [blurFilter]
    this.applyGradualBlur(blurFilter, blur)
  }

  private applyGradualBlur(blurFilter: PIXI.BlurFilter | null, blur: BlurEffect) {
    if (!blur.gradualEnabled) return
    if (blurFilter) blurFilter.strength = blur.gradualStartStrength

    const proxy = { strength: blur.gradualStartStrength }
    const resetStrength = () => {
      proxy.strength = blur.gradualStartStrength
      if (blurFilter) blurFilter.strength = blur.gradualStartStrength
      // 放射線ブラー時、リセット時に画像クローンを更新（テクスチャ＆トランスフォーム）
      if (blur.radialEnabled && this.radialBlurImageClone && this.imageSprite) {
        this.radialBlurImageClone.texture = this.imageSprite.texture
        this.copySpriteTransform(this.imageSprite, this.radialBlurImageClone)
      }
    }

    this.blurGsapTween = gsap.to(proxy, {
      strength: blur.gradualEndStrength,
      duration: Math.max(0.001, blur.gradualDurationSec),
      ease: 'none',
      repeat: -1,
      onRepeat: resetStrength,
      onUpdate: () => {
        if (blurFilter) blurFilter.strength = proxy.strength
      },
    })
  }

  private buildRadialGradientBlur(blur: BlurEffect) {
    if (!this.imageSprite) return

    const radialBlurLayer = new PIXI.Container()
    const imageClone = new PIXI.Sprite(this.imageSprite.texture)
    imageClone.anchor.set(0.5)
    this.copySpriteTransform(this.imageSprite, imageClone)
    radialBlurLayer.addChild(imageClone)

    const maskSprite = this.createRadialGradientMaskSprite(blur.radialIntensity)
    const blurFilter = new PIXI.BlurFilter({ strength: blur.strength, quality: 4 })
    const maskFilter = new PIXI.MaskFilter({
      sprite: maskSprite,
      channel: 'alpha',
    })
    radialBlurLayer.filterArea = new PIXI.Rectangle(0, 0, this.width, this.height)
    radialBlurLayer.filters = [blurFilter, maskFilter]
    this.blurFilter = blurFilter

    const insertIndex = this.container.getChildIndex(this.overlayLayer)
    maskSprite.alpha = 0
    this.container.addChildAt(radialBlurLayer, insertIndex)
    this.container.addChildAt(maskSprite, insertIndex + 1)

    this.radialBlurLayer = radialBlurLayer
    this.radialBlurMaskSprite = maskSprite
    this.radialBlurImageClone = imageClone
  }

  private createRadialGradientMaskSprite(intensity: number): PIXI.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(this.width)
    canvas.height = Math.ceil(this.height)
    const ctx = canvas.getContext('2d')!
    const cx = this.width / 2
    const cy = this.height / 2
    const maxRadius = Math.sqrt(cx * cx + cy * cy)

    const innerStop = Math.max(0, Math.min(0.6, 1 - intensity))
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius)
    gradient.addColorStop(0, `rgba(0,0,0,0)`)
    gradient.addColorStop(innerStop, `rgba(0,0,0,0)`)
    gradient.addColorStop(1, `rgba(255,255,255,1)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = PIXI.Texture.from(canvas)
    return new PIXI.Sprite(texture)
  }

  private refreshBlurRegion() {
    if (!this.latestEffects) return
    this.blurAnimationKey = null
    this.updateBlur(this.latestEffects)
  }

  private syncRadialBlurClones() {
    if (this.imageSprite && this.radialBlurImageClone) {
      this.copySpriteTransform(this.imageSprite, this.radialBlurImageClone)
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
    if (this.radialBlurLayer) {
      this.radialBlurLayer.filters = []
      this.radialBlurLayer.filterArea = null
      this.container.removeChild(this.radialBlurLayer)
      if (this.radialBlurImageClone) {
        this.radialBlurLayer.removeChild(this.radialBlurImageClone)
        this.radialBlurImageClone.destroy({ texture: false })
        this.radialBlurImageClone = null
      }
      this.radialBlurLayer.destroy()
      this.radialBlurLayer = null
    }
    if (this.radialBlurMaskSprite) {
      this.container.removeChild(this.radialBlurMaskSprite)
      this.radialBlurMaskSprite.texture.destroy(true)
      this.radialBlurMaskSprite.destroy()
      this.radialBlurMaskSprite = null
    }
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

function toFileUrl(src: string): string {
  if (src.startsWith('file://') || src.startsWith('http') || src.startsWith('data:')) {
    return src
  }
  const normalized = src.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}
