// TEST1234 학생 계정에 성장 스토리가 있는 작품 3개(썸네일 포함)를 실제로 넣는다.
// 실제 앱 흐름(익명 로그인 → 코드 재연결 → .ent 분석 → (선택)Storage 업로드 →
// (선택)Gemini AI 피드백 → Firestore 저장)을 그대로 재현한다.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import JSZip from 'jszip'

const firebaseConfig = {
  apiKey: 'AIzaSyA9uUbqHF40uqJdALwlwSzX2Xh5SHm6v0w',
  authDomain: 'students-log-269cd.firebaseapp.com',
  projectId: 'students-log-269cd',
  storageBucket: 'students-log-269cd.firebasestorage.app',
}
const SITE_URL = 'https://students-log-umber.vercel.app'
const STUDENT_CODE = 'TEST1234'
const CATEGORY_LABELS = { repeats: '반복 구조', conditions: '조건 구조', functions: '함수', variables: '변수' }

// ---------- 분석기 로직 (src/lib/entryAnalyzer.ts와 동일) ----------
function categorizeBlockType(type) {
  if (/repeat/i.test(type)) return 'repeat'
  if (/(^|_)if(_|$)/i.test(type)) return 'condition'
  if (/function|func_|customblock/i.test(type)) return 'function'
  return 'other'
}
function collectBlockNodes(root, budget) {
  const found = []
  const stack = [root]
  while (stack.length > 0 && budget.remaining > 0) {
    const node = stack.pop()
    budget.remaining--
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item)
      continue
    }
    if (node && typeof node === 'object') {
      if (typeof node.type === 'string') found.push({ type: node.type })
      for (const key of Object.keys(node)) {
        const value = node[key]
        if (value && typeof value === 'object') stack.push(value)
      }
    }
  }
  return found
}
function countVariables(project) {
  const raw = Array.isArray(project.variables) ? project.variables : []
  const hasVariableType = raw.some((v) => v && typeof v === 'object' && 'variableType' in v)
  if (!hasVariableType) return raw.length
  return raw.filter((v) => v && typeof v === 'object' && v.variableType === 'variable').length
}
async function analyzeProject(project) {
  const objects = project.objects
  const budget = { remaining: 20000 }
  const blockNodes = []
  for (const obj of objects) {
    const scriptTree = typeof obj.script === 'string' ? JSON.parse(obj.script) : obj.script
    if (!scriptTree) continue
    blockNodes.push(...collectBlockNodes(scriptTree, budget))
  }
  const functionsRaw = Array.isArray(project.functions) ? project.functions.length : 0
  const functionBlockCount = blockNodes.filter((n) => categorizeBlockType(n.type) === 'function').length
  return {
    objects: objects.length,
    blocks: blockNodes.length,
    variables: countVariables(project),
    repeats: blockNodes.filter((n) => categorizeBlockType(n.type) === 'repeat').length,
    conditions: blockNodes.filter((n) => categorizeBlockType(n.type) === 'condition').length,
    functions: Math.max(functionsRaw, functionBlockCount),
  }
}
function buildInsights(current, previous) {
  const reused = [], isNew = [], expanded = []
  for (const key of Object.keys(CATEGORY_LABELS)) {
    const curr = current[key]
    const prev = previous ? previous[key] : 0
    if (curr <= 0) continue
    if (prev <= 0) isNew.push(CATEGORY_LABELS[key])
    else {
      reused.push(CATEGORY_LABELS[key])
      if (curr > prev) expanded.push(CATEGORY_LABELS[key])
    }
  }
  return { reused, new: isNew, expanded }
}

