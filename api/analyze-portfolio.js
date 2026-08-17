// 개별 작품 피드백(api/analyze-feedback.js)과 달리, 지금까지 저장된
// 작품 전체를 시간순으로 보고 성장 추이를 요약하는 종합 리포트를 생성한다.
import { callGemini, verifyIdToken } from './_shared/gemini.js'

const MAX_WORKS = 30
const MAX_TEXT_LEN = 100

function buildPrompt(works) {
  const lines = works
    .slice(0, MAX_WORKS)
    .map((w, i) => {
      const c = w?.counts ?? {}
      const title = typeof w?.title === 'string' ? w.title.slice(0, MAX_TEXT_LEN) : `작품 ${i + 1}`
      const unit = typeof w?.unit === 'string' ? w.unit.slice(0, MAX_TEXT_LEN) : ''
      return `작품 ${i + 1} (${title}, ${unit}): 오브젝트 ${c.objects ?? 0}개, 블록 ${c.blocks ?? 0}개, 변수 ${c.variables ?? 0}개, 반복 ${c.repeats ?? 0}개, 조건 ${c.conditions ?? 0}개, 함수 ${c.functions ?? 0}개`
    })
    .join('\n')

  return `너는 중학교 1학년 학생의 엔트리(Entry) 코딩 포트폴리오를 검토하는 코딩 선생님이다.
아래는 이 학생이 지금까지 제출한 작품들을 시간 순서대로 구조 분석한 객관적 수치 목록이다.
이 수치의 변화 추이만 근거로, 학생의 성장 과정을 요약하는 4~6문장의 한국어 글을 작성해라.

반드시 지켜야 할 것:
- 수치에 없는 내용을 추측하거나 지어내지 마라 (게임 장르, 스토리, 다른 학생과의 비교, 실력의 절대적 우열 평가는 절대 언급하지 마라)
- 작품 수와 오브젝트/블록/변수/반복/조건/함수 개수가 작품을 거치며 어떻게 변했는지(늘었는지, 새로 등장했는지, 꾸준히 유지됐는지)에만 집중해라
- 단순 수치 나열이 아니라 전체를 관통하는 성장 흐름을 이야기하듯 자연스럽게 써라
- 존댓말로, 따뜻하고 담백하게 작성해라
- 마크다운이나 이모지 없이 순수 텍스트로만 작성해라

작품 목록 (시간순, 총 ${works.length}개):
${lines}`
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

  const { works } = req.body ?? {}
  if (!Array.isArray(works) || works.length === 0) {
    res.status(400).json({ error: '분석할 작품이 없습니다.' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    res.status(500).json({ error: 'AI 기능이 설정되지 않았습니다.' })
    return
  }

  try {
    const summary = await callGemini(buildPrompt(works), geminiKey)
    res.status(200).json({ summary })
  } catch (err) {
    console.error('Gemini 호출 실패', err)
    res.status(502).json({ error: '종합 리포트 생성에 실패했습니다.' })
  }
}
