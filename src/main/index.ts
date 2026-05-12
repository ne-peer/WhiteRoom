import { app, BrowserWindow, ipcMain, dialog, session, Menu, shell } from 'electron'
import { dirname, join, extname, isAbsolute, relative } from 'path'
import { tmpdir } from 'os'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { get as httpGet } from 'http'
import { get as httpsGet } from 'https'
import { fileURLToPath } from 'url'
import type {
  AppProfile,
  AssetEffectFoldersResult,
  CellEffects,
  RemoteImageResult,
  RemoteImageStatsResult,
  ImageEffectProfileDocument,
  LoadImageEffectProfileResult,
  SaveImageEffectProfileResult,
  SavedTimerConfig,
  SaveProfileResult,
  LoadProfileResult,
  OpenFolderResult,
  OpenTextFileResult,
  SaveTextFileResult,
  CleanupTextReaderTempFileResult,
  UiLanguage,
} from '../shared/types'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']
const IMAGE_EFFECT_PROFILE_FILE = 'whiteroom_effects.json'
const PORTABLE_ASSET_EFFECT_PREFIX = 'whiteroom://asset-effect/'
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_PIXIV_UNIQUE_IMAGE_URLS_PER_APP = 10
const DEFAULT_MAIN_WINDOW_WIDTH = 1600
const DEFAULT_MAIN_WINDOW_HEIGHT = 1000
const textReaderTempDirs = new Set<string>()
let activeTextReaderTempDir: string | null = null
const remoteImageDataUrlCache = new Map<string, RemoteImageResult>()
const remoteImageInFlight = new Map<string, Promise<RemoteImageResult>>()
const countedPixivImageUrls = new Set<string>()
const FALLBACK_FONTS = [
  'Meiryo',
  'BIZ UDPGothic',
  'Yu Gothic',
  'MS PGothic',
  'Arial',
  'Segoe UI',
  'Times New Roman',
  'Courier New',
]

const DIALOG_TEXT = {
  ja: {
    imageFolderTitle: '画像フォルダを選択',
    imageFileFilter: '画像ファイル',
    assetImageTitle: 'アセット画像を選択（透過PNG推奨）',
    assetFolderTitle: 'アセットフォルダを選択',
    overlayImageTitle: '直前オーバレイ画像を選択',
    saveProfileTitle: 'プロファイルを保存',
    loadProfileTitle: 'プロファイルを読み込む',
    textFileTitle: 'テキストファイルを選択',
    textFileFilter: 'テキストファイル',
  },
  en: {
    imageFolderTitle: 'Select Image Folder',
    imageFileFilter: 'Image Files',
    assetImageTitle: 'Select Asset Image (transparent PNG recommended)',
    assetFolderTitle: 'Select Asset Folder',
    overlayImageTitle: 'Select Pre-timer Overlay Image',
    saveProfileTitle: 'Save Profile',
    loadProfileTitle: 'Load Profile',
    textFileTitle: 'Select Text File',
    textFileFilter: 'Text Files',
  },
} satisfies Record<UiLanguage, Record<string, string>>

function getDialogText(language?: UiLanguage): typeof DIALOG_TEXT.ja {
  return DIALOG_TEXT[language === 'en' ? 'en' : 'ja']
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(filename).toLowerCase())
}

function readImagePaths(folderPath: string): string[] {
  return readdirSync(folderPath)
    .filter(isImageFile)
    .map(f => join(folderPath, f))
    .sort()
}

function toProfileImageKey(folderPath: string, imagePath: string): string | null {
  const rel = relative(folderPath, imagePath)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return rel.replace(/\\/g, '/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeImageEffectProfile(raw: unknown): ImageEffectProfileDocument {
  const entries: ImageEffectProfileDocument['entries'] = {}
  if (isRecord(raw) && isRecord(raw.entries)) {
    for (const [key, value] of Object.entries(raw.entries)) {
      if (!isRecord(value)) continue
      const image = typeof value.image === 'string' ? value.image : key
      const effects = isRecord(value.effects)
        ? mapEffectsAssetReferences(value.effects as Partial<CellEffects>, resolveAssetEffectReference)
        : {}
      const timer = isRecord(value.timer) ? value.timer as Partial<SavedTimerConfig> : undefined
      entries[key] = timer !== undefined ? { image, effects, timer } : { image, effects }
    }
  }
  const rawVersion = isRecord(raw) ? raw.version : undefined

  return {
    version: typeof rawVersion === 'string' ? rawVersion : String(rawVersion ?? app.getVersion()),
    updatedAt: isRecord(raw) && typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    entries,
  }
}

function loadImageEffectProfileFile(folderPath: string): LoadImageEffectProfileResult {
  const filePath = join(folderPath, IMAGE_EFFECT_PROFILE_FILE)
  if (!existsSync(filePath)) return { success: true, exists: false }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return {
      success: true,
      exists: true,
      profile: normalizeImageEffectProfile(JSON.parse(raw) as unknown),
    }
  } catch (e: unknown) {
    return { success: false, exists: true, error: String(e) }
  }
}

