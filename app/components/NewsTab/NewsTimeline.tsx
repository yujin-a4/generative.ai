"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentNews, NewsArticle } from "@/app/lib/newsService";
import NewsCard from "./NewsCard";
import NewsLoading from "./NewsLoading";
import SummaryModal from "./SummaryModal";
import { getMonthWeeks, getMonthLabel, getMonthSortKey } from "@/app/lib/weekUtils";
import { getWeeklySummaries, getMonthlySummaries } from "@/app/lib/newsService";

// 2주(14일) 이내 생성된 리포트인지 확인
function isRecentReport(createdAt: any): boolean {
  if (!createdAt) return false;
  const ts = createdAt?.toDate?.() ?? createdAt;
  if (!ts) return false;
  const diffMs = Date.now() - new Date(ts).getTime();
  return diffMs < 14 * 24 * 60 * 60 * 1000;
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
  startDate: Date;
  endDate: Date;
  news: NewsArticle[];
}

interface MonthGroup {
  label: string;
  sortKey: string;
  year: number;
  month: number;
  weeks: WeekGroup[];
}

// ✅ [추가] 로컬 타임존 기준 YYYY-MM-DD 문자열 생성 함수
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // 주간/월간 요약 NEW 배지용
  const [weeklySummaryMap, setWeeklySummaryMap] = useState<Record<string, any>>({});
  const [monthlySummaryMap, setMonthlySummaryMap] = useState<Record<string, any>>({});

  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    type: "weekly" | "monthly";
    weekLabel?: string;
    weekStartDate?: string;
    weekEndDate?: string;
    year?: number;
    month?: number;
  }>({ isOpen: false, type: "weekly" });

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  // 주간/월간 요약 목록 fetch (NEW 배지용)
  useEffect(() => {
    getWeeklySummaries(false).then(list => {
      const map: Record<string, any> = {};
      list.forEach((s: any) => { if (s.week_label) map[s.week_label] = s; });
      setWeeklySummaryMap(map);
    });
    getMonthlySummaries(false).then(list => {
      const map: Record<string, any> = {};
      list.forEach((s: any) => { map[`${s.year}-${s.month}`] = s; });
      setMonthlySummaryMap(map);
    });
  }, []);


  // 월별/주별 그룹핑 로직
  const groupedByMonth: Record<string, { 
    label: string; 
    sortKey: string; 
    year: number;
    month: number;
    weekGroups: Map<number, WeekGroup>;
    monthWeeksInfo: any[];
  }> = {};

  // 1단계: 월별로 먼저 그룹핑하고 각 월의 주차 정보 생성
  allNews.forEach((news) => {
    const targetDate = news.publishedAt || news.createdAt;
    if (!targetDate) return;
    
    const date = targetDate.toDate();
    const monthLabel = getMonthLabel(date);
    const monthSortKey = getMonthSortKey(date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (!groupedByMonth[monthLabel]) {
      groupedByMonth[monthLabel] = { 
        label: monthLabel, 
        sortKey: monthSortKey, 
        year,
        month,
        weekGroups: new Map(),
        monthWeeksInfo: getMonthWeeks(year, month)
      };
    }
  });

  // 2단계: 각 월의 주차 정보를 기반으로 WeekGroup 초기화
  Object.values(groupedByMonth).forEach(monthData => {
    monthData.monthWeeksInfo.forEach(weekInfo => {
      monthData.weekGroups.set(weekInfo.weekNumber, {
        label: weekInfo.weekLabel,
        dbLabel: weekInfo.weekDbLabel,
        sortKey: weekInfo.weekNumber,
        startDate: new Date(weekInfo.startDate),
        endDate: new Date(weekInfo.endDate),
        news: []
      });
    });
  });

  // 3단계: 뉴스를 해당 주에 배치
  allNews.forEach((news) => {
    const targetDate = news.publishedAt || news.createdAt;
    if (!targetDate) return;
    
    const date = targetDate.toDate();
    const monthLabel = getMonthLabel(date);
    const monthData = groupedByMonth[monthLabel];
    
    if (!monthData) return;

    // 해당 날짜가 속한 주 찾기
    const weekInfo = monthData.monthWeeksInfo.find(w => 
      date >= w.startDate && date <= w.endDate
    );

    if (weekInfo) {
      const weekGroup = monthData.weekGroups.get(weekInfo.weekNumber);
      if (weekGroup) {
        weekGroup.news.push(news);
      }
    }
  });

  // 정렬된 월별 데이터
  const sortedMonths: MonthGroup[] = Object.values(groupedByMonth)
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .map(month => ({
      label: month.label,
      sortKey: month.sortKey,
      year: month.year,
      month: month.month,
      weeks: Array.from(month.weekGroups.values())
        .filter(week => week.news.length > 0)
        .sort((a, b) => b.sortKey - a.sortKey)
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

  // ✅ [핵심 수정] 요약 모달 열기 - 주간 (타임존 문제 해결)
  const openWeeklySummary = (weekDbLabel: string, startDate: Date, endDate: Date) => {
    // 로컬 타임존 기준으로 날짜 문자열 생성 (toISOString 사용하지 않음!)
    const startDateStr = formatLocalDate(startDate);
    const endDateStr = formatLocalDate(endDate);
    
    console.log('📅 주간요약 열기:', {
      weekDbLabel,
      startDate: startDateStr,
      endDate: endDateStr,
      // 디버깅용: 원본 Date 객체 정보
      startDateRaw: `${startDate.getFullYear()}-${startDate.getMonth()+1}-${startDate.getDate()}`,
      endDateRaw: `${endDate.getFullYear()}-${endDate.getMonth()+1}-${endDate.getDate()}`
    });
    
    setSummaryModal({
      isOpen: true,
      type: "weekly",
      weekLabel: weekDbLabel,
      weekStartDate: startDateStr,
      weekEndDate: endDateStr,
    });
  };

  // 요약 모달 열기 - 월간
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
      <div className="w-full">
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
                  className="relative px-4 py-2 mr-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  📊 월간요약
                  {isRecentReport(monthlySummaryMap[`${month.year}-${month.month}`]?.created_at) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-full bg-red-500 text-white animate-pulse">
                      NEW
                    </span>
                  )}
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
                            {week.news.length}개의 뉴스 • {week.startDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ {week.endDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                        
                        {/* 주간 요약 버튼 */}
                        <button
                          onClick={() => openWeeklySummary(week.dbLabel, week.startDate, week.endDate)}
                          className="relative px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          📊 주간요약
                          {isRecentReport(weeklySummaryMap[week.dbLabel]?.created_at) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-full bg-red-500 text-white animate-pulse">
                              NEW
                            </span>
                          )}
                        </button>
                      </div>

                      {/* 해당 주 뉴스 카드들 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {week.news.map((newsItem) => (
                          <NewsCard 
                            key={newsItem.id} 
                            news={newsItem} 
                            onClick={() => onNewsClick(newsItem)}
                            onEdit={onNewsEdit}
                            refreshList={onRefresh}
                            hideSummary={true}
                            isTimelineView={true}
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
        weekStartDate={summaryModal.weekStartDate}
        weekEndDate={summaryModal.weekEndDate}
        year={summaryModal.year}
        month={summaryModal.month}
      />
    </>
  );
}
