import { Link, useParams } from 'react-router-dom'
import { useTeacherAuth } from '../../contexts/TeacherAuthContext'
import { useStudentDetail } from './useStudentDetail'

export function StudentDetailPage() {
  const { code } = useParams<{ code: string }>()
  const { user } = useTeacherAuth()
  const { submissions, isLoading } = useStudentDetail(user?.uid, code)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{code} 성장 포트폴리오</h1>
        <Link to="/teacher/students" className="text-sm text-slate-500 hover:text-slate-700">
          목록
        </Link>
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500">불러오는 중...</p>}
      {!isLoading && submissions.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          아직 제출한 작품이 없어요.
        </p>
      )}

      {submissions.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="p-3 font-normal"></th>
                {submissions.map((s, i) => (
                  <th key={s.id} className="p-3 font-medium text-slate-900">
                    작품 {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="p-3 text-slate-500">블록 수</td>
                {submissions.map((s) => (
                  <td key={s.id} className="p-3">
                    {s.counts.blocks}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="p-3 text-slate-500">조건 구조</td>
                {submissions.map((s) => (
                  <td key={s.id} className="p-3">
                    {s.counts.conditions}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="p-3 text-slate-500">반복 구조</td>
                {submissions.map((s) => (
                  <td key={s.id} className="p-3">
                    {s.counts.repeats}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 text-slate-500">함수 사용</td>
                {submissions.map((s) => (
                  <td key={s.id} className="p-3">
                    {s.counts.functions}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {submissions.map((s, i) => (
          <details key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-medium text-slate-900">
              작품 {i + 1} · {s.title} ({s.unit})
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              오브젝트 {s.counts.objects}개 · 블록 {s.counts.blocks}개 · 변수 {s.counts.variables}개 · 반복{' '}
              {s.counts.repeats}개 · 조건 {s.counts.conditions}개 · 함수 {s.counts.functions}개
            </p>
            {s.aiFeedback && (
              <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-sm text-indigo-900">{s.aiFeedback}</p>
            )}
          </details>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">학생 개인정보는 표시하지 않음</p>
    </div>
  )
}
