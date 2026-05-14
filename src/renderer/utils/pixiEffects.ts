import * as PIXI from 'pixi.js'
import { gsap } from 'gsap'
import type { CellEffects, AssetParticle, DynamicAssetAdditionalEffect, TextEffect, RippleMovePattern } from '../../shared/types'
import { createVectorDynamicAssetDisplay } from './vectorStampRegistry'

// ===== ビネットテクスチャ生成 =====
export function createVignetteTexture(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  intensity = 50
): PIXI.Texture {
  const t = Math.max(0, Math.min(1, intensity / 100))
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u
  const clearEnd = lerp(0.68, 0.12, t)
  const rampStop = lerp(0.82, 0.36, t)
  const alphaRamp = lerp(0.04, 0.42, t)
  const alphaEdge = lerp(0.58, 1, t)

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
  gradient.addColorStop(clearEnd, `rgba(${r},${g},${b},0)`)
  gradient.addColorStop(rampStop, `rgba(${r},${g},${b},${alphaRamp})`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},${alphaEdge})`)
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
  graphics.rect(0, 0, width, height)
  graphics.fill({ color: (r << 16) | (g << 8) | b, alpha: 1 })
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

// rippleパターン定数
const RIPPLE_BASE_DURATION_MS = 2000  // 1x 速度でのフェードアウト総時間
const RIPPLE_BASE_SPEED = 2           // px/frame（60fps 基準）の外周方向速度
// 1x 速度・60fps 想定の最大移動距離: SPEED * DURATION_MS * 60fps / 1000ms
const RIPPLE_MAX_DIST = RIPPLE_BASE_SPEED * RIPPLE_BASE_DURATION_MS * 60 / 1000  // 240 px

function rippleEase(pattern: RippleMovePattern, t: number): number {
  switch (pattern) {
    case 'easeInSine':    return 1 - Math.cos((t * Math.PI) / 2)
    case 'easeInCubic':   return t * t * t
    case 'easeInQuint':   return t * t * t * t * t
    case 'easeInElastic': {
      if (t === 0) return 0; if (t === 1) return 1
      return -Math.pow(2, 10 * t - 10) * Math.sin((10 * t - 10.75) * (2 * Math.PI) / 3)
    }
    case 'easeOutSine':   return Math.sin((t * Math.PI) / 2)
    case 'easeOutCubic':  { const u = 1 - t; return 1 - u * u * u }
    case 'easeOutQuint':  { const u = 1 - t; return 1 - u * u * u * u * u }
    case 'easeOutElastic': {
      if (t === 0) return 0; if (t === 1) return 1
      return Math.pow(2, -10 * t) * Math.sin((10 * t - 0.75) * (2 * Math.PI) / 3) + 1
    }
    default: return t
  }
}

// ===== パーティクル（動的アセット）管理 =====
export class ParticleSystem {
  private particles: AssetParticle[] = []
  private sprites: Map<string, PIXI.Sprite> = new Map()
  private vectorHolders: Map<string, PIXI.Container> = new Map()
  private featherTextureCache: Map<string, PIXI.Texture> = new Map()
  private container: PIXI.Container
  private renderer: PIXI.Renderer
  private texture: PIXI.Texture | null = null
  private textures: PIXI.Texture[] = []
  private lastSpawn = 0
  private timerProgress = 1
  private activeFeatherRadius = 0
  private activeRasterColorInvert = false

  constructor(container: PIXI.Container, renderer: PIXI.Renderer) {
    this.container = container
    this.renderer = renderer
  }

  setTimerProgress(progress: number) {
    this.timerProgress = progress
  }

  setTexture(texture: PIXI.Texture | null) {
    this.texture = texture
    this.textures = texture ? [texture] : []
    if (!texture) {
      this.clear()
    }
  }

  setTextures(textures: PIXI.Texture[]) {
    if (this.vectorHolders.size > 0) {
      this.clear()
    }
    this.textures = textures
    this.texture = textures[0] ?? null
    if (textures.length === 0) {
      this.clear()
    }
  }

  /** ベクター動的アセットへ切り替え（既存ラスタ表示を破棄） */
  setVectorPreset(_presetId: string) {
    if (this.sprites.size > 0) {
      this.clear()
    }
    this.textures = []
    this.texture = null
  }

  update(
    delta: number,
    canvasWidth: number,
    canvasHeight: number,
    effects: CellEffects,
    nowMs: number
  ) {
    const useVector = effects.dynamicAsset.sourceKind === 'vector' && effects.dynamicAsset.vectorPresetId
    if (!effects.dynamicAsset.enabled || (!useVector && this.textures.length === 0)) {
      this.clear()
      return
    }

    const { spawnIntervalMs, maxParticles, sizeRatio, baseAlpha, pattern } = effects.dynamicAsset
    const featherRadius = featherStrengthToRadius(effects.dynamicAsset.featherStrength ?? 0)
    const rasterInvert =
      effects.dynamicAsset.sourceKind === 'raster' && effects.dynamicAsset.rasterColorInvertEnabled
    if (featherRadius !== this.activeFeatherRadius || rasterInvert !== this.activeRasterColorInvert) {
      this.clear()
      this.activeFeatherRadius = featherRadius
      this.activeRasterColorInvert = rasterInvert
    }
    const rawBaseAlpha = clamp(baseAlpha, 0, 1)
    const assetBaseAlpha = (effects.dynamicAsset.alphaTimerSync) ? rawBaseAlpha * this.timerProgress : rawBaseAlpha
    const isEmergence = (pattern ?? 'rising') === 'emergence'
    const isRipple = (pattern ?? 'rising') === 'ripple'

    // 非表示エリア: 除外円の半径を事前計算（0 のとき全域有効 / ripple は spawn 側で処理）
    const peripheralExcludeRadius = !isRipple
      ? clamp(effects.dynamicAsset.peripheralOnlyRadius, 0, 1) * Math.min(canvasWidth, canvasHeight) / 2
      : 0

    // スポーン
    if (
      nowMs - this.lastSpawn > spawnIntervalMs &&
      this.particles.length < maxParticles
    ) {
      this.lastSpawn = nowMs
      const particleTint = sampleParticleTint(effects)

      if (isEmergence) {
        // 発生パターン: ランダム位置、サイズは表示サイズ × 設定された ±% 範囲
        const spawnPos = sampleSpawnPosition(
          () => [Math.random() * canvasWidth, Math.random() * canvasHeight],
          canvasWidth / 2, canvasHeight / 2, peripheralExcludeRadius
        )
        if (spawnPos) {
          const speedFactor = clamp(effects.dynamicAsset.emergenceSpeedFactor ?? 1.0, 0.1, 5.0)
          const sizeMul = sampleAssetSizeRandomMultiplier(effects.dynamicAsset.sizeRandomPercent ?? 10)
          const baseScale = clamp(sizeRatio, 0.1, 3.0) * sizeMul
          const rotationRad = sampleAssetRotationRad(effects.dynamicAsset.randomRotationEnabled ?? false)
          const p: AssetParticle = {
            id: `p-${nowMs}-${Math.random()}`,
            assetPath: effects.dynamicAsset.assetPath ?? '',
            x: spawnPos[0],
            y: spawnPos[1],
            alpha: assetBaseAlpha,
            vy: 0,
            startTime: nowMs,
            particleTint,
            rotationRad,
            baseScale,
            phase1DurationMs: EMERGENCE_PHASE1_MS / speedFactor,
            phase2DurationMs: EMERGENCE_PHASE2_MS / speedFactor,
          }
          this.particles.push(p)

          if (useVector) {
            const visual = this.createVectorParticleDisplay(
              effects.dynamicAsset.vectorPresetId!,
              particleTint,
              effects.dynamicAsset.featherStrength ?? 0
            )
            if (visual) {
              visual.x = p.x
              visual.y = p.y
              visual.alpha = 0
              visual.rotation = p.rotationRad
              visual.scale.set(0)
              this.container.addChild(visual)
              if (visual instanceof PIXI.Sprite) {
                this.sprites.set(p.id, visual)
              } else {
                this.vectorHolders.set(p.id, visual)
              }
            } else {
              this.particles.pop()
            }
          } else {
            const sprite = new PIXI.Sprite(
              this.resolveRasterTexture(
                randomTexture(this.textures),
                effects.dynamicAsset.featherStrength ?? 0,
                rasterInvert,
              ),
            )
            sprite.anchor.set(0.5)
            sprite.x = p.x
            sprite.y = p.y
            sprite.alpha = 0
            sprite.rotation = p.rotationRad
            sprite.scale.set(0)
            sprite.tint = particleTint
            this.container.addChild(sprite)
            this.sprites.set(p.id, sprite)
          }
        }
      } else if (isRipple) {
        // 波紋パターン: 外周方向にランダム角度で移動、easeInSine でフェードアウト
        // 周辺のみ ON: 除外円の円周上から spawn して外側へ散る
        // 周辺のみ OFF: 中心から spawn
        const rippleSpeedFactor = clamp(effects.dynamicAsset.riseSpeedFactor ?? 1, 0.1, 5)
        const speed = RIPPLE_BASE_SPEED * rippleSpeedFactor
        const angle = Math.random() * Math.PI * 2
        const cx = canvasWidth / 2
        const cy = canvasHeight / 2
        const rippleR = clamp(effects.dynamicAsset.peripheralOnlyRadius, 0, 1) * Math.min(canvasWidth, canvasHeight) / 2
        const spawnX = cx + Math.cos(angle) * rippleR
        const spawnY = cy + Math.sin(angle) * rippleR
        const sizeMul = sampleAssetSizeRandomMultiplier(effects.dynamicAsset.sizeRandomPercent ?? 10)
        const scale = clamp(sizeRatio, 0.1, 3.0) * sizeMul
        const rotationRad = sampleAssetRotationRad(effects.dynamicAsset.randomRotationEnabled ?? false)
        const p: AssetParticle = {
          id: `p-${nowMs}-${Math.random()}`,
          assetPath: effects.dynamicAsset.assetPath ?? '',
          x: spawnX,
          y: spawnY,
          alpha: assetBaseAlpha,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          startTime: nowMs,
          particleTint,
          rotationRad,
          rippleDurationMs: RIPPLE_BASE_DURATION_MS / rippleSpeedFactor,
          rippleStartX: spawnX,
          rippleStartY: spawnY,
        }
        this.particles.push(p)

        if (useVector) {
          const visual = this.createVectorParticleDisplay(
            effects.dynamicAsset.vectorPresetId!,
            particleTint,
            effects.dynamicAsset.featherStrength ?? 0
          )
          if (visual) {
            visual.x = p.x
            visual.y = p.y
            visual.alpha = p.alpha
            visual.rotation = p.rotationRad
            visual.scale.set(scale)
            this.container.addChild(visual)
            if (visual instanceof PIXI.Sprite) {
              this.sprites.set(p.id, visual)
            } else {
              this.vectorHolders.set(p.id, visual)
            }
          } else {
            this.particles.pop()
          }
        } else {
          const sprite = new PIXI.Sprite(
            this.resolveRasterTexture(
              randomTexture(this.textures),
              effects.dynamicAsset.featherStrength ?? 0,
              rasterInvert,
            ),
          )
          sprite.anchor.set(0.5)
          sprite.x = p.x
          sprite.y = p.y
          sprite.alpha = p.alpha
          sprite.rotation = p.rotationRad
          sprite.scale.set(scale)
          sprite.tint = particleTint
          this.container.addChild(sprite)
          this.sprites.set(p.id, sprite)
        }
      } else {
        // 上昇パターン: 表示サイズ × 設定された ±% 範囲
        const spawnPos = sampleSpawnPosition(
          () => [Math.random() * canvasWidth, canvasHeight - Math.random() * canvasHeight * 0.7],
          canvasWidth / 2, canvasHeight / 2, peripheralExcludeRadius
        )
        if (spawnPos) {
          const sizeMul = sampleAssetSizeRandomMultiplier(effects.dynamicAsset.sizeRandomPercent ?? 10)
          const scale = clamp(sizeRatio, 0.1, 3.0) * sizeMul
          const rotationRad = sampleAssetRotationRad(effects.dynamicAsset.randomRotationEnabled ?? false)
          const riseSpeedFactor = clamp(effects.dynamicAsset.riseSpeedFactor ?? 1, 0.1, 5)
          const p: AssetParticle = {
            id: `p-${nowMs}-${Math.random()}`,
            assetPath: effects.dynamicAsset.assetPath ?? '',
            x: spawnPos[0],
            y: spawnPos[1],
            alpha: assetBaseAlpha,
            vy: randomRiseSpeed() * riseSpeedFactor,
            startTime: nowMs,
            particleTint,
            rotationRad,
          }
          this.particles.push(p)

          if (useVector) {
            const visual = this.createVectorParticleDisplay(
              effects.dynamicAsset.vectorPresetId!,
              particleTint,
              effects.dynamicAsset.featherStrength ?? 0
            )
            if (visual) {
              visual.x = p.x
              visual.y = p.y
              visual.alpha = p.alpha
              visual.rotation = p.rotationRad
              visual.scale.set(scale)
              this.container.addChild(visual)
              if (visual instanceof PIXI.Sprite) {
                this.sprites.set(p.id, visual)
              } else {
                this.vectorHolders.set(p.id, visual)
              }
            } else {
              this.particles.pop()
            }
          } else {
            const sprite = new PIXI.Sprite(
              this.resolveRasterTexture(
                randomTexture(this.textures),
                effects.dynamicAsset.featherStrength ?? 0,
                rasterInvert,
              ),
            )
            sprite.anchor.set(0.5)
            sprite.x = p.x
            sprite.y = p.y
            sprite.alpha = p.alpha
            sprite.rotation = p.rotationRad
            sprite.scale.set(scale)
            sprite.tint = particleTint
            this.container.addChild(sprite)
            this.sprites.set(p.id, sprite)
          }
        }
      }
    }

    // 更新・削除
    this.particles = this.particles.filter(p => {
      const sprite = this.sprites.get(p.id)
      const holder = this.vectorHolders.get(p.id)
      const visual = sprite ?? holder

      if (p.rippleDurationMs !== undefined) {
        // 波紋パターンの更新
        const elapsed = nowMs - p.startTime
        const t = Math.min(1, elapsed / p.rippleDurationMs)
        // フェードアウト: easeInSine（序盤ゆっくり、終盤急速）
        const fadeEased = 1 - Math.cos((t * Math.PI) / 2)
        const currentAlpha = p.alpha * (1 - fadeEased)

        if (t >= 1) {
          if (visual) {
            this.container.removeChild(visual)
            visual.destroy({ children: true })
          }
          this.sprites.delete(p.id)
          this.vectorHolders.delete(p.id)
          return false
        }

        // 位置を絶対座標で計算（選択イージングを適用した移動パターン）
        const movePattern = effects.dynamicAsset.rippleMovePattern ?? 'easeInSine'
        const speed = Math.sqrt((p.vx ?? 0) ** 2 + p.vy ** 2)
        const unitX = speed > 0 ? (p.vx ?? 0) / speed : 0
        const unitY = speed > 0 ? p.vy / speed : 0
        const easedDist = rippleEase(movePattern, t) * RIPPLE_MAX_DIST
        p.x = (p.rippleStartX ?? 0) + unitX * easedDist
        p.y = (p.rippleStartY ?? 0) + unitY * easedDist

        if (visual) {
          visual.alpha = currentAlpha
          applyAssetAdditionalEffect(
            visual,
            p,
            effects.dynamicAsset.additionalEffect ?? 'none',
            effects.dynamicAsset.additionalEffectSpeedFactor ?? 1,
            elapsed
          )
          if (sprite) sprite.tint = p.particleTint
          else if (holder) holder.tint = p.particleTint
        }
      } else if (p.baseScale !== undefined) {
        // 発生パターンの更新
        const elapsed = nowMs - p.startTime
        const totalDuration = (p.phase1DurationMs ?? EMERGENCE_PHASE1_MS) + (p.phase2DurationMs ?? EMERGENCE_PHASE2_MS)

        if (elapsed >= totalDuration) {
          if (visual) {
            this.container.removeChild(visual)
            visual.destroy({ children: true })
          }
          this.sprites.delete(p.id)
          this.vectorHolders.delete(p.id)
          return false
        }

        if (visual) {
          const ph1 = p.phase1DurationMs ?? EMERGENCE_PHASE1_MS
          if (elapsed < ph1) {
            // フェーズ1: 高速拡大、透過度50%→100%
            const t = elapsed / ph1
            visual.scale.set(p.baseScale * t)
            visual.alpha = p.alpha * (0.5 + t * 0.5)
          } else {
            // フェーズ2: ゆっくり拡大（100%→115%）、透過度100%→0%
            const t = (elapsed - ph1) / (p.phase2DurationMs ?? EMERGENCE_PHASE2_MS)
            visual.scale.set(p.baseScale * (1.0 + t * 0.15))
            visual.alpha = p.alpha * (1.0 - t)
          }
          applyAssetAdditionalEffect(
            visual,
            p,
            effects.dynamicAsset.additionalEffect ?? 'none',
            effects.dynamicAsset.additionalEffectSpeedFactor ?? 1,
            elapsed
          )
          if (sprite) sprite.tint = p.particleTint
          else if (holder) holder.tint = p.particleTint
        }
      } else {
        // 上昇パターンの更新
        p.y -= p.vy * delta
        p.alpha -= 0.004 * delta

        if (visual) {
          visual.alpha = Math.max(0, p.alpha)
          applyAssetAdditionalEffect(
            visual,
            p,
            effects.dynamicAsset.additionalEffect ?? 'none',
            effects.dynamicAsset.additionalEffectSpeedFactor ?? 1,
            nowMs - p.startTime
          )
          if (sprite) sprite.tint = p.particleTint
          else if (holder) holder.tint = p.particleTint
        }

        if (p.alpha <= 0 || p.y < -50) {
          if (visual) {
            this.container.removeChild(visual)
            visual.destroy({ children: true })
          }
          this.sprites.delete(p.id)
          this.vectorHolders.delete(p.id)
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
    this.vectorHolders.forEach(holder => {
      this.container.removeChild(holder)
      holder.destroy({ children: true })
    })
    this.vectorHolders.clear()
    this.particles = []
  }

  destroy() {
    this.clear()
    this.featherTextureCache.forEach(texture => texture.destroy(true))
    this.featherTextureCache.clear()
  }

  private createVectorParticleDisplay(
    presetId: string,
    particleTint: number,
    featherStrength: number
  ): PIXI.Container | PIXI.Sprite | null {
    if (featherStrength <= 0) {
      return createVectorDynamicAssetDisplay(presetId, particleTint)
    }

    const texture = this.resolveVectorTexture(presetId, featherStrength)
    if (!texture) return null
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.tint = particleTint
    return sprite
  }

  private resolveRasterTexture(texture: PIXI.Texture, featherStrength: number, invertRgb: boolean): PIXI.Texture {
    const radius = featherStrengthToRadius(featherStrength)
    const base =
      radius <= 0 ? texture : this.getOrCreateFeatherTexture(`raster:${texture.uid}:feather:${radius}`, texture, radius)
    if (!invertRgb) return base
    return this.getOrCreateInvertTexture(`invert:${base.uid}`, base)
  }

  private getOrCreateInvertTexture(key: string, texture: PIXI.Texture): PIXI.Texture {
    const cached = this.featherTextureCache.get(key)
    if (cached) return cached

    const canvas = this.renderer.extract.canvas(texture) as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const t = PIXI.Texture.from(canvas)
      this.featherTextureCache.set(key, t)
      return t
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
    ctx.putImageData(imageData, 0, 0)
    const out = PIXI.Texture.from(canvas)
    this.featherTextureCache.set(key, out)
    return out
  }

  private resolveVectorTexture(presetId: string, featherStrength: number): PIXI.Texture | null {
    const radius = featherStrengthToRadius(featherStrength)
    if (radius <= 0) return null

    const key = `vector:${presetId}:feather:${radius}`
    const cached = this.featherTextureCache.get(key)
    if (cached) return cached

    const holder = createVectorDynamicAssetDisplay(presetId, 0xffffff)
    if (!holder) return null
    const canvas = this.renderer.extract.canvas({
      target: holder,
      clearColor: [0, 0, 0, 0],
      antialias: true,
    }) as HTMLCanvasElement
    holder.destroy({ children: true })

    const feathered = createInnerFeatherCanvas(canvas, radius)
    const texture = PIXI.Texture.from(feathered)
    this.featherTextureCache.set(key, texture)
    return texture
  }

  private getOrCreateFeatherTexture(key: string, texture: PIXI.Texture, radius: number): PIXI.Texture {
    const cached = this.featherTextureCache.get(key)
    if (cached) return cached

    const canvas = this.renderer.extract.canvas(texture) as HTMLCanvasElement
    const feathered = createInnerFeatherCanvas(canvas, radius)
    const featherTexture = PIXI.Texture.from(feathered)
    this.featherTextureCache.set(key, featherTexture)
    return featherTexture
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
  private timerProgress = 1

  constructor(container: PIXI.Container) {
    this.container = container
    this.mask = new PIXI.Graphics()
    this.container.addChild(this.mask)
    this.container.mask = this.mask
  }

  setTimerProgress(progress: number) {
    this.timerProgress = progress
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
    const rawAlpha = clamp(effects.alpha ?? 1, 0, 1)
    const alpha = effects.alphaTimerSync ? rawAlpha * this.timerProgress : rawAlpha
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

export function tintFromAssetColorOverlay(
  color: { r: number; g: number; b: number },
  alpha: number
): number {
  const a = Math.max(0, Math.min(1, alpha))
  const r = Math.round(255 + (color.r - 255) * a)
  const g = Math.round(255 + (color.g - 255) * a)
  const b = Math.round(255 + (color.b - 255) * a)
  return (r << 16) | (g << 8) | b
}

/** パーティクル生成時のティント（アセット色ランダム時はその場で透明度をサンプル） */
function sampleParticleTint(effects: CellEffects): number {
  const da = effects.dynamicAsset
  if (!da.colorOverlayEnabled) return 0xffffff
  if (da.colorOverlayAlphaRandomEnabled) {
    const rawLo = da.colorOverlayAlphaRandomMin ?? 0.4
    const rawHi = da.colorOverlayAlphaRandomMax ?? 1
    const lo = Math.max(0, Math.min(1, Math.min(rawLo, rawHi)))
    const hi = Math.max(0, Math.min(1, Math.max(rawLo, rawHi)))
    const alpha = lo + Math.random() * Math.max(0, hi - lo)
    return tintFromAssetColorOverlay(da.colorOverlayColor, alpha)
  }
  if (da.colorOverlayAlpha <= 0) return 0xffffff
  return tintFromAssetColorOverlay(da.colorOverlayColor, da.colorOverlayAlpha)
}

function sampleAssetRotationRad(enabled: boolean): number {
  if (!enabled) return 0
  return (Math.random() * 2 - 1) * (Math.PI / 4)
}

function featherStrengthToRadius(strength: number): number {
  return Math.round(clamp(strength, 0, 100) * 0.4)
}

function createInnerFeatherCanvas(source: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  if (radius <= 0) return source

  const padding = radius + 1
  const canvas = document.createElement('canvas')
  canvas.width = source.width + padding * 2
  canvas.height = source.height + padding * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return source

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, padding, padding)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = image
  const pixelCount = width * height
  const inf = 1_000_000
  const dist = new Float32Array(pixelCount)

  for (let i = 0; i < pixelCount; i += 1) {
    dist[i] = data[i * 4 + 3] > 8 ? inf : 0
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      let d = dist[i]
      if (x > 0) d = Math.min(d, dist[i - 1] + 1)
      if (y > 0) {
        d = Math.min(d, dist[i - width] + 1)
        if (x > 0) d = Math.min(d, dist[i - width - 1] + Math.SQRT2)
        if (x < width - 1) d = Math.min(d, dist[i - width + 1] + Math.SQRT2)
      }
      dist[i] = d
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x
      let d = dist[i]
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 1)
      if (y < height - 1) {
        d = Math.min(d, dist[i + width] + 1)
        if (x > 0) d = Math.min(d, dist[i + width - 1] + Math.SQRT2)
        if (x < width - 1) d = Math.min(d, dist[i + width + 1] + Math.SQRT2)
      }
      dist[i] = d
    }
  }

  for (let i = 0; i < pixelCount; i += 1) {
    const alphaIndex = i * 4 + 3
    if (data[alphaIndex] === 0) continue
    const t = clamp(dist[i] / radius, 0, 1)
    const eased = t * t * (3 - 2 * t)
    data[alphaIndex] = Math.round(data[alphaIndex] * eased)
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

function applyAssetAdditionalEffect(
  visual: PIXI.Container,
  particle: AssetParticle,
  effect: DynamicAssetAdditionalEffect,
  speedFactor: number,
  elapsedMs: number
) {
  const effectiveSpeedFactor = clamp(speedFactor, 0.1, 5) * (effect === 'wiggle' ? 0.5 : 1)
  const cycle = ((elapsedMs * effectiveSpeedFactor) % 1200) / 1200
  visual.x = particle.x
  visual.y = particle.y
  visual.rotation = particle.rotationRad

  if (effect === 'jiggle') {
    visual.rotation += Math.sin(easeInOutSine(cycle) * Math.PI * 6) * (Math.PI / 18)
  } else if (effect === 'bounce') {
    visual.y += oscillateEased(cycle, easeInOutSine) * 8
  } else if (effect === 'wiggle') {
    const wave = Math.sin(cycle * Math.PI * 2)
    const rotationOffset = wave * (Math.PI / 9)
    visual.rotation += rotationOffset
    visual.x += oscillateEased(cycle, easeInOutSine) * 20
  }
}

function oscillateEased(cycle: number, ease: (x: number) => number): number {
  const t = cycle < 0.5 ? ease(cycle * 2) : 1 - ease((cycle - 0.5) * 2)
  return -1 + t * 2
}

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2
}

function sampleAssetSizeRandomMultiplier(sizeRandomPercent: number): number {
  const spread = clamp(sizeRandomPercent ?? 0, 0, 200) / 100
  if (spread <= 0) return 1
  const factor = 1 + (Math.random() * 2 - 1) * spread
  return Math.max(0.05, factor)
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

/**
 * 周辺のみモード用: 除外円の外側に収まる spawn 座標をサンプリングする。
 * excludeRadius === 0 のときは無条件で genFn の結果を返す。
 * 最大 10 回試行して見つからなければ null（そのインターバルはスキップ）。
 */
function sampleSpawnPosition(
  genFn: () => [number, number],
  cx: number,
  cy: number,
  excludeRadius: number
): [number, number] | null {
  if (excludeRadius <= 0) return genFn()
  const r2 = excludeRadius * excludeRadius
  for (let i = 0; i < 10; i++) {
    const pos = genFn()
    const dx = pos[0] - cx
    const dy = pos[1] - cy
    if (dx * dx + dy * dy >= r2) return pos
  }
  return null
}
