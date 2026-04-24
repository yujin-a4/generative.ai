"use client";

import { AIService, SERVICE_CATEGORIES } from "@/types/service";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toggleLikeService, toggleBookmarkService } from "@/app/actions/serviceActions";
import { useQueryClient } from "@tanstack/react-query";

interface ServiceDetailModalProps {
  service: AIService | null;
  onClose: () => void;
}

export default function ServiceDetailModal({ service, onClose }: ServiceDetailModalProps) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && service) {
        setCurrentUser(user);
        setIsLiked(service.likedBy?.includes(user.uid) || false);
        setIsBookmarked(service.bookmarkedBy?.includes(user.uid) || false);
      } else {
        setCurrentUser(null);
        setIsLiked(false);
        setIsBookmarked(false);
      }
    });
    return () => unsubscribe();
  }, [service]);

  // service가 바뀔 때 likesCount 동기화
  useEffect(() => {
    setLikesCount(service?.likes || 0);
  }, [service]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return alert("로그인이 필요합니다. 🔒");
    if (!service?.id) return;

    const prevLiked = isLiked;
    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      await toggleLikeService(service.id, currentUser.uid, service.likedBy);
      await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
    } catch {
      setIsLiked(prevLiked);
      setLikesCount((prev) => (prevLiked ? prev + 1 : prev - 1));
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return alert("로그인이 필요합니다. 🔒");
    if (!service?.id) return;

    const prevBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      await toggleBookmarkService(service.id, currentUser.uid, service.bookmarkedBy);
      await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
    } catch {
      setIsBookmarked(prevBookmarked);
    }
  };

  if (!service) return null;

  const categoryLabel = SERVICE_CATEGORIES[service.category] || service.category;

  const pricingLabel = {
    FREE: { text: "무료", color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
    FREEMIUM: { text: "부분유료", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
    PAID: { text: "유료", color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700" },
  }[service.pricing] || { text: service.pricing, color: "text-gray-600 bg-gray-100 border-gray-200" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 썸네일 영역 ── */}
        {service.thumbnailUrl ? (
          <div
            className="w-full h-44 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${service.thumbnailUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-zinc-800">
            <div />
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── 스크롤 가능한 본문 ── */}
        <div className="overflow-y-auto custom-scrollbar flex-1">
          <div className="p-6 space-y-5">

            {/* 서비스명 + 뱃지 */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {categoryLabel}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pricingLabel.color}`}>
                  {pricingLabel.text}
                </span>
                {service.supportsKorean && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">
                    🇰🇷 한국어 지원
                  </span>
                )}
                {service.isTrending && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-full border border-red-100 dark:border-red-800">
                    🔥 요즘 뜨는
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                {service.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {service.description}
              </p>
            </div>

            {/* 상세 설명 */}
            {service.longDescription && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {service.longDescription}
                </p>
              </div>
            )}

            {/* 주요 기능 */}
            {service.features && service.features.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <span className="text-base">⚡</span> 주요 기능
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {service.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/15 rounded-lg px-3 py-2"
                    >
                      <span className="text-indigo-500 text-xs font-black">✓</span>
                      <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 장점 / 단점 */}
            {((service.pros && service.pros.length > 0) || (service.cons && service.cons.length > 0)) && (
              <div className="grid grid-cols-2 gap-3">
                {service.pros && service.pros.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-100 dark:border-green-900/30">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">👍 장점</p>
                    <ul className="space-y-1.5">
                      {service.pros.map((pro, idx) => (
                        <li key={idx} className="text-xs text-green-800 dark:text-green-300 flex items-start gap-1.5">
                          <span className="mt-0.5 flex-shrink-0">•</span>
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {service.cons && service.cons.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/30">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">👎 단점</p>
                    <ul className="space-y-1.5">
                      {service.cons.map((con, idx) => (
                        <li key={idx} className="text-xs text-red-800 dark:text-red-300 flex items-start gap-1.5">
                          <span className="mt-0.5 flex-shrink-0">•</span>
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 추천 대상 */}
            {service.targetUser && service.targetUser.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                  <span className="text-base">👤</span> 이런 분께 추천해요
                </h3>
                <div className="flex flex-wrap gap-2">
                  {service.targetUser.map((user, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-medium px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 rounded-full border border-purple-100 dark:border-purple-800"
                    >
                      {user}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 태그 */}
            {service.tags && service.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {service.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* ── 하단 고정 액션바 ── */}
        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
          {/* 좋아요 + 즐겨찾기 */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-pink-500 transition-colors"
            >
              {isLiked ? (
                <span className="text-pink-500 text-xl">♥</span>
              ) : (
                <span className="text-xl">♡</span>
              )}
              <span className={isLiked ? "text-pink-500 font-bold" : ""}>{likesCount}</span>
            </button>

            <button
              onClick={handleBookmark}
              className="flex items-center gap-1 text-gray-400 hover:text-yellow-400 transition-colors"
              title={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 추가"}
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

          {/* 서비스 바로가기 버튼 */}
          {service.url && (
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-indigo-200 dark:hover:shadow-indigo-900/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              서비스 바로가기
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
