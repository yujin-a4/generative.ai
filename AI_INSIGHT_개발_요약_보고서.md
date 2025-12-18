# AI Insight - 서비스 개발 요약 보고서

## 📋 서비스 개요

**서비스명**: AI Insight  
**URL**: https://ai-insight-yj.vercel.app/  
**목적**: YBM AI Lab 팀을 위한 실시간 에듀테크 & AI 트렌드 큐레이션 플랫폼  
**핵심 기능**: AI 뉴스 수집 → Gemini가 요약 → 주간/월간 리포트 자동 생성

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Auth (Google 로그인) |
| AI | Google Gemini API (gemini-2.0-flash-exp) |
| 상태 관리 | React Query (@tanstack/react-query) |
| 배포 | Vercel |

---

## 📁 프로젝트 구조

```
app/
├── page.tsx                    # 메인 페이지 (Client Component)
├── layout.tsx                  # 루트 레이아웃 (QueryProvider 포함)
├── globals.css
├── actions/
│   ├── analyze.ts              # 뉴스 분석 (Gemini)
│   ├── analyzeNews.ts          # 뉴스 상세 분석
│   ├── generateWeeklySummary.ts   # 주간 요약 생성
│   └── generateMonthlySummary.ts  # 월간 요약 생성
├── components/
│   ├── NewsTab/
│   │   ├── NewsTab.tsx         # 메인 탭 컨테이너
│   │   ├── NewsTimeline.tsx    # 타임라인 뷰 (메인)
│   │   ├── CategoryView.tsx    # 카테고리별 뷰
│   │   ├── BookmarkView.tsx    # 즐겨찾기 뷰
│   │   ├── NewsList.tsx        # 뉴스 목록 (React Query 캐싱)
│   │   ├── NewsCard.tsx        # 뉴스 카드 컴포넌트
│   │   ├── NewsDetailModal.tsx # 뉴스 상세 모달
│   │   ├── NewsSubmitModal.tsx # 뉴스 등록/수정 모달
│   │   ├── NewsLoading.tsx     # 로딩 화면 (귀여운 UI)
│   │   ├── SummaryModal.tsx    # 주간/월간 요약 팝업
│   │   ├── WeeklySummary.tsx   # 주간 요약 (기존, 일부 사용)
│   │   ├── WeeklySummaryEditModal.tsx
│   │   ├── FilterDropdowns.tsx # 드롭다운 필터들
│   │   ├── CategoryFilter.tsx
│   │   ├── SearchBar.tsx
│   │   └── ...
│   ├── ReportTab.tsx           # AI 순위 탭
│   ├── LoginButton.tsx
│   └── QueryProvider.tsx       # React Query Provider
├── lib/
│   ├── firebase.ts             # Firebase 설정
│   ├── newsService.ts          # Firestore CRUD 함수들
│   ├── newsCategories.ts       # 카테고리 정의
│   └── searchUtils.ts          # 검색 유틸리티
└── report/[id]/page.tsx        # 리포트 상세 페이지
```

---

## 🗄️ Firebase 컬렉션 구조

### 1. `news` (뉴스)
```typescript
{
  id: string;
  url: string;
  title: string;
  source: string;
  shortSummary: string;
  detailedSummary: string[];
  insight: string;
  category: string;  // "에듀테크 x AI", "AI 기술", "AI 서비스/플랫폼" 등
  tags: string[];
  publishedAt: Timestamp;
  createdAt: Timestamp;
  views: number;
  likes: number;
  likedBy: string[];      // 좋아요 누른 유저 ID
  bookmarkedBy: string[]; // 즐겨찾기한 유저 ID
  authorId: string;
  isVisible: boolean;
}
```

### 2. `weekly_summaries` (주간 요약)
```typescript
{
  id: string;
  week_label: string;     // "11월 4주차"
  summary: string;        // 헤드라인 제목
  trends: [
    { keyword: string, desc: string }
  ];
  top_picks: [
    { title: string, reason: string }
  ];
  period_start: Timestamp;
  period_end: Timestamp;
  created_at: Timestamp;
  isPublished: boolean;   // 공개 여부 (관리자 확인 후 공개)
}
```

