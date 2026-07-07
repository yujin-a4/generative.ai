# PLAN: AI 순위 리포트 소스 현행화 — 정체된 소스를 AA API 자동 수집으로 대체 (권장 실행 시점: PLAN-secure-endpoints, PLAN-fix-known-bugs 다음)

## 목표
AI 순위 리포트(6개 분야)의 데이터 소스 중 **업데이트가 멈췄거나 느린 소스를 Artificial Analysis(AA) API 자동 수집으로 대체**한다.

**절대 원칙: LMArena 수동 붙여넣기 소스는 전부 그대로 유지한다.** (사용자 결정 사항. LMArena는 공식 API가 없고, 현재 수집 방식을 계속 쓴다. URL 문자열만 최신으로 갱신.)

대체 대상과 근거:
| 분야 | 현재 소스 | 문제 | 대체 |
|---|---|---|---|
| LLM | LiveBench 복붙 | 갱신 주기 느림 | AA `/data/llms/models` API (지능·코딩·수학 지수, 속도, 가격) |
| 영상 | VBench 복붙 | 최신 모델(Veo·Sora 등) 미반영, 사실상 정체 | AA `/data/media/text-to-video` + `/image-to-video` API |
| 코딩 | Aider 리더보드 복붙 | 업데이트 중단 | 소스 제거, AA LLM 데이터의 coding index로 대체 |
| 이미지 | AA 페이지 복붙 (선택 소스) | 수동 | AA `/data/media/text-to-image` API |
| TTS | 이미 API 자동 (`fetchTTSEloFromAPI`) | — | 변경 없음 (이 패턴을 다른 분야로 확장하는 것이 이 PLAN의 핵심) |
| STT | AA 페이지 복붙 | — | **유지.** `/data/media/speech-to-text` 엔드포인트는 존재하지 않음 (2026-07-07 확인: HTTP 404) |

**엔드포인트 존재 검증 완료 (2026-07-07, 무인증 프로브 — 존재하면 401, 없으면 404):**
```
llms/models          -> 401 (존재)
media/text-to-image  -> 401 (존재)
media/image-editing  -> 401 (존재)
media/text-to-video  -> 401 (존재)
media/image-to-video -> 401 (존재)
media/text-to-speech -> 401 (존재, 이미 사용 중)
media/speech-to-text -> 404 (없음 — STT는 복붙 유지)
```

추가 목표: 리포트 저장 시 **직전 리포트와의 순위 변동(↑↓·NEW)을 계산해 저장**하여 "매번 비교하며 보기"를 가능하게 한다.

## 수정해야 할 정확한 파일
| 파일 | 작업 |
|---|---|
| `.env.local` | **`ARTIFICIAL_ANALYSIS_API_KEY` 추가 — 현재 로컬에 없음!** (Vercel에만 설정되어 있어 로컬 개발 시 TTS 자동 수집이 이미 실패하고 있을 것) |
| `app/actions/analyze.ts` | ① 범용 `fetchAAData()` 서버 액션 추가 ② LLM/Video/Code 프롬프트의 Source 정의 수정 ③ `computeRankDeltas()` 추가 및 저장 로직에 연결 |
| `app/admin/page.tsx` | `REPORT_CONFIG`(24–101행) 수정: 대체되는 소스를 "자동 수집" 소스로 교체, Aider 소스 삭제, LMArena URL 갱신. 자동 수집 버튼 UI 추가(기존 TTS 패턴 복제) |
| `app/admin/ReportViewGeneric.tsx` (및 필요시 `ReportViewLLM.tsx`) | 순위 변동 배지(↑2/↓1/NEW) 표시 |

## 단계별 작업 순서

### 0단계: 로컬 API 키 설정 (필수 선행)
1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 `ARTIFICIAL_ANALYSIS_API_KEY` 값을 복사하거나, https://artificialanalysis.ai/api 에서 키 발급.
2. `.env.local`에 `ARTIFICIAL_ANALYSIS_API_KEY=<키>` 추가. dev 서버 재시작.
3. 동작 확인: `curl -s -H "x-api-key: <키>" "https://artificialanalysis.ai/api/v2/data/llms/models" | head -c 500` → JSON이 나오면 OK.

### 1단계: 범용 AA 수집 함수 추가
`app/actions/analyze.ts`의 `fetchTTSEloFromAPI`(13–29행) 바로 아래에 추가. 기존 TTS 함수는 **건드리지 말 것** (호출부가 있음).

