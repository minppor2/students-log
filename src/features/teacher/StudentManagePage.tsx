import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTeacherAuth } from '../../contexts/TeacherAuthContext'
import { useTeacherRoster } from './useTeacherRoster'
import { useTeacherUnits } from '../student/useTeacherUnits'
import { addStudentCode, addUnit } from './rosterActions'
import { formatDate } from '../../lib/format'

export function StudentManagePage() {
  const { user, logout } = useTeacherAuth()
  const { rows, submissions, isLoading } = useTeacherRoster(user?.uid)
  const { units } = useTeacherUnits(user?.uid)

  const [unitFilter, setUnitFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'missing'>('all')
  const [search, setSearch] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'submitted' && r.submissionCount === 0) return false
      if (statusFilter === 'missing' && r.submissionCount > 0) return false
      if (
        unitFilter !== 'all' &&
        !submissions.some((s) => s.studentCode === r.code && s.unit === unitFilter)
      )
        return false
      if (search && !r.code.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [rows, submissions, statusFilter, unitFilter, search])

  const submittedCount = rows.filter((r) => r.submissionCount > 0).length

  async function handleAddCode(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setActionError(null)
    try {
      await addStudentCode(user.uid, newCode || undefined)
      setNewCode('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '코드 추가에 실패했습니다.')
    }
  }

  async function handleAddUnit(e: FormEvent) {
    e.preventDefault()
    if (!user || !newUnit.trim()) return
    await addUnit(user.uid, newUnit)
    setNewUnit('')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">학생 작품 관리</h1>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">
          로그아웃
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        전체 {rows.length}명 · 제출 {submittedCount}명 · 미제출 {rows.length - submittedCount}명
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">단원 전체</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">제출 상태 전체</option>
          <option value="submitted">제출</option>
          <option value="missing">미제출</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 코드 검색"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {!isLoading && filteredRows.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            등록된 학생이 없어요.
          </p>
        )}
        {filteredRows.map((r) => (
          <Link
            key={r.code}
            to={`/teacher/students/${r.code}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <p className="font-medium text-slate-900">
              학생코드 {r.code} · 작품 {r.submissionCount}개
            </p>
            <p className="text-sm text-slate-500">
              {r.lastSubmittedAt ? `최근 제출 ${formatDate(r.lastSubmittedAt)}` : '제출 기록 없음'}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <form onSubmit={handleAddCode} className="space-y-2">
          <p className="text-sm font-medium text-slate-700">+ 학생 코드 추가</p>
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="직접 입력 (비우면 자동 생성)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            코드 추가
          </button>
        </form>
        <form onSubmit={handleAddUnit} className="space-y-2">
          <p className="text-sm font-medium text-slate-700">+ 단원 추가</p>
          <input
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="단원명"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            단원 추가
          </button>
        </form>
      </div>
      {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
    </div>
  )
}
