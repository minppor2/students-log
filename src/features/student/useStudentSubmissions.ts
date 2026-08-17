import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import type { Submission } from '../../types/models'

export function useStudentSubmissions(studentUid: string | undefined) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!studentUid || !isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    const q = query(
      collection(db, 'submissions'),
      where('studentUid', '==', studentUid),
      orderBy('createdAt', 'desc'),
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission))
      setIsLoading(false)
    })
    return unsubscribe
  }, [studentUid])

  return { submissions, isLoading }
}
