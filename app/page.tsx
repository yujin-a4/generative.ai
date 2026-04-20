"use client";

import { useState, Suspense, useEffect } from "react";
import ReportTab from "@/app/components/ReportTab";
import NewsTab from "@/app/components/NewsTab/NewsTab";
import ServiceTab from "@/app/components/ServiceTab/ServiceTab";
import LoginButton from "@/app/components/LoginButton";
import Sidebar, { MenuType } from "@/app/components/Sidebar";
import Dashboard from "@/app/components/Dashboard";
import LandingScreen from "@/app/components/LandingScreen";
import ThemeToggle from "@/app/components/ThemeToggle";
import FeedbackModal from "@/app/components/FeedbackModal";

function MainContent() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // 🌟 [추가] 뉴스 탭의 초기 뷰를 결정하는 상태
  const [newsInitialView, setNewsInitialView] = useState<string | undefined>(undefined);

  // 로컬 스토리지에서 랜딩 화면 표시 여부 확인
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('hasSeenLanding');
    if (hasSeenLanding === 'true') {
      setShowLanding(false);
    }
    // 페이지 초기 로드 시 항상 최상단으로
    window.scrollTo(0, 0);
  }, []);

  const handleEnter = () => {
    localStorage.setItem('hasSeenLanding', 'true');
    setShowLanding(false);
  };

  // 🌟 [추가] 대시보드에서 보낸 'timeline' 정보를 처리하는 핸들러
  const handleMenuChange = (menu: MenuType, subView?: string) => {
    setActiveMenu(menu);
    window.scrollTo(0, 0);
    if (menu === 'news') {
      setNewsInitialView(subView);
    } else {
      setNewsInitialView(undefined);
    }
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard onMenuChange={handleMenuChange} />; // 🌟 setActiveMenu 대신 handleMenuChange 사용
      case 'news':
        return <NewsTab initialView={newsInitialView as any} />; // 🌟 초기 뷰 값 전달
      case 'services':
        return <ServiceTab />;
      case 'reports':
        return <ReportTab />;
      default:
        return <Dashboard onMenuChange={handleMenuChange} />;
    }
  };

  return (
    <>
      {/* 진입 화면 */}
      {showLanding && <LandingScreen onEnter={handleEnter} />}

      {/* 메인 앱 */}
      <div className={`flex min-h-screen bg-gray-50 dark:bg-black font-sans transition-all duration-500 ${showLanding ? 'opacity-0' : 'opacity-100'}`}>
        {/* 사이드바 */}
        <Sidebar
          activeMenu={activeMenu}
          onMenuChange={handleMenuChange}
          isCollapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
        />

        {/* 메인 컨텐츠 영역 */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          {/* 우측 상단 — 테마 토글 + 로그인 */}
          <div className="fixed top-4 right-6 z-50 flex items-center gap-2">
            <ThemeToggle />
            <LoginButton />
          </div>

          {/* 컨텐츠 */}
          <main className="pb-12 pt-4">
            <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </div>

      {/* 피드백 플로팅 버튼 */}
      {!showLanding && (
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-full shadow-lg border border-gray-200 dark:border-zinc-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 dark:hover:bg-indigo-600 dark:hover:border-indigo-600 transition-all duration-200 group text-sm font-bold hover:-translate-y-0.5 hover:shadow-xl"
          title="오류 제보 또는 건의사항"
        >
          <span className="text-base group-hover:scale-110 transition-transform">📬</span>
          <span>의견 보내기</span>
        </button>
      )}

      {/* 피드백 모달 */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </>
  );
}

export default function HomePage() {
  return <MainContent />;
}