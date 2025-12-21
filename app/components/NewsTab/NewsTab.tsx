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
  
  // 🌟 [수정] initialView 정보가 있으면 해당 모드로 초기화 (기본값: category)
  const [viewMode, setViewMode] = useState<"timeline" | "category" | "bookmarks">(initialView || "category");

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
    // [유지] 대시보드와 여백 통일 (max-w-7xl, px-6, py-8)
    <div className="max-w-7xl mx-auto px-6 py-10">
      
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col gap-4 mb-8 border-b border-gray-200 dark:border-zinc-800 pb-4">
        
        {/* 🛠️ [수정] items-center를 items-end로 변경하여 버튼을 아래로 내림 */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-3xl">📰</span> AI 뉴스 모아보기
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
              최신 AI 및 에듀테크 동향을 한눈에 파악할 수 있습니다.
              <br className="hidden sm:block"/>
              오른쪽의 <strong>[+ 뉴스 추가]</strong> 버튼을 눌러 좋은 기사를 공유해 주세요!
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 버튼 그룹 */}
            <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl flex text-sm font-bold shadow-inner">
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