function saveImageEffectProfileFile(
  folderPath: string,
  imagePath: string,
  effects: ImageEffectProfileDocument['entries'][string]['effects'],
  timer?: Partial<SavedTimerConfig>
): SaveImageEffectProfileResult {
  const imageKey = toProfileImageKey(folderPath, imagePath)
  if (!imageKey) {
    return { success: false, error: 'Image is not inside the selected folder' }
  }

  const loaded = loadImageEffectProfileFile(folderPath)
  const profile = loaded.success && loaded.profile
    ? loaded.profile
    : { version: app.getVersion(), updatedAt: new Date().toISOString(), entries: {} }

  const portableEffects = mapEffectsAssetReferences(effects, serializeAssetEffectReference)
  const entry: ImageEffectProfileDocument['entries'][string] = timer !== undefined
    ? { image: imageKey, effects: portableEffects, timer }
    : { image: imageKey, effects: portableEffects }

  const updated: ImageEffectProfileDocument = {
    ...profile,
    version: app.getVersion(),
    updatedAt: new Date().toISOString(),
    entries: {
      ...profile.entries,
      [imageKey]: entry,
    },
  }

  const filePath = join(folderPath, IMAGE_EFFECT_PROFILE_FILE)
  try {
    const portableUpdated = serializeImageEffectProfileDocument(updated)
    writeFileSync(filePath, JSON.stringify(portableUpdated, null, 2), 'utf-8')
    return { success: true, profile: normalizeImageEffectProfile(portableUpdated), filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
}

function getAssetEffectBasePath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'asset-effect'),
    join(app.getAppPath(), 'assets', 'asset-effect'),
    join(process.cwd(), 'assets', 'asset-effect'),
  ]
  return candidates.find(candidate =>
    existsSync(candidate) && statSync(candidate).isDirectory()
  ) ?? null
}

function fromFileUrlIfNeeded(src: string): string {
  if (!src.startsWith('file://')) return src
  try {
    return fileURLToPath(src)
  } catch {
    return src
  }
}

function normalizeAssetRelativePath(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length < 2 || parts.some(part => part === '.' || part === '..')) return null
  return parts.join('/')
}

function extractAssetEffectRelativePath(src: string): string | null {
  if (src.startsWith(PORTABLE_ASSET_EFFECT_PREFIX)) {
    return normalizeAssetRelativePath(src.slice(PORTABLE_ASSET_EFFECT_PREFIX.length))
  }

  const localPath = fromFileUrlIfNeeded(src)
  const basePath = getAssetEffectBasePath()
  if (basePath) {
    const rel = relative(basePath, localPath)
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
      return normalizeAssetRelativePath(rel)
    }
  }

  const normalized = localPath.replace(/\\/g, '/')
  const marker = '/asset-effect/'
  const markerIndex = normalized.lastIndexOf(marker)
  if (markerIndex >= 0) {
    return normalizeAssetRelativePath(normalized.slice(markerIndex + marker.length))
  }
  if (normalized.startsWith('asset-effect/')) {
    return normalizeAssetRelativePath(normalized.slice('asset-effect/'.length))
  }
  return null
}

function resolveAssetEffectReference(src: string): string {
  const rel = extractAssetEffectRelativePath(src)
  const basePath = getAssetEffectBasePath()
  if (!rel || !basePath) return src

  const resolved = join(basePath, ...rel.split('/'))
  return existsSync(resolved) ? resolved : src
}

