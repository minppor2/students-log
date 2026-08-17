import JSZip from 'jszip'
import { categorizeBlockType, CATEGORY_LABELS } from './entryBlockTypes'
import type { BlockCounts, SubmissionInsights } from '../types/models'

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
export const MAX_BLOCK_NODES = 20000

export type EntAnalysisErrorCode = 'file_too_large' | 'invalid_file' | 'too_many_blocks'

export class EntAnalysisError extends Error {
  code: EntAnalysisErrorCode
  constructor(message: string, code: EntAnalysisErrorCode) {
    super(message)
    this.code = code
  }
}

// A real playentry.org export (verified against an actual student .ent file)
// is gzip-compressed tar, NOT a zip — `file` reports "gzip compressed data",
// and gunzipping it yields a "POSIX tar archive" containing temp/project.json.
// The original design assumed zip (like Scratch's .sb3) since no real sample
// was available; that assumption was wrong, this one is confirmed. Zip
// support is kept as a fallback in case some other Entry export path (e.g.
// the offline editor) produces a different container.
async function gunzip(buffer: ArrayBuffer): Promise<Uint8Array> {
  const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

interface TarEntry {
  name: string
  content: Uint8Array
}

function parseTarOctal(bytes: Uint8Array): number {
  let str = ''
  for (const b of bytes) {
    if (b === 0 || b === 32) continue
    str += String.fromCharCode(b)
  }
  return str ? parseInt(str, 8) : 0
}

// Minimal POSIX/ustar reader: just enough to list regular-file entries and
// their content. Doesn't handle GNU longname extensions (100-char name
// field is plenty for "temp/project.json").
function parseTar(buffer: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break

    let name = ''
    for (const b of header.subarray(0, 100)) {
      if (b === 0) break
      name += String.fromCharCode(b)
    }
    const size = parseTarOctal(header.subarray(124, 136))
    const typeFlag = header[156]
    offset += 512

    if (name && (typeFlag === 0 || typeFlag === 48 /* '0' */)) {
      entries.push({ name, content: buffer.subarray(offset, offset + size) })
    }
    offset += Math.ceil(size / 512) * 512
  }
  return entries
}

async function readProjectJson(file: File): Promise<Record<string, unknown>> {
  const buffer = await file.arrayBuffer()

  try {
    const decompressed = await gunzip(buffer)
    const entry = parseTar(decompressed).find((e) => /project\.json$/i.test(e.name))
    if (entry) {
      const parsed = JSON.parse(new TextDecoder('utf-8').decode(entry.content))
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    }
  } catch {
    // not gzip/tar — fall through to the zip attempt below
  }

  try {
    const zip = await JSZip.loadAsync(buffer)
    const projectEntry = Object.values(zip.files).find(
      (e) => !e.dir && /project\.json$/i.test(e.name),
    )
    if (projectEntry) {
      const parsed = JSON.parse(await projectEntry.async('text'))
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    }
  } catch {
    // neither format worked — caller throws the standard invalid-file error
  }

  throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
}

interface BlockNode {
  type: string
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Explicit-stack (not recursive) traversal so a deeply nested or malformed
// script tree can't blow the call stack, and a shared node budget across all
// objects bounds worst-case work so the tab never freezes on a huge file.
function collectBlockNodes(root: unknown, budget: { remaining: number }): BlockNode[] {
  const found: BlockNode[] = []
  const stack: unknown[] = [root]
  while (stack.length > 0 && budget.remaining > 0) {
    const node = stack.pop()
    budget.remaining--
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item)
      continue
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (typeof obj.type === 'string') {
        found.push({ type: obj.type })
      }
      for (const key of Object.keys(obj)) {
        const value = obj[key]
        if (value && typeof value === 'object') stack.push(value)
      }
    }
  }
  return found
}

function countVariables(project: Record<string, unknown>): number {
  const raw = Array.isArray(project.variables) ? project.variables : []
  const hasVariableType = raw.some(
    (v) => v && typeof v === 'object' && 'variableType' in (v as Record<string, unknown>),
  )
  if (!hasVariableType) return raw.length
  return raw.filter(
    (v) =>
      v &&
      typeof v === 'object' &&
      (v as Record<string, unknown>).variableType === 'variable',
  ).length
}

export async function analyzeEntFile(file: File): Promise<BlockCounts> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new EntAnalysisError(
      '파일 용량이 너무 큽니다. 15MB 이하 파일로 다시 제출해 주세요.',
      'file_too_large',
    )
  }

  const project = await readProjectJson(file)

  const objects = Array.isArray(project.objects) ? project.objects : null
  if (!objects) {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }

  const budget = { remaining: MAX_BLOCK_NODES }
  const blockNodes: BlockNode[] = []
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue
    const script = (obj as Record<string, unknown>).script
    const scriptTree = typeof script === 'string' ? tryParseJson(script) : script
    if (!scriptTree) continue
    blockNodes.push(...collectBlockNodes(scriptTree, budget))
  }

  if (budget.remaining <= 0) {
    throw new EntAnalysisError(
      '허용된 블록 수를 초과했습니다. 파일을 나누어 다시 제출해 주세요.',
      'too_many_blocks',
    )
  }

  const functionsRaw = Array.isArray(project.functions) ? project.functions.length : 0
  const functionBlockCount = blockNodes.filter(
    (n) => categorizeBlockType(n.type) === 'function',
  ).length

  return {
    objects: objects.length,
    blocks: blockNodes.length,
    variables: countVariables(project),
    repeats: blockNodes.filter((n) => categorizeBlockType(n.type) === 'repeat').length,
    conditions: blockNodes.filter((n) => categorizeBlockType(n.type) === 'condition').length,
    functions: Math.max(functionsRaw, functionBlockCount),
  }
}

type InsightKey = keyof typeof CATEGORY_LABELS

export function buildInsights(
  current: BlockCounts,
  previous: BlockCounts | null,
): SubmissionInsights {
  const keys = Object.keys(CATEGORY_LABELS) as InsightKey[]
  const reused: string[] = []
  const isNew: string[] = []
  const expanded: string[] = []

  for (const key of keys) {
    const curr = current[key]
    const prev = previous ? previous[key] : 0
    if (curr <= 0) continue
    if (prev <= 0) {
      isNew.push(CATEGORY_LABELS[key])
    } else {
      reused.push(CATEGORY_LABELS[key])
      if (curr > prev) expanded.push(CATEGORY_LABELS[key])
    }
  }

  return { reused, new: isNew, expanded }
}
