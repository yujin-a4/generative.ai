"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecentNews, getWeeklySummaries, getMonthlySummaries, getRecentHeadlines } from "@/app/lib/newsService";
import { generateTrendHeadline } from "@/app/actions/analyzeNews";
import { getAllReports } from "@/app/actions/analyze";
import { getAiServices, upsertServiceUrl } from "@/app/actions/serviceActions";
import { MenuType } from "./Sidebar";
import type { AIService } from "@/types/service";
import NewsDetailModal from "./NewsTab/NewsDetailModal";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface DashboardProps {
  onMenuChange?: (menu: MenuType) => void;
}

// 🎨 카테고리 설정
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string; reportKeywords: string[] }> = {
  LLM: { 
    label: "LLM / 채팅", 
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300", 
    icon: "🤖",
    reportKeywords: ["LLM", "모델", "언어"]
  },
  IMAGE: { 
    label: "이미지 생성", 
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300", 
    icon: "🎨",
    reportKeywords: ["이미지", "Image"]
  },
  VIDEO: { 
    label: "영상 생성", 
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300", 
    icon: "🎬",
    reportKeywords: ["영상", "Video", "비디오"]
  },
  TTS: { 
    label: "오디오 / TTS", 
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300", 
    icon: "🎧",
    reportKeywords: ["음성", "오디오", "TTS", "Audio"]
  },
  STT: { 
    label: "회의 / STT", 
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300", 
    icon: "🎙️",
    reportKeywords: ["회의", "STT", "받아쓰기"]
  },
  CODING: { 
    label: "코딩 / 개발", 
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", 
    icon: "💻",
    reportKeywords: ["코딩", "Coding", "개발"]
  },
  OTHER: { label: "기타 툴", color: "bg-gray-100 text-gray-700", icon: "🔧", reportKeywords: [] }
};

