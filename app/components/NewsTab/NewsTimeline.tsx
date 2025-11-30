"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentNews, NewsArticle } from "@/app/lib/newsService";
import NewsCard from "./NewsCard";
// import { getExtendedSearchTerms } from "@/app/lib/searchUtils"; // 검색 기능 제거됨
import NewsLoading from "./NewsLoading";
import SummaryModal from "./SummaryModal";

// 🌟 [수정] 모든 유틸리티 함수를 모듈 레벨에 정의하여 스코프 오류 해결

// "2025년 11월" 형식
function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

// "4째주" 형식
function getWeekLabel(date: Date): string {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const weekNumber = Math.ceil((date.getDate() + firstDayWeekday) / 7);
  const weekNames = ["", "1째주", "2째주", "3째주", "4째주", "5째주", "6째주"];
  return weekNames[weekNumber] || `${weekNumber}째주`;
}

// "11월 4주차" 형식 (DB 저장용)
function getWeekLabelForDB(date: Date): string {
  const month = date.getMonth() + 1;
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const weekNumber = Math.ceil((date.getDate() + firstDayWeekday) / 7);
  return `${month}월 ${weekNumber}주차`;
}

// 정렬용 키
function getMonthSortKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekSortKey(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  return Math.ceil((date.getDate() + firstDayWeekday) / 7);
}

interface NewsTimelineProps {
  refreshKey: number;
  onNewsClick: (news: NewsArticle) => void;
  onNewsEdit: (news: NewsArticle) => void;
  onRefresh: () => void;
}

interface WeekGroup {
  label: string;
  dbLabel: string;
  sortKey: number;
  news: NewsArticle[];
}

interface MonthGroup {
  label: string;
  sortKey: string;
  year: number;
  month: number;
  weeks: WeekGroup[];
}

export default function NewsTimeline({ 
  refreshKey, onNewsClick, onNewsEdit, onRefresh
}: NewsTimelineProps) {
  
  const { data: allNews = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['news', 'timeline'],
    queryFn: () => getRecentNews(100),
    staleTime: 1000 * 60 * 3,
  });

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    type: "weekly" | "monthly";
    weekLabel?: string;
    year?: number;
    month?: number;
  }>({ isOpen: false, type: "weekly" });

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const newsForGrouping = allNews; // 검색어 필터링 로직 제거 (allNews를 직접 사용)

  // 월별 → 주별 그룹핑
  const groupedByMonth: Record<string, { 
    label: string; 
    sortKey: string; 
    year: number;
    month: number;
    weeks: Record<string, WeekGroup> 
  }> = {};

  newsForGrouping.forEach((news) => {
    const targetDate = news.publishedAt || news.createdAt;
    if (!targetDate) return;
    
    const date = targetDate.toDate();
    const monthLabel = getMonthLabel(date); // 👈 함수 사용
    const monthSortKey = getMonthSortKey(date); // 👈 함수 사용
    const weekLabel = getWeekLabel(date); // 👈 함수 사용
    const weekDbLabel = getWeekLabelForDB(date); // 👈 함수 사용
    const weekSortKey = getWeekSortKey(date); // 👈 함수 사용

    if (!groupedByMonth[monthLabel]) {
      groupedByMonth[monthLabel] = { 
        label: monthLabel, 
        sortKey: monthSortKey, 
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        weeks: {} 
      };
    }

    if (!groupedByMonth[monthLabel].weeks[weekLabel]) {
      groupedByMonth[monthLabel].weeks[weekLabel] = { 
        label: weekLabel, 
        dbLabel: weekDbLabel,
        sortKey: weekSortKey, 
        news: [] 
      };
    }

    groupedByMonth[monthLabel].weeks[weekLabel].news.push(news);
  });

  // 정렬된 월별 데이터
  const sortedMonths: MonthGroup[] = Object.values(groupedByMonth)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(month => ({
      label: month.label,
      sortKey: month.sortKey,
      year: month.year,
      month: month.month,
      weeks: Object.values(month.weeks).sort((a, b) => b.sortKey - a.sortKey)
    }));

  // 첫 번째 월은 기본 펼침
  useEffect(() => {
    if (sortedMonths.length > 0 && !initialized) {
      setExpandedMonths(new Set([sortedMonths[0].label]));
      setInitialized(true);
    }
  }, [sortedMonths, initialized]);

  const toggleMonth = (monthLabel: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthLabel)) {
        next.delete(monthLabel);
      } else {
        next.add(monthLabel);
      }
      return next;
    });
  };

  // 요약 모달 열기
  const openWeeklySummary = (weekDbLabel: string) => {
    setSummaryModal({
      isOpen: true,
      type: "weekly",
      weekLabel: weekDbLabel,
    });
  };

  const openMonthlySummary = (year: number, month: number) => {
    setSummaryModal({
      isOpen: true,
      type: "monthly",
      year,
      month,
    });
  };

  if (loading) return <NewsLoading />;

  if (allNews.length > 0 && sortedMonths.length === 0) {
    return <div className="text-center py-20 text-gray-500">검색 결과가 없습니다. 😅</div>;
  }

  if (allNews.length === 0) {
    return <div className="text-center py-20 text-gray-500">등록된 뉴스가 없습니다.</div>;
  }

  return (
    <>
      <div className="space-y-4 max-w-5xl mx-auto">
        {sortedMonths.map((month) => {
          const isExpanded = expandedMonths.has(month.label);
          const totalNews = month.weeks.reduce((sum, week) => sum + week.news.length, 0);

          return (
            <div key={month.label} className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {/* 월 헤더 */}
              <div className="flex items-center bg-gray-50 dark:bg-zinc-900">
                <button
                  onClick={() => toggleMonth(month.label)}
                  className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <svg 
                    className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="text-xl">📅</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {month.label}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({totalNews}개의 뉴스)
                  </span>
                </button>
                
                {/* 월간 요약 버튼 */}
                <button
                  onClick={() => openMonthlySummary(month.year, month.month)}
                  className="px-4 py-2 mr-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                >
                  📊 월간요약
                </button>
              </div>

              {/* 월 내용 (주별 그룹) */}
              {isExpanded && (
                <div className="p-5 space-y-6 bg-white dark:bg-zinc-900/50">
                  {month.weeks.map((week) => (
                    <div key={week.label} className="relative pl-6 border-l-2 border-indigo-200 dark:border-indigo-800">
                      {/* 주차 표시 */}
                      <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-indigo-500"></div>
                      
                      {/* 주차 헤더 */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                            {week.label}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {week.news.length}개의 뉴스
                          </p>
                        </div>
                        
                        {/* 주간 요약 버튼 */}
                        <button
                          onClick={() => openWeeklySummary(week.dbLabel)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        >
                          📊 주간요약
                        </button>
                      </div>

                      {/* 해당 주 뉴스 카드들 - 한 줄에 4개로 수정 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {week.news.map((newsItem) => (
                          <NewsCard 
                            key={newsItem.id} 
                            news={newsItem} 
                            onClick={() => onNewsClick(newsItem)}
                            onEdit={onNewsEdit}
                            refreshList={onRefresh}
                            hideSummary={true}
                            isTimelineView={true} // 👈 이 줄이 추가되었습니다.
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 요약 모달 */}
      <SummaryModal
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal({ ...summaryModal, isOpen: false })}
        type={summaryModal.type}
        weekLabel={summaryModal.weekLabel}
        year={summaryModal.year}
        month={summaryModal.month}
      />
    </>
  );
}