import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useStudentSession } from '../contexts/StudentSessionContext'

export function RequireStudent({ children }: { children: ReactNode }) {
  const { session, isLoading } = useStudentSession()
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">불러오는 중...</div>
  }
  if (!session) return <Navigate to="/student/login" replace />
  return <>{children}</>
}
