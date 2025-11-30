"use client";

import { useState, Suspense } from "react";
// import { useSearchParams } from "next/navigation"; // 👈 [삭제] URL 파라미터 체크 로직 제거
import ReportTab from "@/app/components/ReportTab";
import NewsTab from "@/app/components/NewsTab/NewsTab";
import LoginButton from "@/app/components/LoginButton";
import AuroraBackground from "@/app/components/AuroraBackground"; 

function MainTabs() {
  // 🌟 [강제 수정] 기본 탭을 무조건 'news'로 고정했습니다.
  const [activeTab, setActiveTab] = useState<'news' | 'reports'>('news');

  return (
    <>
      {/* 탭 네비게이션 (깔끔한 기본 스타일 유지) */}
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
      <header className="relative bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-20 pb-12 px-6 text-center overflow-hidden">
        
        {/* 배경 오로라 효과 (마우스 반응형, 연한 색상) */}
        <AuroraBackground />

        {/* 우측 상단 로그인 버튼 */}
        <div className="absolute top-6 right-6 z-50">
          <LoginButton />
        </div>

        <div className="relative z-10">
          {/* 메인 타이틀 */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">
              AI
            </span> Insight
          </h1>
          
          {/* 부제 */}
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
            YBM AI Lab 여러분들을 위한 <br className="md:hidden"/>
            실시간 <span className="text-gray-800 dark:text-gray-200 font-bold">에듀테크 & AI 트렌드</span> 큐레이션
          </p>
        </div>
      </header>

      <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
        <MainTabs />
      </Suspense>
    </div>
  );
}