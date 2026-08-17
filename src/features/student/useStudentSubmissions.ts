import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import type { Submission } from '../../types/models'

// Filtered by studentCode (stable across devices), not studentUid — a
// student reclaiming their code from a different lab computer gets a new
// anonymous uid each time, so uid can't be the query key without losing
// access to everything they submitted from earlier devices.
export function useStudentSubmissions(studentCode: string | undefined) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!studentCode || !isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    const q = query(
      collection(db, 'submissions'),
      where('studentCode', '==', studentCode),
      orderBy('createdAt', 'desc'),
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission))
      setIsLoading(false)
    })
    return unsubscribe
  }, [studentCode])

  return { submissions, isLoading }
}
