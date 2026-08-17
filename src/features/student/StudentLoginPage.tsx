import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentSession } from '../../contexts/StudentSessionContext'

export function StudentLoginPage() {
  const { login } = useStudentSession()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(code)
      navigate('/student')
    } catch (err) {
      setError(err instanceof Error ? err.message : '발급받은 학생 코드를 확인해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-bold text-slate-900">학생 접속</h1>
      <p className="mt-1 text-sm text-slate-500">교사에게 받은 코드를 입력하세요</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="학생 코드 입력"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest uppercase focus:border-slate-500 focus:outline-none"
          maxLength={12}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          접속하기
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-400">※ 이름이나 학번은 입력하지 않습니다</p>
    </div>
  )
}
