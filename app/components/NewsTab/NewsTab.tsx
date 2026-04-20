"use client";

import { useState, useEffect } from "react";
import NewsSubmitModal from "./NewsSubmitModal";
import NewsTimeline from "./NewsTimeline";
import CategoryView from "./CategoryView";
import BookmarkView from "./BookmarkView";
import NewsDetailModal from "./NewsDetailModal";
import { NewsArticle } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";

// 🌟 [수정] Props 인터페이스 정리
interface NewsTabProps {
  initialView?: "timeline" | "category" | "bookmarks";
}

export default function NewsTab({ initialView }: NewsTabProps) {
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [editTarget, setEditTarget] = useState<NewsArticle | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // initialView 정보가 있으면 해당 모드로 초기화 (기본값: timeline)
  const [viewMode, setViewMode] = useState<"timeline" | "category" | "bookmarks">(initialView || "timeline");

  // 외부(대시보드 더보기 등)에서 정보가 변경될 때 반영
  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleEdit = (news: NewsArticle) => {
    setEditTarget(news);
    setIsSubmitOpen(true);
  };

  const handleAddClick = () => {
    if (!auth.currentUser) {
      alert("로그인이 필요한 기능입니다. \n우측 상단의 로그인 버튼을 눌러주세요! 🔒");
      return;
    }
    setEditTarget(null);
    setIsSubmitOpen(true);
  };

  const handleModalClose = () => {
    setIsSubmitOpen(false);
    setEditTarget(null);
    handleRefresh();
  };

  return (
    <div className="w-full px-5 py-5">
      
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col gap-4 mb-6 border-b border-gray-200 dark:border-zinc-800 pb-6">
        
        {/* 🛠️ [수정] items-end를 유지하되, 화면이 좁아질 때 제목이 깨지지 않도록 속성 추가 */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div className="flex-1 min-w-fit"> {/* min-w-fit 추가로 최소 너비 확보 */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-2 whitespace-nowrap break-keep">
              {/* 🛠️ whitespace-nowrap: 가로 한 줄 유지, break-keep: 단어 중간 안 잘림 */}
              <span className="text-2xl md:text-3xl">📰</span> AI 뉴스 모아보기
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed break-keep max-w-md">
              최신 AI 및 에듀테크 동향을 한눈에 파악할 수 있습니다.
              <br className="hidden lg:block"/>
              오른쪽의 <strong>[+ 뉴스 추가]</strong> 버튼을 눌러 좋은 기사를 공유해 주세요!
            </p>
          </div>
          
          {/* 🛠️ [수정] 버튼들이 좁은 공간에서 겹치지 않도록 flex-shrink-0 추가 */}
          <div className="flex items-center gap-3 flex-shrink-0 w-full lg:w-auto justify-end">
            <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl flex text-[13px] md:text-sm font-bold shadow-inner overflow-x-auto no-scrollbar">
              {/* 탭 버튼들... */}
              <button 
                onClick={() => setViewMode("category")} 
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === "category" ? "bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
                📂 카테고리별
              </button>

              <button 
                onClick={() => setViewMode("timeline")} 
                className={`px-4 py-2 rounded-lg transition-all flex items-end gap-1.5 ${viewMode === "timeline" ? "bg-white dark:bg-zinc-700 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
                📅 타임라인
              </button>

              <button 
                onClick={() => setViewMode("bookmarks")} 
                className={`px-4 py-2 rounded-lg transition-all flex items-end gap-1.5 ${viewMode === "bookmarks" ? "bg-white dark:bg-zinc-700 text-yellow-500 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
                ⭐ 즐겨찾기
              </button>
            </div>
           
            <button 
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-md hover:shadow-xl transition-all flex items-center gap-2 text-sm"
              onClick={handleAddClick}
            >
              <span>+ 뉴스 추가</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 뷰 모드 렌더링 영역 (부모의 px-6을 그대로 사용하여 여백 일치) */}
      <div className="w-full">
        {viewMode === "category" && (
          <CategoryView 
            refreshKey={refreshKey} 
            onNewsClick={(news) => setSelectedNews(news)}
            onNewsEdit={handleEdit}
            onRefresh={handleRefresh}
          />
        )}

        {viewMode === "timeline" && (
          <NewsTimeline 
            refreshKey={refreshKey} 
            onNewsClick={(news) => setSelectedNews(news)}
            onNewsEdit={handleEdit}
            onRefresh={handleRefresh}
          />
        )}
        
        {viewMode === "bookmarks" && (
          <BookmarkView 
            refreshKey={refreshKey} 
            onNewsClick={(news) => setSelectedNews(news)}
            onNewsEdit={handleEdit}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* 3. 모달 레이어 */}
      <NewsSubmitModal 
        isOpen={isSubmitOpen} 
        onClose={handleModalClose}
        initialData={editTarget}
      />

      <NewsDetailModal 
        isOpen={!!selectedNews} 
        news={selectedNews} 
        onClose={() => setSelectedNews(null)} 
      />
    </div>
  );
}