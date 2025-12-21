"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBookmarkedNews, NewsArticle } from "@/app/lib/newsService"; 
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; 
import { auth } from "@/lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth";
import NewsLoading from "./NewsLoading";
import SearchBar from "./SearchBar";
import { CategoryDropdown } from "./FilterDropdowns";

interface BookmarkViewProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
}

export default function BookmarkView({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh 
}: BookmarkViewProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  // 유저 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 데이터 캐싱
  const { data: newsList = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['news', 'bookmarks', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      return await getBookmarkedNews(user.uid);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3,
  });

  // refreshKey 변경 시 refetch
  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  // 필터링
  const filteredList = newsList.filter((news) => {
    const categoryMatch = filterCategory === "ALL" || news.category === filterCategory;
    
    let keywordMatch = true;
    if (searchKeyword.trim()) {
      const searchTerms = getExtendedSearchTerms(searchKeyword);
      keywordMatch = searchTerms.some(term => 
        news.title.toLowerCase().includes(term) ||
        news.shortSummary.toLowerCase().includes(term) ||
        news.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    return categoryMatch && keywordMatch;
  });

  if (loading) return <NewsLoading />;

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-500">
        로그인이 필요한 기능입니다. 🔒 <br/>
        로그인 후 나만의 스크랩북을 만들어보세요!
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 필터 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
        <CategoryDropdown 
          selected={filterCategory} 
          onSelect={setFilterCategory} 
        />

        <div className="flex-1 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[400px] sm:ml-auto">
          <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
        </div>
      </div>

      {/* 뉴스 카드 그리드 */}
      {newsList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          아직 즐겨찾기한 뉴스가 없어요! ⭐를 눌러 저장해보세요.
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          검색 결과가 없습니다. 😅
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      )}
    </div>
  );
}
