# PLAN: API 엔드포인트 및 서버 액션 보안 강화 (우선순위 1)

## 목표
현재 누구나 호출할 수 있는 3개의 공격 지점을 막는다:
1. `GET /api/news/batch` — CRON_SECRET 검증에 우회 버그가 있어 **헤더를 아예 안 보내면 통과**된다.
2. `POST /api/services/enrich` — 인증이 "요청 body에 관리자 이메일 문자열을 넣었는가"뿐이다. 그 이메일은 클라이언트 번들(`ServiceTab.tsx`)에 하드코딩되어 공개돼 있으므로 누구나 호출해 Gemini API 비용을 무한정 발생시킬 수 있다.
3. 서버 액션(`generateWeeklySummary`, `generateMonthlySummary` 등) — 인증 검사가 전혀 없다. 관리자 UI 버튼은 클라이언트에서만 숨겨져 있고, 서버 액션 자체는 누구나 직접 호출 가능하다.

## 수정해야 할 정확한 파일
| 파일 | 위치 | 작업 |
|---|---|---|
| `app/api/news/batch/route.ts` | 44–51행 | cron secret 검증 로직 수정 |
| `app/api/services/enrich/route.ts` | 80–87행 | body 이메일 비교 → Firebase ID 토큰 검증으로 교체 |
| `app/components/ServiceTab/ServiceTab.tsx` | 약 165–172행 (`fetch("/api/services/enrich"...)` 부분) | `adminEmail` 대신 ID 토큰 전송 |
| `lib/serverAuth.ts` | **신규 생성** | ID 토큰 검증 공용 함수 |
| `app/actions/generateWeeklySummary.ts` | 함수 시그니처 및 도입부 | `idToken` 파라미터 추가 + 검증 |
| `app/actions/generateMonthlySummary.ts` | 동일 | 동일 |
| `app/actions/migrationActions.ts` | 모든 export 함수 | 동일 |
| 서버 액션을 호출하는 컴포넌트 (grep으로 확인: `generateWeeklySummary(`, `generateMonthlySummary(` 호출부 — 최소 `app/components/NewsTab/SummaryModal.tsx`, `app/admin/page.tsx`) | 호출부 | 호출 시 `await auth.currentUser.getIdToken()` 전달 |
| `package.json` | dependencies | `firebase-admin` 추가 |

## 단계별 작업 순서

### 1단계: cron secret 우회 버그 수정 (5분, 의존성 없음)
`app/api/news/batch/route.ts` 44–51행의 현재 코드:
```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader !== `Bearer ${cronSecret}`) {   // ← 버그: 헤더가 없으면(null) 이 블록을 건너뜀
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```
아래로 교체:
```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```
참고: Vercel Cron은 `CRON_SECRET` 환경변수가 설정돼 있으면 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙여 호출하므로 vercel.json 수정은 불필요.

### 2단계: firebase-admin 설치 및 서비스 계정 설정
1. `npm install firebase-admin`
2. Firebase Console → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → JSON 다운로드.
3. JSON 전체를 한 줄 문자열로 만들어 `.env.local`과 Vercel 환경변수에 `FIREBASE_SERVICE_ACCOUNT_KEY`로 저장. (절대 git에 커밋 금지 — `.gitignore`가 `.env*`를 이미 제외하고 있음을 확인할 것)

### 3단계: `lib/serverAuth.ts` 신규 생성
```ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "yujinkang1008@gmail.com")
  .split(",").map(e => e.trim().toLowerCase());

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  // Vercel 환경변수에서 \n이 이스케이프될 수 있음
  if (key.private_key) key.private_key = key.private_key.replace(/\\n/g, "\n");
  return initializeApp({ credential: cert(key) });
}

/** ID 토큰을 검증하고 관리자 이메일인지 확인. 실패 시 throw. */
export async function verifyAdmin(idToken: string): Promise<string> {
  if (!idToken) throw new Error("인증 토큰이 없습니다.");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  const email = (decoded.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) throw new Error("관리자 권한이 없습니다.");
  return email;
}
```

