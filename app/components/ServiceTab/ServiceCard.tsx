"use client";

import { AIService, SERVICE_CATEGORIES } from "@/types/service";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toggleLikeService, toggleBookmarkService } from "@/app/actions/serviceActions";
import { useQueryClient } from "@tanstack/react-query";

interface ServiceCardProps {
  service: AIService;
  onEdit: (service: AIService) => void;
  onDelete: (id: string) => void;
}

export default function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(service.likes || 0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAdmin(user.email === "yujinkang1008@gmail.com");
        setIsLiked(service.likedBy?.includes(user.uid) || false);
        setIsBookmarked(service.bookmarkedBy?.includes(user.uid) || false);
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setIsLiked(false);
        setIsBookmarked(false);
      }
    });
    return () => unsubscribe();
  }, [service.likedBy, service.bookmarkedBy]);

  const handleCardClick = () => {
    if (service.url) window.open(service.url, "_blank");
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return alert("로그인이 필요합니다. 🔒");

    const prevLiked = isLiked;
    setIsLiked(!isLiked);
    setLikesCount(prev => (isLiked ? prev - 1 : prev + 1));

    try {
      if (service.id) {
        await toggleLikeService(service.id, currentUser.uid, service.likedBy);
        // 대시보드와 서비스탭 모두 갱신
        await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
        await queryClient.invalidateQueries({ queryKey: ["aiTrendHeadline"] });
      }
    } catch (error) {
      setIsLiked(prevLiked);
      setLikesCount(prev => (prevLiked ? prev + 1 : prev - 1));
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return alert("로그인이 필요합니다. 🔒");

    const prevBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      if (service.id) {
        await toggleBookmarkService(service.id, currentUser.uid, service.bookmarkedBy);
        await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
      }
    } catch (error) {
      setIsBookmarked(prevBookmarked);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (service.id) onDelete(service.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(service);
  };

  // 카테고리 한글명 가져오기 (없으면 코드 그대로 표시)
  const categoryLabel = SERVICE_CATEGORIES[service.category] || service.category;

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer h-full flex flex-col relative"
    >
      {/* 1. 상단: 카테고리 (왼쪽) + 관리자 버튼 (오른쪽) */}
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded border border-indigo-100 dark:border-indigo-800">
          {categoryLabel}
        </span>
        
        {/* 관리자 버튼 (호버 시 표시) */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAdmin && (
            <>
              <button onClick={handleEditClick} className="p-1 text-gray-400 hover:text-indigo-600">✎</button>
              <button onClick={handleDeleteClick} className="p-1 text-gray-400 hover:text-red-600">🗑️</button>
            </>
          )}
        </div>
      </div>

      {/* 2. 썸네일 (있으면) */}
      {service.thumbnailUrl && (
        <div className="w-full h-32 mb-4 bg-gray-100 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${service.thumbnailUrl})` }} />
      )}

      {/* 3. 제목 & 설명 */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 leading-tight flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
        {service.name}
        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">↗</span>
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
        {service.description}
      </p>

      {/* 4. ✨ 특징 태그 (복구됨) */}
      {service.tags && service.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {service.tags.slice(0, 4).map((tag, idx) => (
            <span key={idx} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 5. 하단: 정보(왼쪽) + 액션(오른쪽) */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800 mt-auto">
        
        {/* 왼쪽: 무료/한국어 정보 (작게) */}
        <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {service.pricing === "FREE" && (
            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
              💰 무료
            </span>
          )}
          {service.pricing === "FREEMIUM" && (
            <span className="flex items-center gap-0.5 text-gray-500">
              💳 부분유료
            </span>
          )}
          {service.supportsKorean && (
            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
              🇰🇷 한국어
            </span>
          )}
        </div>

        {/* 오른쪽: 좋아요/북마크 버튼 */}
        <div className="flex items-center gap-3">
          {/* ❤️ 좋아요 */}
          <button 
            onClick={handleLike}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-pink-500 transition-colors"
          >
            {isLiked ? (
              <span className="text-pink-500 text-lg">♥</span>
            ) : (
              <span className="text-lg">♡</span>
            )}
            <span className={isLiked ? "text-pink-500 font-bold" : ""}>{likesCount}</span>
          </button>

          {/* ⭐ 즐겨찾기 */}
          <button 
            onClick={handleBookmark}
            className="flex items-center gap-1 text-gray-400 hover:text-yellow-400 transition-colors"
          >
            {isBookmarked ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.545.044.757.683.364 1.056l-4.276 3.67a.562.562 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.276-3.67c-.393-.373-.181-1.012.364-1.056l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}