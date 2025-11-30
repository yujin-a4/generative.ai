"use client";

import { useEffect, useState } from "react";
import { getRecentNews, NewsArticle } from "@/app/lib/newsService";
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; // 경로 확인

interface NewsListProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
  // 🌟 이 두 줄이 반드시 있어야 NewsTab에서 에러가 안 납니다!
  filterCategory: string;
  searchKeyword: string;
}

export default function NewsList({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh, filterCategory, searchKeyword 
}: NewsListProps) {
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      const data = await getRecentNews(100); 
      setNewsList(data);
      setLoading(false);
    }
    fetchNews();
  }, [refreshKey]);

  // 필터링 로직
  const filteredList = newsList.filter((news) => {
    // 1. 카테고리 필터
    const categoryMatch = filterCategory === "ALL" || news.category === filterCategory;
    
    // 2. 검색어 필터 (동의어 처리)
    if (!searchKeyword.trim()) return categoryMatch;

    const searchTerms = getExtendedSearchTerms(searchKeyword);
    
    const keywordMatch = searchTerms.some(term => 
      news.title.toLowerCase().includes(term) ||
      news.shortSummary.toLowerCase().includes(term) ||
      news.tags?.some(tag => tag.toLowerCase().includes(term))
    );

    return categoryMatch && keywordMatch;
  });

  if (loading) return <div className="text-center py-20">로딩 중... ⏳</div>;

  if (newsList.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        아직 등록된 뉴스가 없습니다. 첫 번째 뉴스를 올려보세요! 🚀
      </div>
    );
  }

  if (filteredList.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        검색 결과가 없습니다. 😅 <br/>
        <span className="text-sm">"{searchKeyword}" 관련 뉴스가 없네요.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredList.map((news) => (
        <NewsCard 
          key={news.id} 
          news={news} 
          onClick={() => onNewsClick(news)} 
          onEdit={onNewsEdit}
          refreshList={onRefresh}
        />
      ))}
    </div>
  );
}