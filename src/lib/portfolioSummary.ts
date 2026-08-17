import { auth } from './firebase'
import type { BlockCounts } from '../types/models'

interface WorkSummaryInput {
  title: string
  unit: string
  counts: BlockCounts
}

// Unlike fetchAiFeedback (best-effort, silent on failure), this is triggered
// by an explicit "리포트 보기" click, so callers should surface the error
// rather than swallow it.
export async function fetchPortfolioSummary(works: WorkSummaryInput[]): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('로그인이 필요합니다.')

  const response = await fetch('/api/analyze-portfolio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ works }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || typeof data.summary !== 'string') {
    throw new Error(data.error || '종합 리포트 생성에 실패했습니다.')
  }
  return data.summary
}
