"use client";

import { useState } from "react";
import NewsSubmitModal from "./NewsSubmitModal";
import NewsList from "./NewsList";
import NewsTimeline from "./NewsTimeline";
import WeeklySummary from "./WeeklySummary";
import NewsDetailModal from "./NewsDetailModal";
import { NewsArticle } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";
import CategoryFilter from "./CategoryFilter";
import SearchBar from "./SearchBar";

export default function NewsTab() {
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [editTarget, setEditTarget] = useState<NewsArticle | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "timeline" | "weekly">("grid");

  // 필터 및 검색 상태
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 & 상단 컨트롤 */}
      <div className="flex flex-col gap-6 mb-4 border-b border-gray-200 dark:border-zinc-800 pb-6">
        
        {/* 1열: 제목 & 메인 버튼들 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📰 실시간 AI 뉴스
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Gemini가 매일 요약해주는 최신 에듀테크 & AI 트렌드
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex text-sm font-medium">
              <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white dark:bg-zinc-600 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}>
                ⊞ 전체
              </button>
              <button onClick={() => setViewMode("timeline")} className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "timeline" ? "bg-white dark:bg-zinc-600 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}>
                📅 타임라인
              </button>
              <button onClick={() => setViewMode("weekly")} className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "weekly" ? "bg-white dark:bg-zinc-600 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}>
                📉 주간요약
              </button>
            </div>

            <button 
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
              onClick={handleAddClick}
            >
              <span>+ 뉴스 추가</span>
            </button>
          </div>
        </div>

        {/* 2열: 검색 및 카테고리 (주간요약 아닐 때만 노출) */}
        {viewMode !== 'weekly' && (
          <div className="flex flex-col gap-4">
            
            {/* 1. 검색창 (상단 우측 정렬) */}
            <div className="flex justify-end w-full">
               <div className="w-full md:w-[400px]">
                 <SearchBar 
                    value={searchKeyword} 
                    onChange={setSearchKeyword} 
                 />
               </div>
            </div>

            {/* 2. 카테고리 필터 (하단 가로 스크롤) */}
            <div className="w-full overflow-x-auto pb-2">
               <CategoryFilter 
                  selectedCategory={filterCategory} 
                  onSelect={setFilterCategory} 
               />
            </div>
          </div>
        )}
      </div>

      {/* 뷰 모드에 따라 컴포넌트 스위칭 */}
      {viewMode === "grid" && (
        <NewsList 
          refreshKey={refreshKey} 
          onNewsClick={(news) => setSelectedNews(news)}
          onNewsEdit={handleEdit}
          onRefresh={handleRefresh}
          filterCategory={filterCategory} 
          searchKeyword={searchKeyword}   
        />
      )}
      
      {viewMode === "timeline" && (
        <NewsTimeline 
          refreshKey={refreshKey} 
          onNewsClick={(news) => setSelectedNews(news)}
          onNewsEdit={handleEdit}
          onRefresh={handleRefresh}
          filterCategory={filterCategory} 
          searchKeyword={searchKeyword}   
        />
      )}

      {viewMode === "weekly" && (
        <WeeklySummary />
      )}

      {/* 모달들 */}
      <NewsSubmitModal 
        isOpen={isSubmitOpen} 
        onClose={handleModalClose}
        initialData={editTarget}
      />

      <NewsDetailModal 
        news={selectedNews} 
        onClose={() => setSelectedNews(null)} 
      />
    </div>
  );
}