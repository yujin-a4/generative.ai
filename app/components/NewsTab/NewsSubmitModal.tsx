"use client";

import { useState, useEffect } from "react";
import { analyzeNewsArticle } from "@/app/actions/analyzeNews";
import { NEWS_CATEGORIES } from "@/app/lib/newsCategories";
import { addNews, updateNews, NewsArticle } from "@/app/lib/newsService";

// 🌟 [수정] 3개 그룹으로 데이터 확장
const SITE_GROUPS = [
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
  const [url, setUrl] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 가이드 아코디언 상태
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setStep("REVIEW");
      setUrl(initialData.url);
      
      let dateStr = "";
      if (initialData.publishedAt?.toDate) {
         dateStr = initialData.publishedAt.toDate().toISOString().split("T")[0];
      }

      setAnalysisData({
        ...initialData,
        date: dateStr
      });
    } else if (isOpen && !initialData) {
      setStep("INPUT");
      setUrl("");
      setAnalysisData(null);
      setIsGuideOpen(false); 
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!url) return;
    setStep("ANALYZING");
    setError("");

    try {
      const result = await analyzeNewsArticle(url);
      setAnalysisData(result);
      setStep("REVIEW");
    } catch (e: any) {
      setError(e.message);
      setStep("INPUT");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {step === "REVIEW" 
              ? (initialData ? "📝 뉴스 수정하기" : "📝 분석 결과 확인") 
              : "📰 뉴스 링크 추가"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            ✕
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {step === "INPUT" && (
            <div className="space-y-4">
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
                
                {/* 🌟 [수정됨] 3단 그룹 아코디언 */}
                <div className="mt-3">
                  <button 
                    type="button"
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {isGuideOpen ? "▼ 추천 사이트 접기" : "💡 어디서 뉴스를 찾나요? (추천 사이트 보기)"}
                  </button>

                  {isGuideOpen && (
                    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 p-1">
                      {SITE_GROUPS.map((group) => (
                        <div key={group.title}>
                          <h5 className="text-[10px] font-bold text-gray-400 mb-1.5 ml-1">{group.title}</h5>
                          <div className="grid grid-cols-3 gap-2">
                            {group.sites.map((site) => (
                              <a 
                                key={site.name}
                                href={site.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex flex-col px-2 py-2 rounded-lg border border-transparent hover:border-black/5 hover:shadow-sm transition-all text-center ${group.color}`}
                              >
                                <span className="text-xs font-bold block mb-0.5 truncate">
                                   {site.name}
                                </span>
                                <span className="text-[9px] opacity-70 truncate block">
                                  {site.desc}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* 🌟 [끝] */}

              </div>
              {error && <p className="text-red-500 text-sm">⚠️ {error}</p>}
              <button
                onClick={handleAnalyze}
                disabled={!url}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Gemini로 분석 시작 ✨
              </button>
            </div>
          )}

          {step === "ANALYZING" && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
              <h4 className="text-xl font-bold animate-pulse">Gemini가 기사를 읽고 있어요...</h4>
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

              <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">카테고리 (자동분류)</label>
                 <select 
                    value={analysisData.category}
                    onChange={(e) => setAnalysisData({...analysisData, category: e.target.value})}
                    className="w-full mt-1 p-2 bg-gray-50 dark:bg-zinc-800 rounded-md text-sm cursor-pointer"
                 >
                   {Object.values(NEWS_CATEGORIES).map((cat: any) => (
                     <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                   ))}
                 </select>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1">
                  ✨ 한 줄 핵심 요약
                </label>
                <textarea
                  value={analysisData.shortSummary}
                  onChange={(e) => setAnalysisData({...analysisData, shortSummary: e.target.value})}
                  className="w-full mt-2 bg-transparent border-none p-0 text-gray-800 dark:text-gray-200 font-medium focus:ring-0 resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">💡 에듀테크/산업 인사이트</label>
                <textarea
                  value={analysisData.insight}
                  onChange={(e) => setAnalysisData({...analysisData, insight: e.target.value})}
                  className="w-full mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={3}
                />
              </div>

              <div>
                 <label className="text-xs font-bold text-gray-500 uppercase">해시태그</label>
                 <div className="flex flex-wrap gap-2 mt-2">
                   {analysisData.tags?.map((tag: string, i: number) => (
                     <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-zinc-700 rounded text-xs text-gray-600 dark:text-gray-300">
                       {tag}
                     </span>
                   ))}
                 </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
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