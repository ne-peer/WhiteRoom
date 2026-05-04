import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { CellEffects, ImageFitMode, SlideShowTransition } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem
} from './pixiEffects'

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

  private imageLayer: PIXI.Container
  private effectsLayer: PIXI.Container
  private overlayLayer: PIXI.Container
  private particleContainer: PIXI.Container

  private imageSprite: PIXI.Sprite | null = null
  private imageMask: PIXI.Graphics
  private colorOverlayGraphics: PIXI.Graphics
  private vignetteSprite: PIXI.Sprite | null = null
  private particleSystem: ParticleSystem

  private width: number
  private height: number

  private vignetteGsapTween: gsap.core.Tween | null = null
  private blurFilter: PIXI.BlurFilter | null = null
  private blurGsapTween: gsap.core.Tween | null = null

  private assetTexture: PIXI.Texture | null = null
  private assetPath: string | null = null
  private currentImageSrc: string | null = null
  private requestedImageSrc: string | null = null
  private imageFit: ImageFitMode = 'cover'
  private vignetteAnimationKey: string | null = null
  private transitionSprite: PIXI.Sprite | null = null
  private imageTransitionTween: gsap.core.Tween | null = null
  private imageRequestToken = 0

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
    this.imageMask = new PIXI.Graphics()

    this.container.addChild(this.imageLayer)
    this.container.addChild(this.effectsLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)

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
  }

  setImageFit(imageFit: ImageFitMode = 'cover') {
    if (this.imageFit === imageFit) return
    this.imageFit = imageFit
    this.repositionImage()
  }

  async setImage(src: string, transition: SlideShowTransition = 'none', transitionDurationMs = 350) {
    const url = toFileUrl(src)
    if (url === this.currentImageSrc || url === this.requestedImageSrc) return
    this.requestedImageSrc = url
    const requestToken = ++this.imageRequestToken

    if (!src) {
      this.clearTransitionSprite()
      this.swapImageSprite(null, null)
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
      return
    }

    this.startImageTransition(sprite, url, transition, transitionDurationMs)
  }

  private swapImageSprite(sprite: PIXI.Sprite | null, url: string | null) {
    const oldSprite = this.imageSprite
    if (oldSprite) gsap.killTweensOf(oldSprite)
    if (sprite) {
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

    if (!this.transitionSprite) return
    gsap.killTweensOf(this.transitionSprite)
    this.imageLayer.removeChild(this.transitionSprite)
    this.transitionSprite.destroy({ texture: false })
    this.transitionSprite = null
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
    }
  }

  private swapImageSprite(sprite: PIXI.Sprite | null, url: string | null) {
    const oldSprite = this.imageSprite
    if (sprite) {
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

  private repositionImage() {
    if (!this.imageSprite) return
    this.positionSprite(this.imageSprite)
    if (this.transitionSprite && this.transitionSprite !== this.imageSprite) {
      this.positionSprite(this.transitionSprite)
    }
    this.redrawImageMask()
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

  updateEffects(effects: CellEffects) {
    this.updateColorOverlay(effects)
    this.updateVignette(effects)
    this.updateBlur(effects)
    this.updateAsset(effects)
  }

  private updateColorOverlay(effects: CellEffects) {
    updateColorOverlay(this.colorOverlayGraphics, this.width, this.height, effects)
  }

  private rebuildVignette() {
    if (this.vignetteSprite) {
      this.effectsLayer.removeChild(this.vignetteSprite)
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
      this.effectsLayer.addChild(this.vignetteSprite)
    }

    this.vignetteSprite.visible = true

    if (vig.dynamic) {
      const animationKey = [
        vig.dynamicFrom,
        vig.dynamicTo,
        vig.dynamicDurationMs,
        effects.blur.enabled && effects.blur.gradualEnabled ? 'sync-blur' : 'solo',
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
          }
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
    const targetLayer = blur.applyToAll ? this.effectsLayer : this.imageLayer

    this.imageLayer.filters = []
    this.effectsLayer.filters = []

    if (this.blurGsapTween) {
      this.blurGsapTween.kill()
      this.blurGsapTween = null
    }
    this.blurFilter = null

    if (!blur.enabled) return

    const blurFilter = new PIXI.BlurFilter({ strength: blur.strength, quality: 4 })
    this.blurFilter = blurFilter
    targetLayer.filters = [blurFilter]

    if (blur.gradualEnabled) {
      blurFilter.blur = blur.gradualStartStrength
      const proxy = { strength: blur.gradualStartStrength }
      this.blurGsapTween = gsap.to(proxy, {
        strength: blur.gradualEndStrength,
        duration: blur.gradualDurationSec,
        ease: 'none',
        onUpdate: () => { blurFilter.blur = proxy.strength }
      })
    }
  }

  private async updateAsset(effects: CellEffects) {
    const da = effects.dynamicAsset

    if (da.assetPath && da.assetPath !== this.assetPath) {
      this.assetPath = da.assetPath
      try {
        this.assetTexture = await PIXI.Assets.load(toFileUrl(da.assetPath))
      } catch {
        this.assetTexture = null
      }
      this.particleSystem.setTexture(this.assetTexture)
    } else if (!da.assetPath) {
      this.assetPath = null
      this.assetTexture = null
      this.particleSystem.setTexture(null)
    }
  }

  tick(delta: number, effects: CellEffects) {
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
    this.container.destroy({ children: true })
  }
}

function toFileUrl(src: string): string {
  if (src.startsWith('file://') || src.startsWith('http') || src.startsWith('data:')) {
    return src
  }
  const normalized = src.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}