```ts
// 허용된 AA 엔드포인트만 호출 (allowlist — 임의 URL 호출 방지)
const AA_ENDPOINTS = {
  llms:  'llms/models',
  t2i:   'media/text-to-image',
  ie:    'media/image-editing',
  t2v:   'media/text-to-video',
  i2v:   'media/image-to-video',
} as const;

export async function fetchAAData(
  kind: keyof typeof AA_ENDPOINTS
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return { success: false, error: 'ARTIFICIAL_ANALYSIS_API_KEY가 설정되지 않았습니다.' };
  const path = AA_ENDPOINTS[kind];
  if (!path) return { success: false, error: `알 수 없는 endpoint: ${kind}` };
  try {
    const res = await fetch(`https://artificialanalysis.ai/api/v2/data/${path}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) return { success: false, error: `AA API 오류: ${res.status} ${res.statusText}` };
    const json = await res.json();
    return { success: true, data: json.data || [] };
  } catch (e) {
    return { success: false, error: `AA API 호출 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}` };
  }
}
```

### 2단계: 응답 압축 함수 추가 (토큰 폭발 방지 — 중요)
AA 응답은 수백 개 모델 × 수십 필드라 그대로 프롬프트에 넣으면 토큰이 폭발한다. Gemini에 넘기기 전에 **코드에서 상위 N개·필요 필드만 추려서** 문자열로 만든다. `analyze.ts`에 추가:

```ts
/** AA 응답을 프롬프트용 요약 JSON 문자열로 압축 */
export async function compactAAData(kind: string, data: any[]): Promise<string> {
  // 실제 필드명은 0단계 curl 응답에서 확인해 아래 후보 중 존재하는 것으로 맞출 것
  const pick = (o: any, keys: string[]) =>
    Object.fromEntries(keys.filter(k => o?.[k] !== undefined).map(k => [k, o[k]]));

  let rows: any[] = [];
  if (kind === 'llms') {
    rows = [...data]
      .sort((a, b) => (b.artificial_analysis_intelligence_index ?? b.intelligence_index ?? 0)
                    - (a.artificial_analysis_intelligence_index ?? a.intelligence_index ?? 0))
      .slice(0, 20)
      .map(m => pick(m, [
        'name', 'model_creator', 'creator',
        'artificial_analysis_intelligence_index', 'intelligence_index',
        'artificial_analysis_coding_index', 'coding_index',
        'artificial_analysis_math_index', 'math_index',
        'median_output_tokens_per_second', 'output_tokens_per_second',
        'price_1m_input_tokens', 'price_1m_output_tokens', 'price_1m_blended_3_to_1',
      ]));
  } else {
    // 미디어 계열: ELO 내림차순 Top 15
    rows = [...data]
      .sort((a, b) => (b.elo ?? b.quality_elo ?? 0) - (a.elo ?? a.quality_elo ?? 0))
      .slice(0, 15)
      .map(m => pick(m, ['name', 'model_creator', 'creator', 'elo', 'quality_elo', 'rank', 'release_date']));
  }
  return JSON.stringify(rows, null, 1);
}
```
> `"use server"` 파일이므로 export 함수는 async여야 한다. 필드명 후보가 실제 응답과 다르면 0단계 curl 출력을 보고 수정할 것 — **추측으로 두지 말고 반드시 실제 응답 키와 대조.**

### 3단계: `REPORT_CONFIG` 수정 (`app/admin/page.tsx` 24–101행)
- **LLM**: `{ id: "test", name: "LiveBench (Test)", ... }` → `{ id: "llm_aa_auto", name: "AA LLM 지수 (자동 수집)", url: "https://artificialanalysis.ai/models", desc: "자동 수집 버튼 클릭. 지능·코딩·수학 지수 + 속도·가격." }`. **LMSYS 7개 소스(vote_*)는 한 글자도 바꾸지 말 것** (URL만 아래 URL 갱신 규칙 적용).
- **Video**: `{ id: "video_test", name: "VBench 2.0 (정량)", ... }` → `{ id: "video_aa_auto", name: "AA Video ELO (자동 수집)", url: "https://artificialanalysis.ai/text-to-video/arena", desc: "자동 수집 버튼 클릭. T2V + I2V ELO." }`. LMArena 3개 소스 유지. 기존 `aa_video`(복붙 선택) 소스는 삭제 (자동 수집에 포함되므로).
- **Code**: `code_aider` 소스 **삭제**. `{ id: "code_aa_auto", name: "AA Coding Index (자동 수집)", ... }` 추가. `code_swe`(SWE-bench — 아직 갱신됨)와 LMArena WebDev 4개 소스 유지.
- **Image**: LMArena 10개 소스 유지. `aa_image`(복붙 선택) → `{ id: "image_aa_auto", name: "AA T2I ELO (자동 수집)", ... }`로 교체.
- **TTS / STT**: 변경 없음.
- **LMArena URL 갱신** (수집 방식은 그대로, 주소만): `https://lmarena.ai/?leaderboard` → `https://lmarena.ai/leaderboard`. desc 문구는 유지.

