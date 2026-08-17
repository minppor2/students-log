import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../../lib/firebase'

export function useTeacherUnits(teacherId: string | undefined) {
  const [units, setUnits] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!teacherId || !isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    getDoc(doc(db, 'teachers', teacherId)).then((snap) => {
      if (cancelled) return
      const data = snap.data()
      setUnits(Array.isArray(data?.units) ? (data.units as string[]) : [])
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [teacherId])

  return { units, isLoading }
}