function serializeAssetEffectReference(src: string): string {
  const rel = extractAssetEffectRelativePath(src)
  const basePath = getAssetEffectBasePath()
  if (!rel || !basePath) return src

  const resolved = join(basePath, ...rel.split('/'))
  return existsSync(resolved) ? `${PORTABLE_ASSET_EFFECT_PREFIX}${rel}` : src
}

function mapNullableAssetReference(
  value: string | null | undefined,
  mapper: (src: string) => string
): string | null {
  return value ? mapper(value) : null
}

function mapEffectsAssetReferences(
  effects: Partial<CellEffects>,
  mapper: (src: string) => string
): Partial<CellEffects> {
  if (!effects.dynamicAsset) return effects
  return {
    ...effects,
    dynamicAsset: {
      ...effects.dynamicAsset,
      assetPath: mapNullableAssetReference(effects.dynamicAsset.assetPath, mapper),
      assetPaths: effects.dynamicAsset.assetPaths?.map(mapper) ?? [],
      assetFolderPath: mapNullableAssetReference(effects.dynamicAsset.assetFolderPath, mapper),
    },
  }
}

function serializeAppProfile(profile: AppProfile): AppProfile {
  return {
    ...profile,
    cells: profile.cells.map(cell => ({
      ...cell,
      effects: mapEffectsAssetReferences(cell.effects, serializeAssetEffectReference) as CellEffects,
    })),
    stashes: profile.stashes?.map(stash => ({
      ...stash,
      cells: stash.cells.map(cell => ({
        ...cell,
        effects: mapEffectsAssetReferences(cell.effects, serializeAssetEffectReference) as CellEffects,
      })),
    })),
  }
}

function resolveAppProfile(profile: AppProfile): AppProfile {
  return {
    ...profile,
    cells: profile.cells.map(cell => ({
      ...cell,
      effects: mapEffectsAssetReferences(cell.effects, resolveAssetEffectReference) as CellEffects,
    })),
    stashes: profile.stashes?.map(stash => ({
      ...stash,
      cells: stash.cells.map(cell => ({
        ...cell,
        effects: mapEffectsAssetReferences(cell.effects, resolveAssetEffectReference) as CellEffects,
      })),
    })),
  }
}

function serializeImageEffectProfileDocument(profile: ImageEffectProfileDocument): ImageEffectProfileDocument {
  const entries: ImageEffectProfileDocument['entries'] = {}
  for (const [key, entry] of Object.entries(profile.entries)) {
    entries[key] = {
      ...entry,
      effects: mapEffectsAssetReferences(entry.effects, serializeAssetEffectReference),
    }
  }
  return { ...profile, entries }
}

function normalizeFontName(name: string): string[] {
  const withoutType = name.replace(/\s*\([^)]+\)\s*$/u, '').trim()
  if (!withoutType) return []
  return withoutType
    .split(/\s*&\s*/u)
    .map(part => part.trim())
    .filter(Boolean)
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function cleanupTextReaderTempDir(dirPath: string | null): void {
  if (!dirPath) return
  try {
    rmSync(dirPath, { recursive: true, force: true })
  } catch {
    // ignore cleanup failures
  }
  textReaderTempDirs.delete(dirPath)
  if (activeTextReaderTempDir === dirPath) activeTextReaderTempDir = null
}

function cleanupAllTextReaderTempDirs(): void {
  for (const dirPath of [...textReaderTempDirs]) {
    cleanupTextReaderTempDir(dirPath)
  }
}

function createTextReaderTempFile(originalPath: string): string {
  cleanupTextReaderTempDir(activeTextReaderTempDir)
  const dirPath = mkdtempSync(join(tmpdir(), 'whiteroom-text-'))
  const ext = extname(originalPath) || '.txt'
  const tempFilePath = join(dirPath, `storyboard${ext}`)
  copyFileSync(originalPath, tempFilePath)
  textReaderTempDirs.add(dirPath)
  activeTextReaderTempDir = dirPath
  return tempFilePath
}

function getRemoteImageReferer(url: URL): string {
  if (url.hostname.endsWith('pximg.net')) return 'https://www.pixiv.net/'
  return `${url.protocol}//${url.hostname}/`
}

