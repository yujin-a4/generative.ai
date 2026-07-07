# PLAN: 확인된 데이터 버그 2건 수정 (우선순위 2)

## 목표
코드 검토에서 확정적으로 발견된 버그 2건을 수정한다. 둘 다 수정량은 몇 줄이지만 사용자에게 보이는 결과가 잘못되고 있는, 노력 대비 효과가 가장 큰 수정이다.

### 버그 A — 대시보드 트렌드 헤드라인이 실제 뉴스 데이터 없이 생성됨
`app/actions/analyzeNews.ts`의 `generateTrendHeadline` 함수(208행~) 프롬프트 안에서 템플릿 변수가 `\${combinedText}`로 **이스케이프**되어 있다(231행). 즉 Gemini에게 뉴스 목록 대신 리터럴 문자열 `${combinedText}`가 전달되고, 헤드라인은 아무 근거 없이 지어낸 문장이 된다. `Dashboard.tsx` 73~75행에서 이 함수를 실제로 사용 중이므로 대시보드에 항상 가짜 헤드라인이 표시되고 있다.

### 버그 B — 좋아요 수 레이스 컨디션
`app/lib/newsService.ts`의 `toggleLikeNews`(412행~)가 `likes: currentLikedBy.length ± 1`로 카운트를 **클라이언트가 들고 있던 낡은 배열 길이 기준으로 덮어쓴다**. 두 사용자가 비슷한 시점에 좋아요를 누르면 카운트가 소실된다. 캐시(`staleTime: 3분`)를 쓰는 앱이라 낡은 데이터일 확률이 높다.

## 수정해야 할 정확한 파일
| 파일 | 위치 | 작업 |
|---|---|---|
| `app/actions/analyzeNews.ts` | 231행 | `\${combinedText}` → `${combinedText}` |
| `app/lib/newsService.ts` | 412–432행 `toggleLikeNews` | `increment()` 사용으로 교체 |

## 단계별 작업 순서

### 1단계: 헤드라인 프롬프트 수정
`app/actions/analyzeNews.ts` 231행 근처:
```
      [입력 데이터]
      \${combinedText}
```
백슬래시 하나만 제거:
```
      [입력 데이터]
      ${combinedText}
```
그 후 같은 실수가 또 없는지 프로젝트 전체를 검색:
```
grep -rn '\\\${' app/ --include='*.ts' --include='*.tsx'
```
(패턴: 백슬래시 + 달러 + 중괄호. 다른 곳에서도 발견되면 동일하게 수정하되, **의도적으로 리터럴 `${...}`를 출력해야 하는 JSON 예시 부분인지 문맥을 먼저 확인**할 것.)

### 2단계: toggleLikeNews를 atomic increment로 교체
`app/lib/newsService.ts` 상단 import에 `increment` 추가:
```ts
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
  arrayUnion, arrayRemove, increment
} from "firebase/firestore";
```
함수 본문 교체:
```ts
export async function toggleLikeNews(newsId: string, userId: string, currentLikedBy: string[] = []) {
  try {
    const newsRef = doc(db, "news", newsId);
    const isLiked = currentLikedBy.includes(userId);

    if (isLiked) {
      await updateDoc(newsRef, {
        likedBy: arrayRemove(userId),
        likes: increment(-1),
      });
    } else {
      await updateDoc(newsRef, {
        likedBy: arrayUnion(userId),
        likes: increment(1),
      });
    }
  } catch (error) {
    console.error("Error toggling like: ", error);
    throw error;
  }
}
```

### 3단계: 타입 체크 및 빌드 확인
```
npx tsc --noEmit
npm run build
```

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **버그 A에서 프롬프트 문자열 전체를 다시 쓰지 말 것.** 백슬래시 1글자만 지우면 된다. 프롬프트를 재작성하면 출력 규칙(60자 제한, JSON 형식)이 미묘하게 바뀔 수 있다.
- **`\${`가 일반 문자열(`"..."`) 안이라면 이스케이프가 필요 없던 것이고, 백틱 템플릿 리터럴 안이라면 진짜 버그다.** 231행은 백틱 안이므로 버그가 맞다. grep으로 찾은 다른 지점은 각각 백틱 안인지 확인 후 판단.
- **버그 B: `isLiked` 판정은 여전히 클라이언트가 준 `currentLikedBy` 기준**이다. 낡은 캐시로 인해 "이미 좋아요인데 또 arrayUnion" 하는 경우 — `arrayUnion`은 멱등이라 배열은 안전하지만 `increment(1)`이 중복 실행되면 카운트가 배열 길이보다 커질 수 있다. 완벽히 하려면 트랜잭션(`runTransaction`)으로 서버 데이터를 읽고 판정해야 하지만, 이 앱 규모에서는 increment만으로 충분하다. **트랜잭션 리팩터링까지 하려고 범위를 키우지 말 것.**
- `likes`가 음수가 되는 극단 케이스(중복 취소)는 UI에서 `Math.max(0, likes)`로 표시하는 정도면 충분 — 필수 아님.
- `toggleBookmarkNews`는 카운트 필드가 없으므로 수정 불필요. 건드리지 말 것.

## 완료 기준 (직접 검증 방법)
1. `npx tsc --noEmit` && `npm run build` 통과.
2. **버그 A**: `npm run dev` → 대시보드 접속 → 표시되는 트렌드 헤드라인이 최근 2주 실제 뉴스 주제(예: 특정 기업/모델명)와 일치한다. 확실히 확인하려면 `generateTrendHeadline` 안에 `console.log(prompt)`를 임시로 넣고 서버 터미널에서 프롬프트에 뉴스 목록이 실제로 포함되는지 본 뒤 로그 제거.
3. **버그 B**: 브라우저 2개(일반+시크릿, 서로 다른 계정)로 같은 기사에 거의 동시에 좋아요 → Firebase Console에서 해당 문서의 `likes`가 정확히 2이고 `likedBy` 길이와 일치한다.