export default function Dashboard({ onMenuChange }: DashboardProps) {
  const queryClient = useQueryClient();
  
  // 상태 관리
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ name: string; category: string } | null>(null);
  const [linkUrlInput, setLinkUrlInput] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === "yujinkang1008@gmail.com");
    });
    return () => unsubscribe();
  }, []);

  // 데이터 조회
  const { data: allNews } = useQuery({ queryKey: ["recentNews", "dashboard"], queryFn: () => getRecentNews(1000) });
  const { data: recentNews } = useQuery({ queryKey: ["recentNews", "dashboard-preview"], queryFn: () => getRecentNews(5) });
  const { data: allReports } = useQuery({ queryKey: ["recentReports", "dashboard"], queryFn: () => getAllReports() });
  const { data: weeklySummaries } = useQuery({ queryKey: ["weeklySummaries", "dashboard"], queryFn: () => getWeeklySummaries(false) });
  const { data: monthlySummaries } = useQuery({ queryKey: ["monthlySummaries", "dashboard"], queryFn: () => getMonthlySummaries(false) });
  const { data: rawServices } = useQuery({ queryKey: ["aiServices", "dashboard"], queryFn: () => getAiServices() });
  
  const { data: trendHeadline, isLoading: isHeadlineLoading } = useQuery({
    queryKey: ["aiTrendHeadline"],
    queryFn: async () => {
      const headlines = await getRecentHeadlines(14);
      if (headlines.length === 0) return { headline: "데이터 수집 중입니다..." };
      return await generateTrendHeadline(headlines);
    },
    staleTime: 1000 * 60 * 60, 
    refetchOnWindowFocus: false,
  });

  const aiServices = useMemo(() => Array.isArray(rawServices) ? (rawServices as AIService[]) : [], [rawServices]);

  // 주목할 AI 선정 로직
  const featuredTools = useMemo(() => {
    const targetCategories = ["LLM", "IMAGE", "VIDEO", "TTS", "STT", "CODING"];
    
    return targetCategories.map((category) => {
      const config = CATEGORY_CONFIG[category];
      let selectedTool: any = null;

      if (allReports && (allReports as any[]).length > 0) {
        const relevantReport = (allReports as any[]).find(r => {
          const title = r.analysis_result?.report_title || "";
          return config.reportKeywords.some(keyword => title.includes(keyword));
        });

        if (relevantReport?.analysis_result?.raw_data?.test_benchmarks?.total_ranking) {
          const top1 = relevantReport.analysis_result.raw_data.test_benchmarks.total_ranking[0];
          const matchedService = aiServices.find(s => 
            s.name.toLowerCase().includes(top1.model.toLowerCase()) || 
            top1.model.toLowerCase().includes(s.name.toLowerCase())
          );

          selectedTool = {
            id: matchedService?.id || `bench-${category}`,
            name: top1.model,
            desc: `🏆 Benchmark 1위 (점수: ${top1.score})`,
            category: category,
            url: matchedService?.url,
            isBenchmark: true
          };
        }
      }

      if (!selectedTool) {
        const topService = aiServices
          .filter(s => s.category === category)
          .sort((a, b) => (Number(b.isTrending) - Number(a.isTrending)) || (b.likes || 0) - (a.likes || 0))[0];

        if (topService) {
          selectedTool = {
            id: topService.id,
            name: topService.name,
            desc: topService.description,
            category: category,
            url: topService.url,
            isBenchmark: false
          };
        }
      }

      if (!selectedTool) {
        const defaults: Record<string, any> = {
          LLM: { name: "Gemini 2.0", desc: "구글의 차세대 멀티모달 모델" },
          IMAGE: { name: "Midjourney v6", desc: "사실적인 이미지 생성의 최강자" },
          VIDEO: { name: "Sora", desc: "텍스트로 비디오 생성" },
          TTS: { name: "ElevenLabs", desc: "가장 자연스러운 AI 음성" },
          STT: { name: "Whisper", desc: "OpenAI의 강력한 음성 인식" },
          CODING: { name: "Cursor", desc: "AI 기반 코드 에디터" },
        };
        selectedTool = {
          id: `def-${category}`,
          name: defaults[category]?.name || "준비 중",
          desc: defaults[category]?.desc || "데이터 집계 중입니다.",
          category: category,
          url: "",
          isBenchmark: false
        };
      }

      return selectedTool;
    });
  }, [allReports, aiServices]);

  // 핸들러
  const handleToolClick = (url?: string) => {
    if (url) window.open(url, "_blank");
    else alert("해당 서비스의 링크 정보가 없습니다. 😅\n(관리자가 곧 추가할 예정입니다!)");
  };

  const handleNewsClick = (news: any) => { setSelectedNews(news); setIsNewsModalOpen(true); };
  const handleCloseNewsModal = () => { setSelectedNews(null); setIsNewsModalOpen(false); };

  const openLinkModal = (e: React.MouseEvent, name: string, category: string) => {
    e.stopPropagation(); setLinkTarget({ name, category }); setLinkUrlInput(""); setIsLinkModalOpen(true);
  };

  const handleSaveLink = async () => {
    if (!linkTarget || !linkUrlInput.trim()) return;
    let finalUrl = linkUrlInput.trim();
    if (!finalUrl.startsWith("http")) finalUrl = "https://" + finalUrl;
    const result = await upsertServiceUrl(linkTarget.name, finalUrl, linkTarget.category);
    if (result.success) {
      alert("링크가 연결되었습니다! ✅");
      await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
      setIsLinkModalOpen(false);
    } else alert("오류 발생: " + result.error);
  };

  const hotNews = useMemo(() => {
    if (!allNews) return [];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return allNews.filter((n: any) => {
      const d = n.publishedAt?.toDate?.() || new Date(n.createdAt || n.timestamp);
      return d >= weekAgo;
    }).sort((a: any, b: any) => ((a.likes || 0) + (a.bookmarkedBy?.length || 0)) - ((b.likes || 0) + (b.bookmarkedBy?.length || 0)))
      .reverse().slice(0, 3);
  }, [allNews]);

  const latestWeeklySummary: any = Array.isArray(weeklySummaries) && weeklySummaries.length > 0 ? weeklySummaries[0] : null;
  const latestMonthlySummary: any = Array.isArray(monthlySummaries) && monthlySummaries.length > 0 ? monthlySummaries[0] : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black font-sans p-6 relative">
      <div className="max-w-7xl mx-auto">
        
        {/* 상단 타이틀 */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">대시보드</h1>
          <p className="text-gray-500 dark:text-gray-400">AI 트렌드 분석 플랫폼의 주요 정보를 한눈에 확인하세요</p>
        </div>

        {/* AI 트렌드 헤드라인 */}
        <div className="mb-8 relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 shadow-lg text-white">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
          <div className="relative p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-shrink-0 flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/30">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold tracking-wider">LIVE TREND</span>
            </div>
            <div className="flex-1">
              {isHeadlineLoading ? (
                <div className="h-7 w-full md:w-2/3 bg-white/20 rounded animate-pulse"></div>
              ) : (
                <p className="text-lg md:text-xl font-bold leading-snug drop-shadow-sm">
                  {trendHeadline?.headline || "현재 수집된 데이터로 트렌드를 분석하고 있습니다..."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* 1. HOT 뉴스 (Col 4) */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-red-100 dark:border-red-900/20 h-full relative overflow-hidden flex flex-col">
               <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
               <div className="flex items-center justify-between mb-6 relative z-10">
                 <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                   <span className="text-2xl">🔥</span> HOT 뉴스
                 </h2>
                 <button onClick={() => onMenuChange?.('news')} className="text-gray-400 hover:text-red-500 text-xs font-bold transition-colors">전체보기</button>
               </div>
               
               <div className="flex-1 flex flex-col gap-3 relative z-10">
                 {hotNews.length > 0 ? hotNews.map((news: any, index: number) => {
                   const isTop = index === 0;
                   return (
                     <div key={news.id} onClick={() => handleNewsClick(news)} 
                      className={`group cursor-pointer rounded-xl p-4 transition-all duration-200 border relative ${isTop ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 shadow-sm" : "bg-gray-50/50 dark:bg-zinc-800/50 border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 hover:shadow-sm"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg font-bold text-sm ${isTop ? "bg-red-500 text-white shadow-md shadow-red-200" : index === 1 ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-gray-400"}`}>{index + 1}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-bold mb-1 line-clamp-2 leading-snug ${isTop ? "text-gray-900 dark:text-white text-base" : "text-gray-700 dark:text-gray-200"}`}>{news.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                              <span className="truncate max-w-[80px]">{news.source || "AI News"}</span><span>•</span>
                              <span>{new Date(news.publishedAt?.toDate?.() || news.createdAt || Date.now()).toLocaleDateString('ko-KR')}</span>
                            </div>
                          </div>
                        </div>
                     </div>
                   );
                 }) : (
                   <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">데이터를 집계하고 있습니다...</div>
                 )}
               </div>
            </div>
          </div>

          {/* 2. 주목할 AI (Col 8) */}
          <div className="lg:col-span-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-6 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">✨ 이번 주 주목할 AI</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">분야별 최고의 성능을 보여주는 모델을 선정했습니다.</p>
              </div>
              <button onClick={() => onMenuChange?.('reports')} className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium transition-colors">더보기</button>
            </div>

            {/* 카드 그리드: 컴팩트한 사이즈 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              {featuredTools.map((tool, idx) => {
                const style = CATEGORY_CONFIG[tool.category] || CATEGORY_CONFIG["OTHER"];
                return (
                  <div 
                    key={tool.id || idx}
                    onClick={() => handleToolClick(tool.url)}
                    className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-indigo-50 dark:border-indigo-900/20 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform cursor-pointer hover:shadow-md flex flex-col h-full"
                  >
                    {isAdmin && (
                      <button onClick={(e) => openLinkModal(e, tool.name, tool.category)} className="absolute top-2 right-2 p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition-colors z-20">🔗</button>
                    )}
                    
                    {!isAdmin && (
                      <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="text-6xl grayscale">{style.icon}</span>
                      </div>
                    )}

                    {/* 상단: 뱃지 */}
                    <div className="mb-3">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold ${style.color}`}>
                        <span>{style.icon}</span><span>{style.label}</span>
                      </div>
                    </div>

                    {/* 중단: 콘텐츠 (높이 균등화) */}
                    <div className="flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1 leading-tight min-h-[2.5rem] line-clamp-2">
                        {tool.name}
                        {tool.url && <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>}
                      </h3>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 h-[2.5rem] leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 하단 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-zinc-800">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">최근 뉴스</h2>
                <button onClick={() => onMenuChange?.('news')} className="text-gray-400 hover:text-blue-500 text-xs transition-colors font-medium">더보기</button>
             </div>
             {recentNews && recentNews.length > 0 ? (
               <div className="space-y-4">
                 {recentNews.slice(0, 5).map((news: any) => (
                   <div key={news.id} onClick={() => handleNewsClick(news)} className="p-4 rounded-lg border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                     <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{news.title}</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{news.shortSummary || news.summary}</p>
                     <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                       <span>{new Date(news.publishedAt?.toDate?.() || news.createdAt || Date.now()).toLocaleDateString('ko-KR')}</span>
                       {news.category && <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-300">{news.category}</span>}
                     </div>
                   </div>
                 ))}
               </div>
             ) : (<div className="text-center py-10 text-gray-400">뉴스가 없습니다.</div>)}
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-zinc-800">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">최근 리포트</h2>
                <button onClick={() => onMenuChange?.('news')} className="text-gray-400 hover:text-blue-500 text-xs transition-colors font-medium">더보기</button>
             </div>
             <div className="space-y-4">
                {latestMonthlySummary && (
                  <div className="p-4 rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50 dark:bg-purple-900/10">
                    <div className="flex items-center gap-2 mb-2"><span className="text-lg">📅</span><span className="font-bold text-gray-900 dark:text-white">{latestMonthlySummary.month_label}</span></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{latestMonthlySummary.summary}</p>
                  </div>
                )}
                {latestWeeklySummary && (
                  <div className="p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2 mb-2"><span className="text-lg">📊</span><span className="font-bold text-gray-900 dark:text-white">{latestWeeklySummary.week_label}</span></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{latestWeeklySummary.summary}</p>
                  </div>
                )}
                {!latestMonthlySummary && !latestWeeklySummary && (
                  <div className="text-center py-10 text-gray-400">아직 리포트가 없습니다.</div>
                )}
             </div>
           </div>
        </div>
      </div>

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-4 dark:text-white">🔗 서비스 링크 연결</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4"><span className="font-bold text-indigo-600">{linkTarget?.name}</span> 서비스의 URL을 입력하세요.<br/>(입력 시 자동으로 해당 서비스가 등록됩니다)</p>
            <input type="text" className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-zinc-800 dark:text-white" placeholder="https://..." value={linkUrlInput} onChange={(e) => setLinkUrlInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">취소</button>
              <button onClick={handleSaveLink} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">연결하기</button>
            </div>
          </div>
        </div>
      )}

      <NewsDetailModal isOpen={isNewsModalOpen} onClose={handleCloseNewsModal} news={selectedNews} />
    </div>
  );
}