function isPixivHost(url: URL): boolean {
  return url.hostname === 'pixiv.net' ||
    url.hostname.endsWith('.pixiv.net') ||
    url.hostname === 'pximg.net' ||
    url.hostname.endsWith('.pximg.net')
}

function registerPixivImageUrl(url: URL): RemoteImageResult | null {
  if (!isPixivHost(url)) return null
  const key = url.toString()
  if (countedPixivImageUrls.has(key)) return null
  if (countedPixivImageUrls.size >= MAX_PIXIV_UNIQUE_IMAGE_URLS_PER_APP) {
    return {
      success: false,
      limitExceeded: true,
      error: `Pixiv image limit reached for this app session (${MAX_PIXIV_UNIQUE_IMAGE_URLS_PER_APP})`,
    }
  }
  countedPixivImageUrls.add(key)
  return null
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extractMetaImageUrl(html: string): string | null {
  const patterns = [
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
    /<meta\s+[^>]*property=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']twitter:image["'][^>]*>/i,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match?.[1]) return decodeHtmlAttribute(match[1])
  }
  return null
}

type PixivIllustPage = {
  urls?: {
    original?: string
    regular?: string
  }
}

type PixivIllustBody = {
  urls?: {
    original?: string
    regular?: string
  }
}

type PixivIllustResponse = {
  error?: boolean
  body?: PixivIllustBody
}

type PixivIllustPagesResponse = {
  error?: boolean
  body?: PixivIllustPage[]
}

function getPixivArtworkId(url: URL): string | null {
  const artworkMatch = /^\/(?:en\/)?artworks\/(\d+)/.exec(url.pathname)
  if (artworkMatch?.[1]) return artworkMatch[1]
  const legacyId = url.searchParams.get('illust_id')
  return legacyId && /^\d+$/.test(legacyId) ? legacyId : null
}

function getPixivArtworkPageIndex(url: URL): number {
  const pageMatch = /[_?&]p(?:age)?=(\d+)/.exec(`${url.pathname}${url.search}${url.hash}`)
  if (!pageMatch?.[1]) return 0
  const page = Number.parseInt(pageMatch[1], 10)
  return Number.isFinite(page) && page >= 0 ? page : 0
}

function getPximgOriginalCandidates(url: URL): string[] {
  if (!url.hostname.endsWith('pximg.net')) return []
  const normalizedPath = url.pathname.replace(/^\/c\/[^/]+\/(?=img-master\/img\/)/, '/')
  if (!normalizedPath.includes('/img-master/img/')) return []

  const originalBasePath = normalizedPath
    .replace('/img-master/img/', '/img-original/img/')
    .replace(/_(?:master|square|custom)\d+(?:_\d+)?(?=\.[^.\/]+$)/, '')

  const originalBaseUrl = new URL(url.toString())
  originalBaseUrl.pathname = originalBasePath
  originalBaseUrl.search = ''
  originalBaseUrl.hash = ''

  const extMatch = /\.([^.\/]+)$/.exec(originalBasePath)
  const currentExt = extMatch?.[1]?.toLowerCase()
  const extensions = [currentExt, 'png', 'jpg', 'jpeg', 'webp']
    .filter((ext): ext is string => Boolean(ext))
    .filter((ext, index, list) => list.indexOf(ext) === index)

  return extensions.map(ext => {
    const candidate = new URL(originalBaseUrl.toString())
    candidate.pathname = originalBasePath.replace(/\.[^.\/]+$/, `.${ext}`)
    return candidate.toString()
  })
}

function fetchText(url: URL, accept: string): Promise<{ statusCode?: number; contentType?: string; text?: string; error?: string }> {
  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? httpsGet : httpGet
    const request = client(url, {
      headers: {
        Accept: accept,
        Referer: getRemoteImageReferer(url),
        'User-Agent': 'Mozilla/5.0 WhiteRoom/1.0',
      },
    }, (response) => {
      const contentTypeHeader = response.headers['content-type']
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        resolve({ statusCode: response.statusCode, contentType, error: `HTTP ${response.statusCode ?? 'error'}` })
        return
      }
      const chunks: Buffer[] = []
      let total = 0
      response.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > 1024 * 1024) {
          request.destroy(new Error('Response is too large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, contentType, text: Buffer.concat(chunks).toString('utf-8') })
      })
    })
    request.on('error', error => {
      resolve({ error: error.message })
    })
    request.setTimeout(15000, () => {
      request.destroy(new Error('Remote request timed out'))
    })
  })
}