### 4단계: enrich 라우트 교체
`app/api/services/enrich/route.ts`의 80–87행을:
```ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const { verifyAdmin } = await import("@/lib/serverAuth");
    await verifyAdmin(body.idToken);
  } catch (e: any) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...이하 기존 로직 유지
```
`app/components/ServiceTab/ServiceTab.tsx`의 호출부(약 169행)를:
```ts
const idToken = await auth.currentUser?.getIdToken();
... body: JSON.stringify({ idToken }),
```
(`auth`는 `@/lib/firebase`에서 import — 파일 상단에 이미 있는지 확인.)

### 5단계: 서버 액션에 검증 추가
`generateWeeklySummary`, `generateMonthlySummary`, `migrationActions.ts`의 각 export 함수:
- 마지막 파라미터로 `idToken: string` 추가.
- 함수 본문 최상단 try 안에 `await verifyAdmin(idToken);` 추가 (import는 `@/lib/serverAuth`).
- 실패 시 기존 패턴대로 `return { success: false, error: "관리자 권한이 없습니다." }`.

### 6단계: 호출부 수정
`generateWeeklySummary(`, `generateMonthlySummary(`, migration 함수들을 grep으로 전부 찾아, 각 호출 직전에 `const idToken = await auth.currentUser?.getIdToken() ?? "";`를 넣고 인자로 전달. 인자 개수가 바뀌므로 TypeScript 컴파일 에러가 누락 지점을 알려준다 — `npx tsc --noEmit`으로 전부 잡을 것.

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **1단계 조건식 방향**: `!authHeader || authHeader !== ...`처럼 고치는 것도 맞지만, `authHeader !== ...` 하나로 null 케이스가 이미 포함된다. 반대로 `if (authHeader !== cronSecret)`처럼 `Bearer ` 접두어를 빼먹으면 Vercel Cron 호출까지 401이 된다.
- **firebase-admin은 Edge 런타임에서 동작 안 함**: 두 라우트 파일에 `export const runtime = "edge"`가 없음을 확인. (현재 없음 — 추가하지 말 것.)
- **서비스 계정 JSON의 `private_key` 개행 문자**: Vercel 환경변수에 넣으면 `\n`이 리터럴 문자열이 되는 경우가 많다. 3단계 코드의 replace가 이를 처리한다 — 삭제하지 말 것.
- **서버 액션 파일은 `"use server"`이므로 export 함수는 전부 공개 엔드포인트다**: 검증을 함수 "일부"에만 넣으면 안 된다. 해당 파일의 **모든 export async 함수**에 넣어야 한다.
- **클라이언트에서 `auth.currentUser`가 null인 순간**(새로고침 직후)이 있다 — `?.` 사용하고, 토큰이 빈 문자열이면 서버가 401을 반환하므로 크래시는 없다.
- **`dashboardActions.ts`, `feedbackActions.ts`, `serviceActions.ts`, `analyzeNews.ts`도 서버 액션이다**: 이 중 읽기 전용이거나 일반 사용자도 써야 하는 것(예: `analyzeNewsArticle`은 뉴스 등록 모달에서 사용)은 관리자 검증을 넣으면 기능이 깨진다. 이번 PLAN 범위는 **관리자 전용 쓰기 액션**(주간/월간 요약 생성, 마이그레이션)만이다.

## 완료 기준 (직접 검증 방법)
1. `npx tsc --noEmit` 통과.
2. 터미널에서 (배포 후 또는 `CRON_SECRET=test npm run dev` 상태에서):
   - `curl -i https://<배포URL>/api/news/batch` → **401**
   - `curl -i -H "Authorization: Bearer <CRON_SECRET>" https://<배포URL>/api/news/batch` → 200
   - `curl -i -X POST https://<배포URL>/api/services/enrich -H "Content-Type: application/json" -d '{"adminEmail":"yujinkang1008@gmail.com"}'` → **401** (기존에는 이게 뚫렸음)
3. 관리자 계정으로 로그인 → 주간 요약 생성 버튼 → 정상 생성됨.
4. 브라우저 시크릿 창(비로그인) 개발자도구에서 서버 액션을 직접 fetch로 호출하면 `{ success: false, error: "관리자 권한이 없습니다." }` 반환.
