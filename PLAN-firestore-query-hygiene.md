# PLAN: Firestore 쿼리 정리 및 status 백필 (우선순위 5)

## 목표
`app/lib/newsService.ts` 곳곳에서 "전체(또는 과다) fetch 후 클라이언트 필터" 패턴을 쓰고 있어 두 가지 문제가 있다:
1. **정확성**: `getRecentNews`는 `limit × 2`만 가져와 draft를 걸러내므로, 자동수집 draft가 쌓이면(특히 PLAN-auto-analyze-drafts 적용 후 매일 20여 건씩) 최신 published 기사가 목록에서 **누락**된다.
2. **비용/성능**: `getDraftNews`는 300건, `getWeeklySummaries`/`getMonthlySummaries`는 컬렉션 전체를 매번 읽는다. Firestore는 읽은 문서 수만큼 과금된다.

근본 원인은 옛날 문서에 `status` 필드가 없어서 `where('status','==','published')` 서버 쿼리를 못 쓰는 것이다. 백필 마이그레이션으로 이를 해결하고 쿼리를 서버 필터로 전환한다.

## 수정해야 할 정확한 파일
| 파일 | 작업 |
|---|---|
| `app/actions/migrationActions.ts` | `backfillNewsStatus()` 함수 추가 |
| `app/admin/page.tsx` | 마이그레이션 실행 버튼 1개 추가 (기존 migration 버튼 패턴 재사용) |
| `app/lib/newsService.ts` | `getRecentNews`(87–115행), `getDraftNews`(118–135행), `getWeeklySummaries`(209–234행), `getMonthlySummaries`(312–337행) 쿼리 교체 |
| Firebase Console | 복합 인덱스 2~4개 생성 (아래 참조) |

## 단계별 작업 순서

### 1단계: 백필 마이그레이션 작성
`app/actions/migrationActions.ts`에 추가 (기존 함수 스타일을 따를 것):
```ts
export async function backfillNewsStatus() {
  const snap = await getDocs(collection(db, "news"));
  let updated = 0;
  for (const d of snap.docs) {
    if (d.data().status === undefined) {
      await updateDoc(doc(db, "news", d.id), { status: "published" });
      updated++;
    }
  }
  return { total: snap.size, updated };
}
```
- `status`가 이미 있는 문서(`draft`/`rejected`/`published`)는 건드리지 않는다.
- PLAN-secure-endpoints를 적용했다면 이 함수에도 `verifyAdmin(idToken)` 추가.

### 2단계: admin 페이지에서 1회 실행
`app/admin/page.tsx`에 임시 버튼 추가 → 클릭 → 결과 alert(`{total, updated}`) 확인 → Firebase Console에서 `status` 없는 `news` 문서가 0건인지 확인. (버튼은 남겨둬도 무해 — 멱등이다.)

### 3단계: 쿼리 교체 (백필 완료 후에만!)
`app/lib/newsService.ts`:

**getRecentNews** — `limit × 2` + 클라이언트 필터 제거:
```ts
if (sortBy === 'likes') {
  q = query(newsCollection, where("status", "==", "published"), orderBy("likes", "desc"), limit(limitCount));
} else if (sortBy === 'created') {
  q = query(newsCollection, where("status", "==", "published"), orderBy("createdAt", "desc"), limit(limitCount));
} else {
  q = query(newsCollection, where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(limitCount));
}
// 이후 .filter(...)와 .slice(...) 제거, map 결과 그대로 반환
```

**getDraftNews** — 300건 스캔 제거:
```ts
const snap = await getDocs(query(
  collection(db, "news"),
  where("status", "==", "draft"),
  orderBy("createdAt", "desc"),
  limit(100)
));
return snap.docs.map(d => ({ id: d.id, ...d.data() })) as NewsArticle[];
// isAuto 클라이언트 필터는 유지해도 되고, draft는 자동수집뿐이므로 제거해도 된다
```

**getWeeklySummaries / getMonthlySummaries** — 전체 fetch 제거:
```ts
// includeUnpublished === true (관리자)
q = query(collection(db, "weekly_summaries"), orderBy("created_at", "desc"), limit(10));
// includeUnpublished === false (일반)
q = query(collection(db, "weekly_summaries"), where("isPublished", "==", true), orderBy("created_at", "desc"), limit(10));
```
클라이언트 sort/filter/slice 제거. monthly는 limit(12).

