import { auth } from './firebase'
import type { BlockCounts, SubmissionInsights } from '../types/models'

interface AnalyzeFeedbackInput {
  title: string
  unit: string
  counts: BlockCounts
  insights: SubmissionInsights
}

// Calls the Vercel serverless function at /api/analyze-feedback (see
// api/analyze-feedback.js) rather than a Firebase Cloud Function — Cloud
// Functions needs the Blaze plan, while Vercel's free tier already runs
// this app and includes serverless functions.
// Best-effort: AI feedback is a nice-to-have on top of the objective block
// counts, so callers should treat a null return as "no feedback this time"
// rather than a hard failure of the analysis step.
export async function fetchAiFeedback(input: AnalyzeFeedbackInput): Promise<string | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) return null

    const response = await fetch('/api/analyze-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) return null

    const data = await response.json()
    return typeof data.feedback === 'string' ? data.feedback : null
  } catch {
    return null
  }
}
