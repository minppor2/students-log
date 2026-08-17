import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentSession } from '../../contexts/StudentSessionContext'
import { useTeacherUnits } from './useTeacherUnits'
import { analyzeEntFile, buildInsights, EntAnalysisError } from '../../lib/entryAnalyzer'
import { fetchAiFeedback } from '../../lib/aiFeedback'
import { fetchPreviousCounts, saveSubmission } from './submissionUpload'
import type { BlockCounts, SubmissionInsights } from '../../types/models'

type Step = { kind: 'form' } | { kind: 'result'; counts: BlockCounts; insights: SubmissionInsights }

export function NewSubmissionPage() {
  const { session } = useStudentSession()
  const { units } = useTeacherUnits(session?.teacherId)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [unit, setUnit] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('파일을 선택해 주세요')
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    setError(null)
    setStatus(next ? `${next.name} 선택됨` : '파일을 선택해 주세요')
  }

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault()
    if (!session || !file || !title.trim() || !unit) return
    setError(null)
    setIsAnalyzing(true)

    // Two independent failure domains: a bad .ent file vs. a Firestore
    // problem fetching the previous submission. Conflating them into one
    // message previously told students their file was broken when the real
    // cause was a backend issue.
    let counts: BlockCounts
    try {
      counts = await analyzeEntFile(file)
    } catch (err) {
      setError(err instanceof EntAnalysisError ? err.message : '분석할 수 없는 엔트리 파일입니다.')
      setIsAnalyzing(false)
      return
    }

    try {
      const previous = await fetchPreviousCounts(session.code)
      const insights = buildInsights(counts, previous)
      setStep({ kind: 'result', counts, insights })

      // Best-effort AI feedback: fetched after the objective counts are
      // already on screen, so a slow/failed Gemini call never blocks the
      // student from seeing their analysis or saving it.
      setAiFeedback(null)
      setIsFetchingFeedback(true)
      fetchAiFeedback({ title: title.trim(), unit, counts, insights })
        .then(setAiFeedback)
        .finally(() => setIsFetchingFeedback(false))
    } catch {
      setError('이전 작품 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!session || !file || step.kind !== 'result') return
    setIsSaving(true)
    setError(null)
    try {
      await saveSubmission({
        studentCode: session.code,
        studentUid: session.uid,
        teacherId: session.teacherId,
        unit,
        title: title.trim(),
        file,
        counts: step.counts,
        insights: step.insights,
        aiFeedback,
      })
      navigate('/student')
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  if (step.kind === 'result') {
    const { counts, insights } = step
    const hasInsights = insights.reused.length + insights.new.length + insights.expanded.length > 0
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">작품 분석 결과</h1>
        <p className="mt-3 text-sm text-slate-600">
          오브젝트 {counts.objects}개 · 블록 {counts.blocks}개 · 변수 {counts.variables}개
        </p>
        <p className="text-sm text-slate-600">
          반복 {counts.repeats}개 · 조건 {counts.conditions}개 · 함수 {counts.functions}개
        </p>
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          {insights.reused.length > 0 && <p>잘 활용한 요소: {insights.reused.join('·')}</p>}
          {insights.new.length > 0 && <p>새롭게 사용한 요소: {insights.new.join('·')}</p>}
          {insights.expanded.length > 0 && <p>이전 작품보다 확장된 점: {insights.expanded.join('·')}</p>}
          {!hasInsights && (
            <p className="text-slate-400">첫 작품이에요. 다음 작품부터 변화가 표시됩니다.</p>
          )}
        </div>
        {(isFetchingFeedback || aiFeedback) && (
          <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-medium">AI 코치 피드백</p>
            {isFetchingFeedback ? (
              <p className="mt-1 text-indigo-400">생성 중...</p>
            ) : (
              <p className="mt-1">{aiFeedback}</p>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setStep({ kind: 'form' })
              setAiFeedback(null)
              setIsFetchingFeedback(false)
            }}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            다시 분석
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            저장하기
          </button>
        </div>
      </div>
    )
  }

  const canAnalyze = Boolean(file && title.trim() && unit) && !isAnalyzing

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-bold text-slate-900">새 작품 등록</h1>
      <form onSubmit={handleAnalyze} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm text-slate-600">작품명</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600">단원</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">단원 선택</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600">엔트리 파일</label>
          <input type="file" accept=".ent" onChange={handleFileChange} className="mt-1 w-full text-sm" />
        </div>
        <p className="text-sm text-slate-500">업로드 상태: {status}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={!canAnalyze}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isAnalyzing ? '분석 중...' : '작품 분석하기'}
        </button>
        <p className="text-center text-xs text-slate-400">분석 후 학생이 확인해야 저장됩니다</p>
      </form>
    </div>
  )
}