### 4단계: 복합 인덱스 생성
아래 인덱스가 필요하다. **가장 쉬운 방법**: 3단계 배포 후 각 화면을 열면 콘솔 에러에 "인덱스 생성 링크"가 뜬다 — 링크 클릭으로 생성. 예상 목록:
- `news`: `status ASC + publishedAt DESC`
- `news`: `status ASC + createdAt DESC`
- `news`: `status ASC + likes DESC`
- `weekly_summaries`: `isPublished ASC + created_at DESC`
- `monthly_summaries`: `isPublished ASC + created_at DESC`

인덱스 빌드는 수 분 걸린다. 빌드 완료 전까지 해당 쿼리는 실패하므로 **dev 환경에서 먼저 전부 생성해 두고 배포할 것.**

### 5단계: 빌드 및 회귀 확인
`npx tsc --noEmit && npm run build`, 이후 아래 완료 기준 수행.

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **순서가 생명이다: 백필(1~2단계) 전에 쿼리를 바꾸면(3단계) `status` 필드가 없는 옛 기사들이 `where('status','==','published')`에 걸리지 않아 화면에서 전부 사라진다.** Firestore의 where는 필드가 없는 문서를 절대 매치하지 않는다.
- **백필은 클라이언트 SDK로 문서를 1건씩 update한다** — 문서가 수천 건이면 오래 걸린다. 수백 건 규모(이 서비스 규모)면 그대로 두되, 루프 안에서 실패 1건 때문에 전체가 멈추지 않게 try/catch로 감싸고 실패 건수를 리턴에 포함하는 것이 좋다. `writeBatch`(500건 제한)로 최적화해도 되지만 필수는 아니다.
- **`getRecentNews`의 반환 개수 의미가 바뀐다**: 기존엔 "published만 limitCount개 이하", 변경 후엔 "정확히 limitCount개(있는 만큼)". 호출부(`NewsList.tsx`, `NewsTimeline.tsx`, `CategoryView.tsx`, `Dashboard.tsx` 등)에서 개수 가정을 하는 코드가 있는지 grep으로 확인.
- **`isVisible` 필드**: 문서에 존재하지만 현재 어떤 쿼리도 필터하지 않는다. 이번 PLAN에서 갑자기 `where('isVisible','==',true)`를 추가하지 말 것 — 옛 문서에 필드가 없을 수 있어 같은 실종 사고가 난다.
- **`getBookmarkedNews`와 `getNewsForSummary`는 건드리지 말 것.** 북마크는 draft 포함이어도 실해가 없고, 요약 생성은 의도적으로 전체 기사를 본다. (draft 제외를 원하면 별도 결정 사항 — 이 PLAN 범위 밖.)
- **React Query 캐시**: 쿼리를 바꿔도 브라우저에 3분 캐시가 남는다. 검증할 때 강력 새로고침(Ctrl+Shift+R) 후 확인할 것.
- **인덱스 에러는 빌드/타입체크에서 안 잡힌다.** 런타임 콘솔에만 `The query requires an index...`로 뜬다. 각 화면(타임라인, 카테고리, 즐겨찾기, 대시보드, admin 수신함, 주간/월간 요약 모달)을 전부 한 번씩 열어봐야 한다.

## 완료 기준 (직접 검증 방법)
1. 백필 실행 결과 `updated ≥ 0`, 재실행 시 `updated: 0` (멱등 확인).
2. Firebase Console에서 `news` 컬렉션 아무 옛날 문서나 열어 `status: "published"`가 있다.
3. 타임라인/카테고리/대시보드 화면의 기사 목록이 변경 전과 동일하다 (변경 전 화면 스크린샷과 비교).
4. draft 기사(admin 수신함에 있는 것)가 일반 사용자 타임라인에 **안 보인다**.
5. 브라우저 콘솔에 Firestore 인덱스 에러가 없다 (위 화면 전부 순회).
6. (선택) Firebase Console → 사용량 탭에서 문서 읽기 수가 이전 대비 감소 추세.
