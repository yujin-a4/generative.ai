"use client";

import { useState, useEffect } from "react";
import { NewsArticle, deleteNews, toggleLikeNews, toggleBookmarkNews } from "@/app/lib/newsService";
import { getCategoryInfo } from "@/app/lib/newsCategories";
import { auth } from "@/lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth";

interface NewsCardProps {
  news: NewsArticle;
  onClick: () => void;
  onEdit: (news: NewsArticle) => void;
  refreshList: () => void;
  hideSummary?: boolean; 
  isTimelineView?: boolean; // 👈 [추가] 타임라인 뷰 여부
}

export default function NewsCard({ news, onClick, onEdit, refreshList, hideSummary = false, isTimelineView = false }: NewsCardProps) {
  const category = getCategoryInfo(news.category);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [likedBy, setLikedBy] = useState<string[]>(news.likedBy || []);
  const [isLiked, setIsLiked] = useState(false);
  const [bookmarkedBy, setBookmarkedBy] = useState<string[]>(news.bookmarkedBy || []);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        if (user.email === "yujinkang1008@gmail.com") setIsAdmin(true);
        if (news.likedBy?.includes(user.uid)) setIsLiked(true);
        if (news.bookmarkedBy?.includes(user.uid)) setIsBookmarked(true);
      } else {
        setCurrentUserId(null);
        setIsAdmin(false);
        setIsLiked(false);
        setIsBookmarked(false);
      }
    });
    return () => unsubscribe();
  }, [news.likedBy, news.bookmarkedBy]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return alert("로그인이 필요합니다.");

    const prevLikedBy = [...likedBy];
    const prevIsLiked = isLiked;

    if (isLiked) {
      setLikedBy(prev => prev.filter(id => id !== currentUserId));
      setIsLiked(false);
    } else {
      setLikedBy(prev => [...prev, currentUserId]);
      setIsLiked(true);
    }

    try {
      if (news.id) await toggleLikeNews(news.id, currentUserId, prevLikedBy);
    } catch (error) {
      setLikedBy(prevLikedBy);
      setIsLiked(prevIsLiked);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return alert("로그인이 필요한 기능입니다.");

    const prevBookmarkedBy = [...bookmarkedBy];
    const prevIsBookmarked = isBookmarked;

    if (isBookmarked) {
        setBookmarkedBy(prev => prev.filter(id => id !== currentUserId));
        setIsBookmarked(false);
    } else {
        setBookmarkedBy(prev => [...prev, currentUserId]);
        setIsBookmarked(true);
    }

    try {
        if (news.id) await toggleBookmarkNews(news.id, currentUserId, prevBookmarkedBy);
    } catch (error) {
        setBookmarkedBy(prevBookmarkedBy);
        setIsBookmarked(prevIsBookmarked);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!confirm("정말로 삭제하시겠습니까?")) return;
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

  const targetDate = news.publishedAt || news.createdAt;
  const dateStr = targetDate?.toDate 
    ? targetDate.toDate().toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) 
    : "";

  const isMyPost = currentUserId && news.authorId === currentUserId;
  const canDelete = isMyPost || isAdmin;
  const canEdit = isMyPost;
  
  // 🌟 [추가] 폰트 크기 및 줄 수 클래스 선택
  const titleSizeClass = isTimelineView
    ? "text-base line-clamp-3" // 타임라인: 작게, 3줄까지 허용
    : "text-lg line-clamp-2"; // 기본: 크게, 2줄까지 허용

  return (
    <div 
      onClick={onClick} 
      className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer h-full flex flex-col relative"
    >
      {/* 1. 상단 라인: 카테고리 (왼쪽) ... 날짜 (오른쪽) */}
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-1 rounded text-[10px] font-bold ${category.color} bg-opacity-50 border`}>
          {category.icon} {category.name}
        </span>
        
        <span className="text-xs text-gray-400 font-medium">
          {dateStr}
        </span>
      </div>

      {/* 수정/삭제 버튼 (우측 상단, 날짜 위에 뜸 - 호버 시) */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-zinc-900 pl-2 z-10">
        {canEdit && (
          <button onClick={handleEditClick} className="p-1 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-600 rounded text-xs font-bold">수정</button>
        )}
        {canDelete && (
          <button onClick={handleDelete} className="p-1 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded text-xs font-bold">삭제</button>
        )}
      </div>

      {/* 2. 제목 */}
      <h3 className={`font-bold text-gray-900 dark:text-white mb-1 transition-colors group-hover:text-indigo-600 ${titleSizeClass}`}>
        {news.title}
      </h3>

      {/* 3. 발행사 (제목 아래) */}
      <div className="text-xs font-semibold text-gray-500 mb-3">
        {news.source}
      </div>

      {/* 4. 요약 내용 */}
      {!hideSummary && (
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg flex-1">
          {news.shortSummary}
        </p>
      )}

      {/* 5. 하단 라인: 태그(왼쪽) ... 아이콘(오른쪽) */}
      <div className="flex items-end justify-between mt-auto">
        {/* 태그들 */}
        <div className="flex flex-wrap gap-1.5">
          {news.tags?.slice(0, 2).map((tag, i) => (
            <span key={i} className="text-[10px] text-gray-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* 인터랙션 버튼들 (하트 | 별) */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {/* ❤️ 좋아요 */}
          <button 
            onClick={handleLike}
            className="flex items-center gap-1 hover:text-pink-500 transition-colors"
          >
            {isLiked ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-pink-500 animate-pulse">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.691c0-3.44 2.155-5.914 5.25-5.914 2.296 0 4.298 1.48 5.25 3.522 1.052-2.042 3.054-3.522 5.35-3.522 3.095 0 5.25 2.474 5.25 5.914 0 3.483-2.438 6.669-4.755 8.818a25.18 25.18 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 hover:text-pink-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
            <span className={`text-sm ${isLiked ? "text-pink-500 font-bold" : ""}`}>{likedBy.length}</span>
          </button>

          {/* ⭐ 즐겨찾기 */}
          <button 
            onClick={handleBookmark}
            className="hover:text-yellow-400 transition-colors"
          >
            {isBookmarked ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 hover:text-yellow-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.545.044.757.683.364 1.056l-4.276 3.67a.562.562 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.276-3.67c-.393-.373-.181-1.012.364-1.056l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}