async function fetchPixivOriginalCandidates(url: URL): Promise<string[]> {
  const artworkId = getPixivArtworkId(url)
  if (!artworkId) return []
  const pageIndex = getPixivArtworkPageIndex(url)
  const candidates: string[] = []

  const pagesUrl = new URL(`https://www.pixiv.net/ajax/illust/${artworkId}/pages`)
  const pagesResponse = await fetchText(pagesUrl, 'application/json,text/plain,*/*')
  if (pagesResponse.text) {
    try {
      const parsed = JSON.parse(pagesResponse.text) as PixivIllustPagesResponse
      const original = parsed.error === false ? parsed.body?.[pageIndex]?.urls?.original : undefined
      const regular = parsed.error === false ? parsed.body?.[pageIndex]?.urls?.regular : undefined
      if (original) candidates.push(original)
      if (regular) candidates.push(...getPximgOriginalCandidates(new URL(regular)), regular)
    } catch {
      // Fall back to the single-illust endpoint below.
    }
  }

  const illustUrl = new URL(`https://www.pixiv.net/ajax/illust/${artworkId}`)
  const illustResponse = await fetchText(illustUrl, 'application/json,text/plain,*/*')
  if (illustResponse.text) {
    try {
      const parsed = JSON.parse(illustResponse.text) as PixivIllustResponse
      const original = parsed.error === false ? parsed.body?.urls?.original : undefined
      const regular = parsed.error === false ? parsed.body?.urls?.regular : undefined
      if (original) candidates.push(original)
      if (regular) candidates.push(...getPximgOriginalCandidates(new URL(regular)), regular)
    } catch {
      // The normal HTML/OG image path remains as a final fallback.
    }
  }

  return candidates.filter((candidate, index, list) => list.indexOf(candidate) === index)
}

async function tryPixivOriginalImage(rawUrl: string, url: URL, redirectCount: number): Promise<RemoteImageResult | null> {
  const candidates = [
    ...getPximgOriginalCandidates(url),
    ...(url.hostname.endsWith('pixiv.net') ? await fetchPixivOriginalCandidates(url) : []),
  ].filter(candidate => candidate !== rawUrl)

  for (const candidate of candidates) {
    const result = await downloadRemoteImageAsDataUrl(candidate, false, redirectCount + 1)
    if (result.success) return result
  }
  return null
}

function downloadRemoteImageAsDataUrl(rawUrl: string, countPixivUrl: boolean, redirectCount = 0): Promise<RemoteImageResult> {
  return new Promise((resolve) => {
    if (redirectCount > 5) {
      resolve({ success: false, error: 'Too many redirects' })
      return
    }

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      resolve({ success: false, error: 'Invalid URL' })
      return
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      resolve({ success: false, error: 'Unsupported URL protocol' })
      return
    }

    const cached = remoteImageDataUrlCache.get(url.toString())
    if (cached) {
      resolve(cached)
      return
    }

    const limited = countPixivUrl ? registerPixivImageUrl(url) : null
    if (limited) {
      resolve(limited)
      return
    }

    if (isPixivHost(url)) {
      tryPixivOriginalImage(rawUrl, url, redirectCount).then(originalResult => {
        if (originalResult) {
          resolve(originalResult)
          return
        }
        requestRemoteImage(url, redirectCount, resolve)
      })
      return
    }

    requestRemoteImage(url, redirectCount, resolve)
  })
}

