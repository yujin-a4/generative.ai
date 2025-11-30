"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReportTab from "@/app/components/ReportTab";
import NewsTab from "@/app/components/NewsTab/NewsTab";
import LoginButton from "@/app/components/LoginButton";

function MainTabs() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'reports' ? 'reports' : 'news';
  const [activeTab, setActiveTab] = useState<'news' | 'reports'>(initialTab);

  return (
    <>
      {/* 탭 네비게이션 */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto flex">
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-4 text-center font-bold text-lg transition-colors border-b-2 
              ${activeTab === 'news' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
          >
            📰 AI 뉴스
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-4 text-center font-bold text-lg transition-colors border-b-2
              ${activeTab === 'reports' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
          >
            📊 생성형 AI 순위
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <main className="min-h-screen bg-gray-50 dark:bg-black font-sans pb-20">
        {activeTab === 'news' ? <NewsTab /> : <ReportTab />}
      </main>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black font-sans">
      {/* 헤더 (로그인 버튼 배치) */}
      <header className="relative bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-16 pb-8 px-6 text-center">
        
        {/* 우측 상단 로그인 버튼 (절대 위치) */}
        <div className="absolute top-6 right-6 z-50">
          <LoginButton />
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
          AI Service Insight 🧠
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Gemini와 함께하는 AI 트렌드 큐레이션 & 성능 리포트
        </p>
      </header>

      <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
        <MainTabs />
      </Suspense>
    </div>
  );
}