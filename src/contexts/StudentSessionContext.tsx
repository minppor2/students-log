import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { signInAnonymously } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'
import { normalizeStudentCode } from '../lib/ids'
import type { StudentDoc } from '../types/models'

const SESSION_STORAGE_KEY = 'students-log-student-code'

interface StudentSession {
  code: string
  uid: string
  teacherId: string
}

interface StudentSessionContextValue {
  session: StudentSession | null
  isLoading: boolean
  login: (rawCode: string) => Promise<void>
  logout: () => void
}

const StudentSessionContext = createContext<StudentSessionContextValue | null>(null)

// Anonymous auth + "reclaim on login": whoever holds the code becomes the
// linked uid, so students can log in from any lab computer without a
// backend. See README for the accepted trade-off.
async function claimCode(rawCode: string): Promise<StudentSession> {
  const code = normalizeStudentCode(rawCode)
  if (!code) {
    throw new Error('발급받은 학생 코드를 확인해 주세요.')
  }

  let uid = auth.currentUser?.uid
  if (!uid) {
    const cred = await signInAnonymously(auth)
    uid = cred.user.uid
  }

  const studentRef = doc(db, 'students', code)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) {
    throw new Error('발급받은 학생 코드를 확인해 주세요.')
  }
  const data = snap.data() as StudentDoc

  await updateDoc(studentRef, { linkedUid: uid, lastLoginAt: serverTimestamp() })
  sessionStorage.setItem(SESSION_STORAGE_KEY, code)
  return { code, uid, teacherId: data.teacherId }
}

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudentSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    const storedCode = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!storedCode) {
      setIsLoading(false)
      return
    }
    claimCode(storedCode)
      .then(setSession)
      .catch(() => sessionStorage.removeItem(SESSION_STORAGE_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (rawCode: string) => {
    setIsLoading(true)
    try {
      const next = await claimCode(rawCode)
      setSession(next)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
  }, [])

  return (
    <StudentSessionContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </StudentSessionContext.Provider>
  )
}

export function useStudentSession(): StudentSessionContextValue {
  const ctx = useContext(StudentSessionContext)
  if (!ctx) throw new Error('useStudentSession must be used within StudentSessionProvider')
  return ctx
}