### 4단계: 자동 수집 버튼 UI
`app/admin/page.tsx`에서 `fetchTTSEloFromAPI`가 어떻게 쓰이는지 grep으로 찾아(TTS 리포트 생성 흐름, 약 315행 부근에서 `inputs["tts_api_elo"]` 사용) **그 패턴을 그대로 복제**한다:
- source id가 `_aa_auto`로 끝나는 소스는 textarea 대신 "🔄 자동 수집" 버튼 + 수집 결과 미리보기(모델 수, 첫 3개 이름)를 렌더.
- 버튼 클릭 → `fetchAAData(kind)` → `compactAAData(kind, data)` → 결과 문자열을 `inputs[source.id]`에 저장 (기존 붙여넣기와 동일한 저장 위치를 쓰므로 이후 흐름 수정 불필요).
- Video는 버튼 1개가 `t2v`와 `i2v`를 둘 다 호출해 `{ "text_to_video": [...], "image_to_video": [...] }` 형태로 합쳐 저장.
- Code는 `llms` 데이터에서 coding index 기준 정렬본을 저장 (compactAAData에 `kind === 'code'` 분기를 추가해 coding index 내림차순 Top 20으로).

### 5단계: Gemini 프롬프트의 Source 정의 수정 (`app/actions/analyze.ts`)
프롬프트는 "붙여넣은 표"든 "AA JSON"이든 동일하게 텍스트로 받으므로 구조 변경은 소스 설명부만:
- **LLM 프롬프트** (131행~): `Source 1 (LiveBench)` → `Source 1 (AA LLM 지수 JSON)`으로 바꾸고, [규칙 1]을 다음으로 교체: "Source 1은 JSON 배열이다. intelligence index 내림차순 Top 10 → total_ranking. coding index → sub_categories.coding_index, math index → sub_categories.math… (기존 출력 스키마 필드명은 절대 바꾸지 말 것 — ReportView가 그 스키마를 렌더링한다)". LMSYS 관련 규칙(Source 2~8)은 그대로.
- **Video 프롬프트** (297행~): `Source 1 (VBench 2.0)` → `Source 1 (AA Video ELO JSON: text_to_video + image_to_video)`. [규칙 1]을 "text_to_video ELO 내림차순 Top 10 → test_benchmarks.total_ranking" 방식으로 교체. VBench 세부 24개 카테고리 규칙은 삭제하되 **출력 JSON 스키마의 키 자체는 유지하고 빈 배열로 채우게** 할 것 (ReportView 크래시 방지).
- **Code 프롬프트** (537행~): Source 2 (Aider) 규칙 삭제 → Source 2 = AA Coding Index JSON으로 교체. `sub_categories.aider` 출력 키는 스키마 유지 차원에서 빈 배열로.

### 6단계: 순위 변동(델타) 계산
`analyze.ts`의 리포트 저장 함수(파일 뒷부분 — `addDoc(collection(db, 'reports')...` 하는 곳을 찾을 것)에서 저장 직전에:
```ts
function normalizeModelName(n: string): string {
  return (n || '').toLowerCase().replace(/[^a-z0-9가-힣.]/g, '');
}
/** 같은 report_type의 직전 리포트와 비교해 순위 변동 계산 */
function computeRankDeltas(prevItems: any[], currItems: any[]): Record<string, number | 'NEW'> {
  const prevRank = new Map(prevItems.map((it, i) => [normalizeModelName(it.model || it.name), i + 1]));
  const deltas: Record<string, number | 'NEW'> = {};
  currItems.forEach((it, i) => {
    const key = normalizeModelName(it.model || it.name);
    const prev = prevRank.get(key);
    deltas[key] = prev === undefined ? 'NEW' : prev - (i + 1); // 양수 = 상승
  });
  return deltas;
}
```
- 직전 리포트 조회: `reports` 컬렉션에서 같은 `report_type` 최신 1건 (기존 `getAllReports` 참고).
- `vote_rankings.overall.items`와 `test_benchmarks.total_ranking` 두 목록에 대해 각각 계산해 `analysis_result.rank_deltas = { overall: {...}, test: {...} }`로 저장.
- 표시: `ReportViewGeneric.tsx`의 순위 테이블 행 렌더링 부분에서 `rank_deltas`가 있으면 모델명 옆에 `▲2`(초록)/`▼1`(빨강)/`NEW`(파랑) 배지. 델타가 없거나 0이면 아무것도 표시하지 않음.

### 7단계: 검증
`npx tsc --noEmit && npm run build`, 이후 아래 완료 기준 수행.

