"use client";

import { useState, useEffect } from "react";
import { analyzeNewsArticle } from "@/app/actions/analyzeNews";
import { NEWS_CATEGORIES } from "@/app/lib/newsCategories";
import { addNews, updateNews, NewsArticle } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";

// 🌟 TypeScript 오류 방지를 위한 타입 정의
interface Site {
  name: string;
  url: string;
  desc: string;
  color?: string;
}

interface SiteGroup {
  title: string;
  color: string;
  sites: Site[];
}

const SITE_GROUPS: SiteGroup[] = [
  {
    title: "🇰🇷 국내 AI/IT 핵심",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300",
    sites: [
      { name: "AI 타임스", url: "https://www.aitimes.com/", desc: "국내 AI 전문" },
      { name: "GeekNews", url: "https://news.hada.io/", desc: "기술 요약" },
      { name: "요즘IT", url: "https://yozm.wishket.com/magazine/list/develop/", desc: "IT 칼럼" },
    ]
  },
  {
    title: "🌍 글로벌 공신력",
    color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-300",
    sites: [
      { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/", desc: "AI 속보" },
      { name: "MIT Tech", url: "https://www.technologyreview.com/topic/artificial-intelligence/", desc: "심층 분석" },
      { name: "The Verge", url: "https://www.theverge.com/ai-artificial-intelligence", desc: "테크 트렌드" },
    ]
  },
  {
    title: "🎓 에듀테크 & 🏛️ 정책",
    color: "text-gray-600 bg-gray-50", 
    sites: [
      { 
        name: "AskEdTech", 
        url: "https://www.askedtech.com/knowledge-archive", 
        desc: "지식 아카이브",
        color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300"
      },
      { 
        name: "에듀모닝", 
        url: "https://edumorning.com", 
        desc: "교육 뉴스",
        color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300"
      },
      { 
        name: "정책브리핑", 
        url: "https://www.korea.kr/", 
        desc: "대한민국 정책",
        color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300"
      },
    ]
  },
  {
    title: "🏢 빅테크 공식 블로그",
    color: "text-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300",
    sites: [
      { name: "DeepMind", url: "https://deepmind.google/discover/blog/", desc: "구글 연구" },
      { name: "OpenAI", url: "https://openai.com/blog", desc: "GPT 소식" },
      { name: "MS AI", url: "https://blogs.microsoft.com/ai/", desc: "코파일럿" },
    ]
  }
];

interface NewsSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: NewsArticle | null;
}

