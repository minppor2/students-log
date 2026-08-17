import { isFirebaseConfigured } from '../../lib/firebase'

export function ConfigBanner() {
  if (isFirebaseConfigured) return null
  return (
    <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
      Firebase 설정이 비어 있습니다. .env.local에 VITE_FIREBASE_* 값을 채워주세요.
    </div>
  )
}
