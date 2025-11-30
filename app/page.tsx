"use client";

import { useEffect, useState } from "react";
import { getAllReports } from "@/app/actions/analyze";
import Link from "next/link";

// 탭 메뉴 정의 (사용자용)
const TABS = [
  { id: "llm", label: "LLM 순위", icon: "🤖", searchKey: "LLM", keywords: ["LLM", "종합"] },
  { id: "image", label: "이미지 AI", icon: "🎨", searchKey: "Image", keywords: ["Image", "이미지"] },
  { id: "video", label: "영상 AI", icon: "🎬", searchKey: "Video", keywords: ["Video", "영상"] },
  { id: "coding", label: "코딩/개발", icon: "💻", searchKey: "Coding", keywords: ["Coding", "코딩", "Dev"] },
  { id: "agent", label: "에이전트", icon: "⚡", searchKey: "Agent", keywords: ["Agent", "에이전트", "비서"] },
  { id: "service", label: "서비스 랭킹", icon: "🏆", searchKey: "Service", keywords: ["Service", "서비스"] },
];

// 🌟 추가: 요약에 사용할 아이콘 배열
const SUMMARY_ICONS = ["🎯", "📈", "💡", "⚡", "🔮"];

export default function HomePage() {
  const [allReports, setAllReports] = useState<any[]>([]); // 전체 리포트
  const [filteredReports, setFilteredReports] = useState<any[]>([]); // 필터링된 리포트
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("llm");

  // 1. 데이터 가져오기
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getAllReports();
      setAllReports(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  // 2. 탭 필터링 로직
  useEffect(() => {
    if (!allReports) return;

    const currentTab = TABS.find(t => t.id === activeTab);
    if (!currentTab) return;

    const filtered = allReports.filter(report => {
      const title = report.analysis_result?.report_title || "";
      return currentTab.keywords.some(keyword => title.includes(keyword));
    });

    setFilteredReports(filtered);
  }, [activeTab, allReports]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const isNew = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  };

  const currentTabInfo = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black font-sans">
      {/* 헤더 */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-16 pb-8 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
          AI Service Insight 🧠
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          모델 성능 평가부터 실전 서비스 랭킹까지, AI의 모든 것
        </p>
      </header>

      {/* 탭 네비게이션 */}
      <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4">
        <div className="max-w-6xl mx-auto flex overflow-x-auto no-scrollbar space-x-4 md:space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors flex items-center gap-2
                ${activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        
        {/* 서브 헤더 & 트렌드 버튼 */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 pb-4 border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {currentTabInfo?.icon} {currentTabInfo?.label} 리포트
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {currentTabInfo?.label} 관련 최신 분석을 확인하세요.
            </p>
          </div>
          
          <Link 
            href={`/trends?category=${encodeURIComponent(currentTabInfo?.searchKey || "")}`}
            className="mt-4 md:mt-0 inline-flex items-center px-5 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:shadow-md transition-all group"
          >
            <span>📈 기간별 분석 보기</span>
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* 리포트 리스트 */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">데이터 로딩 중...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                    
                    {/* 💡 수정된 요약 인사이트 표시 로직 (아이콘 + 간결) */}
                    <div className="space-y-2 mb-6 flex-1">
                      {report.analysis_result?.report_type === "LLM" ? (
                        <>
                          {/* 요약 1: 총평의 첫 문장 (가장 중요한 인사이트) */}
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-1 flex items-center gap-2">
                            <span className="text-lg">{SUMMARY_ICONS[0]}</span>
                            {report.analysis_result?.summary_insights?.[0] || "총평 인사이트 준비 중..."}
                          </p>
                          {/* 요약 2: 총평의 두 번째 문장 (두 번째 핵심 내용) */}
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center gap-2">
                            <span className="text-lg">{SUMMARY_ICONS[1]}</span>
                            {report.analysis_result?.summary_insights?.[1] || "두 번째 핵심 분석 내용은 없습니다."}
                          </p>
                        </>
                      ) : (
                        // LLM 외 리포트는 기존 overview_summary 사용
                        report.analysis_result?.overview_summary?.slice(0, 2).map((s: string, i: number) => (
                          <p key={i} className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                            {s.replace(/["']/g, "")}
                          </p>
                        ))
                      )}
                    </div>
                    {/* ------------------------------------- */}
                    
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
              아직 등록된 <strong>{currentTabInfo?.label}</strong> 리포트가 없습니다.
            </p>
            <Link href="/admin" className="text-indigo-600 font-bold hover:underline">
              관리자 페이지에서 만들기
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}