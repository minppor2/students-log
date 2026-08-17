// 실제 앱의 학생 업로드 흐름(익명 로그인 → 코드 확인 → .ent 분석 → Storage 업로드 →
// Firestore 저장)을 Node에서 그대로 재현해 TEST1234 계정에 테스트 데이터를 넣는다.
// 분석 로직은 src/lib/entryAnalyzer.ts / entryBlockTypes.ts와 동일하게 복제.
import { readFile } from 'node:fs/promises'
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
  messagingSenderId: '1021826841582',
  appId: '1:1021826841582:web:7b12974ac0431f24a9ecff',
}

const STUDENT_CODE = 'TEST1234'
const CATEGORY_LABELS = { repeats: '반복 구조', conditions: '조건 구조', functions: '함수', variables: '변수' }

class EntAnalysisError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

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

async function analyzeEntFile(buffer) {
  if (buffer.length > 15 * 1024 * 1024) {
    throw new EntAnalysisError('파일 용량이 너무 큽니다. 15MB 이하 파일로 다시 제출해 주세요.', 'file_too_large')
  }
  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }
  const projectEntry = Object.values(zip.files).find((e) => !e.dir && /project\.json$/i.test(e.name))
  if (!projectEntry) throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')

  let project
  try {
    const text = await projectEntry.async('text')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') throw new Error('not object')
    project = parsed
  } catch {
    throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')
  }

  const objects = Array.isArray(project.objects) ? project.objects : null
  if (!objects) throw new EntAnalysisError('분석할 수 없는 엔트리 파일입니다.', 'invalid_file')

  const budget = { remaining: 20000 }
  const blockNodes = []
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue
    const script = obj.script
    const scriptTree = typeof script === 'string' ? JSON.parse(script) : script
    if (!scriptTree) continue
    blockNodes.push(...collectBlockNodes(scriptTree, budget))
  }
  if (budget.remaining <= 0) {
    throw new EntAnalysisError('허용된 블록 수를 초과했습니다. 파일을 나누어 다시 제출해 주세요.', 'too_many_blocks')
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
  const reused = []
  const isNew = []
  const expanded = []
  for (const key of Object.keys(CATEGORY_LABELS)) {
    const curr = current[key]
    const prev = previous ? previous[key] : 0
    if (curr <= 0) continue
    if (prev <= 0) {
      isNew.push(CATEGORY_LABELS[key])
    } else {
      reused.push(CATEGORY_LABELS[key])
      if (curr > prev) expanded.push(CATEGORY_LABELS[key])
    }
  }
  return { reused, new: isNew, expanded }
}

async function main() {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  const cred = await signInAnonymously(auth)
  const uid = cred.user.uid
  console.log('익명 로그인 성공, uid =', uid)

  const studentRef = doc(db, 'students', STUDENT_CODE)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) {
    throw new Error(`students/${STUDENT_CODE} 문서가 없습니다. 교사 화면에서 먼저 코드를 발급해 주세요.`)
  }
  const { teacherId } = snap.data()
  console.log('학생 코드 확인됨. teacherId =', teacherId)

  await updateDoc(studentRef, { linkedUid: uid, lastLoginAt: Date.now() })
  console.log('코드 재연결(claim) 완료\n')

  const scenarios = [
    { file: 'test-작품1.ent', title: '고양이 달리기 게임', unit: '인공지능과 문제해결' },
    { file: 'test-작품2-성장버전.ent', title: '고양이 달리기 게임 v2', unit: '인공지능과 문제해결' },
  ]

  let previousCounts = null
  for (const scenario of scenarios) {
    const buffer = await readFile(scenario.file)
    const counts = await analyzeEntFile(buffer)
    const insights = buildInsights(counts, previousCounts)

    const submissionId = crypto.randomUUID()
    const storagePath = `entries/${uid}/${submissionId}.ent`
    await uploadBytes(ref(storage, storagePath), buffer)
    await addDoc(collection(db, 'submissions'), {
      studentCode: STUDENT_CODE,
      studentUid: uid,
      teacherId,
      unit: scenario.unit,
      title: scenario.title,
      fileName: scenario.file,
      storagePath,
      counts,
      insights,
      createdAt: serverTimestamp(),
    })
    console.log(`✅ 저장: ${scenario.title} (${scenario.file})`)
    console.log('   counts:', counts)
    console.log('   insights:', insights, '\n')
    previousCounts = counts
  }

  // 오류 케이스: 손상된 파일은 분석 단계에서 막혀야 하고, Firestore에는 아무것도 남지 않아야 한다.
  console.log('--- 오류 케이스 테스트: test-손상된파일.ent ---')
  try {
    const badBuffer = await readFile('test-손상된파일.ent')
    await analyzeEntFile(badBuffer)
    console.error('❌ FAIL: 손상된 파일이 분석을 통과해버림 (문제 있음)')
  } catch (err) {
    console.log(`✅ 예상대로 실패: [${err.code}] ${err.message}`)
    console.log('   -> 실제 앱과 동일하게 Firestore에는 아무 것도 저장되지 않음')
  }

  console.log('\n모든 테스트 데이터 삽입 완료')
}

main().catch((err) => {
  console.error('스크립트 실행 중 오류:', err)
  process.exit(1)
})
