import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { BlurEffect, CellEffects, ImageFitMode, SlideShowTransition } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem,
} from './pixiEffects'

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

  private imageLayer: PIXI.Container
  private effectsLayer: PIXI.Container
  private overlayLayer: PIXI.Container
  private particleContainer: PIXI.Container
  private vignetteLayer: PIXI.Container

  private imageSprite: PIXI.Sprite | null = null
  private imageMask: PIXI.Graphics
  private colorOverlayGraphics: PIXI.Graphics
  private vignetteSprite: PIXI.Sprite | null = null
  private radialBlurLayer: PIXI.Container | null = null
  private radialBlurMaskSprite: PIXI.Sprite | null = null
  private radialBlurImageClone: PIXI.Sprite | null = null
  private particleSystem: ParticleSystem

  private width: number
  private height: number

  private vignetteGsapTween: gsap.core.Tween | null = null
  private vignetteAnimationKey: string | null = null
  private blurFilter: PIXI.BlurFilter | null = null
  private blurGsapTween: gsap.core.Tween | null = null
  private blurAnimationKey: string | null = null

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

  constructor(cellId: string, width: number, height: number) {
    this.cellId = cellId
    this.width = width
    this.height = height

    this.container = new PIXI.Container()
    this.container.eventMode = 'static'
    this.container.cursor = 'pointer'

    this.imageLayer = new PIXI.Container()
    this.effectsLayer = new PIXI.Container()
    this.overlayLayer = new PIXI.Container()
    this.particleContainer = new PIXI.Container()
    this.vignetteLayer = new PIXI.Container()
    this.imageMask = new PIXI.Graphics()

    this.container.addChild(this.imageLayer)
    this.container.addChild(this.effectsLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)
    this.container.addChild(this.vignetteLayer)

    this.imageLayer.addChild(this.imageMask)
    this.imageLayer.mask = this.imageMask
    this.redrawImageMask()

    this.colorOverlayGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.colorOverlayGraphics)

    this.particleSystem = new ParticleSystem(this.particleContainer)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.repositionImage()
    this.redrawImageMask()
    this.rebuildVignette()
    this.refreshBlurRegion()
  }

  setImageFit(imageFit: ImageFitMode = 'cover') {
    if (this.imageFit === imageFit) return
    this.imageFit = imageFit
    this.repositionImage()
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
      this.positionSprite(sprite)
      this.refreshBlurRegion()
      return
    }

    this.startImageTransition(sprite, url, transition, transitionDurationMs)
  }

  updateEffects(effects: CellEffects) {
    this.latestEffects = effects
    this.updateColorOverlay(effects)
    this.updateVignette(effects)
    this.updateBlur(effects)
    this.updateAsset(effects)
  }

  resetEffectTiming(effects: CellEffects, withRandomDelay = false) {
    // ビネット・ブラーアニメーション開始タイミングをリセット
    const durationMs = Math.max(effects.vignette.dynamicDurationMs, effects.blur.gradualDurationSec * 1000, 1000)
    const delay = withRandomDelay ? Math.random() * durationMs : 0
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.vignetteGsapTween = null
    this.blurGsapTween = null
    this.vignetteAnimationKey = null
    this.blurAnimationKey = null
    if (delay > 0) {
      const timeoutId = window.setTimeout(() => {
        this.updateEffects(effects)
      }, delay)
      // タイムアウトIDを記録（cleanup用）
      const prevTimeoutId = (this as any).effectResetTimeoutId
      if (prevTimeoutId) clearTimeout(prevTimeoutId)
      ;(this as any).effectResetTimeoutId = timeoutId
    } else {
      this.updateEffects(effects)
    }
  }

  tick(delta: number, effects: CellEffects) {
    this.syncRadialBlurClones()
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
    this.imageTransitionTween?.kill()
    this.particleSystem.destroy()
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
      this.positionSprite(sprite)
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

    this.positionSprite(oldSprite)
    this.positionSprite(sprite)

    const duration = Math.max(0.05, transitionDurationMs / 1000)
    const baseScale = sprite.scale.x
    const centerX = this.width / 2
    const centerY = this.height / 2

    const finish = () => {
      if (this.transitionSprite === oldSprite) {
        this.imageLayer.removeChild(oldSprite)
        oldSprite.destroy({ texture: false })
        this.transitionSprite = null
      }
      this.imageTransitionTween = null
      this.repositionImage()
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
        sprite.x = centerX + offsetX
        sprite.y = centerY + offsetY
        oldSprite.x = centerX
        oldSprite.y = centerY
        this.imageTransitionTween = gsap.to(sprite, {
          x: centerX,
          y: centerY,
          duration,
          ease: 'sine.out',
          onComplete: finish,
        })
        gsap.to(oldSprite, {
          x: centerX - offsetX * 0.25,
          y: centerY - offsetY * 0.25,
          alpha: 0,
          duration,
          ease: 'sine.out',
        })
        break
      }
      case 'zoom-in':
      case 'zoom-out': {
        const startScale = transition === 'zoom-in' ? baseScale * 1.12 : baseScale * 0.88
        sprite.scale.set(startScale)
        sprite.alpha = 0
        oldSprite.alpha = 1
        this.imageTransitionTween = gsap.to(sprite.scale, {
          x: baseScale,
          y: baseScale,
          duration,
          ease: 'sine.out',
          onComplete: finish,
        })
        gsap.to(sprite, { alpha: 1, duration, ease: 'sine.out' })
        gsap.to(oldSprite, { alpha: 0, duration, ease: 'sine.out' })
        break
      }
      default:
        this.swapImageSprite(sprite, url)
        this.positionSprite(sprite)
        this.refreshBlurRegion()
    }
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

    if (!this.transitionSprite) return
    gsap.killTweensOf(this.transitionSprite)
    this.imageLayer.removeChild(this.transitionSprite)
    this.transitionSprite.destroy({ texture: false })
    this.transitionSprite = null
  }

  private repositionImage() {
    if (!this.imageSprite) return
    this.positionSprite(this.imageSprite)
    if (this.transitionSprite && this.transitionSprite !== this.imageSprite) {
      this.positionSprite(this.transitionSprite)
    }
    this.redrawImageMask()
    this.syncRadialBlurClones()
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

  private updateColorOverlay(effects: CellEffects) {
    updateColorOverlay(this.colorOverlayGraphics, this.width, this.height, effects)
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
