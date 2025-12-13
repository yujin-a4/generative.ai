# AI 툴 등록 문제 해결 가이드

## 🔍 문제 분석

### 1. Firestore 인덱스 에러 (해결됨 ✅)
- **문제**: `weekly_summaries`와 `monthly_summaries`에서 `where`와 `orderBy`를 함께 사용할 때 인덱스 필요
- **해결**: 클라이언트 사이드에서 필터링 및 정렬하도록 변경 (인덱스 불필요)

### 2. AI 툴 등록 후 목록에 안 나타나는 문제

## 📋 확인해야 할 사항

### 1. Firebase 콘솔에서 확인
1. Firebase Console → Firestore Database 열기
2. `ai_services` 컬렉션이 있는지 확인
3. 등록한 서비스가 실제로 저장되었는지 확인
   - 문서가 있다면: 조회 로직 문제
   - 문서가 없다면: 저장 로직 문제

### 2. 브라우저 콘솔에서 확인
등록 시 다음 로그가 출력되는지 확인:
- `"서비스 생성 시도: ..."`
- `"서비스 생성 성공, ID: ..."`
- `"서비스 목록 조회 시작"`
- `"총 X개 문서 발견"`
- `"필터링 후 X개 서비스"`

### 3. Firestore 보안 규칙 확인
Firebase Console → Firestore Database → 규칙 탭에서:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ai_services 컬렉션 읽기/쓰기 허용
    match /ai_services/{document=**} {
      allow read: if true;  // 모든 사용자 읽기 허용
      allow write: if true; // 모든 사용자 쓰기 허용 (나중에 인증 필요 시 수정)
    }
  }
}
```

### 4. 데이터 구조 확인
등록된 문서가 다음과 같은 구조인지 확인:
```javascript
{
  name: "서비스명",
  category: "LLM",
  description: "설명",
  url: "https://...",
  isPublished: true,  // ← 이 필드가 true여야 함
  createdAt: Timestamp,
  updatedAt: Timestamp,
  likes: 0,
  likedBy: [],
  // ... 기타 필드
}
```

## 🛠️ 문제 해결 단계

### Step 1: 브라우저 콘솔 확인
1. 브라우저 개발자 도구(F12) 열기
2. Console 탭에서 에러 메시지 확인
3. 서비스 등록 시 로그 확인

### Step 2: Firebase 콘솔 확인
1. Firebase Console 접속
2. Firestore Database → ai_services 컬렉션 확인
3. 데이터가 있는지, `isPublished` 필드가 `true`인지 확인

### Step 3: 수동 테스트
브라우저 콘솔에서 직접 테스트:
```javascript
// Firestore에 직접 쿼리 (개발 환경에서만)
// 이 코드는 실제로 사용하지 마세요, 확인용입니다
```

## 📝 추가 정보 필요
문제를 해결하려면 다음 정보를 알려주세요:

1. **브라우저 콘솔 로그**: 서비스 등록 시 나타나는 모든 로그
2. **Firebase 콘솔 스크린샷**: `ai_services` 컬렉션의 데이터
3. **에러 메시지**: 브라우저 콘솔에 나타나는 모든 에러
4. **Firestore 규칙**: 현재 설정된 보안 규칙

## 🔧 임시 해결책

만약 계속 문제가 발생한다면:

1. **하드 리프레시**: Ctrl+Shift+R (Windows) 또는 Cmd+Shift+R (Mac)
2. **브라우저 캐시 삭제**: 개발자 도구 → Application → Clear storage
3. **Firebase 재연결**: 로그아웃 후 재로그인
4. **수동 새로고침**: 목록 페이지에서 새로고침 버튼 클릭