// ---------- 썸네일 SVG (인스타 피드처럼 정사각형 카드 이미지) ----------
function toDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
const THUMBNAILS = {
  cat: toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#bfe3ff"/>
    <rect y="150" width="200" height="50" fill="#e2c290"/>
    <line x1="0" y1="175" x2="200" y2="175" stroke="#fff" stroke-width="4" stroke-dasharray="20 15"/>
    <circle cx="100" cy="110" r="45" fill="#f4a259"/>
    <polygon points="65,80 80,40 95,85" fill="#f4a259"/>
    <polygon points="135,80 120,40 105,85" fill="#f4a259"/>
    <circle cx="82" cy="105" r="6" fill="#222"/>
    <circle cx="118" cy="105" r="6" fill="#222"/>
    <path d="M85 125 Q100 135 115 125" stroke="#222" stroke-width="3" fill="none"/>
  </svg>`),
  maze: toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#fef3c7"/>
    <g stroke="#78350f" stroke-width="8" stroke-linecap="round">
      <line x1="20" y1="20" x2="180" y2="20"/>
      <line x1="20" y1="20" x2="20" y2="180"/>
      <line x1="20" y1="180" x2="180" y2="180"/>
      <line x1="180" y1="20" x2="180" y2="180"/>
      <line x1="60" y1="20" x2="60" y2="100"/>
      <line x1="100" y1="60" x2="100" y2="180"/>
      <line x1="140" y1="20" x2="140" y2="140"/>
    </g>
    <circle cx="40" cy="40" r="10" fill="#16a34a"/>
    <circle cx="160" cy="160" r="10" fill="#dc2626"/>
  </svg>`),
  draw: toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#ffffff"/>
    <rect x="10" y="10" width="180" height="140" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>
    <path d="M30 100 Q60 40 90 90 T150 60" stroke="#ec4899" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M30 120 Q70 130 110 110 T170 120" stroke="#3b82f6" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="175" r="12" fill="#ef4444"/>
    <circle cx="65" cy="175" r="12" fill="#f59e0b"/>
    <circle cx="100" cy="175" r="12" fill="#22c55e"/>
    <circle cx="135" cy="175" r="12" fill="#3b82f6"/>
    <circle cx="170" cy="175" r="12" fill="#a855f7"/>
  </svg>`),
}

// ---------- 3개 작품: 성장 스토리 (블록/변수 증가, 3번째에 함수 처음 등장) ----------
const WORKS = [
  {
    title: '고양이 달리기 게임',
    unit: '인공지능과 문제해결',
    thumbnail: THUMBNAILS.cat,
    project: {
      objects: [
        { id: 'o1', script: JSON.stringify([[{ type: 'when_run_button_click' }, { type: 'repeat_basic', params: [10], statements: [[{ type: '_if' }]] }]]) },
        { id: 'o2', script: JSON.stringify([[{ type: 'repeat_inf' }, { type: 'move_direction' }]]) },
      ],
      variables: [{ id: 'v1', name: '점수', variableType: 'variable' }],
      functions: [],
    },
  },
  {
    title: '미로 탈출 게임',
    unit: '인공지능과 문제해결',
    thumbnail: THUMBNAILS.maze,
    project: {
      objects: [
        { id: 'o1', script: JSON.stringify([[{ type: 'repeat_basic' }, { type: '_if' }, { type: 'if_else' }]]) },
        { id: 'o2', script: JSON.stringify([[{ type: 'repeat_basic' }, { type: '_if' }]]) },
        { id: 'o3', script: JSON.stringify([[{ type: 'move_direction' }]]) },
      ],
      variables: [
        { id: 'v1', name: '점수', variableType: 'variable' },
        { id: 'v2', name: '목숨', variableType: 'variable' },
      ],
      functions: [],
    },
  },
  {
    title: '인공지능 그림판',
    unit: '인공지능과 데이터',
    thumbnail: THUMBNAILS.draw,
    project: {
      objects: [
        { id: 'o1', script: JSON.stringify([[{ type: 'repeat_basic' }, { type: '_if' }, { type: 'function_create' }]]) },
        { id: 'o2', script: JSON.stringify([[{ type: 'function_general' }]]) },
        { id: 'o3', script: JSON.stringify([[{ type: 'function_general' }]]) },
        { id: 'o4', script: JSON.stringify([[{ type: 'repeat_inf' }]]) },
      ],
      variables: [
        { id: 'v1', name: '점수', variableType: 'variable' },
        { id: 'v2', name: '목숨', variableType: 'variable' },
        { id: 'v3', name: '브러시색상', variableType: 'variable' },
      ],
      functions: [{ id: 'f1', name: '브러시그리기' }, { id: 'f2', name: '색상변경' }],
    },
  },
]

async function tryFetchAiFeedback(idToken, { title, unit, counts, insights }) {
  try {
    const resp = await fetch(`${SITE_URL}/api/analyze-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ title, unit, counts, insights }),
    })
    if (!resp.ok) {
      console.log(`   (AI 피드백 생략: ${resp.status} ${(await resp.json().catch(() => ({}))).error ?? ''})`)
      return null
    }
    const data = await resp.json()
    return typeof data.feedback === 'string' ? data.feedback : null
  } catch (err) {
    console.log('   (AI 피드백 생략: 네트워크 오류)', err.message)
    return null
  }
}

async function main() {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  const cred = await signInAnonymously(auth)
  const uid = cred.user.uid
  const idToken = await cred.user.getIdToken()
  console.log('익명 로그인 성공, uid =', uid)

  const studentRef = doc(db, 'students', STUDENT_CODE)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) throw new Error(`students/${STUDENT_CODE} 문서가 없습니다.`)
  const { teacherId } = snap.data()
  await updateDoc(studentRef, { linkedUid: uid, lastLoginAt: Date.now() })
  console.log('코드 재연결 완료. teacherId =', teacherId, '\n')

  let previousCounts = null
  for (const work of WORKS) {
    console.log(`--- ${work.title} ---`)
    const counts = await analyzeProject(work.project)
    const insights = buildInsights(counts, previousCounts)
    console.log('  counts:', counts)
    console.log('  insights:', insights)

    // 원본 .ent 파일도 실제처럼 만들어서 Storage에 업로드 시도 (실패해도 계속 진행)
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify(work.project))
    const entBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const submissionId = crypto.randomUUID()
    let storagePath = null
    try {
      const path = `entries/${uid}/${submissionId}.ent`
      await uploadBytes(ref(storage, path), entBuffer)
      storagePath = path
      console.log('  Storage 업로드 성공')
    } catch (err) {
      console.log('  Storage 업로드 생략(Storage 미설정):', err.code ?? err.message)
    }

    const aiFeedback = await tryFetchAiFeedback(idToken, { title: work.title, unit: work.unit, counts, insights })
    if (aiFeedback) console.log('  AI 피드백:', aiFeedback)

    await addDoc(collection(db, 'submissions'), {
      studentCode: STUDENT_CODE,
      studentUid: uid,
      teacherId,
      unit: work.unit,
      title: work.title,
      fileName: `${work.title}.ent`,
      storagePath,
      thumbnailDataUrl: work.thumbnail,
      counts,
      insights,
      aiFeedback,
      createdAt: serverTimestamp(),
    })
    console.log(`  ✅ 저장 완료\n`)
    previousCounts = counts
  }

  console.log('모든 작품 저장 완료 —', SITE_URL, `에서 학생 코드 ${STUDENT_CODE}로 로그인해 확인 가능`)
}

main().catch((err) => {
  console.error('스크립트 실행 중 오류:', err)
  process.exit(1)
})
