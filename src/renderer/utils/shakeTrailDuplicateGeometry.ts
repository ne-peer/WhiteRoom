function clampTrailEllipseSize(s: number): number {
  return s < 0.05 ? 0.05 : s > 3 ? 3 : s
}

function clampTrailEllipseHeight(h: number): number {
  return h < 0.05 ? 0.05 : h > 3 ? 3 : h
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
