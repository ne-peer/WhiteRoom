/** Last path segment basename, then extension including dot (lower-case), or "". */
function lowercaseExtension(filename: string): string {
  const normalized = filename.replace(/\\/g, '/')
  const base = normalized.split('/').pop() ?? normalized
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot).toLowerCase()
}

/** Extensions treated as ordinary raster images (folder listing, dialogs). */
export const RASTER_IMAGE_EXTENSIONS: readonly string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
]

/** Clip Studio brush material (SQLite + embedded PNGs). */
export const SUT_EXTENSION = '.sut'

/** Preset folder scan in electron.vite may use a subset (no bmp/avif). */
export const PRESET_RASTER_EXTENSIONS: readonly string[] = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
]

export function isRasterImageFilename(filename: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.includes(lowercaseExtension(filename))
}

export function isSutFilename(filename: string): boolean {
  return lowercaseExtension(filename) === SUT_EXTENSION
}

/** Files shown when listing a folder for images + brush materials. */
export function isRasterSourceListingFilename(filename: string): boolean {
  return isRasterImageFilename(filename) || isSutFilename(filename)
}

/** Preset asset-effect folder: image or .sut counts toward “has content”. */
export function isPresetRasterListingFilename(filename: string): boolean {
  const ext = lowercaseExtension(filename)
  return PRESET_RASTER_EXTENSIONS.includes(ext) || ext === SUT_EXTENSION
}

/** ツールチップ用: ラスタ拡張子を「 / 」区切り、末尾にのみ `.sut` を「 / .sut」で付与 */
export function formatRasterSourceListingExtensionsForTooltip(): string {
  const sorted = [...RASTER_IMAGE_EXTENSIONS].sort()
  return `${sorted.join(' / ')} / .sut`
}
