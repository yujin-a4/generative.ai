"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRecentNews,
  NewsArticle,
  migrateNewsCategories
} from "@/app/lib/newsService";
import { NEWS_CATEGORIES, getCategoryInfo } from "@/app/lib/newsCategories";

import NewsCard from "./NewsCard";
import { getExtendedSearchTerms } from "@/app/lib/searchUtils";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import NewsLoading from "./NewsLoading";
import SearchBar from "./SearchBar";
import { DateDropdown, SortDropdown } from "./FilterDropdowns";

const ALL_CATEGORY = { id: "ALL", name: "전체", icon: "📋" };

interface CategoryViewProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
}

export default function CategoryView({
  refreshKey, onNewsClick, onNewsEdit, onRefresh,
}: CategoryViewProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterSubTag, setFilterSubTag] = useState<string | null>(null); // 하위 태그 필터
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "likes" | "created">("latest");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 대분류 변경 시 하위 태그 초기화
  const handleCategoryChange = (catId: string) => {
    setFilterCategory(catId);
    setFilterSubTag(null);
  };

  // 현재 선택된 대분류의 subTags
  const currentCat =
    filterCategory !== "ALL"
      ? NEWS_CATEGORIES[filterCategory as keyof typeof NEWS_CATEGORIES]
      : null;
  const subTags = currentCat && "subTags" in currentCat ? currentCat.subTags : [];

  const { data: newsList = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["news", "category", sortBy],
    queryFn: () => getRecentNews(100, sortBy),
    staleTime: 1000 * 60 * 3,
  });

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  const filteredList = newsList.filter((news) => {
    // 대분류 필터 (구버전 ID 자동 변환)
    const effectiveCategory = getCategoryInfo(news.category)?.id || news.category;
    const categoryMatch = filterCategory === "ALL" || effectiveCategory === filterCategory;

    // 하위 태그 필터
    const subTagMatch =
      !filterSubTag ||
      (news.tags && news.tags.some((t: string) => t === filterSubTag));

    // 검색어 필터
    let keywordMatch = true;
    if (searchKeyword.trim()) {
      const searchTerms = getExtendedSearchTerms(searchKeyword);
      keywordMatch = searchTerms.some(
        (term) =>
          news.title.toLowerCase().includes(term) ||
          news.shortSummary.toLowerCase().includes(term) ||
          news.tags?.some((tag: string) => tag.toLowerCase().includes(term))
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

    return categoryMatch && subTagMatch && keywordMatch && dateMatch;
  });

  if (loading) return <NewsLoading />;

  return (
    <div className="w-full">
      {/* ── 대분류 카테고리 탭 ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-3">
        <div className="flex flex-wrap gap-2 p-4">
          {/* 전체 */}
          <button
            onClick={() => handleCategoryChange("ALL")}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2
              ${filterCategory === "ALL"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
          >
            <span>{ALL_CATEGORY.icon}</span>
            <span>{ALL_CATEGORY.name}</span>
          </button>

          {Object.values(NEWS_CATEGORIES).map((cat) => {
            const isActive = filterCategory === cat.id;
            const countInCat = newsList.filter(
              (n) => (getCategoryInfo(n.category)?.id || n.category) === cat.id
            ).length;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 group
                  ${isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                {countInCat > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ml-0.5 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400"
                    }`}
                  >
                    {countInCat}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── 하위 태그 (대분류 선택 시 슬라이드 등장) ── */}
        {subTags.length > 0 && (
          <div className="border-t border-gray-100 dark:border-zinc-800 px-4 py-3 bg-gray-50/60 dark:bg-zinc-800/40 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mr-1 flex-shrink-0">
              세부 분류
            </span>

            {/* 전체 (하위 태그 초기화) */}
            <button
              onClick={() => setFilterSubTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterSubTag === null
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700"
                  : "bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700"
              }`}
            >
              전체
            </button>

            {subTags.map((tag) => {
              const countWithTag = newsList.filter(
                (n) =>
                  (getCategoryInfo(n.category)?.id || n.category) === filterCategory &&
                  n.tags?.includes(tag)
              ).length;
              const isActive = filterSubTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setFilterSubTag(isActive ? null : tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400"
                  }`}
                >
                  {tag}
                  {countWithTag > 0 && (
                    <span
                      className={`text-[10px] font-black ${
                        isActive ? "opacity-70" : "text-gray-400 dark:text-zinc-500"
                      }`}
                    >
                      {countWithTag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 현재 필터 상태 표시 ── */}
      {(filterCategory !== "ALL" || filterSubTag) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-zinc-500">필터:</span>
          {filterCategory !== "ALL" && (
            <span className="flex items-center gap-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full">
              {currentCat?.icon} {currentCat?.name}
              <button
                onClick={() => handleCategoryChange("ALL")}
                className="ml-1 text-indigo-400 hover:text-indigo-700 font-black"
              >
                ×
              </button>
            </span>
          )}
          {filterSubTag && (
            <span className="flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-full">
              {filterSubTag}
              <button
                onClick={() => setFilterSubTag(null)}
                className="ml-1 opacity-70 hover:opacity-100 font-black"
              >
                ×
              </button>
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-zinc-500 ml-1">
            {filteredList.length}건
          </span>
          <button
            onClick={() => { handleCategoryChange("ALL"); setFilterSubTag(null); }}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 underline ml-1"
          >
            전체 초기화
          </button>
        </div>
      )}

      {/* ── 필터 바 (기간, 정렬, 검색) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <DateDropdown
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
          />
          <span className="text-gray-300 dark:text-zinc-600 hidden sm:inline">|</span>
          <SortDropdown selected={sortBy} onSelect={setSortBy} />
        </div>
        <div className="flex-1 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[400px] sm:ml-auto">
          <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
        </div>
      </div>

      {/* ── 뉴스 카드 그리드 ── */}
      {newsList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          아직 등록된 뉴스가 없습니다. 🚀
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          검색 결과가 없습니다. 😅
          <br />
          <button
            onClick={() => { handleCategoryChange("ALL"); setFilterSubTag(null); setSearchKeyword(""); }}
            className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            필터 초기화
          </button>
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