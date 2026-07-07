"use client";

import { useEffect, useState } from "react";
import { getAllReports, deleteReport } from "@/app/actions/analyze";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const REPORT_CATEGORIES = [
  { id: "llm",  label: "LLM 순위",       icon: "🤖",  searchKey: "LLM",   keywords: ["LLM", "종합"] },
  { id: "image", label: "이미지 AI",      icon: "🎨",  searchKey: "Image", keywords: ["Image", "이미지"] },
  { id: "video", label: "영상 AI",        icon: "🎬",  searchKey: "Video", keywords: ["Video", "영상"] },
  { id: "code",  label: "코딩 AI",        icon: "💻",  searchKey: "CODE",  keywords: ["CODE", "코딩", "Code"] },
  { id: "tts",   label: "TTS (음성 합성)", icon: "🎶",  searchKey: "TTS",   keywords: ["TTS", "음성합성", "Voice"] },
  { id: "stt",   label: "STT (음성 인식)", icon: "🎙️", searchKey: "STT",   keywords: ["STT", "음성인식", "Speech"] },
];

// 분야별 고유색 — admin의 REPORT_CONFIG 색 체계와 동일 (Tailwind 정적 클래스 유지 필수)
const CATEGORY_STYLES: Record<string, {
  tabActive: string;   // 활성 탭
  eyebrow: string;     // 카드 상단 분야 라벨
  chip: string;        // 점수 칩
  champRow: string;    // 1위(챔피언) 행
  champBadge: string;  // 1위 순위 배지
  focusRing: string;   // 포커스 링
}> = {
  llm: {
    tabActive:  "bg-indigo-600 text-white",
    eyebrow:    "text-indigo-600 dark:text-indigo-400",
    chip:       "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10",
    champRow:   "bg-indigo-50/70 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30",
    champBadge: "bg-indigo-600 text-white",
    focusRing:  "focus-visible:ring-indigo-500",
  },
  image: {
    tabActive:  "bg-pink-600 text-white",
    eyebrow:    "text-pink-600 dark:text-pink-400",
    chip:       "text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-500/10",
    champRow:   "bg-pink-50/70 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/30",
    champBadge: "bg-pink-600 text-white",
    focusRing:  "focus-visible:ring-pink-500",
  },
  video: {
    tabActive:  "bg-rose-600 text-white",
    eyebrow:    "text-rose-600 dark:text-rose-400",
    chip:       "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10",
    champRow:   "bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
    champBadge: "bg-rose-600 text-white",
    focusRing:  "focus-visible:ring-rose-500",
  },
  code: {
    tabActive:  "bg-cyan-600 text-white",
    eyebrow:    "text-cyan-600 dark:text-cyan-400",
    chip:       "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10",
    champRow:   "bg-cyan-50/70 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30",
    champBadge: "bg-cyan-600 text-white",
    focusRing:  "focus-visible:ring-cyan-500",
  },
  tts: {
    tabActive:  "bg-violet-600 text-white",
    eyebrow:    "text-violet-600 dark:text-violet-400",
    chip:       "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10",
    champRow:   "bg-violet-50/70 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30",
    champBadge: "bg-violet-600 text-white",
    focusRing:  "focus-visible:ring-violet-500",
  },
  stt: {
    tabActive:  "bg-emerald-600 text-white",
    eyebrow:    "text-emerald-600 dark:text-emerald-400",
    chip:       "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10",
    champRow:   "bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
    champBadge: "bg-emerald-600 text-white",
    focusRing:  "focus-visible:ring-emerald-500",
  },
};