## 성능이 낮은 모델이 놓칠 수 있는 엣지 케이스
- **LMArena 소스를 "개선"하려 들지 말 것.** 이 PLAN의 명시적 제약이다. LMArena 관련 textarea·프롬프트 규칙·파싱 로직은 URL 문자열 갱신 외에 일절 수정 금지.
- **출력 JSON 스키마(필드명)는 소스가 바뀌어도 유지해야 한다.** `ReportViewGeneric.tsx`(1,174줄)와 `calculateVideoManufacturerRanking`(analyze.ts 66행)이 `test_benchmarks.total_ranking` 등 기존 키를 읽는다. 소스 교체는 "그 키에 들어가는 데이터의 출처"만 바꾸는 것.
- **AA 필드명은 추측 금지.** 2단계 후보 목록은 참고용이다. 0단계 curl로 실제 응답을 덤프해 키 이름을 확정하고 코드에 반영할 것. (예: 가격 필드가 `pricing.price_1m_input_tokens`처럼 중첩 객체일 수 있다 — 그 경우 pick 함수로는 못 꺼내니 명시적 매핑 필요.)
- **AA 응답을 압축 없이 프롬프트에 넣으면** 수십만 토큰이 되어 Gemini 호출이 실패하거나 비용이 튄다. 반드시 2단계 압축을 거칠 것.
- **`fetchAAData`는 `"use server"` 액션이라 공개 엔드포인트다.** allowlist(`AA_ENDPOINTS`)를 제거하거나 `kind`를 URL 조립에 직접 쓰면 SSRF가 된다. PLAN-secure-endpoints 적용 후라면 관리자 검증도 추가 권장 (API 무료 티어 1,000req/일 소진 공격 방지).
- **레이트 리밋**: 무료 티어 1,000req/일. 자동 수집 버튼을 연타해도 문제없는 수준이지만, 버튼에 로딩 상태(중복 클릭 방지)를 넣을 것 — 기존 TTS 버튼 패턴에 이미 있다면 그대로 복제.
- **델타 계산의 모델명 정규화**: 리포트마다 Gemini가 모델명을 미묘하게 다르게 쓸 수 있다("Gemini 2.5 Pro" vs "gemini-2.5-pro-preview"). `normalizeModelName`으로도 못 잡는 경우 델타가 NEW로 잘못 표시될 수 있다 — 이는 허용되는 열화이며, 완벽 매칭을 위해 별도 AI 호출을 추가하지 말 것 (비용·복잡도 대비 이득 없음).
- **첫 리포트(직전 리포트 없음)**: `rank_deltas`를 아예 저장하지 않거나 빈 객체로. UI는 없으면 배지를 렌더하지 않으므로 안전.
- **STT에 `/data/media/speech-to-text`를 시도하지 말 것.** 404 확인됨. AA가 나중에 추가하면 그때 1단계 allowlist에 한 줄 추가하면 된다.
- **기존 저장된 리포트와의 호환**: 옛 리포트에는 `rank_deltas`가 없다. ReportView에서 `analysis_result.rank_deltas?.overall?.[key]`처럼 전부 옵셔널 체이닝으로 접근할 것.
- **TTS의 `fetchTTSEloFromAPI`를 `fetchAAData('tts')`로 통합하고 싶어질 수 있다** — 하지 말 것. 동작 중인 코드이고 이 PLAN 범위 밖이다.

## 완료 기준 (직접 검증 방법)
1. `.env.local`에 AA 키 설정 후 `npm run dev` → `/admin` → LLM 리포트 생성 화면에서 "자동 수집" 버튼 클릭 → 몇 초 내 "모델 N개 수집됨" 미리보기가 뜬다 (N ≥ 15).
2. LMSYS 카테고리 textarea들은 **이전과 완전히 동일하게** 표시되고, 표를 붙여넣는 기존 방식이 그대로 동작한다.
3. LLM 리포트 생성 → 리포트 상세에서 정량 순위(test_benchmarks)가 AA 지능지수 기준으로 나오고, 최신 모델(현 시점 최신 프론티어 모델)이 포함되어 있다 — LiveBench 시절 리포트에 없던 모델이 보이면 성공.
4. Video 리포트 생성 → VBench 붙여넣기 없이 생성이 완료되고, 영상 순위에 최신 영상 모델이 포함된다.
5. Code 리포트 생성 화면에 Aider 입력칸이 없고, 생성된 리포트가 에러 없이 렌더된다 (aider 섹션은 빈 상태로 숨겨지거나 표시 안 됨).
6. 같은 분야 리포트를 두 번 생성(며칠 간격 또는 즉시 재생성) → 두 번째 리포트의 순위 테이블에 ▲/▼/NEW 배지가 표시된다. 첫 리포트에는 배지가 없다.
7. 옛날(이번 변경 전) 리포트를 열어도 크래시 없이 그대로 보인다.
8. `npx tsc --noEmit && npm run build` 통과.
