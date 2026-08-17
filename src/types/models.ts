export interface TeacherDoc {
  email: string
  units: string[]
  createdAt: number
}

export interface StudentDoc {
  teacherId: string
  linkedUid: string | null
  createdAt: number
  lastLoginAt: number | null
}

export interface BlockCounts {
  objects: number
  blocks: number
  variables: number
  repeats: number
  conditions: number
  functions: number
}

export interface SubmissionInsights {
  reused: string[]
  new: string[]
  expanded: string[]
}

export interface SubmissionDoc {
  studentCode: string
  studentUid: string
  teacherId: string
  unit: string
  title: string
  fileName: string
  storagePath: string | null
  thumbnailDataUrl: string | null
  counts: BlockCounts
  insights: SubmissionInsights
  aiFeedback: string | null
  createdAt: number
}

export interface Submission extends SubmissionDoc {
  id: string
}
