import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import type { BlockCounts, SubmissionInsights } from '../../types/models'

export async function fetchPreviousCounts(studentCode: string): Promise<BlockCounts | null> {
  const q = query(
    collection(db, 'submissions'),
    where('studentCode', '==', studentCode),
    orderBy('createdAt', 'desc'),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return (snap.docs[0].data().counts as BlockCounts) ?? null
}

interface SaveSubmissionInput {
  studentCode: string
  studentUid: string
  teacherId: string
  unit: string
  title: string
  file: File
  counts: BlockCounts
  insights: SubmissionInsights
  aiFeedback: string | null
  thumbnailDataUrl?: string | null
}

export async function saveSubmission(input: SaveSubmissionInput): Promise<void> {
  const submissionId = crypto.randomUUID()
  const attemptedPath = `entries/${input.studentUid}/${submissionId}.ent`

  // The raw file backup is a nice-to-have audit trail, not core to growth
  // tracking — if Storage isn't set up yet (or the upload fails for any
  // reason), still save the analysis rather than blocking the student.
  let storagePath: string | null = null
  try {
    await uploadBytes(ref(storage, attemptedPath), input.file)
    storagePath = attemptedPath
  } catch (err) {
    console.warn('원본 파일 업로드 실패, 분석 결과만 저장합니다.', err)
  }

  await addDoc(collection(db, 'submissions'), {
    studentCode: input.studentCode,
    studentUid: input.studentUid,
    teacherId: input.teacherId,
    unit: input.unit,
    title: input.title,
    fileName: input.file.name,
    storagePath,
    thumbnailDataUrl: input.thumbnailDataUrl ?? null,
    counts: input.counts,
    insights: input.insights,
    aiFeedback: input.aiFeedback,
    createdAt: serverTimestamp(),
  })
}
