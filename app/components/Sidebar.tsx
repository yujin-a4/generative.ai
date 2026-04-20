"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MenuType = 'dashboard' | 'news' | 'reports' | 'services';

interface SidebarProps {
  activeMenu: MenuType;
  onMenuChange: (menu: MenuType) => void;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ activeMenu, onMenuChange, isCollapsed = false, onCollapseChange }: SidebarProps) {
  const handleCollapse = () => {
    onCollapseChange?.(!isCollapsed);
  };

  const menuItems = [
    { id: 'dashboard' as MenuType, label: '대시보드', icon: '📊' },
    { id: 'news' as MenuType, label: 'AI 뉴스', icon: '📰' },
    { id: 'services' as MenuType, label: 'AI 서비스', icon: '💻' },
    { id: 'reports' as MenuType, label: 'AI 순위', icon: '🏆' },
  ];

  return (
    <div
      className={`
        fixed left-0 top-0 h-full bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800
        transition-all duration-300 ease-in-out z-30
        ${isCollapsed ? 'w-20' : 'w-64'}
        flex flex-col
      `}
    >
      {/* 사이드바 헤더 */}
      <div className="border-b border-gray-200 dark:border-zinc-800 px-4 py-6">
        <div className="flex items-start justify-between mb-4">
          {!isCollapsed && (
            <div className="flex-1">
              {/* 메인 타이틀: AI Trend Lab */}
              <h1 className="text-2xl font-extrabold mb-2 tracking-tight leading-tight text-gray-900 dark:text-white">
                AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                  Trend
                </span> Lab
              </h1>
              
              {/* 부제 */}
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                함께 만들어 나가는 AI 트렌드 아카이브
              </p>
            </div>
          )}
          <button
            onClick={handleCollapse}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
            aria-label={isCollapsed ? "사이드바 확장" : "사이드바 접기"}
          >
            <span className="text-xl">
              {isCollapsed ? '→' : '←'}
            </span>
          </button>
        </div>
      </div>

      {/* 메뉴 목록 */}
      <nav className="mt-6 px-3 flex-1">
        {menuItems.map((item) => {
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2
                transition-all duration-200
                ${isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }
              `}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="text-base">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="p-6 mb-2 border-t border-gray-200 dark:border-zinc-800">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">YBM AI Lab</p>
          <p className="text-xs text-gray-300 dark:text-gray-500 mt-0.5">Yujin Kang</p>
        </div>
      )}
    </div>
  );
}