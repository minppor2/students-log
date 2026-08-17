import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'

interface TeacherAuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const TeacherAuthContext = createContext<TeacherAuthContextValue | null>(null)

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false)
      return
    }
    // Anonymous (student) sessions must never satisfy the teacher guard.
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser && !nextUser.isAnonymous ? nextUser : null)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    // Merge-only write: never touches `units`, so an existing teacher's
    // unit list survives repeated logins.
    await setDoc(
      doc(db, 'teachers', cred.user.uid),
      { email: cred.user.email ?? email, lastLoginAt: Date.now() },
      { merge: true },
    )
  }, [])

  const logout = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  return (
    <TeacherAuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </TeacherAuthContext.Provider>
  )
}

export function useTeacherAuth(): TeacherAuthContextValue {
  const ctx = useContext(TeacherAuthContext)
  if (!ctx) throw new Error('useTeacherAuth must be used within TeacherAuthProvider')
  return ctx
}
