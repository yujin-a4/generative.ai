# PLAN: 자동수집 기사 AI 자동 분석 파이프라인 (우선순위 4)

## 목표
현재 매일 cron(`/api/news/batch`, 23:30 UTC)이 RSS로 기사를 수집해 `status: 'draft'`로 저장하지만, **요약·카테고리·태그가 전부 비어 있다** (`shortSummary: ''`, `category: 'AI_TECH'` 하드코딩). 관리자가 `app/admin/page.tsx`의 수신함에서 기사마다 수동으로 "분석" 버튼(1199행의 `analyzeNewsArticle` 호출)을 눌러야 한다. 이 수동 단계를 자동화한다: **수집 직후 Gemini 분석까지 자동 실행 → 관리자는 검토·승인만** 하면 되게 만든다. 이 서비스의 핵심 반복 업무를 없애는, 기능 면에서 레버리지가 가장 큰 작업이다.

## 수정해야 할 정확한 파일
| 파일 | 작업 |
|---|---|
| `app/api/news/batch/route.ts` | 저장 후 자동 분석 단계 추가, `maxDuration` 설정, 분석 결과로 category/tags/summary 채우기 |
| `app/admin/page.tsx` (수신함 영역, 약 1098행~ `adminTab === 'inbox'` 블록) | 분석 완료된 draft는 요약 미리보기 표시, 미분석 기사만 "분석" 버튼 유지 |

`app/actions/analyzeNews.ts`의 `analyzeNewsArticle`은 수정 없이 재사용한다 (`"use server"` 파일의 함수를 route handler에서 import해 호출하는 것은 정상 동작한다).

## 단계별 작업 순서

### 1단계: batch route에 maxDuration 추가
`app/api/news/batch/route.ts` 상단(import 아래)에:
```ts
export const maxDuration = 300; // Vercel Pro 기준. Hobby 플랜이면 60으로.
```
> 현재 Vercel 플랜을 먼저 확인할 것. Hobby면 60초가 상한이므로 아래 3단계의 `ANALYZE_CAP`을 5로 낮춘다.

### 2단계: 저장 로직을 "저장 → 분석 → 업데이트" 로 확장
현재 139–169행의 `Promise.allSettled(toSave.map(item => addDoc(...)))`를 다음 구조로 변경한다. 핵심: **addDoc의 반환 DocumentReference를 보관**해서 분석 결과로 updateDoc 한다.

```ts
import { analyzeNewsArticle } from '@/app/actions/analyzeNews'; // 파일 상단

// 저장 (기존 필드 그대로 유지)
const savedRefs: Array<{ ref: DocumentReference; item: typeof toSave[number] }> = [];
for (const item of toSave) {
  try {
    const ref = await addDoc(newsRef, { /* 기존 필드 그대로 */ });
    savedRefs.push({ ref, item });
  } catch (e: any) {
    console.error('[자동수집] 저장 실패:', e?.message);
  }
}

// 자동 분석 (순차 실행 — Gemini rate limit 보호)
const ANALYZE_CAP = 15; // 한 번의 cron 실행에서 분석할 최대 건수
let analyzed = 0, analyzeFailed = 0;
for (const { ref, item } of savedRefs.slice(0, ANALYZE_CAP)) {
  try {
    const result = await analyzeNewsArticle(item.url, '', item.rssSummary || item.title);
    await updateDoc(ref, {
      title: result.title || item.title,
      source: result.source || item.source,
      shortSummary: result.shortSummary || '',
      detailedSummary: result.detailedSummary || [],
      insight: result.insight || '',
      category: result.category || 'AI_TECH',
      tags: result.tags || [],
      url: result.resolvedUrl || item.url,   // Google News 리다이렉트가 풀린 실제 URL
      analyzedAt: Timestamp.now(),
    });
    analyzed++;
  } catch (e: any) {
    analyzeFailed++;
    console.warn(`[자동분석] 실패 (draft 유지): ${item.title}`, e?.message);
    // 실패해도 draft는 남아 있으므로 관리자가 수동 분석 가능 — throw 금지
  }
  await new Promise(r => setTimeout(r, 1000)); // Gemini 무료 티어 RPM 보호
}
```
`updateDoc`, `DocumentReference`를 firestore import에 추가. 응답 JSON에 `analyzed`, `analyzeFailed` 필드도 추가한다.

