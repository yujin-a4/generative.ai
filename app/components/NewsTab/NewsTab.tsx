"use client";

import { useState, useEffect } from "react";
import NewsSubmitModal from "./NewsSubmitModal";
import NewsTimeline from "./NewsTimeline";
import CategoryView from "./CategoryView";
import BookmarkView from "./BookmarkView";
import NewsDetailModal from "./NewsDetailModal";
import { NewsArticle } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import SearchBar from "./SearchBar"; // (SearchBar import는 유지)

export default function NewsTab() {
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [editTarget, setEditTarget] = useState<NewsArticle | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 뷰 모드
  const [viewMode, setViewMode] = useState<"timeline" | "category" | "bookmarks">("timeline");
  
  // 타임라인용 검색어 (사용하지 않지만 상태는 유지)
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
      {/* 헤더 */}
      <div className="flex flex-col gap-4 mb-6 border-b border-gray-200 dark:border-zinc-800 pb-6">
        
        {/* 타이틀 & 뷰모드 & 뉴스추가 버튼 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📰 AI 뉴스 모아보기
            </h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              최신 AI 및 에듀테크 동향을 한눈에 파악할 수 있습니다.
              <br/>
              오른쪽의 [+ 뉴스 추가] 버튼을 눌러 좋은 기사를 공유해 주세요!
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex text-sm font-medium">
              <button 
                onClick={() => setViewMode("timeline")} 
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "timeline" ? "bg-white dark:bg-zinc-600 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
                📅 타임라인
              </button>
              <button 
                onClick={() => setViewMode("category")} 
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "category" ? "bg-white dark:bg-zinc-600 text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
                📂 카테고리별
              </button>
              <button 
                onClick={() => setViewMode("bookmarks")} 
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === "bookmarks" ? "bg-white dark:bg-zinc-600 text-yellow-500 font-bold shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
              >
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

        {/* 🌟 [제거] 타임라인 검색창 렌더링 블록을 완전히 삭제했습니다. */}
        {/* {viewMode === 'timeline' && ( ... )} */}
      </div>

      {/* 뷰 모드 스위칭 */}
      {viewMode === "timeline" && (
        <NewsTimeline 
          refreshKey={refreshKey} 
          onNewsClick={(news) => setSelectedNews(news)}
          onNewsEdit={handleEdit}
          onRefresh={handleRefresh}
          // 🌟 [제거] searchKeyword prop 전달 제거
        />
      )}
      
      {viewMode === "category" && (
        <CategoryView 
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