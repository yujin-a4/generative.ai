"use client";

import { useEffect, useState } from "react";
import { getRecentNews, getBookmarkedNews, NewsArticle } from "@/app/lib/newsService"; 
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; 
import { auth } from "@/lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth"; // 👈 추가

interface NewsListProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
  filterCategory: string;
  searchKeyword: string;
  sortBy?: "latest" | "likes"; 
  onlyBookmarked?: boolean;
}

export default function NewsList({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh, filterCategory, searchKeyword, sortBy = "latest", onlyBookmarked = false 
}: NewsListProps) {
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(auth.currentUser); // 유저 상태 관리

  // 1. 유저 상태 감지 (새로고침 시 로그인 풀림 방지)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. 데이터 불러오기
  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      
      try {
        if (onlyBookmarked) {
          // 즐겨찾기 모드: 유저 정보가 확인된 후에만 요청
          if (user) {
            const data = await getBookmarkedNews(user.uid);
            setNewsList(data);
          } else {
            // 아직 로딩 중일 수도 있으니, auth가 초기화된 후에도 없으면 빈 배열
            setNewsList([]); 
          }
        } else {
          // 일반 모드
          const data = await getRecentNews(100, sortBy); 
          setNewsList(data);
        }
      } catch (e) {
        console.error("데이터 로딩 실패", e);
      } finally {
        setLoading(false);
      }
    }
    
    // user가 바뀔 때(로그인 완료 시)에도 실행되도록 의존성 추가
    fetchNews();
  }, [refreshKey, sortBy, onlyBookmarked, user]); 

  // ... (필터링 로직은 그대로) ...
  const filteredList = newsList.filter((news) => {
    const categoryMatch = filterCategory === "ALL" || news.category === filterCategory;
    
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