### 3단계: status는 계속 'draft'로 유지
자동 분석이 되어도 **자동 게시하지 않는다**. 관리자 승인(`updateNewsStatus(id, 'published')`) 흐름은 그대로 둔다. (오분류·저품질 요약이 바로 공개되는 사고 방지.)

### 4단계: admin 수신함 UI 개선
`app/admin/page.tsx`의 inbox 블록에서:
- `article.shortSummary`가 비어 있지 않으면: 요약·카테고리·태그를 카드에 표시하고 "분석" 버튼 대신 "재분석" 버튼(동일 핸들러)을 보여준다.
- 비어 있으면: 기존 "분석" 버튼 유지 (자동 분석이 실패했거나 CAP을 초과한 기사).

### 5단계: 로컬 검증 실행
```
npm run dev
# 다른 터미널에서 (CRON_SECRET 미설정 시 헤더 생략 가능, PLAN-secure-endpoints 적용 후라면 헤더 필수)
curl -i -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/news/batch
```
응답의 `saved`/`analyzed` 수치와 서버 로그 확인.

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **타임아웃 예산 계산**: 기사 1건 분석 = URL 리다이렉트 해석 + 본문 fetch + Gemini 호출 ≈ 5~15초. `ANALYZE_CAP × 최악 15초 + 수집 시간`이 `maxDuration`을 넘으면 함수가 도중에 killed 된다. 이 경우에도 저장은 이미 끝났고 분석만 일부 누락되므로 데이터는 안전하지만, CAP을 플랜에 맞게 보수적으로 잡을 것 (Pro 300초 → CAP 15, Hobby 60초 → CAP 5 이하 + delay 500ms).
- **분석을 `Promise.all`로 병렬 실행하지 말 것.** Gemini 무료 티어는 분당 요청 수 제한이 있어 429가 쏟아진다. 반드시 순차 + 1초 delay.
- **`analyzeNewsArticle`은 실패 시 throw 한다** (return이 아님). try/catch 없이 루프를 돌리면 첫 실패에서 전체가 죽고 이후 기사 분석이 전부 누락된다.
- **Google News URL**: RSS의 `item.link`는 `news.google.com` 리다이렉트 URL이다. `analyzeNewsArticle`이 내부에서 해석해 `resolvedUrl`을 반환하므로 이를 `url` 필드에 반영해야 뉴스 카드 클릭 시 실제 기사로 이동한다. 단 해석 실패 시 `resolvedUrl`이 여전히 google.com일 수 있음 — `|| item.url` 폴백 유지.
- **`result.category` 검증**: Gemini가 규칙을 어기고 목록 밖 카테고리를 반환할 수 있다. `['AI_TECH','AI_SERVICE','EDUTECH_AI','EDU_INDUSTRY','POLICY'].includes(result.category)`가 아니면 `'AI_TECH'`로 폴백하는 것이 안전하다 (카테고리 목록은 `app/lib/newsCategories.ts`와 대조해 확인할 것).
- **본문 fetch가 막히는 언론사** (paywall, bot 차단): `analyzeNewsArticle`은 `fallbackText`(RSS 요약)로 폴백한다 — 세 번째 인자로 `item.rssSummary || item.title`을 반드시 넘길 것. 빈 문자열을 넘기면 "본문을 읽어올 수 없습니다" 에러가 난다.
- **기존 수동 등록 흐름(`NewsSubmitModal.tsx`)은 건드리지 말 것.** 같은 함수를 공유하므로 `analyzeNewsArticle` 시그니처 변경 금지.

## 완료 기준 (직접 검증 방법)
1. 로컬에서 `curl`로 batch 호출 → 응답 JSON에 `saved > 0`이면 `analyzed > 0`이고, 서버 로그에 기사별 분석 성공/실패가 찍힌다.
2. Firebase Console → `news` 컬렉션 → 방금 생성된 `isAuto: true, status: 'draft'` 문서에 `shortSummary`, `detailedSummary`(3개), `insight`, `tags`가 채워져 있고 `category`가 항상 `AI_TECH`만은 아니다(기사 주제에 따라 분산).
3. 새 문서의 `url`이 `news.google.com`이 아닌 실제 언론사 도메인이다 (일부 해석 실패 건 제외).
4. `/admin` 수신함에서 자동 분석된 기사에 요약이 미리 보이고, "승인" 클릭 시 타임라인에 정상 노출된다.
5. 분석이 실패한 기사도 수신함에 남아 있고 수동 "분석" 버튼으로 처리 가능하다.
