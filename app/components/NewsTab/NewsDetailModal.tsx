"use client";

import { NewsArticle } from "@/app/lib/newsService";
import { getCategoryInfo } from "@/app/lib/newsCategories";
import { useEffect, useState } from "react";

// 🛠️ isOpen 속성 추가 (필수)
interface NewsDetailModalProps {
  isOpen: boolean;
  news: NewsArticle | null;
  onClose: () => void;
}

export default function NewsDetailModal({ isOpen, news, onClose }: NewsDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "unset";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;
  if (!news) return null;

  const category = getCategoryInfo(news.category);
  const dateStr = news.publishedAt?.toDate 
    ? news.publishedAt.toDate().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) 
    : "";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose}>
      <div 
        className={`bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative transform transition-all duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}
        onClick={(e) => e.stopPropagation()} 
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors z-10"
        >
          ✕
        </button>

        <div className={`p-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-br ${category.color.replace('bg-', 'from-').replace('text-', '').split(' ')[0]}/10 to-transparent`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${category.color} bg-white/80 dark:bg-zinc-900/80 shadow-sm border`}>
              {category.icon} {category.name}
            </span>
            <span className="text-sm text-gray-500">{dateStr}</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-2">
            {news.title}
          </h2>
          <div className="text-sm font-medium text-gray-500">
            출처: <span className="text-gray-800 dark:text-gray-300">{news.source}</span>
          </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              📝 핵심 요약
            </h3>
            <ul className="space-y-2">
              {news.detailedSummary?.map((line, i) => (
                <li key={i} className="flex gap-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="text-indigo-500 flex-shrink-0 mt-1.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-2 flex items-center gap-1">
              💡 에듀테크 Insight
            </h3>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
              {news.insight}
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex flex-wrap gap-2 mb-6">
              {news.tags?.map((tag, i) => (
                <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>

            <a 
              href={news.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full py-4 text-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              원문 기사 보러가기 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}