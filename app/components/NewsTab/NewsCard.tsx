"use client";

import { useState, useEffect } from "react";
import { NewsArticle, deleteNews } from "@/app/lib/newsService";
import { getCategoryInfo } from "@/app/lib/newsCategories";
import { auth } from "@/lib/firebase"; // Auth 가져오기
import { onAuthStateChanged } from "firebase/auth";

interface NewsCardProps {
  news: NewsArticle;
  onClick: () => void;
  onEdit: (news: NewsArticle) => void; // 수정 핸들러 추가
  refreshList: () => void; // 목록 새로고침 핸들러 추가
}

export default function NewsCard({ news, onClick, onEdit, refreshList }: NewsCardProps) {
  const category = getCategoryInfo(news.category);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 현재 로그인한 사용자 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 방지
    if (!confirm("정말로 이 뉴스를 삭제하시겠습니까?")) return;
    
    try {
      if (news.id) {
        await deleteNews(news.id);
        alert("삭제되었습니다.");
        refreshList();
      }
    } catch (error) {
      alert("삭제 실패");
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(news);
  };

  // 날짜 포맷
  const targetDate = news.publishedAt || news.createdAt;
  const dateStr = targetDate?.toDate 
    ? targetDate.toDate().toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) 
    : "";

  // 본인 글인지 확인 (authorId가 없으면 'anonymous'로 간주되어 수정 불가)
  const isMyPost = currentUserId && news.authorId === currentUserId;

  return (
    <div 
      onClick={onClick} 
      className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer h-full flex flex-col relative"
    >
      {/* 수정/삭제 버튼 (내 글일 때만 표시) */}
      {isMyPost && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button 
            onClick={handleEditClick}
            className="p-1.5 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-600 rounded-md text-xs font-bold"
          >
            수정
          </button>
          <button 
            onClick={handleDelete}
            className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-md text-xs font-bold"
          >
            삭제
          </button>
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-1 rounded text-[10px] font-bold ${category.color} bg-opacity-50 border`}>
          {category.icon} {category.name}
        </span>
        <span className="text-xs text-gray-400">{dateStr}</span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
        {news.title}
      </h3>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span className="font-semibold">{news.source}</span>
        <span>•</span>
        <span>조회 {news.views || 0}</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg flex-1">
        {news.shortSummary}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        {news.tags?.slice(0, 3).map((tag, i) => (
          <span key={i} className="text-[10px] text-gray-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}