import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">엔트리 성장 포트폴리오</h1>
      <p className="mt-2 text-sm text-slate-500">작품을 기록하고 성장을 확인하세요</p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/student/login"
          className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          학생으로 접속
        </Link>
        <Link
          to="/teacher/login"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          교사로 접속
        </Link>
      </div>
    </div>
  )
}