export default function NewsSubmitModal({ isOpen, onClose, initialData }: NewsSubmitModalProps) {
  const [step, setStep] = useState<"INPUT" | "ANALYZING" | "REVIEW">("INPUT");
  const [activeTab, setActiveTab] = useState<"manual" | "feed">("manual");
  const [autoNews, setAutoNews] = useState<any[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (isOpen && initialData) {
      setStep("REVIEW");
      setUrl(initialData.url);
      setManualText("");
      setShowManualInput(false);
      
      let dateStr = "";
      if (initialData.publishedAt?.toDate) {
         dateStr = initialData.publishedAt.toDate().toISOString().split("T")[0];
      }
      setAnalysisData({ 
        ...initialData, 
        date: dateStr,
        author: initialData.author || "" 
      });
    } else if (isOpen && !initialData) {
      setStep("INPUT");
      setActiveTab("manual");
      setUrl("");
      setManualText("");
      setShowManualInput(false);
      setAnalysisData(null);
      setError("");
      loadTrendingNews();
    }
  }, [isOpen, initialData]);

  const loadTrendingNews = async () => {
    setIsLoadingFeed(true);
    try {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Network response was not ok');
      
      const news = await response.json();
      setAutoNews(news);
    } catch (err) {
      console.error("뉴스 로드 중 오류:", err);
      setError("최신 뉴스를 가져오는 데 실패했습니다.");
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleDetailedSummaryChange = (index: number, value: string) => {
    const newSummary = [...(analysisData.detailedSummary || ["", "", ""])];
    newSummary[index] = value;
    setAnalysisData({ ...analysisData, detailedSummary: newSummary });
  };

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || url;
    if (!targetUrl && !manualText) return;
    setStep("ANALYZING");
  
    try {
      const result = await analyzeNewsArticle(targetUrl, manualText);
      
      if (result.resolvedUrl) setUrl(result.resolvedUrl);
  
      setAnalysisData({
        ...result,
        author: auth.currentUser?.displayName || ""
      });
      setStep("REVIEW");
    } catch (e: any) {
      setError("해당 링크의 내용을 가져오는 데 실패했습니다. 아래에 본문 내용을 직접 붙여넣어 주세요.");
      setShowManualInput(true);
      setStep("INPUT");
      setActiveTab("manual");
    }
  };

  const handleSubmit = async () => {
    if (!analysisData) return;
    setIsSubmitting(true);
    
    try {
      if (initialData && initialData.id) {
        await updateNews(initialData.id, { ...analysisData, url: url });
        alert("뉴스가 수정되었습니다! ✨");
      } else {
        await addNews({ ...analysisData, url: url });
        alert("뉴스가 게시되었습니다! 🎉");
      }
      onClose(); 
    } catch (error) {
      console.error(error);
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {step === "REVIEW" 
              ? (initialData ? "📝 뉴스 수정하기" : "📝 분석 결과 확인") 
              : "📰 뉴스 추가하기"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            ✕
          </button>
        </div>

        {/* 탭 메뉴 */}
        {step === "INPUT" && !initialData && (
          <div className="flex border-b border-gray-100 dark:border-zinc-800 px-6 bg-white dark:bg-zinc-900">
            <button 
              onClick={() => setActiveTab("manual")}
              className={`py-3 px-4 text-sm font-bold transition-all ${activeTab === "manual" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              직접 입력
            </button>
            <button 
              onClick={() => setActiveTab("feed")}
              className={`py-3 px-4 text-sm font-bold transition-all ${activeTab === "feed" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              최신 뉴스 모아보기
              {autoNews.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[10px]">{autoNews.length}</span>}
            </button>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {step === "INPUT" && (
            <div className="space-y-4">
              {activeTab === "manual" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      뉴스 기사 URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/article..."
                      className="w-full p-4 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />

                    {showManualInput && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                          ⚠️ 본문 직접 입력
                        </label>
                        <textarea
                          placeholder="본문 내용을 여기에 붙여넣으세요."
                          className="w-full p-4 border border-red-200 dark:border-red-900/30 rounded-xl bg-red-50/30 dark:bg-red-900/10 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                          rows={6}
                          value={manualText}
                          onChange={(e) => setManualText(e.target.value)}
                        />
                      </div>
                    )}
                    
                    {!showManualInput && (
                      <div className="mt-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                          💡 어디에서 뉴스를 찾나요? 아래 추천 사이트를 확인해 보세요.
                        </h4>
                        <div className="space-y-3 p-1">
                          {SITE_GROUPS.map((group) => (
                            <div key={group.title}>
                              <h5 className="text-[10px] font-bold text-gray-400 mb-1.5 ml-1">{group.title}</h5>
                              <div className="grid grid-cols-3 gap-2">
                                {group.sites.map((site: Site) => (
                                  <a 
                                    key={site.name}
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex flex-col px-2 py-2 rounded-lg border border-transparent hover:border-black/5 hover:shadow-sm transition-all text-center ${site.color || group.color}`}
                                  >
                                    <span className="text-xs font-bold block mb-0.5 truncate">{site.name}</span>
                                    <span className="text-[9px] opacity-70 truncate block">{site.desc}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
                  <button
                    onClick={() => handleAnalyze()}
                    disabled={!url && !manualText}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
                      showManualInput ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                    } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {showManualInput ? "본문 내용으로 다시 분석하기 ✨" : "Gemini로 분석 시작 ✨"}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* --- 🌟 안내 문구 추가 --- */}
                  <div className="bg-indigo-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                      실시간으로 수집된 최신 AI 뉴스를 확인해 보세요! 📰<br/>
                      공유하고 싶은 유익한 기사를 발견하셨다면, 링크(URL)를 복사해 '직접 입력' 탭에서 분석 및 등록하실 수 있습니다. ✨
                    </p>
                  </div>

                  {isLoadingFeed ? (
                    <div className="py-20 text-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-500 text-sm">최신 AI 뉴스를 수집 중입니다...</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {autoNews.map((news, idx) => (
                        <div key={idx} className="py-4 first:pt-0 group">
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex-1">
                              <span className="text-[10px] font-bold text-indigo-500 uppercase">{news.source}</span>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1 leading-snug group-hover:text-indigo-600 transition-colors">
                                {news.title}
                              </h4>
                              <p className="text-[11px] text-gray-400 mt-1">{new Date(news.pubDate).toLocaleDateString()}</p>
                            </div>
                            {/* --- 🌟 게시하기 버튼 삭제, 원문 보기만 유지 --- */}
                            <a 
                              href={news.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors shrink-0"
                            >
                              원문 보기
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "ANALYZING" && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
              <h4 className="text-xl font-bold animate-pulse">Gemini가 내용을 읽고 있어요...</h4>
              <p className="text-gray-500">핵심 내용을 요약하고 에듀테크 인사이트를 도출합니다.</p>
            </div>
          )}

          {step === "REVIEW" && analysisData && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">제목</label>
                <input 
                  value={analysisData.title} 
                  onChange={(e) => setAnalysisData({...analysisData, title: e.target.value})}
                  className="w-full mt-1 p-2 bg-transparent border-b border-gray-200 dark:border-zinc-700 font-bold text-lg focus:border-indigo-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">기사 날짜</label>
                   <input 
                     type="date"
                     value={analysisData.date || ""} 
                     onChange={(e) => setAnalysisData({...analysisData, date: e.target.value})}
                     className="w-full mt-1 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm font-medium"
                   />
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">출처</label>
                   <input 
                     value={analysisData.source} 
                     onChange={(e) => setAnalysisData({...analysisData, source: e.target.value})}
                     className="w-full mt-1 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm"
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">작성자</label>
                   <input 
                     value={analysisData.author || ""} 
                     onChange={(e) => setAnalysisData({...analysisData, author: e.target.value})}
                     className="w-full mt-1 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm font-medium"
                   />
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">카테고리</label>
                   <select 
                     value={analysisData.category}
                     onChange={(e) => setAnalysisData({...analysisData, category: e.target.value})}
                     className="w-full mt-1 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm cursor-pointer"
                   >
                     {Object.values(NEWS_CATEGORIES).map((cat) => (
                       <option key={cat.id} value={cat.id}>
                         {cat.icon} {cat.name}
                       </option>
                     ))}
                   </select>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">✨ 한 줄 핵심 요약</label>
                <textarea
                  value={analysisData.shortSummary}
                  onChange={(e) => setAnalysisData({...analysisData, shortSummary: e.target.value})}
                  className="w-full mt-2 bg-transparent border-none p-0 text-gray-800 dark:text-gray-200 font-medium focus:ring-0 resize-none text-sm"
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase">📝 핵심 요약</label>
                <div className="space-y-2">
                  {(analysisData.detailedSummary || ["", "", ""]).map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-indigo-500 mt-2.5 text-xs">•</span>
                      <textarea
                        value={item}
                        onChange={(e) => handleDetailedSummaryChange(idx, e.target.value)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none border-none"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-zinc-800/50 p-5 rounded-xl border border-blue-100 dark:border-zinc-800">
                <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2 block">💡 에듀테크 INSIGHT</label>
                <textarea
                  value={analysisData.insight}
                  onChange={(e) => setAnalysisData({...analysisData, insight: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-gray-800 dark:text-gray-200 text-sm leading-relaxed focus:ring-0"
                  rows={4}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? "처리 중..." : (initialData ? "수정 완료" : "게시하기")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}