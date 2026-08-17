import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import { toMillis } from '../../lib/format'
import type { StudentDoc, Submission } from '../../types/models'

export interface RosterRow {
  code: string
  submissionCount: number
  lastSubmittedAt: number | null
}

export function useTeacherRoster(teacherId: string | undefined) {
  const [students, setStudents] = useState<(StudentDoc & { code: string })[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [studentsLoaded, setStudentsLoaded] = useState(false)
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false)

  useEffect(() => {
    if (!teacherId || !isFirebaseConfigured) return
    const studentsQuery = query(collection(db, 'students'), where('teacherId', '==', teacherId))
    const unsubscribe = onSnapshot(studentsQuery, (snap) => {
      setStudents(
        snap.docs.map((d) => ({ code: d.id, ...d.data() }) as StudentDoc & { code: string }),
      )
      setStudentsLoaded(true)
    })
    return unsubscribe
  }, [teacherId])

  useEffect(() => {
    if (!teacherId || !isFirebaseConfigured) return
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc'),
    )
    const unsubscribe = onSnapshot(submissionsQuery, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission))
      setSubmissionsLoaded(true)
    })
    return unsubscribe
  }, [teacherId])

  const rows: RosterRow[] = students.map((s) => {
    const own = submissions.filter((sub) => sub.studentCode === s.code)
    return {
      code: s.code,
      submissionCount: own.length,
      lastSubmittedAt: own[0] ? toMillis(own[0].createdAt) : null,
    }
  })

  return { rows, submissions, isLoading: !isFirebaseConfigured ? false : !(studentsLoaded && submissionsLoaded) }
}