function matchesCategory(report: any, cat: (typeof REPORT_CATEGORIES)[number]) {
  // 1차: report_type으로 정확 매칭 (가장 신뢰할 수 있는 방법)
  const reportType = (report.analysis_result?.report_type || "").toUpperCase();
  if (reportType === cat.searchKey.toUpperCase()) return true;
  // 2차: report_title 키워드 매칭 (대소문자 무시)
  const title = (report.analysis_result?.report_title || "").toLowerCase();
  return cat.keywords.some((keyword) => title.includes(keyword.toLowerCase()));
}

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
    setFilteredReports(allReports.filter(report => matchesCategory(report, currentCat)));
  }, [activeCategory, allReports]);

  // 카테고리 변경 + URL sub 파라미터 동기화
  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    const url = new URL(window.location.href);
    url.searchParams.set('sub', categoryId);
    window.history.replaceState({}, '', url.toString());
  };

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
  const style = CATEGORY_STYLES[activeCategory] || CATEGORY_STYLES.llm;

  return (
    <div className="w-full">
      {/* 1. 헤더: 제목 + 기간별 분석 링크를 한 줄로 */}
      <div className="w-full px-10 pt-5 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">AI 순위 리포트</h1>
          <p className="text-gray-500 dark:text-gray-400">
            공신력 있는 벤치마크 데이터를 기반으로 한 분야별 모델 성능 순위를 확인하세요.
          </p>
        </div>
        <Link
          href={`/trends?category=${encodeURIComponent(currentCatInfo?.searchKey || "")}`}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${style.focusRing}`}
        >
          📈 기간별 분석 보기
          <span aria-hidden className="group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none">→</span>
        </Link>
      </div>

      {/* 2. 탭 네비게이션: 분야별 고유색 + 리포트 개수 */}
      <div className="w-full px-10 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-zinc-800 flex overflow-x-auto no-scrollbar gap-1" role="tablist" aria-label="리포트 분야">
          {REPORT_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const count = allReports.filter(r => matchesCategory(r, cat)).length;
            const st = CATEGORY_STYLES[cat.id];
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${st.focusRing}
                  ${active
                    ? st.tabActive
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  }`}
              >
                <span aria-hidden>{cat.icon}</span>
                {cat.label}
                {count > 0 && (
                  <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                    active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 리포트 그리드 */}
      <div className="w-full px-10 pb-12">
        {loading ? (
          <div className="text-center py-20" role="status">
            <div className="w-10 h-10 border-4 border-gray-200 dark:border-zinc-700 border-t-gray-500 dark:border-t-zinc-300 rounded-full animate-spin motion-reduce:animate-none mx-auto mb-4" aria-hidden></div>
            <p className="text-gray-500">데이터 로딩 중...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
            {filteredReports.map((report) => (
              <Link
                href={`/report/${report.id}`}
                key={report.id}
                className={`group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 rounded-2xl ${style.focusRing}`}
              >
                <article className="relative h-full flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 transition-all duration-300 motion-reduce:transition-none hover:-translate-y-1 motion-reduce:hover:translate-y-0 hover:shadow-lg hover:border-gray-300 dark:hover:border-zinc-700">

                  {/* 아이브로우: 분야 라벨 + NEW/삭제 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${style.eyebrow}`}>
                      <span aria-hidden>{currentCatInfo?.icon}</span>
                      {currentCatInfo?.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isNew(report.created_at) && (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDeleteReport(e, report.id)}
                          aria-label="리포트 삭제"
                          title="리포트 삭제"
                          className="p-1.5 -m-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 제목 + 날짜 */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1">
                    {report.analysis_result?.report_title || "분석 리포트"}
                  </h3>
                  <time className="block text-xs text-gray-400 dark:text-zinc-500 mb-5">
                    {formatDate(report.created_at)}
                  </time>

                  {/* TOP 3 순위 — 1위는 챔피언 행으로 강조. test_benchmarks 또는 vote_rankings.overall 둘 다 지원 */}
                  {(() => {
                    const reportType = (report.analysis_result?.report_type || "").toUpperCase();
                    const isTTS = reportType === "TTS";
                    const isSTT = reportType === "STT";

                    // 우선순위: TTS → vote_rankings.overall, 나머지 → test_benchmarks.total_ranking → vote_rankings.overall → sub_categories 첫 번째 항목
                    let topItems: any[] = [];
                    if (isTTS) {
                      topItems = report.analysis_result?.raw_data?.vote_rankings?.overall?.slice(0, 3) || [];
                    } else {
                      topItems = report.analysis_result?.raw_data?.test_benchmarks?.total_ranking?.slice(0, 3) || [];
                    }
                    if (topItems.length === 0) {
                      topItems = report.analysis_result?.raw_data?.vote_rankings?.overall?.slice(0, 3) || [];
                    }
                    if (topItems.length === 0) {
                      const subCats = report.analysis_result?.raw_data?.vote_rankings?.sub_categories || {};
                      const firstCatKey = Object.keys(subCats)[0];
                      if (firstCatKey) {
                        topItems = (subCats[firstCatKey]?.items || []).slice(0, 3);
                      }
                    }

                    if (topItems.length === 0) {
                      return <p className="text-sm text-gray-400 text-center py-6 flex-1">순위 정보가 아직 없습니다.</p>;
                    }

                    return (
                      <ol className="space-y-1.5 mb-6 flex-1" aria-label="상위 3개 모델">
                        {topItems.map((item: any, idx: number) => {
                          const scoreVal = isTTS
                            ? (item.elo ?? item.score ?? "")
                            : (item.score ?? item.elo ?? "");
                          const displayScore = scoreVal !== "" && scoreVal !== null
                            ? (isSTT ? `${Number(scoreVal).toFixed(1)}%` : `${Number(scoreVal).toLocaleString()}`)
                            : "TOP";
                          const modelName = (item.model || item.bestModel || item.org || "Unknown")
                            .split('/').pop()?.replace(/-/g, ' ');
                          const isChamp = idx === 0;

                          return (
                            <li
                              key={idx}
                              className={`flex items-center justify-between gap-3 rounded-xl border px-3 ${
                                isChamp
                                  ? `py-3 ${style.champRow}`
                                  : "py-2 border-transparent"
                              }`}
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-2.5">
                                <span
                                  aria-hidden
                                  className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black ${
                                    isChamp
                                      ? style.champBadge
                                      : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className={`truncate ${
                                  isChamp
                                    ? "text-[15px] font-bold text-gray-900 dark:text-white"
                                    : "text-sm font-medium text-gray-600 dark:text-gray-300"
                                }`}>
                                  {modelName}
                                </span>
                              </div>
                              <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md ${
                                isChamp ? style.chip : "text-gray-500 dark:text-zinc-400"
                              }`}>
                                {displayScore}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    );
                  })()}

                  <div className={`flex items-center gap-1 font-semibold text-sm ${style.eyebrow}`}>
                    상세 리포트 보기
                    <span aria-hidden className="group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none">→</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700">
            <p className="text-2xl mb-3" aria-hidden>{currentCatInfo?.icon}</p>
            <p className="text-gray-600 dark:text-gray-300 font-semibold mb-1">
              아직 {currentCatInfo?.label} 리포트가 없습니다
            </p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mb-5">
              첫 리포트를 만들면 이 분야의 모델 순위를 한눈에 볼 수 있어요.
            </p>
            {isAdmin && (
              <Link
                href="/admin"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${style.tabActive}`}
              >
                관리자 페이지에서 만들기 →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
