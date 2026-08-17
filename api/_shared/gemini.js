// api/*.js 함수들이 공유하는 Gemini 호출 로직. 파일명이 밑줄로 시작하는
// 디렉터리는 Vercel이 라우트로 만들지 않는다(내부 헬퍼 전용 관례).
export const GEMINI_MODEL = 'gemini-3.6-flash'
export const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const IDENTITY_LOOKUP_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo'

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

// 로그인한 사용자인지(익명 포함) Admin SDK/서비스 계정 없이 확인한다 —
// Firebase의 공개 identitytoolkit 조회 엔드포인트는 웹 API 키만으로 동작한다.
export async function verifyIdToken(idToken) {
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

export async function callGemini(prompt, geminiKey) {
  const response = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({ model: GEMINI_MODEL, input: prompt }),
  })
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${await response.text()}`)
  }
  const data = await response.json()
  const text = extractOutputText(data)
  if (!text) throw new Error('Gemini returned no text')
  return text
}
