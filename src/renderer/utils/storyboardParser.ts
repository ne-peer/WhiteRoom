import type { CellEffects, StoryboardRichTagPayload, StoryboardTag, TagEntry } from '../../shared/types'

// [[画像パス]]
const SIMPLE_TAG_RE = /^\[\[(.+)\]\]$/
// [WR:バージョン:{...json...}]
const RICH_TAG_RE = /^\[WR:([0-9a-z._-]+):(\{.*\})\]$/i

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

export type ParsedTextFile = {
  cleanSegments: string[]
  tagEntries: TagEntry[]
  // cleanSegments[i] がファイル内で何行目から始まるか（0-indexed）
  segmentStartLines: number[]
}

/**
 * 生テキストを解析し、タグ行を抽出したクリーンセグメントとタグエントリを返す。
 *
 * タグ行は表示から除外され、次の段落（cleanSegment）がページに現れた瞬間にトリガーされる。
 * タグが段落内に混在している場合は、その段落の開始と同時にトリガーされる。
 */
export function parseTextFile(text: string): ParsedTextFile {
  const lines = text.split('\n')

  // パラグラフ（2個以上の空行で区切られたブロック）に分割
  type RawParagraph = { lines: string[]; startLineIndex: number }
  const paragraphs: RawParagraph[] = []
  let blockLines: string[] = []
  let blockStart = 0

  for (let i = 0; i <= lines.length; i++) {
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

  return { cleanSegments, tagEntries, segmentStartLines }
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
