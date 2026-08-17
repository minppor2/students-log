// Excludes ambiguous characters (0/O, 1/I) so codes are easy to read aloud/write on a whiteboard.
const STUDENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateStudentCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += STUDENT_CODE_ALPHABET[Math.floor(Math.random() * STUDENT_CODE_ALPHABET.length)]
  }
  return code
}

export function normalizeStudentCode(raw: string): string {
  return raw.trim().toUpperCase()
}
