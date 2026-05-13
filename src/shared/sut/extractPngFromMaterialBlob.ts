const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ASCII_PNG = new Uint8Array([0x50, 0x4e, 0x47]) // "PNG"
const ASCII_IEND = new Uint8Array([0x49, 0x45, 0x4e, 0x44]) // "IEND"

/** Last start index of `needle` in `haystack`, or -1 if none (same idea as Python get_last_pos). */
function findLastSubarray(haystack: Uint8Array, needle: Uint8Array): number {
  let last = -1
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    last = i
  }
  return last
}

function hasPngMagicAt(data: Uint8Array, begin: number): boolean {
  if (begin < 0 || begin + PNG_SIG.length > data.length) return false
  for (let i = 0; i < PNG_SIG.length; i++) {
    if (data[begin + i] !== PNG_SIG[i]) return false
  }
  return true
}

/**
 * Extract embedded PNG from Clip Studio `MaterialFile.FileData` blob.
 * Mirrors `lib/wr_cspbrushextract.py`: last "PNG" anchor minus one byte, last "IEND" + 8 bytes.
 */
export function extractPngFromMaterialFileData(fileData: Uint8Array): Uint8Array | null {
  if (!fileData?.length) return null

  const lastPng = findLastSubarray(fileData, ASCII_PNG)
  if (lastPng < 1) return null
  const beginPos = lastPng - 1
  if (!hasPngMagicAt(fileData, beginPos)) return null

  const lastIend = findLastSubarray(fileData, ASCII_IEND)
  if (lastIend < 0) return null
  const endPos = lastIend + 8
  if (endPos <= beginPos || endPos > fileData.length) return null

  return fileData.subarray(beginPos, endPos)
}
