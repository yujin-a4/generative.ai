"use client";

import { useState, Suspense, useEffect } from "react";
import ReportTab from "@/app/components/ReportTab";
import NewsTab from "@/app/components/NewsTab/NewsTab";
import ServiceTab from "@/app/components/ServiceTab/ServiceTab";
import LoginButton from "@/app/components/LoginButton";
import Sidebar, { MenuType } from "@/app/components/Sidebar";
import Dashboard from "@/app/components/Dashboard";
import LandingScreen from "@/app/components/LandingScreen";

function MainContent() {
  const [showLanding, setShowLanding] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 로컬 스토리지에서 랜딩 화면 표시 여부 확인
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('hasSeenLanding');
    if (hasSeenLanding === 'true') {
      setShowLanding(false);
    }
  }, []);

  const handleEnter = () => {
    localStorage.setItem('hasSeenLanding', 'true');
    setShowLanding(false);
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <Dashboard onMenuChange={setActiveMenu} />;
      case 'news':
        return <NewsTab />;
      case 'services':
        return <ServiceTab />;
      case 'reports':
        return <ReportTab />;
      default:
        return <Dashboard onMenuChange={setActiveMenu} />;
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
          onMenuChange={setActiveMenu}
          isCollapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
        />

        {/* 메인 컨텐츠 영역 */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          {/* 우측 상단 로그인 버튼 */}
          <div className="fixed top-6 right-6 z-50">
            <LoginButton />
          </div>

          {/* 컨텐츠 */}
          <main className="pb-20 pt-6">
            <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  return <MainContent />;
}