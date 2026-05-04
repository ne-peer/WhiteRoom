import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { CellEffects } from '../../shared/types'
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

  async setImage(src: string) {
    const url = toFileUrl(src)
    if (url === this.currentImageSrc) return
    this.currentImageSrc = url

    if (this.imageSprite) {
      this.imageLayer.removeChild(this.imageSprite)
      this.imageSprite.destroy({ texture: false })
      this.imageSprite = null
    }

    if (!src) return

    const texture = await PIXI.Assets.load(url)
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    this.imageLayer.addChild(sprite)
    this.imageSprite = sprite
    this.repositionImage()
  }

  private repositionImage() {
    if (!this.imageSprite) return
    const texW = this.imageSprite.texture.width
    const texH = this.imageSprite.texture.height
    const scale = Math.max(this.width / texW, this.height / texH)

    this.imageSprite.scale.set(scale)
    this.imageSprite.x = this.width / 2
    this.imageSprite.y = this.height / 2
    this.redrawImageMask()
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
      return
    }

    if (!this.vignetteSprite) {
      const tex = createVignetteTexture(this.width, this.height, vig.color)
      this.vignetteSprite = new PIXI.Sprite(tex)
      this.effectsLayer.addChild(this.vignetteSprite)
    }

    this.vignetteSprite.visible = true

    if (vig.dynamic) {
      if (!this.vignetteGsapTween) {
        const proxy = { alpha: vig.dynamicFrom }
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