function requestRemoteImage(
  url: URL,
  redirectCount: number,
  resolve: (value: RemoteImageResult) => void
) {
    const client = url.protocol === 'https:' ? httpsGet : httpGet
    const request = client(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        Referer: getRemoteImageReferer(url),
        'User-Agent': 'Mozilla/5.0 WhiteRoom/1.0',
      },
    }, (response) => {
      const location = response.headers.location
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
        response.resume()
        if (redirectCount >= 5) {
          resolve({ success: false, error: 'Too many redirects' })
          return
        }
        const nextUrl = new URL(location, url).toString()
        downloadRemoteImageAsDataUrl(nextUrl, true, redirectCount + 1).then(resolve)
        return
      }

      const contentTypeHeader = response.headers['content-type']
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume()
        resolve({ success: false, contentType, error: `HTTP ${response.statusCode ?? 'error'}` })
        return
      }
      if (!contentType?.toLowerCase().startsWith('image/')) {
        if (contentType?.toLowerCase().includes('text/html')) {
          const chunks: Buffer[] = []
          let total = 0
          response.on('data', (chunk: Buffer) => {
            total += chunk.length
            if (total > 1024 * 1024) {
              request.destroy(new Error('HTML page is too large'))
              return
            }
            chunks.push(chunk)
          })
          response.on('end', () => {
            const metaImageUrl = extractMetaImageUrl(Buffer.concat(chunks).toString('utf-8'))
            if (!metaImageUrl) {
              resolve({ success: false, contentType, error: 'URL did not return an image' })
              return
            }
            downloadRemoteImageAsDataUrl(metaImageUrl, false, redirectCount + 1).then(result => {
              if (result.success) remoteImageDataUrlCache.set(metaImageUrl, result)
              resolve(result)
            })
          })
          return
        }
        response.resume()
        resolve({ success: false, contentType, error: 'URL did not return an image' })
        return
      }

      const chunks: Buffer[] = []
      let total = 0
      response.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_REMOTE_IMAGE_BYTES) {
          request.destroy(new Error('Image is too large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        const data = Buffer.concat(chunks).toString('base64')
        resolve({ success: true, contentType, dataUrl: `data:${contentType};base64,${data}` })
      })
    })

    request.on('error', (error) => {
      resolve({ success: false, error: error.message })
    })
    request.setTimeout(15000, () => {
      request.destroy(new Error('Remote image request timed out'))
    })
}

function cleanupTextReaderTempFilePath(tempFilePath: string): CleanupTextReaderTempFileResult {
  const dirPath = dirname(tempFilePath)
  if (!textReaderTempDirs.has(dirPath)) {
    return { success: false, error: 'Unknown text reader temp file' }
  }
  cleanupTextReaderTempDir(dirPath)
  return { success: true }
}

function listWindowsFonts(): string[] {
  const command = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '$OutputEncoding = [System.Text.Encoding]::UTF8',
    "$paths = @('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', 'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts')",
    'foreach ($path in $paths) {',
    '  if (Test-Path $path) {',
    '    (Get-ItemProperty -Path $path).PSObject.Properties |',
    "      Where-Object { $_.Name -notlike 'PS*' } |",
    '      ForEach-Object { $_.Name }',
    '  }',
    '}',
  ].join('\n')

  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
  )

  return output
    .split(/\r?\n/u)
    .flatMap(line => normalizeFontName(line))
}

function listUnixFonts(): string[] {
  const output = execFileSync('fc-list', [':', 'family'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  return output
    .split(/\r?\n/u)
    .flatMap(line => line.split(','))
    .map(name => name.trim())
    .filter(Boolean)
}

function listSystemFonts(): string[] {
  try {
    const fonts = process.platform === 'win32' ? listWindowsFonts() : listUnixFonts()
    return sortedUnique([...FALLBACK_FONTS, ...fonts])
  } catch (error) {
    console.warn('Failed to list system fonts:', error)
    return sortedUnique(FALLBACK_FONTS)
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DEFAULT_MAIN_WINDOW_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    frame: true,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // ローカル画像ファイルのアクセスに必要
    }
  })

  win.setMenuBarVisibility(false)

  // 開発時
  if (process.env.NODE_ENV === 'development' || process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
    if (process.env.WHITEROOM_OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    win.loadFile(join(__dirname, '../../dist/renderer/index.html'))
  }

  // フルスクリーン変更を renderer に通知
  win.on('enter-full-screen', () => {
    win.webContents.send('fullscreen-change', true)
  })
  win.on('leave-full-screen', () => {
    win.webContents.send('fullscreen-change', false)
  })

  // スタッシュ残存時の終了確認
  win.on('close', async (e) => {
    e.preventDefault()
    let hasStash = false
    try {
      hasStash = await win.webContents.executeJavaScript('window.__whiteroom_hasStash?.()')
    } catch { /* ignore */ }
    if (hasStash) {
      const result = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['終了する', 'キャンセル'],
        defaultId: 1,
        cancelId: 1,
        message: 'スタッシュに設定が残っています。終了しますか？',
      })
      if (result.response === 0) {
        win.destroy()
      }
    } else {
      win.destroy()
    }
  })

  return win
}

