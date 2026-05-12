import * as PIXI from 'pixi.js'
import { DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART } from '../../shared/types'

export function isBuiltinVectorDynamicAssetPreset(id: string | null | undefined): boolean {
  return id === DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART
}

const PARTICLE_HEART_UNIT = 96

/** フラッシュ等でラスタ化するときの幾何スケール（形状は同じ、解像度のみ上げる） */
export const BUILTIN_VECTOR_FLASH_RASTER_GEOMETRY_SCALE = 4

/**
 * 動的アセット用。親 `Container` の原点が回転・移動の基点になるよう描画した `Container` を返す。
 * @param geometryScale 1=パーティクル基準。フラッシュ用ラスタ化などでは 4 などで描画して劣化を抑える。
 */
export function createVectorDynamicAssetDisplay(
  presetId: string,
  overlayTint: number,
  geometryScale = 1,
): PIXI.Container | null {
  if (!isBuiltinVectorDynamicAssetPreset(presetId)) return null
  const holder = new PIXI.Container()
  const g = new PIXI.Graphics()
  const size = PARTICLE_HEART_UNIT * geometryScale
  const x = 0
  const y = 0
  drawHeartBezierTopLeft(g, x, y, size, 0xffffff, 0xffccd5, Math.max(1, size * 0.012))
  const bounds = g.getLocalBounds()
  // Keep the holder origin at the visible asset center for rotation effects.
  g.position.set(
    -(bounds.x + bounds.width / 2),
    -(bounds.y + bounds.height / 2),
  )
  holder.addChild(g)
  holder.tint = overlayTint
  return holder
}

function drawHeartBezierTopLeft(
  g: PIXI.Graphics,
  x: number,
  y: number,
  size: number,
  fillColor: number,
  strokeColor: number,
  strokeWidth: number,
): void {
  g.clear()
  const topCurveHeight = size * 0.3
  g.moveTo(x, y + topCurveHeight)
  g.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight)
  g.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 2, x, y + size)
  g.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight)
  g.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight)
  g.closePath()
  g.fill({ color: fillColor, alpha: 1 })
  g.stroke({ color: strokeColor, width: strokeWidth, alpha: 1 })
}
