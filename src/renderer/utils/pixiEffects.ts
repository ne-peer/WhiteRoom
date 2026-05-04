import * as PIXI from 'pixi.js'
import type { CellEffects, AssetParticle } from '../../shared/types'

// ===== ビネットテクスチャ生成 =====
export function createVignetteTexture(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): PIXI.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.sqrt(width * width + height * height) / 2
  )
  const { r, g, b } = color
  gradient.addColorStop(0, `rgba(${r},${g},${b},0)`)
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.1)`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},1)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  return PIXI.Texture.from(canvas)
}

// ===== カラーオーバーレイグラフィック更新 =====
export function updateColorOverlay(
  graphics: PIXI.Graphics,
  width: number,
  height: number,
  effects: CellEffects
) {
  graphics.clear()
  if (!effects.colorOverlay.enabled) {
    graphics.alpha = 0
    return
  }
  const { r, g, b } = effects.colorOverlay.color
  const alpha = effects.colorOverlay.alpha
  graphics.rect(0, 0, width, height)
  graphics.fill({ color: (r << 16) | (g << 8) | b, alpha })
  graphics.alpha = 1
}

// ===== ブラーフィルタ適用 =====
export function applyBlurFilter(
  container: PIXI.Container,
  effects: CellEffects
): PIXI.BlurFilter | null {
  // 既存フィルタ除去
  container.filters = []
  if (!effects.blur.enabled || effects.blur.strength <= 0) return null
  const blur = new PIXI.BlurFilter({ strength: effects.blur.strength, quality: 4 })
  container.filters = [blur]
  return blur
}

// ===== パーティクル（動的アセット）管理 =====
export class ParticleSystem {
  private particles: AssetParticle[] = []
  private sprites: Map<string, PIXI.Sprite> = new Map()
  private container: PIXI.Container
  private texture: PIXI.Texture | null = null
  private lastSpawn = 0

  constructor(container: PIXI.Container) {
    this.container = container
  }

  setTexture(texture: PIXI.Texture | null) {
    this.texture = texture
    if (!texture) {
      this.clear()
    }
  }

  update(
    delta: number,
    canvasWidth: number,
    canvasHeight: number,
    effects: CellEffects,
    nowMs: number
  ) {
    if (!effects.dynamicAsset.enabled || !this.texture) {
      this.clear()
      return
    }

    const { spawnIntervalMs, maxParticles } = effects.dynamicAsset
    const overlayTint = getAssetOverlayTint(effects)

    // スポーン
    if (
      nowMs - this.lastSpawn > spawnIntervalMs &&
      this.particles.length < maxParticles
    ) {
      this.lastSpawn = nowMs
      const p: AssetParticle = {
        id: `p-${nowMs}-${Math.random()}`,
        assetPath: effects.dynamicAsset.assetPath ?? '',
        x: Math.random() * canvasWidth,
        y: canvasHeight + 20,
        alpha: 0.9,
        vy: randomRiseSpeed(),
        startTime: nowMs,
      }
      this.particles.push(p)

      const sprite = new PIXI.Sprite(this.texture)
      sprite.anchor.set(0.5)
      sprite.x = p.x
      sprite.y = p.y
      sprite.alpha = p.alpha
      sprite.scale.set(0.5 + Math.random() * 0.5)
      sprite.tint = overlayTint
      this.container.addChild(sprite)
      this.sprites.set(p.id, sprite)
    }

    // 更新・削除
    this.particles = this.particles.filter(p => {
      p.y -= p.vy * delta
      p.alpha -= 0.004 * delta

      const sprite = this.sprites.get(p.id)
      if (sprite) {
        sprite.y = p.y
        sprite.alpha = Math.max(0, p.alpha)
        sprite.tint = overlayTint
      }

      if (p.alpha <= 0 || p.y < -50) {
        if (sprite) {
          this.container.removeChild(sprite)
          sprite.destroy()
        }
        this.sprites.delete(p.id)
        return false
      }
      return true
    })
  }

  clear() {
    this.sprites.forEach(sprite => {
      this.container.removeChild(sprite)
      sprite.destroy()
    })
    this.sprites.clear()
    this.particles = []
  }

  destroy() {
    this.clear()
  }
}

function getAssetOverlayTint(effects: CellEffects): number {
  const da = effects.dynamicAsset
  if (!da.colorOverlayEnabled || da.colorOverlayAlpha <= 0) return 0xffffff

  const alpha = Math.max(0, Math.min(1, da.colorOverlayAlpha))
  const r = Math.round(255 + (da.colorOverlayColor.r - 255) * alpha)
  const g = Math.round(255 + (da.colorOverlayColor.g - 255) * alpha)
  const b = Math.round(255 + (da.colorOverlayColor.b - 255) * alpha)
  return (r << 16) | (g << 8) | b
}

function randomRiseSpeed(): number {
  return [2, 4, 6][Math.floor(Math.random() * 3)]
}
