import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import type { Submission } from '../../types/models'

export function useStudentDetail(teacherId: string | undefined, code: string | undefined) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!teacherId || !code || !isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    const q = query(
      collection(db, 'submissions'),
      where('teacherId', '==', teacherId),
      where('studentCode', '==', code),
      orderBy('createdAt', 'asc'),
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission))
      setIsLoading(false)
    })
    return unsubscribe
  }, [teacherId, code])

  return { submissions, isLoading }
}
