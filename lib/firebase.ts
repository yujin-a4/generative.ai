import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase 설정 타입
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// 환경 변수에서 Firebase 설정 가져오기
const getFirebaseConfig = (): FirebaseConfig => {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };

  // 필수 환경 변수 검증
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      'Firebase 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요.'
    );
  }

  return config;
};

// Firebase App 초기화 (싱글톤 패턴)
let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export const initializeFirebase = (): { app: FirebaseApp; db: Firestore } => {
  // 이미 초기화된 앱이 있으면 재사용
  if (getApps().length > 0) {
    app = getApps()[0];
    db = getFirestore(app);
    return { app, db };
  }

  // 새로 초기화
  const config = getFirebaseConfig();
  app = initializeApp(config);
  db = getFirestore(app);

  return { app, db };
};

// Firestore 인스턴스 가져오기
export const getDb = (): Firestore => {
  if (!db) {
    const { db: initializedDb } = initializeFirebase();
    return initializedDb;
  }
  return db;
};

// Firebase App 인스턴스 가져오기
export const getApp = (): FirebaseApp => {
  if (!app) {
    const { app: initializedApp } = initializeFirebase();
    return initializedApp;
  }
  return app;
};

