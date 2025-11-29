# LLM 벤치마크 인사이트 대시보드

LLM 순위 사이트의 `.mhtml` 파일을 업로드하면 AI가 분석하여 시각화해주는 웹 서비스입니다.

## 기술 스택

- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS (다크 모드 지원)
- **Backend**: Next.js Server Actions
- **Database**: Firebase Firestore
- **AI Model**: Gemini 1.5 Flash
- **Visualization**: Recharts

## 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정해주세요:

```env
# Firebase Configuration
# Firebase Console (https://console.firebase.google.com/)에서 프로젝트 설정 > 일반 탭에서 확인 가능

NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini API Configuration
# Google AI Studio (https://aistudio.google.com/)에서 API 키 발급

GEMINI_API_KEY=your_gemini_api_key_here
```

### Firebase 설정 값 찾는 방법

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 선택 (또는 새 프로젝트 생성)
3. 프로젝트 설정(톱니바퀴 아이콘) > 일반 탭
4. "내 앱" 섹션에서 웹 앱 추가 또는 기존 앱 선택
5. Firebase SDK 설정에서 `firebaseConfig` 객체의 값들을 복사하여 `.env.local`에 입력

## 패키지 설치

필요한 패키지를 설치합니다:

```bash
npm install @google/generative-ai
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
