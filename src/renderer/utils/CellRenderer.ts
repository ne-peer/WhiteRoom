import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { Cell, CellEffects } from '../../shared/types'
import {
  createVignetteTexture,
  updateColorOverlay,
  ParticleSystem
} from './pixiEffects'

export class CellRenderer {
  readonly cellId: string
  readonly container: PIXI.Container

  private imageLayer: PIXI.Container        // 画像本体
  private effectsLayer: PIXI.Container      // 全エフェクト（blur対象になりうる）
  private overlayLayer: PIXI.Container      // 画像の上のオーバレイ

  private imageSprite: PIXI.Sprite | null = null
  private colorOverlayGraphics: PIXI.Graphics
  private vignetteSprite: PIXI.Sprite | null = null
  private particleContainer: PIXI.Container
  private particleSystem: ParticleSystem

  private width: number
  private height: number

  // ビネット動的アニメ
  private vignetteGsapTween: gsap.core.Tween | null = null

  // ブラーフィルタ参照
  private blurFilter: PIXI.BlurFilter | null = null
  // ブラー徐々増加用
  private blurGsapTween: gsap.core.Tween | null = null

  // アセットテクスチャキャッシュ
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

    // レイヤー構成
    this.imageLayer = new PIXI.Container()
    this.effectsLayer = new PIXI.Container()
    this.overlayLayer = new PIXI.Container()
    this.particleContainer = new PIXI.Container()

    this.container.addChild(this.imageLayer)
    this.container.addChild(this.effectsLayer)
    this.container.addChild(this.overlayLayer)
    this.container.addChild(this.particleContainer)

    // カラーオーバレイ
    this.colorOverlayGraphics = new PIXI.Graphics()
    this.overlayLayer.addChild(this.colorOverlayGraphics)

    // パーティクルシステム
    this.particleSystem = new ParticleSystem(this.particleContainer)
  }

  // ===== リサイズ =====

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.repositionImage()
    this.rebuildVignette()
  }

  // ===== 画像セット =====

  async setImage(src: string) {
    const url = toFileUrl(src)
    if (url === this.currentImageSrc) return
    this.currentImageSrc = url

    // 既存スプライト除去
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
    const s = this.imageSprite
    const { width: w, height: h } = this
    const texW = s.texture.width
    const texH = s.texture.height
    const scale = Math.max(w / texW, h / texH)
    s.scale.set(scale)
    s.x = w / 2
    s.y = h / 2

    // クリッピング（マスク）
    const mask = new PIXI.Graphics()
    mask.rect(0, 0, w, h).fill(0xffffff)
    this.imageLayer.mask = mask
    this.imageLayer.addChild(mask)
  }

  // ===== エフェクト更新 =====

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
      if (this.vignetteGsapTween) { this.vignetteGsapTween.kill(); this.vignetteGsapTween = null }
      return
    }

    // テクスチャ再生成（色やサイズが変わった場合）
    if (!this.vignetteSprite) {
      const tex = createVignetteTexture(
        this.width, this.height, vig.color
      )
      this.vignetteSprite = new PIXI.Sprite(tex)
      this.effectsLayer.addChild(this.vignetteSprite)
    }

    this.vignetteSprite.visible = true

    // 動的ビネット
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
      if (this.vignetteGsapTween) { this.vignetteGsapTween.kill(); this.vignetteGsapTween = null }
      this.vignetteSprite.alpha = vig.alpha
    }
  }

  private updateBlur(effects: CellEffects) {
    const blur = effects.blur

    // ブラー対象レイヤー決定
    const targetLayer = blur.applyToAll ? this.effectsLayer : this.imageLayer

    // 既存フィルタ全クリア
    this.imageLayer.filters = []
    this.effectsLayer.filters = []

    if (this.blurGsapTween) { this.blurGsapTween.kill(); this.blurGsapTween = null }
    this.blurFilter = null

    if (!blur.enabled) return

    const blurFilter = new PIXI.BlurFilter({ strength: blur.strength, quality: 4 })
    this.blurFilter = blurFilter
    targetLayer.filters = [blurFilter]

    // 徐々に強度増加
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

    // アセットパスが変わった場合テクスチャ再ロード
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

  // ===== フレーム更新（PixiJS ticker から呼ばれる）=====

  tick(delta: number, effects: CellEffects) {
    this.particleSystem.update(
      delta,
      this.width,
      this.height,
      effects,
      performance.now()
    )
  }

  // ===== 後片付け =====

  destroy() {
    this.vignetteGsapTween?.kill()
    this.blurGsapTween?.kill()
    this.particleSystem.destroy()
    this.container.destroy({ children: true })
  }
}

// OSパス → file:// URL 変換（PixiJS Assets.load用）
function toFileUrl(src: string): string {
  if (src.startsWith('file://') || src.startsWith('http') || src.startsWith('data:')) {
    return src
  }
  // Windows: C:\path\to\img.jpg → file:///C:/path/to/img.jpg
  const normalized = src.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}
