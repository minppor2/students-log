import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useTeacherAuth } from '../contexts/TeacherAuthContext'

export function RequireTeacher({ children }: { children: ReactNode }) {
  const { user, isLoading } = useTeacherAuth()
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">불러오는 중...</div>
  }
  if (!user) return <Navigate to="/teacher/login" replace />
  return <>{children}</>
}
