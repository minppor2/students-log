import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudentSession } from '../../contexts/StudentSessionContext'
import { useTeacherUnits } from './useTeacherUnits'
import { useStudentSubmissions } from './useStudentSubmissions'
import { formatDate } from '../../lib/format'
import { PortfolioSummaryPanel } from '../../components/PortfolioSummaryPanel'

export function PortfolioPage() {
  const { session, logout } = useStudentSession()
  const { units } = useTeacherUnits(session?.teacherId)
  const { submissions, isLoading } = useStudentSubmissions(session?.code)
  const [unitFilter, setUnitFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered =
    unitFilter === 'all' ? submissions : submissions.filter((s) => s.unit === unitFilter)

  // 종합 리포트는 필터와 무관하게 전체 히스토리를 다루고, submissions는
  // 최신순(desc)이라 시간순(오래된 것부터)으로 뒤집어서 넘긴다.
  const chronologicalWorks = useMemo(
    () =>
      [...submissions]
        .reverse()
        .map((s) => ({ title: s.title, unit: s.unit, counts: s.counts })),
    [submissions],
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">내 성장 포트폴리오</h1>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">
          나가기
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 단원</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <Link
          to="/student/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          ＋ 새 작품
        </Link>
      </div>

      <div className="mt-4">
        <PortfolioSummaryPanel works={chronologicalWorks} />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            아직 등록한 작품이 없어요.
          </p>
        )}
        {filtered.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {s.thumbnailDataUrl && (
              <img src={s.thumbnailDataUrl} alt={s.title} className="aspect-square w-full object-cover" />
            )}
            <div className="p-4">
              <p className="text-xs text-slate-400">{formatDate(s.createdAt)}</p>
              <p className="font-medium text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                사용 블록 {s.counts.blocks}개 · 오브젝트 {s.counts.objects}개
              </p>
              <button
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className="mt-2 text-sm font-medium text-slate-700 underline underline-offset-2"
              >
                분석 결과 보기
              </button>
              {expandedId === s.id && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <p>
                    변수 {s.counts.variables}개 · 반복 {s.counts.repeats}개 · 조건 {s.counts.conditions}개 · 함수{' '}
                    {s.counts.functions}개
                  </p>
                  {s.insights.reused.length > 0 && (
                    <p className="mt-1">잘 활용한 요소: {s.insights.reused.join('·')}</p>
                  )}
                  {s.insights.new.length > 0 && <p>새롭게 사용한 요소: {s.insights.new.join('·')}</p>}
                  {s.insights.expanded.length > 0 && (
                    <p>이전 작품보다 확장된 점: {s.insights.expanded.join('·')}</p>
                  )}
                  {s.aiFeedback && (
                    <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-indigo-900">{s.aiFeedback}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
