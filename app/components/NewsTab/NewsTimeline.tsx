"use client";

import { useEffect, useState } from "react";
import { getRecentNews, NewsArticle } from "@/app/lib/newsService";
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils";

interface NewsTimelineProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
  // 🌟 이 두 줄이 꼭 필요합니다!
  filterCategory: string;
  searchKeyword: string;
}

export default function NewsTimeline({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh, filterCategory, searchKeyword 
}: NewsTimelineProps) {
  const [allNews, setAllNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      const data = await getRecentNews(100);
      setAllNews(data);
      setLoading(false);
    }
    fetchNews();
  }, [refreshKey]);

  // 필터링 및 그룹핑 로직
  const groupedNews = allNews
    .filter((news) => {
      const categoryMatch = filterCategory === "ALL" || news.category === filterCategory;
      
      if (!searchKeyword.trim()) return categoryMatch;

      const searchTerms = getExtendedSearchTerms(searchKeyword);
      const keywordMatch = searchTerms.some(term => 
        news.title.toLowerCase().includes(term) ||
        news.shortSummary.toLowerCase().includes(term) ||
        news.tags?.some(tag => tag.toLowerCase().includes(term))
      );

      return categoryMatch && keywordMatch;
    })
    .reduce((acc, item) => {
      const targetDate = item.publishedAt || item.createdAt;
      if (!targetDate) return acc;
      
      const dateKey = targetDate.toDate().toLocaleDateString("ko-KR", {
        year: "numeric", 
        month: "long", 
        day: "numeric", 
        weekday: "short"
      });

      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, NewsArticle[]>);

  if (loading) return <div className="text-center py-20">로딩 중... ⏳</div>;

  const dates = Object.keys(groupedNews);

  if (allNews.length > 0 && dates.length === 0) {
    return <div className="text-center py-20 text-gray-500">검색 결과가 없습니다. 😅</div>;
  }

  if (allNews.length === 0) {
    return <div className="text-center py-20 text-gray-500">등록된 뉴스가 없습니다.</div>;
  }

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {dates.map((date) => (
        <div key={date} className="relative pl-8 border-l-2 border-gray-200 dark:border-zinc-800">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-black"></div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pl-2">
            {date}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupedNews[date].map((news) => (
              <NewsCard 
                key={news.id} 
                news={news} 
                onClick={() => onNewsClick(news)}
                onEdit={onNewsEdit}
                refreshList={onRefresh}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}