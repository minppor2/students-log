// Vercel serverless function — the free-tier alternative to Firebase Cloud
// Functions (which requires the Blaze plan). Runs on Vercel's Node runtime,
// so GEMINI_API_KEY (set in the Vercel dashboard, no VITE_ prefix) never
// reaches the client bundle. See functions/index.js for the Firebase
// Functions version of the same logic, kept for when Blaze is available.
const GEMINI_MODEL = 'gemini-3.6-flash'
const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const IDENTITY_LOOKUP_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo'
const MAX_TEXT_LEN = 100

function buildPrompt({ title, unit, counts, insights }) {
  const safeTitle = typeof title === 'string' ? title.slice(0, MAX_TEXT_LEN) : '작품'
  const safeUnit = typeof unit === 'string' ? unit.slice(0, MAX_TEXT_LEN) : ''
  const newList = Array.isArray(insights?.new) ? insights.new.slice(0, 10) : []
  const expandedList = Array.isArray(insights?.expanded) ? insights.expanded.slice(0, 10) : []

  return `너는 중학교 1학년 학생에게 엔트리(Entry) 코딩 작품에 대해 짧고 격려하는 피드백을 주는 코딩 선생님이다.
아래는 학생 작품을 구조적으로 분석한 객관적 수치다. 이 수치만 근거로 2~3문장의 한국어 피드백을 작성해라.

반드시 지켜야 할 것:
- 수치에 없는 내용을 추측하거나 지어내지 마라 (게임 장르, 스토리, 캐릭터 이름 등 알 수 없는 내용은 절대 언급하지 마라)
- 오브젝트/블록/변수/반복/조건/함수 개수와 그 의미(무엇을 잘 활용했는지, 다음에 시도해볼 만한 것)에만 집중해라
- 존댓말로, 따뜻하고 짧게(2~3문장) 작성해라
- 마크다운이나 이모지 없이 순수 텍스트로만 작성해라

작품명: ${safeTitle}
단원: ${safeUnit}
오브젝트 ${counts.objects ?? 0}개, 블록 ${counts.blocks ?? 0}개, 변수 ${counts.variables ?? 0}개, 반복 ${counts.repeats ?? 0}개, 조건 ${counts.conditions ?? 0}개, 함수 ${counts.functions ?? 0}개
${newList.length ? `새롭게 사용한 요소: ${newList.join(', ')}` : ''}
${expandedList.length ? `이전 작품보다 늘어난 요소: ${expandedList.join(', ')}` : ''}`
}

function extractOutputText(interaction) {
  const steps = Array.isArray(interaction.steps) ? interaction.steps : []
  return steps
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => (Array.isArray(step.content) ? step.content : []))
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim()
}

// Verifies the caller is a real signed-in Firebase user (anonymous students
// included) without needing the Admin SDK / a service-account secret — the
// public web API key is enough for this lookup endpoint.
async function verifyIdToken(idToken) {
  const webApiKey = process.env.VITE_FIREBASE_API_KEY
  if (!webApiKey || !idToken) return false
  try {
    const resp = await fetch(`${IDENTITY_LOOKUP_URL}?key=${webApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!resp.ok) return false
    const data = await resp.json()
    return Array.isArray(data.users) && data.users.length > 0
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!(await verifyIdToken(idToken))) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return
  }

  const { title, unit, counts, insights } = req.body ?? {}
  if (!counts || typeof counts !== 'object') {
    res.status(400).json({ error: '분석 데이터가 올바르지 않습니다.' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    res.status(500).json({ error: 'AI 기능이 설정되지 않았습니다.' })
    return
  }

  try {
    const response = await fetch(INTERACTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: buildPrompt({ title, unit, counts, insights }),
      }),
    })

    if (!response.ok) {
      console.error('Gemini 호출 실패', response.status, await response.text())
      res.status(502).json({ error: 'AI 피드백 생성에 실패했습니다.' })
      return
    }

    const data = await response.json()
    const feedback = extractOutputText(data)
    if (!feedback) {
      console.error('Gemini 응답에 텍스트 없음', JSON.stringify(data))
      res.status(502).json({ error: 'AI 피드백 생성에 실패했습니다.' })
      return
    }

    res.status(200).json({ feedback })
  } catch (err) {
    console.error('Gemini 네트워크 오류', err)
    res.status(500).json({ error: 'AI 피드백 생성에 실패했습니다.' })
  }
}
