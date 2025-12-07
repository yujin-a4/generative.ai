"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentNews, getBookmarkedNews, NewsArticle } from "@/app/lib/newsService"; 
import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; 
import { auth } from "@/lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth";
import NewsLoading from "./NewsLoading";
import SearchBar from "./SearchBar";
import { DateDropdown, SortDropdown } from "./FilterDropdowns";

// 🌟 [수정됨] DB에 저장되는 영문 ID로 id 값을 변경했습니다.
const CATEGORIES = [
  { id: "ALL", label: "전체", icon: "📋" },
  { id: "EDUTECH_AI", label: "에듀테크 x AI", icon: "🎓" },
  { id: "AI_TECH", label: "AI 기술", icon: "🤖" },
  { id: "AI_TOOLS", label: "AI 툴/플랫폼", icon: "🛠️" },
  { id: "INDUSTRY_TREND", label: "업계 동향", icon: "📊" },
  { id: "COMPANY_NEWS", label: "기업/투자", icon: "💼" },
  { id: "POLICY_ETHICS", label: "정책/규제", icon: "📜" },
  { id: "RESEARCH", label: "연구/논문", icon: "📚" },
  { id: "PRODUCT_RELEASE", label: "신제품 출시", icon: "🚀" },
];

interface CategoryViewProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
}

export default function CategoryView({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh 
}: CategoryViewProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "likes">("latest");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // 유저 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 데이터 캐싱
  const { data: newsList = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['news', 'category', sortBy],
    queryFn: () => getRecentNews(100, sortBy),
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
    // 카테고리 필터 (이제 영문 ID끼리 비교하므로 정상 작동합니다)
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

    // 날짜 범위 필터
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

  if (loading) return <NewsLoading />;

  return (
    <div className="max-w-6xl mx-auto">
      {/* 카테고리 버튼 (크게 잘 보이게) */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2
                ${filterCategory === cat.id 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 필터 바 (기간, 정렬, 검색) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <DateDropdown 
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
          />
          <span className="text-gray-300 dark:text-zinc-600 hidden sm:inline">|</span>
          <SortDropdown 
            selected={sortBy} 
            onSelect={setSortBy} 
          />
        </div>

        <div className="flex-1 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[400px] sm:ml-auto">
          <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
        </div>
      </div>

      {/* 뉴스 카드 그리드 */}
      {newsList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          아직 등록된 뉴스가 없습니다. 🚀
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