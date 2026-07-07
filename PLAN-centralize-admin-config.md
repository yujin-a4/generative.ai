# PLAN: 관리자 판별 로직 중앙화 (우선순위 3)

## 목표
관리자 이메일 `yujinkang1008@gmail.com`이 최소 10개 파일에 하드코딩되어 있다. 관리자를 추가/변경하려면 10곳을 고쳐야 하고, 한 곳이라도 놓치면 권한이 어긋난다. 단일 유틸 함수 + 환경변수로 통합한다.

(참고: 이 작업은 클라이언트 **UI 표시용** 판별만 다룬다. 실제 보안 검증은 `PLAN-secure-endpoints.md`의 서버 측 `verifyAdmin`이 담당한다. 두 PLAN은 독립적으로 실행 가능하다.)

## 수정해야 할 정확한 파일

**신규 생성:**
- `app/lib/adminConfig.ts`

**하드코딩 제거 대상 (grep `yujinkang1008`로 재확인할 것 — 아래는 검토 시점 기준 전체 목록):**
| 파일 | 행 |
|---|---|
| `app/components/Dashboard.tsx` | 57 |
| `app/components/ReportTab.tsx` | 44 |
| `app/components/ServiceTab/ServiceCard.tsx` | 32 |
| `app/components/ServiceTab/ServiceTab.tsx` | 44, 169 |
| `app/components/NewsTab/NewsCard.tsx` | 37 |
| `app/components/NewsTab/WeeklySummary.tsx` | 63 |
| `app/components/NewsTab/SummaryModal.tsx` | 56 |
| `app/api/services/enrich/route.ts` | 82 |
| `app/admin/page.tsx` | (grep으로 확인 — 관리자 체크가 있다면 교체) |

## 단계별 작업 순서

### 1단계: `app/lib/adminConfig.ts` 생성
```ts
// 관리자 이메일 목록. 쉼표로 여러 명 지정 가능.
// NEXT_PUBLIC_ 접두어이므로 클라이언트에 노출된다 — UI 표시 판별용일 뿐,
// 실제 권한은 서버(Firestore rules / lib/serverAuth.ts)가 강제해야 한다.
export const ADMIN_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || "yujinkang1008@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
```

### 2단계: 환경변수 등록
- `.env.local`에 추가: `NEXT_PUBLIC_ADMIN_EMAILS=yujinkang1008@gmail.com`
- Vercel 프로젝트 환경변수에도 동일하게 추가 (Production/Preview/Development 전부).
- `README.md`의 환경변수 섹션에 한 줄 추가.

### 3단계: 각 사용처 교체
전형적인 교체 패턴 (예: `Dashboard.tsx` 57행):
```ts
// 변경 전
setIsAdmin(user?.email === "yujinkang1008@gmail.com");
// 변경 후
setIsAdmin(isAdminEmail(user?.email));
```
각 파일 상단에 `import { isAdminEmail } from "@/app/lib/adminConfig";` 추가.

`ServiceTab.tsx` 169행은 성격이 다르다 — API 요청 body에 이메일을 실어 보내는 코드:
```ts
body: JSON.stringify({ adminEmail: "yujinkang1008@gmail.com" }),
```
- `PLAN-secure-endpoints.md`를 이미 적용했다면 이 줄은 이미 `idToken` 방식으로 바뀌어 있으므로 건드릴 것 없음.
- 아직이라면 `body: JSON.stringify({ adminEmail: auth.currentUser?.email })`로 교체 (로그인한 본인 이메일 전송). 서버 쪽 `enrich/route.ts` 82행도 `isAdminEmail(body.adminEmail)` 사용으로 교체.

### 4단계: 전수 검증
```
grep -rn "yujinkang1008" app/ lib/
```
결과가 `app/lib/adminConfig.ts` 1곳(기본값)뿐이어야 한다.

### 5단계: 빌드
```
npx tsc --noEmit
npm run build
```

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **`NEXT_PUBLIC_` 환경변수는 빌드 시점에 인라인된다.** Vercel에 변수 추가 후 재배포해야 반영된다. 로컬에서도 `.env.local` 수정 후 dev 서버 재시작 필요.
- **서버 파일(`enrich/route.ts`)에서도 `NEXT_PUBLIC_` 변수는 읽을 수 있다** — 별도 변수를 또 만들 필요 없음. 단, `PLAN-secure-endpoints.md`의 `lib/serverAuth.ts`는 서버 전용 `ADMIN_EMAILS` 변수를 쓴다. 두 변수 값을 똑같이 맞춰둘 것 (이메일 목록이 어긋나면 UI에는 관리자 버튼이 보이는데 서버가 401을 주는 혼란 발생).
- **대소문자**: Firebase Auth의 이메일은 일반적으로 소문자지만, 비교 전 `toLowerCase()`를 양쪽 모두에 적용하는 위 구현을 유지할 것.
- **`user?.email`이 `null`인 익명/로딩 상태** — `isAdminEmail`이 null-safe이므로 호출부에서 별도 가드 불필요. 기존 코드의 `if (user && user.email === ...)` 같은 가드는 `if (isAdminEmail(user?.email))`로 단순화해도 되지만, 주변 로직(예: user 객체를 함께 쓰는 경우)을 깨뜨리지 않도록 조건문 구조는 최대한 유지할 것.
- **`app/admin/page.tsx`가 1,430줄이다.** 에디터 검색으로 이메일 문자열이 정말 없는지 확인하고, 접근 가드가 아예 없다면(URL 직접 접근 시 누구나 보임) 발견 사실만 기록하고 이 PLAN 범위에서는 UI 판별 교체만 수행.

## 완료 기준 (직접 검증 방법)
1. `grep -rn "yujinkang1008" app/ lib/` → `app/lib/adminConfig.ts` 1건만 출력.
2. `npm run build` 성공.
3. 관리자 계정으로 로그인 → 뉴스 카드 수정/삭제 버튼, 주간요약 생성 버튼 등 관리자 UI가 이전과 동일하게 보인다.
4. 비관리자 계정(또는 비로그인)으로 접속 → 관리자 UI가 보이지 않는다.
5. `.env.local`의 `NEXT_PUBLIC_ADMIN_EMAILS`에 테스트 이메일을 쉼표로 추가하고 dev 서버 재시작 → 그 계정으로 로그인하면 관리자 UI가 보인다.
