import type { CellEffects, ReadingConfigPayload, StoryboardRichTagPayload, StoryboardTag, TagEntry } from '../../shared/types'

// [[画像パス]]
const SIMPLE_TAG_RE = /^\[\[(.+)\]\]$/
// [WR:バージョン:{...json...}]
const RICH_TAG_RE = /^\[WR:([0-9a-z._-]+):(\{.*\})\]$/i
// [WR-RC:バージョン:{...json...}]
const READ_CONFIG_TAG_RE = /^\[WR-RC:([0-9a-z._-]+):(\{.*\})\]$/i

export function parseTagLine(line: string): StoryboardTag | null {
  const trimmed = line.trim()

  const simple = SIMPLE_TAG_RE.exec(trimmed)
  if (simple && simple[1]) {
    return { kind: 'simple', image: simple[1] }
  }

  const rich = RICH_TAG_RE.exec(trimmed)
  if (rich && rich[1] && rich[2]) {
    try {
      const payload = JSON.parse(rich[2]) as StoryboardRichTagPayload
      if (typeof payload.image !== 'string') return null
      return { kind: 'rich', version: rich[1], payload }
    } catch {
      return null
    }
  }

  return null
}

export function isTagLine(line: string): boolean {
  return parseTagLine(line) !== null
}

export function parseReadConfigTagLine(line: string): ReadingConfigPayload | null {
  const trimmed = line.trim()
  const match = READ_CONFIG_TAG_RE.exec(trimmed)
  if (!match || !match[2]) return null
  try {
    return JSON.parse(match[2]) as ReadingConfigPayload
  } catch {
    return null
  }
}

export function buildReadConfigTagLine(appVersion: string, payload: ReadingConfigPayload): string {
  return `[WR-RC:${appVersion}:${JSON.stringify(payload)}]`
}

export type ParsedTextFile = {
  cleanSegments: string[]
  tagEntries: TagEntry[]
  // cleanSegments[i] がファイル内で何行目から始まるか（0-indexed）
  segmentStartLines: number[]
  // ファイル先頭に埋め込まれた読書設定（存在する場合）
  readingConfig?: ReadingConfigPayload
}

/**
 * 生テキストを解析し、タグ行を抽出したクリーンセグメントとタグエントリを返す。
 *
 * タグ行は表示から除外され、次の段落（cleanSegment）がページに現れた瞬間にトリガーされる。
 * タグが段落内に混在している場合は、その段落の開始と同時にトリガーされる。
 */
export function parseTextFile(text: string): ParsedTextFile {
  const lines = text.split('\n')

  // ファイル先頭の ReadConfig タグを検出（最初の1行目のみチェック）
  let readingConfig: ReadingConfigPayload | undefined
  let lineStart = 0
  if (lines[0] !== undefined) {
    const firstLineConfig = parseReadConfigTagLine(lines[0])
    if (firstLineConfig !== null) {
      readingConfig = firstLineConfig
      // ReadConfigタグ行と後続の空行をスキップ
      lineStart = 1
      while (lineStart < lines.length && lines[lineStart]?.trim() === '') lineStart++
    }
  }

  // パラグラフ（2個以上の空行で区切られたブロック）に分割
  type RawParagraph = { lines: string[]; startLineIndex: number }
  const paragraphs: RawParagraph[] = []
  let blockLines: string[] = []
  let blockStart = 0

  for (let i = lineStart; i <= lines.length; i++) {
    const line = lines[i] ?? null
    if (line === null || line.trim() === '') {
      if (blockLines.length > 0) {
        paragraphs.push({ lines: blockLines, startLineIndex: blockStart })
        blockLines = []
      }
      if (line === null) break
    } else {
      if (blockLines.length === 0) blockStart = i
      blockLines.push(line)
    }
  }

  const cleanSegments: string[] = []
  const segmentStartLines: number[] = []
  const tagEntries: TagEntry[] = []
  const pendingTags: StoryboardTag[] = []

  for (const para of paragraphs) {
    const tagLines: StoryboardTag[] = []
    const textLines: string[] = []

    for (const line of para.lines) {
      const tag = parseTagLine(line)
      if (tag) tagLines.push(tag)
      else textLines.push(line)
    }

    // このパラグラフに含まれるタグを pending に追加
    for (const t of tagLines) pendingTags.push(t)

    const cleanText = textLines.join('\n').trim()
    if (cleanText.length > 0) {
      const segIdx = cleanSegments.length
      // pending タグをこのセグメントに紐付け
      for (const t of pendingTags) {
        tagEntries.push({ segmentIndex: segIdx, tag: t })
      }
      pendingTags.length = 0
      cleanSegments.push(cleanText)
      segmentStartLines.push(para.startLineIndex)
    }
  }

  // ファイル末尾にタグだけ残った場合は最後のセグメントに紐付け
  if (pendingTags.length > 0 && cleanSegments.length > 0) {
    const lastIdx = cleanSegments.length - 1
    for (const t of pendingTags) {
      tagEntries.push({ segmentIndex: lastIdx, tag: t })
    }
  }

  return { cleanSegments, tagEntries, segmentStartLines, readingConfig }
}

/**
 * ファイル先頭にReadConfigタグを挿入または上書きする。
 */
