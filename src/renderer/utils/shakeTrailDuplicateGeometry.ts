import type { ShakeTrailArea } from '../../shared/types'

function clampTrailEllipseSize(s: number): number {
  return s < 0.05 ? 0.05 : s > 3 ? 3 : s
}

function clampTrailEllipseHeight(h: number): number {
  return h < 0.05 ? 0.05 : h > 3 ? 3 : h
}

function clampSecondStageOffset(v: number): number {
  return v < -0.5 ? -0.5 : v > 0.5 ? 0.5 : v
}

function clampSecondStageSizeRatio(r: number): number {
  return r < 0.1 ? 0.1 : r > 1 ? 1 : r
}

/**
 * 2段階追従円が親（1段目）楕円内に収まるときの、正規化座標での最大移動量。
 */
export function trailSecondStageMaxOffsetNorm(
  cellWidth: number,
  cellHeight: number,
  area: ShakeTrailArea,
  secondStageSizeRatio: number,
): { x: number; y: number } {
  if (cellWidth <= 0 || cellHeight <= 0) return { x: 0, y: 0 }
  const baseSize = Math.min(cellWidth, cellHeight)
  const size1 = clampTrailEllipseSize(area.size)
  const size2 = size1 * clampSecondStageSizeRatio(secondStageSizeRatio)
  const h = clampTrailEllipseHeight(area.height)
  const rx1 = baseSize * size1 * 0.5
  const ry1 = baseSize * size1 * h * 0.5
  const rx2 = baseSize * size2 * 0.5
  const ry2 = baseSize * size2 * h * 0.5
  return {
    x: Math.max(0, rx1 - rx2) / cellWidth,
    y: Math.max(0, ry1 - ry2) / cellHeight,
  }
}

/**
 * 2段階追従の位置調整オフセット（正規化座標、セル幅/高さに対する比）。
 */
export function trailSecondStageCenterOffsetNorm(
  cellWidth: number,
  cellHeight: number,
  area: ShakeTrailArea,
  secondStageSizeRatio: number,
  offsetX: number,
  offsetY: number,
  horizontalMirror: boolean,
  side: 'single' | 'left' | 'right',
): { x: number; y: number } {
  const max = trailSecondStageMaxOffsetNorm(cellWidth, cellHeight, area, secondStageSizeRatio)
  const ox = clampSecondStageOffset(offsetX)
  const oy = clampSecondStageOffset(offsetY)
  const shiftX = ox * 2 * max.x
  const shiftY = oy * 2 * max.y
  if (side === 'right' && horizontalMirror) {
    return { x: -shiftX, y: shiftY }
  }
  return { x: shiftX, y: shiftY }
}

/**
 * 追従遅延「円のエリアを複製」用：共通中心から各円の中心までの X 方向オフセット（正規化座標、セル幅に対する比）
 *
 * @param spacingShift 基準距離 rx に対する -0.5〜+0.5（±50%）。半分離 = rx × (1 + spacingShift)
 */
export function trailDuplicateHalfSeparationNormX(
  cellWidth: number,
  cellHeight: number,
  trailEllipseSize: number,
  spacingShift: number,
): number {
  if (cellWidth <= 0 || cellHeight <= 0) return 0
  const baseSize = Math.min(cellWidth, cellHeight)
  const s = clampTrailEllipseSize(trailEllipseSize)
  const rx = Math.max(1, baseSize * s * 0.5)
  const shift = spacingShift < -0.5 ? -0.5 : spacingShift > 0.5 ? 0.5 : spacingShift
  const halfSep = rx * (1 + shift)
  return halfSep / cellWidth
}

/**
 * 左右の複製円を、効果中心を挟んで上下交互にずらす（正規化座標での Y 加算量）。
 * 左円: baseY + left、右円: baseY + right。縦半径 ry を基準に shift∈[-0.5,0.5] で |Δy|=ry×|shift|。
 */
export function trailDuplicateVerticalStaggerOffsetsNormY(
  cellWidth: number,
  cellHeight: number,
  trailEllipseSize: number,
  trailEllipseHeight: number,
  verticalSpacingShift: number,
): { left: number; right: number } {
  if (cellWidth <= 0 || cellHeight <= 0) return { left: 0, right: 0 }
  const baseSize = Math.min(cellWidth, cellHeight)
  const s = clampTrailEllipseSize(trailEllipseSize)
  const h = clampTrailEllipseHeight(trailEllipseHeight)
  const ry = Math.max(1, baseSize * s * h * 0.5)
  const shift = verticalSpacingShift < -0.5 ? -0.5 : verticalSpacingShift > 0.5 ? 0.5 : verticalSpacingShift
  const delta = (ry * shift) / cellHeight
  return { left: -delta, right: delta }
}