### 3. `monthly_summaries` (월간 요약)
```typescript
{
  id: string;
  month_label: string;    // "2025년 11월"
  year: number;
  month: number;
  summary: string;
  trends: [...];
  top_picks: [...];
  category_highlights: [
    { category: string, summary: string }
  ];
  period_start: Timestamp;
  period_end: Timestamp;
  created_at: Timestamp;
  isPublished: boolean;
}
```

---

## 👤 권한 시스템

### 관리자
- **이메일**: yujinkang1008@gmail.com (하드코딩)
- **권한**:
  - 뉴스 등록/수정/삭제
  - 주간/월간 요약 생성 (Gemini API)
  - 요약 수정/삭제
  - 요약 공개하기 (isPublished: true로 변경)

### 일반 사용자
- 뉴스 보기
- 좋아요/즐겨찾기
- 공개된 요약만 보기

---

## 🎨 UI 구조 (최종)

### 탭 구조
```
[📅 타임라인] [📂 카테고리별] [⭐ 즐겨찾기]
```

### 1. 타임라인 뷰 (메인)
- 월별로 그룹핑 (접기/펼치기 가능)
- 그 안에 주별로 그룹핑
- 각 월/주 옆에 "📊 월간요약" / "📊 주간요약" 버튼
- 클릭 시 팝업 모달로 요약 표시
- 검색창 (오른쪽 정렬)

```
▼ 2025년 11월 (8개)                [📊 월간요약]
   ● 4째주 (3개)                   [📊 주간요약]
     [카드] [카드] [카드]
   ● 3째주 (5개)                   [📊 주간요약]
     [카드] [카드] ...
     
▶ 2025년 10월 (접힘)               [📊 월간요약]
```

### 2. 카테고리별 뷰
- 상단에 카테고리 버튼 크게 배치
- 기간/정렬 드롭다운
- 한 줄에 4개 카드

### 3. 즐겨찾기 뷰
- 로그인 필요
- 북마크한 뉴스 목록

---

## ⚡ 성능 최적화 (적용 완료)

### 1. React Query 캐싱
- `staleTime: 3분` - 3분간 캐시 유지
- `gcTime: 30분` - 30분간 가비지 컬렉션 방지
- `refetchOnWindowFocus: false` - 탭 전환 시 재요청 방지

### 2. 로딩 UX 개선
- 귀여운 로딩 화면 (`NewsLoading.tsx`)
```
🤖 (통통 튀는 애니메이션)
최신 AI 뉴스를 가져오는 중이에요
첫 로딩만 조금 느려요. 잠시만 기다려 주세요!
━━━━━━━━━━━━━━━━━━━ (프로그레스 바)
```

---

## 📦 주요 의존성

```json
{
  "@tanstack/react-query": "^5.x",
  "firebase": "^10.x",
  "@google/generative-ai": "^0.x",
  "next": "14.x",
  "tailwindcss": "^3.x"
}
```

---

## 🔧 환경 변수

```env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
# ... 기타 Firebase 설정
```

---

## 📝 최근 개발 내역 (이번 세션)

1. **성능 최적화**
   - React Query 도입으로 데이터 캐싱
   - 탭 전환 시 즉시 로드

2. **UI 정리**
   - 필터를 드롭다운으로 변경 (한 줄로 정리)
   - 타임라인을 메인 뷰로 변경
   - 주간요약 탭 제거 → 타임라인 내 팝업으로 통합

3. **타임라인 뷰 개선**
   - 월별 접기/펼치기
   - 주별 그룹핑
   - 월간/주간 요약 버튼 추가

4. **요약 시스템**
   - 월간 요약 기능 추가 (Gemini API)
   - 생성 시 비공개 → 관리자 확인 후 공개
   - 삭제 기능 추가

5. **로딩 UX**
   - 귀여운 로딩 화면 추가

---

## 🚀 향후 개선 아이디어

- 다크모드 토글 버튼
- 뉴스 공유 기능 (카카오톡, 링크 복사)
- 뉴스 카드 호버 효과
- 맨 위로 가기 버튼
- 무한 스크롤
- Server Component로 첫 로딩 개선 (미적용 상태)

---

## 📌 참고사항

- 모든 파일은 `"use client"` 또는 `"use server"` 지시문 사용
- 관리자 이메일은 하드코딩 (보안상 환경변수로 이동 권장)
- Firebase 인덱스 설정 필요 (복합 쿼리 사용 시)
