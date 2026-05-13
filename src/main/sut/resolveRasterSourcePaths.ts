import { existsSync } from 'fs'
import { isAbsolute, normalize, resolve } from 'path'
import type { ResolveRasterSourceEntry, ResolveRasterSourcePathsResult } from '../../shared/types'
import { isRasterImageFilename, isSutFilename } from '../../shared/rasterSourceExtensions'
import { fileStatFingerprint, logSutResolveFailure, resolveSutToPngCachePaths } from './sutPngCache'

function toAbsolutePath(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = normalize(trimmed.replace(/\//g, '\\'))
  if (isAbsolute(n)) return n
  try {
    return resolve(n)
  } catch {
    return null
  }
}

/**
 * For each input path: if `.sut`, expand to cached PNG paths; if a known raster image, pass through as one path.
 * Order is preserved; each `.sut` expands to multiple consecutive `loadablePaths` in that entry.
 */
export async function resolveRasterSourcePaths(
  paths: string[],
  userDataRoot: string,
): Promise<ResolveRasterSourcePathsResult> {
  const entries: ResolveRasterSourceEntry[] = []
  for (const raw of paths) {
    const abs = toAbsolutePath(raw)
    if (!abs) {
      return { kind: 'error', message: 'Invalid path' }
    }
    if (!existsSync(abs)) {
      entries.push({
        loadablePaths: [],
        sourceFingerprint: 'missing:0',
      })
      continue
    }

    const fp = fileStatFingerprint(abs)

    if (isSutFilename(abs)) {
      try {
        const pngs = await resolveSutToPngCachePaths(abs, userDataRoot)
        if (pngs.length === 0) {
          logSutResolveFailure(abs, 'no PNG tips extracted')
        }
        entries.push({ loadablePaths: pngs, sourceFingerprint: fp })
      } catch (e) {
        logSutResolveFailure(abs, String(e))
        entries.push({ loadablePaths: [], sourceFingerprint: fp })
      }
      continue
    }

    if (isRasterImageFilename(abs)) {
      entries.push({ loadablePaths: [abs], sourceFingerprint: fp })
      continue
    }

    // Unknown extension: still try direct load (Pixi may support it)
    entries.push({ loadablePaths: [abs], sourceFingerprint: fp })
  }

  return { kind: 'ok', entries }
}
