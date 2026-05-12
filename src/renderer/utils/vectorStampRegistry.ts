import * as PIXI from 'pixi.js'
import { DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART } from '../../shared/types'

export function isBuiltinVectorDynamicAssetPreset(id: string | null | undefined): boolean {
  return id === DYNAMIC_ASSET_VECTOR_PRESET_BUILTIN_HEART
}

/** セル座標系でハートを描画（列プレビュー用。中心付近の従来ジオメトリ） */
export function drawBuiltinHeartAtCell(
  g: PIXI.Graphics,
  cellWidth: number,
  cellHeight: number,
  fillColor: number,
  strokeColor: number,
  strokeWidth: number,
): void {
  const minDim = Math.min(cellWidth, cellHeight)
  const size = minDim * 0.36
  const cx = cellWidth * 0.5
  const topY = cellHeight * 0.38 - size * 0.35
  drawHeartBezierTopLeft(g, cx, topY, size, fillColor, strokeColor, strokeWidth)
}

const PARTICLE_HEART_UNIT = 48

/**
 * 動的アセット用。子 `Graphics` の pivot を形状中心に合わせた `Container` を返す。
 */
export function createVectorDynamicAssetDisplay(
  presetId: string,
  overlayTint: number,
): PIXI.Container | null {
  if (!isBuiltinVectorDynamicAssetPreset(presetId)) return null
  const holder = new PIXI.Container()
  const g = new PIXI.Graphics()
  const size = PARTICLE_HEART_UNIT
  const x = 0
  const y = -size * 0.35
  drawHeartBezierTopLeft(g, x, y, size, 0xffffff, 0xffccd5, Math.max(1, size * 0.012))
  const b = g.getLocalBounds()
  g.pivot.set(b.x + b.width / 2, b.y + b.height / 2)
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
