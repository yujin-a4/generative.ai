"use client";

import { useState, Suspense } from "react";
import ReportTab from "@/app/components/ReportTab";
import NewsTab from "@/app/components/NewsTab/NewsTab";
import LoginButton from "@/app/components/LoginButton";

function MainTabs() {
  const [activeTab, setActiveTab] = useState<'news' | 'reports'>('news');

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
      <header className="relative bg-gradient-to-b from-blue-50/70 to-purple-50/70 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-20 pb-12 px-6 text-center">
        
        {/* 좌측 상단 YBM AI Lab 텍스트 */}
        <div className="absolute top-6 left-6 z-50">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">YBM AI Lab</span>
        </div>

        {/* 우측 상단 로그인 버튼 */}
        <div className="absolute top-6 right-6 z-50">
          <LoginButton />
        </div>

        <div className="relative z-10">
          {/* 메인 타이틀: AI Trend Lab */}
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight text-gray-900 dark:text-white">
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Trend
            </span> Lab
          </h1>
          
          {/* 🌟 [수정] 메인 부제: 함께 만들어 나가는 AI 트렌드 지도 */}
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
            함께 만들어 나가는 AI 트렌드 지도
          </p>
        </div>
      </header>

      <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
        <MainTabs />
      </Suspense>
    </div>
  );
}