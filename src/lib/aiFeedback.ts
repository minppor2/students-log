import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { BlockCounts, SubmissionInsights } from '../types/models'

interface AnalyzeFeedbackInput {
  title: string
  unit: string
  counts: BlockCounts
  insights: SubmissionInsights
}

interface AnalyzeFeedbackOutput {
  feedback: string
}

const callAnalyzeFeedback = httpsCallable<AnalyzeFeedbackInput, AnalyzeFeedbackOutput>(
  functions,
  'analyzeFeedback',
)

// Best-effort: AI feedback is a nice-to-have on top of the objective block
// counts, so callers should treat a null return as "no feedback this time"
// rather than a hard failure of the analysis step.
export async function fetchAiFeedback(input: AnalyzeFeedbackInput): Promise<string | null> {
  try {
    const result = await callAnalyzeFeedback(input)
    return result.data.feedback || null
  } catch {
    return null
  }
}
