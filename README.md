# 엔트리 성장 포트폴리오

`PRD.md`에 정리된 요구사항을 구현한 앱. React 19 + Vite + TypeScript + Tailwind CSS v4 + Firebase(Auth/Firestore/Storage), Vercel 배포.

## 시작하기

```bash
npm install
cp .env.example .env.local   # Firebase 프로젝트 값 채워 넣기
npm run dev
```

Firebase CLI가 있다면 보안 규칙과 인덱스도 배포해야 실제로 동작합니다.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 보안 모델: "익명 인증 + 코드 재연결"

학생은 이름/학번 없이 교사가 발급한 코드만으로 접속합니다. 별도 서버 없이 Firebase 클라이언트 SDK만으로 이를 구현하기 위해 다음 방식을 사용합니다.

1. 학생이 코드를 입력하면 Firebase 익명 인증(`signInAnonymously`)으로 로그인한다.
2. `students/{code}` 문서의 `linkedUid`를 방금 발급받은 익명 uid로 갱신(재연결)한다.
3. 이후 모든 Firestore 요청은 `request.auth.uid`가 그 학생의 `linkedUid`와 일치하는지로 검증된다(`firestore.rules` 참고).

이 방식 덕분에 실습실처럼 매번 다른 컴퓨터를 쓰는 환경에서도 코드 하나로 어디서든 로그인할 수 있고, 별도 백엔드(Cloud Functions) 없이 오늘 바로 배포할 수 있습니다.

**트레이드오프**: 코드를 아는 사람은 곧 그 학생으로 취급됩니다. 코드가 유출되면 다른 사람이 재연결해서 그 학생의 계정을 가로챌 수 있습니다. PRD가 "코드 유출 시 재발급 기능"을 P1(오늘 안 만듦)으로 명시적으로 미루고 있어 이 리스크를 이미 인지하고 있는 상태이며, 이번 스코프에서는 받아들이는 트레이드오프입니다. 실제 운영 시 재발급 기능을 P1로 반드시 이어서 구현하는 것을 권장합니다.

교사는 별도로 Firebase Auth 이메일/비밀번호 계정을 사용하며, 학생 코드와는 완전히 분리되어 있습니다. 교사 계정은 Firebase 콘솔(Authentication 탭)에서 미리 만들어 두어야 합니다 — 앱 안에는 회원가입 화면이 없습니다(와이어프레임에도 로그인만 있음).

## .ent 분석기의 한계

Entry(.ent) 프로젝트 파일의 정확한 JSON 스키마는 공개 문서로 확정할 수 없었습니다. `src/lib/entryAnalyzer.ts`는 zip 안의 `project.json`을 열어 `type` 필드를 가진 모든 노드를 방어적으로 순회하며 블록 수를 집계하고, `src/lib/entryBlockTypes.ts`의 정규식으로 반복/조건/함수를 분류합니다.

실제 학생이 내보낸 `.ent` 샘플을 확보하면:
1. `src/lib/entryBlockTypes.ts`의 정규식이 실제 block type 이름과 맞는지 확인하고 조정하세요.
2. `project.variables`/`project.functions`의 실제 필드명이 다르면 `entryAnalyzer.ts`의 `countVariables`/`functionsRaw` 부분을 맞춰 고치세요.

## AI 코치 피드백 (Gemini)

구조적 분석(블록/반복/조건/함수 개수)은 그대로 유지하고, Gemini가 그 수치를 바탕으로 짧은 해설/격려 피드백만 한 줄 더 생성합니다. 원본 `.ent` 파일이나 코드 내용은 절대 Gemini로 전송하지 않습니다 — PRD의 "AI가 추정 평가하지 않는다" 원칙을 지키기 위해 카운트 이상의 정보를 주지 않습니다.

Gemini API 키는 브라우저에 노출되면 안 되므로(노출 시 다른 사람이 그대로 꺼내가 무제한 사용 가능), 서버 쪽에서만 다룹니다. Firebase Cloud Functions는 Blaze(종량제) 요금제가 필요해서, 대신 **이미 배포 중인 Vercel의 서버리스 함수**(`api/analyze-feedback.js`)를 씁니다 — 별도 결제수단 등록 없이 무료로 됩니다.

설정 방법:
1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. `GEMINI_API_KEY`(**`VITE_` 접두사 없이!**)에 https://aistudio.google.com/apikey 에서 발급받은 값 저장 → Production 체크 → 저장
3. Deployments → 최신 배포 → Redeploy

`VITE_`가 붙으면 Vite가 클라이언트 번들에 박아 넣어버려서 키가 그대로 노출되니 절대 붙이면 안 됩니다.

`functions/`에는 Firebase Cloud Functions 버전(같은 로직)도 남겨뒀습니다 — 나중에 Blaze로 업그레이드하면 `firebase functions:secrets:set GEMINI_API_KEY`로 시크릿 등록 후 `firebase deploy --only functions`로 전환할 수 있습니다(현재는 배포되어 있지 않음, 클라이언트는 Vercel 함수만 호출합니다).

## 남은 확인 사항

- 실제 Firebase 프로젝트 자격증명(`VITE_FIREBASE_*`)을 `.env.local`에 채워야 로그인/저장이 동작합니다.
- 실제 `.ent` 샘플로 분석기 정확도를 검증해야 합니다(위 "한계" 참고).
- 교사 계정은 Firebase 콘솔에서 미리 생성해야 합니다.
- Firebase Storage를 콘솔에서 최초 1회 초기화해야 합니다(Storage 탭 → "시작하기").
- Vercel에 `GEMINI_API_KEY` 환경변수를 설정해야 AI 피드백이 동작합니다(위 "AI 코치 피드백" 참고). 설정 전에는 AI 피드백만 조용히 생략되고 나머지 기능은 정상 동작합니다.
