import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { generateStudentCode, normalizeStudentCode } from '../../lib/ids'

export async function addStudentCode(teacherId: string, rawCode?: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = rawCode ? normalizeStudentCode(rawCode) : generateStudentCode()
    if (!code) throw new Error('코드를 입력해 주세요.')
    const ref = doc(db, 'students', code)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      if (rawCode) throw new Error('이미 사용 중인 코드입니다.')
      continue
    }
    await setDoc(ref, {
      teacherId,
      linkedUid: null,
      createdAt: Date.now(),
      lastLoginAt: null,
    })
    return code
  }
  throw new Error('코드 생성에 실패했습니다. 다시 시도해 주세요.')
}

export async function addUnit(teacherId: string, unit: string): Promise<void> {
  const trimmed = unit.trim()
  if (!trimmed) return
  await updateDoc(doc(db, 'teachers', teacherId), { units: arrayUnion(trimmed) })
}
