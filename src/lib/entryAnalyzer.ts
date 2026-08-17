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

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }

  const projectEntry = Object.values(zip.files).find(
    (entry) => !entry.dir && /project\.json$/i.test(entry.name),
  )
  if (!projectEntry) {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }

  let project: Record<string, unknown>
  try {
    const text = await projectEntry.async('text')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    project = parsed as Record<string, unknown>
  } catch {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }

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
