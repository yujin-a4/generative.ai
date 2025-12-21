"use client";

import { useEffect, useState } from "react";
import { getAllReports, deleteReport } from "@/app/actions/analyze";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const REPORT_CATEGORIES = [
  { id: "llm", label: "LLM 순위", icon: "🤖", searchKey: "LLM", keywords: ["LLM", "종합"] },
  { id: "image", label: "이미지 AI", icon: "🎨", searchKey: "Image", keywords: ["Image", "이미지"] },
  { id: "video", label: "영상 AI", icon: "🎬", searchKey: "Video", keywords: ["Video", "영상"] },
  { id: "tts", label: "TTS (음성 합성)", icon: "🎶", searchKey: "TTS", keywords: ["TTS", "음성합성", "Voice"] },
  { id: "stt", label: "STT (음성 인식)", icon: "🎙️", searchKey: "STT", keywords: ["STT", "음성인식", "Speech"] },
  { id: "service", label: "서비스 랭킹", icon: "🏆", searchKey: "Service", keywords: ["Service", "서비스"] },
];

const SUMMARY_ICONS = ["🎯", "📈", "💡", "⚡", "🔮"];

export default function ReportTab() {
  const [allReports, setAllReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const searchParams = useSearchParams();
  const initialSub = searchParams.get('sub');
  
  const [activeCategory, setActiveCategory] = useState(initialSub || "llm");

  const fetchData = async () => {
    setLoading(true);
    const data = await getAllReports();
    setAllReports(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === "yujinkang1008@gmail.com") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
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

  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("정말로 이 리포트를 삭제하시겠습니까? (복구 불가)")) return;

    const res = await deleteReport(id);
    if (res.success) {
      alert("리포트가 삭제되었습니다.");
      fetchData();
    } else {
      alert("삭제 실패");
    }
  };

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
      {/* 1. 메인 헤더 영역 (기존 유지) */}
      <div className="max-w-7xl mx-auto px-6 pt-8 mb-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">AI 순위 리포트</h1>
        <p className="text-gray-500 dark:text-gray-400">
          공신력 있는 벤치마크 데이터를 기반으로 한 분야별 모델 성능 순위를 확인하세요.
        </p>
      </div>

      {/* 🛠️ [수정] 2. 탭 네비게이션: AI 뉴스 스타일로 통일 (카드 컨테이너 적용) */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex overflow-x-auto no-scrollbar gap-2">
          {REPORT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2
                ${activeCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
            >
              <span className="text-lg">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 실제 리포트 컨텐츠 영역 */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
      {/* 🛠️ [수정] 빨간색 네모 부분(중복 제목) 삭제 및 버튼만 우측 정렬 */}
      <div className="flex justify-end mb-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
          <Link 
            href={`/trends?category=${encodeURIComponent(currentCatInfo?.searchKey || "")}`}
            className="inline-flex items-center px-5 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:shadow-md transition-all group"
          >
            <span>📈 기간별 분석 보기</span>
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* 리포트 그리드 */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">데이터 로딩 중...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
       
       {/* 리포트 그리드 영역 내부의 카드 컴포넌트 */}
       {filteredReports.map((report) => (
         <Link href={`/report/${report.id}`} key={report.id} className="group block relative">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-200 dark:border-zinc-800 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col relative">
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDeleteReport(e, report.id)}
                      className="absolute top-2 right-2 z-20 p-2 bg-white/80 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full shadow-sm transition-colors"
                      title="리포트 삭제"
                    >
                      🗑️
                    </button>
                  )}

                  {isNew(report.created_at) && (
                    <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md animate-pulse z-10 pointer-events-none">
                      NEW
                    </div>
                  )}
                  <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 flex items-end">
                    <h3 className="text-white font-bold text-xl line-clamp-2 leading-tight drop-shadow-md">
                      {report.analysis_result?.report_title || "분석 리포트"}
                    </h3>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
                      <span>📅 {formatDate(report.created_at)}</span>
                    </div>
                    
        {/* 🛠️ [수정] 줄글 요약 대신 TOP 3 순위 리스트 표시 */}
        <div className="space-y-2.5 mb-8 flex-1">
          {report.analysis_result?.raw_data?.test_benchmarks?.total_ranking?.slice(0, 3).map((item: any, idx: number) => (
            <div 
              key={idx} 
              className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 group-hover:border-indigo-100 dark:group-hover:border-indigo-900/30 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* 순위 배지 */}
                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black shadow-sm ${
                  idx === 0 ? "bg-yellow-400 text-white" :
                  idx === 1 ? "bg-slate-300 text-gray-700" :
                  "bg-orange-300 text-white"
                }`}>
                  {idx + 1}
                </span>
                {/* 모델명 (말줄임 처리) */}
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">
                  {item.model.split('/').pop()?.replace(/-/g, ' ')}
                </span>
              </div>
              {/* 점수 또는 등급 */}
              <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">
                {item.score || item.elo || "TOP"}
              </span>
            </div>
          )) || (
            // 데이터가 없는 경우 폴백 메시지
            <p className="text-sm text-gray-400 italic text-center py-4">순위 정보를 불러오는 중...</p>
          )}
        </div>
        
        <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-bold text-sm group-hover:translate-x-1 transition-transform">
          상세 리포트 보기 <span className="ml-1">→</span>
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