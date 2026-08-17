import { useState } from 'react'
import { fetchPortfolioSummary } from '../lib/portfolioSummary'
import type { BlockCounts } from '../types/models'

interface Work {
  title: string
  unit: string
  counts: BlockCounts
}

// Shared by the student's own portfolio and the teacher's per-student
// detail view — both need the same "generate a whole-history growth
// write-up" interaction, just fed a different (but same-shaped) work list.
export function PortfolioSummaryPanel({ works }: { works: Work[] }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchPortfolioSummary(works)
      setSummary(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '종합 리포트 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (works.length === 0) return null

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-indigo-900">종합 성장 리포트</p>
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="rounded-lg bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? '생성 중...' : summary ? '다시 생성' : '리포트 보기'}
        </button>
      </div>
      {summary && <p className="mt-3 text-sm leading-relaxed text-indigo-900">{summary}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!summary && !error && (
        <p className="mt-2 text-xs text-indigo-400">
          지금까지 저장된 작품 {works.length}개를 한 번에 분석해 성장 흐름을 글로 요약합니다.
        </p>
      )}
    </div>
  )
}