export function insertOrReplaceReadConfigAtTop(text: string, tagLine: string): string {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[0] !== undefined && parseReadConfigTagLine(lines[0]) !== null) {
    lines[0] = tagLine
  } else {
    lines.unshift(tagLine, '')
  }
  return lines.join('\n')
}

/**
 * ファイルテキストの指定行の直前にタグ行を挿入または上書きする。
 * すでに同位置にタグ行があれば置換し、なければ挿入する。
 *
 * @param text 現在のファイルテキスト
 * @param beforeLineIndex タグを挿入したいセグメントの開始行インデックス
 * @param tagLine 挿入するタグ行文字列
 */
export function insertOrReplaceTagBefore(
  text: string,
  beforeLineIndex: number,
  tagLine: string
): string {
  const lines = text.split('\n')
  // 挿入位置の直前の非空行を探す
  let scanIdx = beforeLineIndex - 1
  while (scanIdx >= 0 && lines[scanIdx]?.trim() === '') scanIdx--

  if (scanIdx >= 0 && lines[scanIdx] !== undefined && isTagLine(lines[scanIdx]!)) {
    // 既存タグを上書き
    lines[scanIdx] = tagLine
  } else {
    // beforeLineIndex の直前に挿入（空行 + タグ行）
    lines.splice(beforeLineIndex, 0, tagLine, '')
  }

  return lines.join('\n')
}

/**
 * 現在適用中のエフェクトを使ってリッチタグ文字列を生成する。
 */
export function buildRichTagLine(
  appVersion: string,
  image: string,
  effects: Partial<CellEffects>,
  progress?: { enabled: boolean; pages: number },
  timer?: { enabled: boolean }
): string {
  const payload: StoryboardRichTagPayload = { image, effects, progress, timer }
  return `[WR:${appVersion}:${JSON.stringify(payload)}]`
}

export function buildSimpleTagLine(image: string): string {
  return `[[${image}]]`
}

export function isRemoteImageReference(src: string): boolean {
  return /^https?:\/\//i.test(src) || src.startsWith('data:')
}

function fromFileUrl(src: string): string {
  if (!src.toLowerCase().startsWith('file://')) return src
  const withoutScheme = src.slice('file://'.length)
  const normalized = withoutScheme.startsWith('/') && /^[a-zA-Z]:/.test(withoutScheme.slice(1))
    ? withoutScheme.slice(1)
    : withoutScheme
  return decodeURIComponent(normalized)
}

function normalizePathSeparators(src: string): string {
  return fromFileUrl(src.trim()).replace(/\\/g, '/')
}

function isAbsoluteLocalPath(src: string): boolean {
  const normalized = normalizePathSeparators(src)
  return /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/')
}

function getPathDirectory(filePath: string): string {
  const normalized = normalizePathSeparators(filePath)
  const trimmed = normalized.replace(/\/+$/g, '')
  const slash = trimmed.lastIndexOf('/')
  if (slash <= 0) return trimmed
  if (/^[a-zA-Z]:$/.test(trimmed.slice(0, slash))) return trimmed.slice(0, slash + 1)
  return trimmed.slice(0, slash)
}

function splitPath(src: string): string[] {
  return normalizePathSeparators(src).split('/').filter(Boolean)
}

function sameWindowsDrive(a: string, b: string): boolean {
  const driveA = /^[a-zA-Z]:/.exec(a)?.[0].toLowerCase()
  const driveB = /^[a-zA-Z]:/.exec(b)?.[0].toLowerCase()
  return driveA !== undefined && driveA === driveB
}

function toRelativePath(targetPath: string, baseFilePath: string): string {
  const target = normalizePathSeparators(targetPath)
  const baseDir = getPathDirectory(baseFilePath)
  if (!isAbsoluteLocalPath(target) || !isAbsoluteLocalPath(baseDir)) return targetPath

  const targetHasDrive = /^[a-zA-Z]:\//.test(target)
  const baseHasDrive = /^[a-zA-Z]:\//.test(baseDir)
  if (targetHasDrive !== baseHasDrive) return targetPath
  if (targetHasDrive && !sameWindowsDrive(target, baseDir)) return targetPath

  const targetParts = splitPath(target)
  const baseParts = splitPath(baseDir)
  let common = 0
  while (
    common < targetParts.length &&
    common < baseParts.length &&
    targetParts[common]!.toLowerCase() === baseParts[common]!.toLowerCase()
  ) {
    common += 1
  }

  if (common === 0) return targetPath
  const up = Array.from({ length: baseParts.length - common }, () => '..')
  const down = targetParts.slice(common)
  const relative = [...up, ...down].join('/')
  return relative || '.'
}

export function createStoryboardImageReference(
  image: string,
  baseFilePath: string | null,
  useRelativePath: boolean
): string {
  const trimmed = image.trim()
  if (!trimmed || !useRelativePath || !baseFilePath || isRemoteImageReference(trimmed)) return trimmed
  return toRelativePath(trimmed, baseFilePath)
}

export function resolveStoryboardImageReference(image: string, baseFilePath: string | null): string {
  const trimmed = image.trim()
  if (!trimmed || !baseFilePath || isRemoteImageReference(trimmed) || isAbsoluteLocalPath(trimmed)) {
    return trimmed
  }
  const baseDir = getPathDirectory(baseFilePath)
  return `${baseDir}/${normalizePathSeparators(trimmed)}`.replace(/\/{2,}/g, '/')
}
