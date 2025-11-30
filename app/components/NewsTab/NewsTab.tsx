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
  
  // 뷰 모드
  const [viewMode, setViewMode] = useState<"grid" | "timeline" | "weekly" | "bookmarks">("grid");

  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "likes">("latest");

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
              {/* 즐겨찾기 탭 */}
              <button onClick={() => setViewMode("bookmarks")} className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "bookmarks" ? "bg-white dark:bg-zinc-600 text-yellow-500 font-bold shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}>
                ⭐ 즐겨찾기
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
            
            {/* 🌟 [수정] 1. 검색창 및 정렬 (깔끔하게 한 줄 배치) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
               
               {/* 정렬 버튼 (명확한 캡슐형 토글) */}
               {viewMode !== 'bookmarks' && (
                 <div className="flex text-xs font-bold self-start md:self-auto">
                   <button onClick={() => setSortBy('latest')} 
                     className={`px-3 py-1.5 transition-all rounded-l-full border border-gray-300 dark:border-zinc-700 
                     ${sortBy === 'latest' ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500' : 'bg-white dark:bg-zinc-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                   >
                     🕒 최신순
                   </button>
                   <button onClick={() => setSortBy('likes')} 
                     className={`px-3 py-1.5 transition-all rounded-r-full border border-l-0 border-gray-300 dark:border-zinc-700 
                     ${sortBy === 'likes' ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500' : 'bg-white dark:bg-zinc-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                   >
                     🔥 좋아요순
                   </button>
                 </div>
               )}
               
               {viewMode === 'bookmarks' && <div className="hidden md:block"></div>}

               <div className="w-full md:w-[400px]">
                 <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
               </div>
            </div>

            {/* 🌟 [수정] 2. 카테고리 필터 (구분선 추가로 계층 분리) */}
            <div className="w-full overflow-x-auto pb-2 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-2">
               <CategoryFilter selectedCategory={filterCategory} onSelect={setFilterCategory} />
            </div>
          </div>
        )}
      </div>

      {/* 뷰 모드 스위칭 */}
      {viewMode === "grid" && (
        <NewsList 
          refreshKey={refreshKey} 
          onNewsClick={(news) => setSelectedNews(news)}
          onNewsEdit={handleEdit}
          onRefresh={handleRefresh}
          filterCategory={filterCategory} 
          searchKeyword={searchKeyword}
          sortBy={sortBy}
        />
      )}
      
      {viewMode === "bookmarks" && (
        <NewsList 
          refreshKey={refreshKey} 
          onNewsClick={(news) => setSelectedNews(news)}
          onNewsEdit={handleEdit}
          onRefresh={handleRefresh}
          filterCategory={filterCategory} 
          searchKeyword={searchKeyword}
          onlyBookmarked={true}
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