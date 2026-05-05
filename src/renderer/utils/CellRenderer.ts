import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { CellEffects, ImageFitMode } from '../../shared/types'
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
  private animationRandomOffset: number = 0  // 各セルのアニメーション開始ランダムオフセット（秒）

  private assetTexture: PIXI.Texture | null = null
  private assetPath: string | null = null
  private assetFolderImagePaths: string[] = []
  private currentImageSrc: string | null = null
  private requestedImageSrc: string | null = null
  private imageFit: ImageFitMode = 'cover'
  private vignetteAnimationKey: string | null = null

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
    this.animationRandomOffset = Math.random() * 2  // 0～2秒のランダムオフセット
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

  async setImage(src: string) {
    const url = toFileUrl(src)
    if (url === this.currentImageSrc || url === this.requestedImageSrc) return
    this.requestedImageSrc = url

    if (!src) {
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
    if (this.requestedImageSrc !== url) return

    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    this.swapImageSprite(sprite, url)
    this.repositionImage()
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
    const texW = this.imageSprite.texture.width
    const texH = this.imageSprite.texture.height
    const scale = this.getImageScale(texW, texH)

    this.imageSprite.scale.set(scale)
    this.imageSprite.x = this.width / 2
    this.imageSprite.y = this.height / 2
    this.redrawImageMask()
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
          delay: this.animationRandomOffset,
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

    const blurFilter = new PIXI.BlurFilter()
    this.blurFilter = blurFilter
    targetLayer.filters = [blurFilter]

    if (blur.gradualEnabled) {
      blurFilter.blur = blur.gradualStartStrength
      const proxy = { strength: blur.gradualStartStrength }
      this.blurGsapTween = gsap.to(proxy, {
        strength: blur.gradualEndStrength,
        duration: blur.gradualDurationSec,
        ease: 'none',
        delay: this.animationRandomOffset,
        onUpdate: () => { blurFilter.blur = proxy.strength }
      })
    } else {
      blurFilter.blur = blur.strength
    }
  }

  private async updateAsset(effects: CellEffects) {
    const da = effects.dynamicAsset

    if (!da.assetPath) {
      this.assetPath = null
      this.assetTexture = null
      this.assetFolderImagePaths = []
      this.particleSystem.setTextures([])
      return
    }

    // フォルダ選択: folderImages の内容が変わった場合にリロード
    if (da.assetSourceType === 'folder' && da.folderImages && da.folderImages.length > 0) {
      const pathKey = da.folderImages.join('|')
      if (pathKey === this.assetFolderImagePaths.join('|')) return
      this.assetPath = da.assetPath
      this.assetFolderImagePaths = da.folderImages.slice()
      const textures = (await Promise.all(
        da.folderImages.map(p => PIXI.Assets.load(toFileUrl(p)).catch(() => null))
      )).filter(Boolean) as PIXI.Texture[]
      this.particleSystem.setTextures(textures)
      return
    }

    // ファイル選択
    if (da.assetPath !== this.assetPath) {
      this.assetPath = da.assetPath
      this.assetFolderImagePaths = []
      try {
        this.assetTexture = await PIXI.Assets.load(toFileUrl(da.assetPath))
      } catch {
        this.assetTexture = null
      }
      this.particleSystem.setTextures(this.assetTexture ? [this.assetTexture] : [])
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

  resetAnimationTiming() {
    this.animationRandomOffset = Math.random() * 2
    this.vignetteGsapTween?.kill()
    this.vignetteGsapTween = null
    this.vignetteAnimationKey = null
    this.blurGsapTween?.kill()
    this.blurGsapTween = null
    this.blurFilter = null
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
