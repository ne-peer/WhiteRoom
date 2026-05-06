import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { CellEffects, AssetParticle, TextEffect } from '../../shared/types'

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

// emergenceパターンのフェーズ時間（固定）
const EMERGENCE_PHASE1_MS = 600   // 高速拡大フェーズ
const EMERGENCE_PHASE2_MS = 1400  // 緩慢拡大＋フェードアウトフェーズ

// ===== パーティクル（動的アセット）管理 =====
export class ParticleSystem {
  private particles: AssetParticle[] = []
  private sprites: Map<string, PIXI.Sprite> = new Map()
  private container: PIXI.Container
  private texture: PIXI.Texture | null = null
  private textures: PIXI.Texture[] = []
  private lastSpawn = 0

  constructor(container: PIXI.Container) {
    this.container = container
  }

  setTexture(texture: PIXI.Texture | null) {
    this.texture = texture
    this.textures = texture ? [texture] : []
    if (!texture) {
      this.clear()
    }
  }

  setTextures(textures: PIXI.Texture[]) {
    this.textures = textures
    this.texture = textures[0] ?? null
    if (textures.length === 0) {
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
    if (!effects.dynamicAsset.enabled || this.textures.length === 0) {
      this.clear()
      return
    }

    const { spawnIntervalMs, maxParticles, sizeRatio, baseAlpha, pattern } = effects.dynamicAsset
    const overlayTint = getAssetOverlayTint(effects)
    const isEmergence = (pattern ?? 'rising') === 'emergence'

    // スポーン
    if (
      nowMs - this.lastSpawn > spawnIntervalMs &&
      this.particles.length < maxParticles
    ) {
      this.lastSpawn = nowMs

      if (isEmergence) {
        // 発生パターン: ランダム位置、サイズ係数1.0-1.4のランダムばらつき
        const speedFactor = clamp(effects.dynamicAsset.emergenceSpeedFactor ?? 1.0, 0.1, 5.0)
        const randomFactor = 1.0 + Math.random() * 0.4
        const baseScale = clamp(sizeRatio, 0.1, 3.0) * randomFactor
        const p: AssetParticle = {
          id: `p-${nowMs}-${Math.random()}`,
          assetPath: effects.dynamicAsset.assetPath ?? '',
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
          alpha: 0.5,
          vy: 0,
          startTime: nowMs,
          baseScale,
          phase1DurationMs: EMERGENCE_PHASE1_MS / speedFactor,
          phase2DurationMs: EMERGENCE_PHASE2_MS / speedFactor,
        }
        this.particles.push(p)

        const sprite = new PIXI.Sprite(randomTexture(this.textures))
        sprite.anchor.set(0.5)
        sprite.x = p.x
        sprite.y = p.y
        sprite.alpha = 0
        sprite.scale.set(0)
        sprite.tint = overlayTint
        this.container.addChild(sprite)
        this.sprites.set(p.id, sprite)
      } else {
        // 上昇パターン: 既存の挙動
        const p: AssetParticle = {
          id: `p-${nowMs}-${Math.random()}`,
          assetPath: effects.dynamicAsset.assetPath ?? '',
          x: Math.random() * canvasWidth,
          y: canvasHeight - Math.random() * canvasHeight * clamp(effects.dynamicAsset.spawnMaxHeightRatio, 0, 0.7),
          alpha: clamp(baseAlpha, 0, 1),
          vy: randomRiseSpeed(),
          startTime: nowMs,
        }
        this.particles.push(p)

        const sprite = new PIXI.Sprite(randomTexture(this.textures))
        sprite.anchor.set(0.5)
        sprite.x = p.x
        sprite.y = p.y
        sprite.alpha = p.alpha
        sprite.scale.set((0.5 + Math.random() * 0.5) * clamp(sizeRatio, 0.1, 3.0))
        sprite.tint = overlayTint
        this.container.addChild(sprite)
        this.sprites.set(p.id, sprite)
      }
    }

    // 更新・削除
    this.particles = this.particles.filter(p => {
      const sprite = this.sprites.get(p.id)

      if (p.baseScale !== undefined) {
        // 発生パターンの更新
        const elapsed = nowMs - p.startTime
        const totalDuration = (p.phase1DurationMs ?? EMERGENCE_PHASE1_MS) + (p.phase2DurationMs ?? EMERGENCE_PHASE2_MS)

        if (elapsed >= totalDuration) {
          if (sprite) {
            this.container.removeChild(sprite)
            sprite.destroy()
          }
          this.sprites.delete(p.id)
          return false
        }

        if (sprite) {
          const ph1 = p.phase1DurationMs ?? EMERGENCE_PHASE1_MS
          if (elapsed < ph1) {
            // フェーズ1: 高速拡大、透過度50%→100%
            const t = elapsed / ph1
            sprite.scale.set(p.baseScale * t)
            sprite.alpha = 0.5 + t * 0.5
          } else {
            // フェーズ2: ゆっくり拡大（100%→115%）、透過度100%→0%
            const t = (elapsed - ph1) / (p.phase2DurationMs ?? EMERGENCE_PHASE2_MS)
            sprite.scale.set(p.baseScale * (1.0 + t * 0.15))
            sprite.alpha = 1.0 - t
          }
          sprite.tint = overlayTint
        }
      } else {
        // 上昇パターンの更新
        p.y -= p.vy * delta
        p.alpha -= 0.004 * delta

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

// ===== テキストエフェクト管理 =====

export class TextSystem {
  private container: PIXI.Container
  private mask: PIXI.Graphics
  private activeChars: PIXI.Text[] = []
  private activeTimeline: gsap.core.Timeline | null = null
  private nextTimeout: ReturnType<typeof setTimeout> | null = null
  private running = false
  private currentKey: string | null = null
  private cellWidth = 0
  private cellHeight = 0

  constructor(container: PIXI.Container) {
    this.container = container
    this.mask = new PIXI.Graphics()
    this.container.addChild(this.mask)
    this.container.mask = this.mask
  }

  resizeMask(width: number, height: number) {
    this.cellWidth = width
    this.cellHeight = height
    this.mask.clear()
    this.mask.rect(0, 0, width, height)
    this.mask.fill(0xffffff)
  }

  update(effects: TextEffect, width: number, height: number) {
    this.cellWidth = width
    this.cellHeight = height

    const validTexts = effects.texts.filter(t => t.trim().length > 0)
    if (!effects.enabled || validTexts.length === 0) {
      this.stop()
      return
    }

    const key = [
      effects.font,
      effects.fontSize,
      effects.color.r, effects.color.g, effects.color.b,
      effects.alpha,
      effects.charIntervalMs,
      effects.displayDurationMs,
      effects.intervalMs,
      effects.direction,
      validTexts.join('|'),
    ].join(':')

    if (this.running && this.currentKey === key) return

    this.stop()
    this.currentKey = key
    this.running = true
    this.scheduleNext(0, effects)
  }

  private scheduleNext(delayMs: number, effects: TextEffect) {
    if (this.nextTimeout) clearTimeout(this.nextTimeout)
    this.nextTimeout = setTimeout(() => {
      if (this.running) this.playAnimation(effects)
    }, delayMs)
  }

  private playAnimation(effects: TextEffect) {
    if (!this.running) return

    const validTexts = effects.texts.filter(t => t.trim().length > 0)
    if (validTexts.length === 0) return

    const text = validTexts[Math.floor(Math.random() * validTexts.length)]
    const { font, fontSize, color, charIntervalMs, displayDurationMs, intervalMs, direction } = effects
    const alpha = clamp(effects.alpha ?? 1, 0, 1)
    const hexColor = (color.r << 16) | (color.g << 8) | color.b

    const style = new PIXI.TextStyle({
      fontFamily: font,
      fontSize,
      fill: hexColor,
      dropShadow: { color: 0x000000, alpha: 0.5, blur: 4, distance: 2, angle: Math.PI / 4 },
    })

    const chars = Array.from(text)
    const charObjects: PIXI.Text[] = []

    const safeX = Math.max(0, Math.random() * (this.cellWidth - fontSize))
    const safeY = Math.max(0, Math.random() * (this.cellHeight - fontSize))

    chars.forEach((ch, i) => {
      const charText = new PIXI.Text({ text: ch, style })
      charText.alpha = 0
      charText.anchor.set(0, 0)
      if (direction === 'horizontal') {
        charText.x = safeX + i * fontSize * 0.85
        charText.y = safeY
      } else {
        charText.x = safeX
        charText.y = safeY + i * fontSize * 1.1
      }
      this.container.addChild(charText)
      charObjects.push(charText)
    })

    this.activeChars = charObjects

    const tl = gsap.timeline({
      onComplete: () => {
        charObjects.forEach(c => {
          if (c.parent) c.parent.removeChild(c)
          c.destroy()
        })
        this.activeChars = []
        this.activeTimeline = null
        if (this.running) this.scheduleNext(intervalMs, effects)
      },
    })

    // 1文字ずつフェードイン
    const charIntervalSec = charIntervalMs / 1000
    chars.forEach((_, i) => {
      tl.to(charObjects[i], { alpha, duration: Math.max(0.03, charIntervalSec * 0.5), ease: 'sine.out' },
        i * charIntervalSec)
    })

    // 全文字表示後にフェードアウト
    const allCharsTime = (chars.length - 1) * charIntervalSec + Math.max(0.03, charIntervalSec * 0.5)
    tl.to(charObjects, {
      alpha: 0,
      duration: Math.max(0.1, displayDurationMs / 1000),
      ease: 'sine.in',
    }, allCharsTime)

    this.activeTimeline = tl
  }

  stop() {
    this.running = false
    this.currentKey = null
    if (this.nextTimeout) {
      clearTimeout(this.nextTimeout)
      this.nextTimeout = null
    }
    this.activeTimeline?.kill()
    this.activeTimeline = null
    this.activeChars.forEach(c => {
      if (c.parent) c.parent.removeChild(c)
      c.destroy()
    })
    this.activeChars = []
  }

  destroy() {
    this.stop()
    this.container.mask = null
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

function randomTexture(textures: PIXI.Texture[]): PIXI.Texture {
  return textures[Math.floor(Math.random() * textures.length)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
