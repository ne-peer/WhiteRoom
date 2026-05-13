import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { extractPngFromMaterialFileData } from '../../shared/sut/extractPngFromMaterialBlob'
import { readSutMaterialRows } from './readSutMaterialFile'

function cacheDirForSut(absoluteSutPath: string, mtimeMs: number, userDataRoot: string): string {
  const h = createHash('sha256')
    .update(absoluteSutPath)
    .update('\0')
    .update(String(mtimeMs))
    .digest('hex')
    .slice(0, 48)
  return join(userDataRoot, 'sut-cache', h)
}

function listCachedTipPngs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.startsWith('tip-') && f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
    .map(f => join(dir, f))
}

/**
 * Extract all brush-tip PNGs from `.sut` into `userData/sut-cache/<hash>/` and return absolute `.png` paths.
 * Cache key includes source mtime; same file + mtime reuses existing `tip-*.png` files.
 */
export async function resolveSutToPngCachePaths(
  absoluteSutPath: string,
  userDataRoot: string,
): Promise<string[]> {
  const st = statSync(absoluteSutPath)
  const dir = cacheDirForSut(absoluteSutPath, st.mtimeMs, userDataRoot)
  if (existsSync(dir)) {
    const existingTips = listCachedTipPngs(dir)
    if (existingTips.length > 0) return existingTips
  }

  mkdirSync(dir, { recursive: true })
  const materialRows = await readSutMaterialRows(absoluteSutPath)
  const sorted = [...materialRows].sort((a, b) =>
    a.pwId.localeCompare(b.pwId, undefined, { sensitivity: 'base', numeric: true }),
  )

  const written: string[] = []
  for (const row of sorted) {
    const png = extractPngFromMaterialFileData(row.fileData)
    if (!png?.byteLength) continue
    const safeId = row.pwId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'noid'
    const outPath = join(dir, `tip-${safeId}.png`)
    writeFileSync(outPath, png)
    written.push(outPath)
  }

  if (written.length === 0) {
    return []
  }

  return listCachedTipPngs(dir)
}

/** Short fingerprint for renderer cache keys (mtime + size). */
export function fileStatFingerprint(absolutePath: string): string {
  try {
    const st = statSync(absolutePath)
    return `${st.mtimeMs}:${st.size}`
  } catch {
    return 'missing:0'
  }
}

export function logSutResolveFailure(absoluteSutPath: string, reason: string): void {
  console.warn(`[sut] ${reason}: ${basename(absoluteSutPath)}`)
}