// ===== IPC ハンドラ =====

// フォルダパスを直接渡して画像一覧を取得（D&D用）
ipcMain.handle('read-folder-path', async (_event, folderPath: string): Promise<OpenFolderResult> => {
  try {
    const images = readImagePaths(folderPath)
    return { canceled: false, folderPath, images }
  } catch {
    return { canceled: true }
  }
})

// フォルダ選択ダイアログ
ipcMain.handle('open-folder', async (_event, language?: UiLanguage): Promise<OpenFolderResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: text.imageFolderTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readImagePaths(folderPath)
  return { canceled: false, folderPath, images }
})

// アセット画像選択
ipcMain.handle('open-asset', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.imageFileFilter, extensions: ['png', 'webp', 'gif'] }],
    title: text.assetImageTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  return { canceled: false, filePath: result.filePaths[0] }
})

// 直前オーバレイ画像選択
ipcMain.handle('open-overlay-image', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.imageFileFilter, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }],
    title: text.overlayImageTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  return { canceled: false, filePath: result.filePaths[0] }
})

ipcMain.handle('open-asset-folder', async (_event, language?: UiLanguage) => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: text.assetFolderTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const folderPath = result.filePaths[0]
  const images = readImagePaths(folderPath)
  return { canceled: false, folderPath, images }
})

ipcMain.handle('list-asset-effect-folders', async (): Promise<AssetEffectFoldersResult> => {
  try {
    const basePath = getAssetEffectBasePath()
    if (!basePath) return { folders: [] }

    const folders = readdirSync(basePath, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const folderPath = join(basePath, entry.name)
        return {
          name: entry.name,
          path: folderPath,
          images: readImagePaths(folderPath),
        }
      })
      .filter(folder => folder.images.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    return { basePath, folders }
  } catch {
    return { folders: [] }
  }
})

// 画像をBase64で読み込み
ipcMain.handle('read-image-base64', async (_event, filePath: string): Promise<string> => {
  try {
    const data = readFileSync(filePath)
    const ext = extname(filePath).toLowerCase().replace('.', '')
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return ''
  }
})

// プロファイル保存
ipcMain.handle('save-profile', async (_event, profile: AppProfile, language?: UiLanguage): Promise<SaveProfileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    defaultPath: `${profile.name || 'profile'}.json`,
    title: text.saveProfileTitle
  })
  if (result.canceled || !result.filePath) {
    return { success: false }
  }
  try {
    writeFileSync(result.filePath, JSON.stringify(serializeAppProfile(profile), null, 2), 'utf-8')
    return { success: true, filePath: result.filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// プロファイル読み込み
ipcMain.handle('load-profile', async (_event, language?: UiLanguage): Promise<LoadProfileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'WhiteRoom Profile', extensions: ['json'] }],
    properties: ['openFile'],
    title: text.loadProfileTitle
  })
  if (result.canceled || !result.filePaths[0]) {
    return { success: false }
  }
  try {
    const filePath = result.filePaths[0]
    const raw = readFileSync(filePath, 'utf-8')
    const profile = resolveAppProfile(JSON.parse(raw) as AppProfile)
    return { success: true, profile, filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// フルスクリーン制御
ipcMain.handle('set-fullscreen', (_event, flag: boolean) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.setFullScreen(flag)
})

ipcMain.handle('reset-window-size', () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isFullScreen()) win.setFullScreen(false)
  if (win.isMaximized()) win.unmaximize()
  win.setSize(DEFAULT_MAIN_WINDOW_WIDTH, DEFAULT_MAIN_WINDOW_HEIGHT)
})

ipcMain.handle('get-window-size', (): { width: number; height: number } => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return { width: DEFAULT_MAIN_WINDOW_WIDTH, height: DEFAULT_MAIN_WINDOW_HEIGHT }
  const [width, height] = win.getSize()
  return { width, height }
})

ipcMain.handle('set-window-size', (_event, width: number, height: number): void => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isFullScreen() || win.isMaximized()) return
  win.setSize(Math.round(width), Math.round(height))
})

