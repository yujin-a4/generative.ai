"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentNews, getBookmarkedNews, NewsArticle } from "@/app/lib/newsService"; 
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; 
import { auth } from "@/lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth";
import NewsLoading from "./NewsLoading";

interface NewsListProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
  filterCategory: string;
  searchKeyword: string;
  // 🌟 [수정] 'created' 타입 추가
  sortBy?: "latest" | "likes" | "created"; 
  onlyBookmarked?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export default function NewsList({ 
  // 🌟 [수정] sortBy 기본값 유지하며 타입 수용
  refreshKey, onNewsClick, onNewsEdit, onRefresh, filterCategory, searchKeyword, sortBy = "latest", onlyBookmarked = false, startDate, endDate 
}: NewsListProps) {
  const [user, setUser] = useState(auth.currentUser);

  // 1. 유저 상태 감지 (새로고침 시 로그인 풀림 방지)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. React Query로 데이터 캐싱
  const { data: newsList = [], isLoading: loading, refetch } = useQuery({
    queryKey: onlyBookmarked 
      ? ['news', 'bookmarks', user?.uid] 
      : ['news', 'list', sortBy],
    queryFn: async () => {
      if (onlyBookmarked) {
        if (!user) return [];
        return await getBookmarkedNews(user.uid);
      }
      return await getRecentNews(100, sortBy);
    },
    enabled: onlyBookmarked ? !!user : true,
    staleTime: 1000 * 60 * 3, // 3분간 캐시 유지 (fresh)
  });

  // 3. refreshKey 변경 시 refetch
  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  // 필터링 로직 (카테고리 + 검색어 + 날짜 범위)
  const filteredList = newsList.filter((news) => {
    // 카테고리 필터
    const categoryMatch = filterCategory === "ALL" || news.category === filterCategory;
    
    // 검색어 필터
    let keywordMatch = true;
    if (searchKeyword.trim()) {
      const searchTerms = getExtendedSearchTerms(searchKeyword);
      keywordMatch = searchTerms.some(term => 
        news.title.toLowerCase().includes(term) ||
        news.shortSummary.toLowerCase().includes(term) ||
        news.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // 🌟 날짜 범위 필터
    let dateMatch = true;
    if (startDate || endDate) {
      const targetDate = news.publishedAt || news.createdAt;
      if (targetDate) {
        const newsDate = targetDate.toDate();
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (newsDate < start) dateMatch = false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (newsDate > end) dateMatch = false;
        }
      }
    }

    return categoryMatch && keywordMatch && dateMatch;
  });

  // 🎨 귀여운 로딩 화면
  if (loading) return <NewsLoading />;

  if (onlyBookmarked && !user) {
    return (
        <div className="text-center py-20 text-gray-500">
          로그인이 필요한 기능입니다. 🔒 <br/>
          로그인 후 나만의 스크랩북을 만들어보세요!
        </div>
    );
  }

  if (newsList.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        {onlyBookmarked 
          ? "아직 즐겨찾기한 뉴스가 없어요! ⭐를 눌러 저장해보세요." 
          : "아직 등록된 뉴스가 없습니다. 🚀"}
      </div>
    );
  }

  if (filteredList.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        검색 결과가 없습니다. 😅
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
