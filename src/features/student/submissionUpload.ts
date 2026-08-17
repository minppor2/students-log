import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import type { BlockCounts, SubmissionInsights } from '../../types/models'

export async function fetchPreviousCounts(studentUid: string): Promise<BlockCounts | null> {
  const q = query(
    collection(db, 'submissions'),
    where('studentUid', '==', studentUid),
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
}

export async function saveSubmission(input: SaveSubmissionInput): Promise<void> {
  const submissionId = crypto.randomUUID()
  const storagePath = `entries/${input.studentUid}/${submissionId}.ent`
  await uploadBytes(ref(storage, storagePath), input.file)
  await addDoc(collection(db, 'submissions'), {
    studentCode: input.studentCode,
    studentUid: input.studentUid,
    teacherId: input.teacherId,
    unit: input.unit,
    title: input.title,
    fileName: input.file.name,
    storagePath,
    counts: input.counts,
    insights: input.insights,
    createdAt: serverTimestamp(),
  })
}