ipcMain.handle('open-external', async (_event, url: string) => {
  if (url.startsWith('https://github.com/')) {
    await shell.openExternal(url)
  }
})

ipcMain.handle('open-devtools', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.openDevTools({ mode: 'detach' })
})

ipcMain.handle('list-system-fonts', async (): Promise<string[]> => {
  return listSystemFonts()
})

// テキストファイル選択＆読み込み
ipcMain.handle('open-text-file', async (_event, language?: UiLanguage): Promise<OpenTextFileResult> => {
  const text = getDialogText(language)
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: text.textFileFilter, extensions: ['txt'] }],
    title: text.textFileTitle,
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true }
  }
  const filePath = result.filePaths[0]
  try {
    const tempFilePath = createTextReaderTempFile(filePath)
    const buf = readFileSync(tempFilePath)
    // UTF-8 BOM 除去
    const fileText = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF
      ? buf.slice(3).toString('utf-8')
      : buf.toString('utf-8')
    return { canceled: false, filePath, tempFilePath, text: fileText }
  } catch {
    cleanupTextReaderTempDir(activeTextReaderTempDir)
    return { canceled: true }
  }
})

// プロファイルをパス直接指定で読み込み（D&D用）
ipcMain.handle('load-profile-from-path', async (_event, filePath: string): Promise<LoadProfileResult> => {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const profile = resolveAppProfile(JSON.parse(raw) as AppProfile)
    return { success: true, profile, filePath }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// テキストファイルをパス直接指定で読み込み（D&D用）
ipcMain.handle('open-text-file-direct', async (_event, filePath: string): Promise<OpenTextFileResult> => {
  try {
    const tempFilePath = createTextReaderTempFile(filePath)
    const buf = readFileSync(tempFilePath)
    const fileText = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF
      ? buf.slice(3).toString('utf-8')
      : buf.toString('utf-8')
    return { canceled: false, filePath, tempFilePath, text: fileText }
  } catch {
    cleanupTextReaderTempDir(activeTextReaderTempDir)
    return { canceled: true }
  }
})

// テキストファイル保存
ipcMain.handle('save-text-file', async (_event, filePath: string, content: string): Promise<SaveTextFileResult> => {
  try {
    writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

// ===== アプリ起動 =====

ipcMain.handle('load-image-effect-profile', async (_event, folderPath: string): Promise<LoadImageEffectProfileResult> => {
  return loadImageEffectProfileFile(folderPath)
})

ipcMain.handle(
  'save-image-effect-profile',
  async (
    _event,
    folderPath: string,
    imagePath: string,
    effects: ImageEffectProfileDocument['entries'][string]['effects'],
    timer?: Partial<SavedTimerConfig>
  ): Promise<SaveImageEffectProfileResult> => {
    return saveImageEffectProfileFile(folderPath, imagePath, effects, timer)
  }
)

ipcMain.handle('cleanup-text-reader-temp-file', async (_event, tempFilePath: string): Promise<CleanupTextReaderTempFileResult> => {
  try {
    return cleanupTextReaderTempFilePath(tempFilePath)
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('load-remote-image-data-url', async (_event, url: string): Promise<RemoteImageResult> => {
  const cached = remoteImageDataUrlCache.get(url)
  if (cached) return cached

  const inFlight = remoteImageInFlight.get(url)
  if (inFlight) return inFlight

  const request = downloadRemoteImageAsDataUrl(url, true)
    .then(result => {
      if (result.success) remoteImageDataUrlCache.set(url, result)
      return result
    })
    .finally(() => {
      remoteImageInFlight.delete(url)
    })
  remoteImageInFlight.set(url, request)
  return request
})

ipcMain.handle('get-remote-image-stats', async (): Promise<RemoteImageStatsResult> => {
  return {
    pixivUniqueImageCount: countedPixivImageUrls.size,
    pixivUniqueImageLimit: MAX_PIXIV_UNIQUE_IMAGE_URLS_PER_APP,
  }
})

ipcMain.handle('check-has-stash', async (): Promise<boolean> => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) return false
  try {
    return await win.webContents.executeJavaScript('window.__whiteroom_hasStash?.() ?? false')
  } catch {
    return false
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  // ローカルファイルプロトコル許可
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: blob:; worker-src blob:"]
      }
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  cleanupAllTextReaderTempDirs()
})
