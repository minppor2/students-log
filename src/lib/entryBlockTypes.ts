// Entry(.ent) 프로젝트 파일의 정확한 block-type 스키마는 공개 문서로 확정할 수 없었다.
// 실제 export 샘플이 확보되면 아래 패턴만 고치면 되도록 분류 로직을 이 파일 하나에 모아둔다.
export type BlockCategory = 'repeat' | 'condition' | 'function' | 'other'

const CATEGORY_PATTERNS: [BlockCategory, RegExp][] = [
  ['repeat', /repeat/i],
  ['condition', /(^|_)if(_|$)/i],
  ['function', /function|func_|customblock/i],
]

export function categorizeBlockType(type: string): BlockCategory {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(type)) return category
  }
  return 'other'
}

export const CATEGORY_LABELS = {
  repeats: '반복 구조',
  conditions: '조건 구조',
  functions: '함수',
  variables: '변수',
} as const
