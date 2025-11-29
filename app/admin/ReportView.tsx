"use client";

import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ReportViewProps {
  data: any;
  onSave?: () => void;
  onReanalyze?: () => void;
  isSaving?: boolean;
}

export default function ReportView({ data, onSave, onReanalyze, isSaving }: ReportViewProps) {
  if (!data) return null;

  const summaryPoints = Array.isArray(data.overview_summary)
    ? data.overview_summary
    : (data.overview_summary || data.summary)?.split(/(?<=[.?!])\s+/) || [];

  // 공통: 순위 뱃지
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  // LLM용: Tier 색상
  const getTierColor = (tier: string) => {
    const tierLower = tier?.toLowerCase() || "";
    if (tierLower.includes('s')) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    if (tierLower.includes('a')) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
    if (tierLower.includes('b')) return 'text-blue-600 bg-blue-100 border-blue-200';
    return 'text-gray-600 bg-gray-100 border-gray-200';
  };

  const getMaxScore = (models: Array<{ score: number }>) => {
    if (!models || models.length === 0) return 100;
    return Math.max(...models.map((m) => m.score || 0), 100);
  };

  // =========================================================
  // 🎨 모드 1: 이미지 생성 AI 리포트 UI (Pink Theme)
  // =========================================================
  if (data.report_type === "Image" || data.aesthetic_ranking) {
    return (
      <div className="max-w-[1400px] mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-800 my-10 font-sans border border-pink-100">
        
        {/* 헤더 (핑크 그라데이션) */}
        <header className="bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-20 transform -skew-y-6 origin-top-left"></div>
          <div className="relative z-10">
            <div className="inline-block p-3 bg-white/20 rounded-full mb-4 text-4xl backdrop-blur-sm shadow-lg">🎨</div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-sm">
               {data.report_title || "이미지 생성 AI 분석"}
            </h1>
            <p className="text-lg opacity-95 font-medium bg-white/10 inline-block px-4 py-1 rounded-full">
              화질(Quality)과 속도(Speed)의 완벽한 비교 분석
            </p>
          </div>
        </header>

        <div className="p-8 md:p-12 space-y-12 bg-rose-50/30">
           {/* 요약 카드 */}
           <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {summaryPoints.slice(0, 3).map((point: string, idx: number) => (
                <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-pink-500 hover:shadow-md transition-all hover:-translate-y-1">
                  <h3 className={`font-bold mb-3 text-lg flex items-center gap-2
                    ${idx === 0 ? "text-pink-600" : idx === 1 ? "text-rose-600" : "text-orange-500"}`}>
                    {idx === 0 ? "🔥 트렌드" : idx === 1 ? "👑 최고 화질" : "⚡ 인사이트"}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed font-medium">{point.replace(/["']/g, "")}</p>
                </div>
              ))}
           </section>

           {/* 1. 👁️ 화질 랭킹 (메인) */}
           <section>
             <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-pink-500 text-white w-8 h-8 rounded-lg flex items-center justify-center mr-3 shadow-md text-lg">👁️</span> 
                생성 화질 순위 (Text-to-Image)
             </h2>
             <div className="bg-white rounded-2xl shadow-lg border border-pink-100 overflow-hidden">
               <div className="grid grid-cols-1 divide-y divide-gray-100">
                 {data.text_to_image?.map((item: any, idx: number) => (
                   <div key={idx} className="flex items-center p-6 hover:bg-pink-50/50 transition-colors group relative">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl mr-6 shadow-sm z-10
                        ${idx === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-4 ring-white" : 
                          idx === 1 ? "bg-gray-200 text-gray-600" : 
                          idx === 2 ? "bg-orange-200 text-orange-700" : "bg-white border border-gray-200 text-gray-400"}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 z-10">
                        <div className="flex justify-between items-end mb-2">
                          <h3 className="text-xl font-bold text-gray-800 group-hover:text-pink-600 transition-colors">
                            {item.model}
                            {idx === 0 && <span className="ml-2 text-sm bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">BEST</span>}
                          </h3>
                          <div className="text-right">
                            <span className="block text-2xl font-black text-gray-800">{item.elo}</span>
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Elo Score</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3 overflow-hidden">
                          <div className="bg-gradient-to-r from-pink-400 to-rose-600 h-full rounded-full shadow-sm" 
                               style={{ width: `${(item.elo / 1300) * 100}%` }}></div>
                        </div>
                        <p className="text-sm text-gray-500 font-medium bg-gray-50 inline-block px-3 py-1 rounded-lg">{item.desc}</p>
                      </div>
                   </div>
                 ))}
               </div>
             </div>
           </section>

           {/* 2. 🖌️ 이미지 편집 (Image Editing) */}
           {data.image_editing && data.image_editing.length > 0 && (
             <section>
               <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-purple-500 text-white w-8 h-8 rounded-lg flex items-center justify-center mr-3 shadow-md text-lg">🖌️</span>
                  이미지 편집 순위 (In-painting)
               </h2>
               <div className="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
                 <div className="grid grid-cols-1 divide-y divide-gray-100">
                   {data.image_editing.map((item: any, idx: number) => (
                     <div key={idx} className="flex items-center p-6 hover:bg-purple-50/50 transition-colors group">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl mr-6 shadow-sm
                          ${idx < 3 ? "bg-gradient-to-br from-purple-400 to-indigo-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-2">
                            <h3 className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">{item.model}</h3>
                            <span className="text-purple-600 font-bold text-lg">{item.elo} <span className="text-xs text-gray-400">Elo</span></span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3 overflow-hidden">
                             <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${(item.elo / 1300) * 100}%` }}></div>
                          </div>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             </section>
           )}
        </div>
        
        {onSave && onReanalyze && (
          <div className="bg-white p-8 border-t border-gray-200 flex justify-center gap-4">
            <button onClick={onSave} disabled={isSaving} className="px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold shadow-lg hover:shadow-pink-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50">
              {isSaving ? '저장 중...' : '리포트 발행하기'}
            </button>
            <button onClick={onReanalyze} disabled={isSaving} className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">
              다시 분석하기
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 🤖 모드 2: LLM 종합 리포트 UI (Indigo Theme)
  // =========================================================
  return (
    <div className="max-w-[1400px] mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-800 my-10 font-sans border border-indigo-100">
      
      {/* 헤더 (인디고 그라데이션) */}
      <header className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-12 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10">
          <div className="inline-block p-3 bg-white/10 rounded-full mb-4 text-4xl backdrop-blur-sm border border-white/20">🤖</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-lg">
            {data.report_title || "LLM 종합 분석 리포트"}
          </h1>
          <p className="text-lg opacity-90 font-medium bg-indigo-900/30 inline-block px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
            데이터 기반의 객관적 성능 평가 및 인사이트
          </p>
        </div>
      </header>

      <div className="p-8 md:p-12 space-y-16 bg-slate-50">
        
        {/* 종합 분석 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="bg-indigo-600 w-1.5 h-8 mr-3 rounded-full"></span>
            🌟 종합 분석 & 핵심 인사이트
          </h2>
          <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {summaryPoints.slice(0, 3).map((point: string, idx: number) => (
                <div key={idx} className="bg-indigo-50/50 rounded-xl p-6 border-l-4 border-indigo-500 hover:bg-indigo-50 transition-colors">
                  <h3 className="font-bold text-indigo-600 mb-3 text-lg">
                    {idx === 0 ? "🔥 Market Trend" : idx === 1 ? "👑 Top Performer" : "💡 Key Insight"}
                  </h3>
                  <p className="text-gray-700 font-medium leading-relaxed text-[15px]">
                    {point.replace(/["']/g, "")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 목적별 추천 */}
        {data.best_for_purpose && data.best_for_purpose.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="bg-violet-600 w-1.5 h-8 mr-3 rounded-full"></span>
            🏆 목적별 최적 모델 가이드
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {data.best_for_purpose?.map((item: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 group h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl bg-gray-50 p-3 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                    {item.icon || "📌"}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border border-gray-200 px-2 py-1 rounded text-center leading-tight max-w-[60%] break-keep">
                    {item.category}
                  </span>
                </div>
                <div className="text-xl font-extrabold text-gray-800 mb-3 group-hover:text-indigo-600 transition-colors break-words">
                  {item.model_name}
                </div>
                <p className="text-gray-600 text-sm mb-5 leading-relaxed flex-grow whitespace-pre-wrap">
                  {item.reason}
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-xs font-semibold text-gray-500 border border-gray-100 mt-auto flex items-center gap-2">
                  📊 {item.score_summary}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* 상세 분석 Grid */}
        {data.deep_analysis && data.deep_analysis.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="bg-fuchsia-500 w-1.5 h-8 mr-3 rounded-full"></span>
            📊 분야별 상세 심층 분석
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {data.deep_analysis?.map((category: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 flex flex-col h-full hover:shadow-lg transition-shadow">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3 border-b border-gray-100 pb-3 flex justify-between items-center">
                    {category.category}
                    <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded">Top 5</span>
                  </h3>
                  <p className="text-gray-600 leading-7 text-[15px] text-justify whitespace-pre-wrap">
                    {category.analysis}
                  </p>
                </div>
                <div className="mt-auto bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="space-y-3">
                    {category.top_models?.map((model: any, mIdx: number) => {
                        const maxScore = getMaxScore(category.top_models || []);
                        const percentage = maxScore > 0 ? (model.score / maxScore) * 100 : 0;
                        
                        return (
                      <div key={mIdx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3 w-full">
                          <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shadow-sm flex-shrink-0 transition-transform group-hover:scale-110
                            ${mIdx === 0 ? "bg-indigo-600 text-white" : 
                              mIdx === 1 ? "bg-indigo-400 text-white" : 
                              mIdx === 2 ? "bg-indigo-300 text-white" : "bg-white border border-gray-200 text-gray-400"}`}>
                            {mIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                  <span className={`font-semibold truncate pr-2 ${mIdx === 0 ? "text-indigo-700" : "text-gray-700 text-sm"}`}>
                                    {model.model}
                                    {mIdx === 0 && <span className="ml-2 text-lg">👑</span>}
                                  </span>
                                  <span className="text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 flex-shrink-0 font-mono">
                                    {model.score}
                                  </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${mIdx === 0 ? "bg-indigo-600" : "bg-slate-400"}`} style={{ width: `${percentage}%` }}></div>
                              </div>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* 통합 랭킹 */}
        {data.benchmark_integration && data.benchmark_integration.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="bg-gray-800 w-1.5 h-8 mr-3 rounded-full"></span>
            🏅 종합 통합 랭킹
          </h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-5 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-20">Rank</th>
                  <th className="p-5 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-48">Model</th>
                  <th className="p-5 text-left text-sm font-bold text-gray-500 uppercase tracking-wider w-24">Tier</th>
                  <th className="p-5 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.benchmark_integration?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="p-5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm transition-transform group-hover:scale-110
                        ${idx === 0 ? "bg-gradient-to-r from-yellow-400 to-orange-500" : 
                          idx === 1 ? "bg-gray-400" : 
                          idx === 2 ? "bg-orange-300" : "bg-indigo-100 text-indigo-500"}`}>
                        {row.rank}
                      </div>
                    </td>
                    <td className="p-5 font-bold text-gray-800 text-lg">{row.model}</td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getTierColor(row.tier)}`}>
                        {row.tier || "A-Tier"}
                      </span>
                    </td>
                    <td className="p-5 text-gray-600 text-sm leading-relaxed">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>
        )}

      </div>

      {onSave && onReanalyze && (
        <div className="bg-white p-8 border-t border-gray-200 flex justify-center gap-4">
          <button onClick={onSave} disabled={isSaving} className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50">
            {isSaving ? '저장 중...' : 'DB에 발행하기'}
          </button>
          <button onClick={onReanalyze} disabled={isSaving} className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
            다시 분석하기
          </button>
        </div>
      )}

      <footer className="bg-white p-10 text-center text-gray-400 border-t border-gray-100">
        <p className="font-medium mb-4">Data Sources Integrated by Gemini 2.0</p>
        <p className="mt-6 text-xs opacity-70">Powered by Next.js & Google Gemini AI</p>
      </footer>
    </div>
  );
}