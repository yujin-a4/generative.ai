// app/components/ReportTab.tsx
"use client";

import { useEffect, useState } from "react";
import { getAllReports } from "@/app/actions/analyze";
import Link from "next/link";

// 기존 TABS 정의 유지
const REPORT_CATEGORIES = [
  { id: "llm", label: "LLM 순위", icon: "🤖", searchKey: "LLM", keywords: ["LLM", "종합"] },
  { id: "image", label: "이미지 AI", icon: "🎨", searchKey: "Image", keywords: ["Image", "이미지"] },
  { id: "video", label: "영상 AI", icon: "🎬", searchKey: "Video", keywords: ["Video", "영상"] },
  { id: "coding", label: "코딩/개발", icon: "💻", searchKey: "Coding", keywords: ["Coding", "코딩", "Dev"] },
  { id: "agent", label: "에이전트", icon: "⚡", searchKey: "Agent", keywords: ["Agent", "에이전트", "비서"] },
  { id: "service", label: "서비스 랭킹", icon: "🏆", searchKey: "Service", keywords: ["Service", "서비스"] },
];

const SUMMARY_ICONS = ["🎯", "📈", "💡", "⚡", "🔮"];

export default function ReportTab() {
  const [allReports, setAllReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("llm");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getAllReports();
      setAllReports(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!allReports) return;

    const currentCat = REPORT_CATEGORIES.find(t => t.id === activeCategory);
    if (!currentCat) return;

    const filtered = allReports.filter(report => {
      const title = report.analysis_result?.report_title || "";
      return currentCat.keywords.some(keyword => title.includes(keyword));
    });

    setFilteredReports(filtered);
  }, [activeCategory, allReports]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const isNew = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  };

  const currentCatInfo = REPORT_CATEGORIES.find((t) => t.id === activeCategory);

  return (
    <div className="w-full">
      {/* 2차 탭 네비게이션 (리포트 카테고리) */}
      <div className="sticky top-[73px] z-10 bg-gray-50/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 mb-8">
        <div className="max-w-5xl mx-auto flex overflow-x-auto no-scrollbar space-x-4 md:space-x-8">
          {REPORT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`py-3 px-2 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors flex items-center gap-2
                ${activeCategory === cat.id
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
            >
              <span className="text-lg">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {/* 서브 헤더 & 트렌드 버튼 */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 pb-4 border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {currentCatInfo?.icon} {currentCatInfo?.label} 리포트
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {currentCatInfo?.label} 관련 최신 분석을 확인하세요.
            </p>
          </div>
          
          <Link 
            href={`/trends?category=${encodeURIComponent(currentCatInfo?.searchKey || "")}`}
            className="mt-4 md:mt-0 inline-flex items-center px-5 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:shadow-md transition-all group"
          >
            <span>📈 기간별 분석 보기</span>
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* 리포트 그리드 (기존 코드 동일) */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">데이터 로딩 중...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
            {filteredReports.map((report) => (
              <Link href={`/report/${report.id}`} key={report.id} className="group block">
                 <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-200 dark:border-zinc-800 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col relative">
                  {isNew(report.created_at) && (
                    <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md animate-pulse z-10">
                      NEW
                    </div>
                  )}
                  <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 flex items-end">
                    <h3 className="text-white font-bold text-xl line-clamp-2 leading-tight drop-shadow-md">
                      {report.analysis_result?.report_title || "분석 리포트"}
                    </h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                      <span>📅 {formatDate(report.created_at)}</span>
                    </div>
                    
                    <div className="space-y-2 mb-6 flex-1">
                      {report.analysis_result?.report_type === "LLM" ? (
                        <>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-1 flex items-center gap-2">
                            <span className="text-lg">{SUMMARY_ICONS[0]}</span>
                            {report.analysis_result?.summary_insights?.[0] || "총평 인사이트 준비 중..."}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center gap-2">
                            <span className="text-lg">{SUMMARY_ICONS[1]}</span>
                            {report.analysis_result?.summary_insights?.[1] || "두 번째 핵심 내용 없음"}
                          </p>
                        </>
                      ) : (
                        report.analysis_result?.overview_summary?.slice(0, 2).map((s: string, i: number) => (
                          <p key={i} className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                            {s.replace(/["']/g, "")}
                          </p>
                        ))
                      )}
                    </div>
                    
                    <div className="flex items-center text-indigo-600 font-semibold text-sm group-hover:underline">
                      상세 리포트 보기 &rarr;
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">
              아직 등록된 <strong>{currentCatInfo?.label}</strong> 리포트가 없습니다.
            </p>
            <Link href="/admin" className="text-indigo-600 font-bold hover:underline">
              관리자 페이지에서 만들기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}