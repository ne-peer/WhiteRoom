import type { GridLayout } from '../../shared/types'

export type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

const MIN_COLUMN_RATIO = 0.03

export function normalizeColumnWidths(grid: GridLayout): number[] {
  const cols = Math.max(1, grid.cols)
  const source = grid.columnWidths
  if (!source || source.length !== cols) return buildEqualColumnWidths(cols)

  const sanitized = source.map(value => Number.isFinite(value) && value > 0 ? value : 0)
  const sum = sanitized.reduce((acc, value) => acc + value, 0)
  if (sum <= 0) return buildEqualColumnWidths(cols)

  return sanitized.map(value => value / sum)
}

export function buildEqualColumnWidths(cols: number): number[] {
  const count = Math.max(1, cols)
  return Array.from({ length: count }, () => 1 / count)
}

export function resizeColumnPair(
  grid: GridLayout,
  boundaryIndex: number,
  deltaPx: number,
  totalWidthPx: number
): number[] {
  const widths = normalizeColumnWidths(grid)
  if (totalWidthPx <= 0 || boundaryIndex < 0 || boundaryIndex >= widths.length - 1) return widths

  const pairTotal = widths[boundaryIndex] + widths[boundaryIndex + 1]
  const minRatio = Math.min(MIN_COLUMN_RATIO, pairTotal / 2)
  const deltaRatio = deltaPx / totalWidthPx
  const left = clamp(widths[boundaryIndex] + deltaRatio, minRatio, pairTotal - minRatio)

  widths[boundaryIndex] = left
  widths[boundaryIndex + 1] = pairTotal - left
  return widths
}

export function getColumnEdges(totalWidth: number, grid: GridLayout): number[] {
  const widths = normalizeColumnWidths(grid)
  const edges = [0]
  let acc = 0
  for (const width of widths) {
    acc += width * totalWidth
    edges.push(acc)
  }
  edges[edges.length - 1] = totalWidth
  return edges
}

export function getColumnRect(
  rect: RectLike,
  column: number,
  grid: GridLayout
): { left: number; top: number; width: number; height: number } {
  const edges = getColumnEdges(rect.width, grid)
  const left = Math.round(edges[column] ?? 0)
  const nextLeft = Math.round(edges[column + 1] ?? rect.width)
  return {
    left,
    top: 0,
    width: nextLeft - left,
    height: rect.height,
  }
}

export function getCellRect(
  rect: RectLike,
  col: number,
  row: number,
  grid: GridLayout
): { left: number; top: number; width: number; height: number } {
  const column = getColumnRect(rect, col, grid)
  const top = Math.round((row * rect.height) / grid.rows)
  const nextTop = Math.round(((row + 1) * rect.height) / grid.rows)
  return {
    left: column.left,
    top,
    width: column.width,
    height: nextTop - top,
  }
}

export function findColumnAtX(relX: number, totalWidth: number, grid: GridLayout): number {
  const edges = getColumnEdges(totalWidth, grid)
  const clampedX = clamp(relX, 0, totalWidth)
  for (let i = 0; i < grid.cols - 1; i += 1) {
    if (clampedX < edges[i + 1]) return i
  }
  return Math.max(0, grid.cols - 1)
}

export function toGridTemplateColumns(grid: GridLayout): string {
  return normalizeColumnWidths(grid).map(width => `${width}fr`).join(' ')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
