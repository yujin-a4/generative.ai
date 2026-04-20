"use client";

import { useState, useEffect } from "react";
import { analyzeReports, saveReportToDB, fetchTTSEloFromAPI } from "@/app/actions/analyze";
import { getAllFeedbacks, markFeedbackResolved } from "@/app/actions/feedbackActions";
import { reCategorizeAllNews, getNewsCategoryStats, type ReCategorizeStats } from "@/app/actions/migrationActions";
import { NEWS_CATEGORIES } from "@/app/lib/newsCategories";
import ReportView from "./ReportView";
import ThemeToggle from "@/app/components/ThemeToggle";

type Source = { id: string; name: string; url: string; desc: string };
type ReportConfigEntry = { label: string; icon: string; color: string; desc: string; sources: Source[] };

const REPORT_CONFIG: Record<string, ReportConfigEntry> = {
  LLM: {
    label: "LLM", icon: "🤖", color: "indigo",
    desc: "LiveBench(정량) + LMSYS 7대 분야(정성) 교차 검증",
    sources: [
      { id: "test",         name: "LiveBench (Test)",         url: "https://livebench.ai/",          desc: "표 전체 복사" },
      { id: "vote_overall", name: "LMSYS – Overall",          url: "https://lmarena.ai/?leaderboard", desc: "Category: Overall → 전체 복사" },
      { id: "vote_coding",  name: "LMSYS – Coding",           url: "https://lmarena.ai/?leaderboard", desc: "Category: Coding" },
      { id: "vote_hard",    name: "LMSYS – Hard Prompts",     url: "https://lmarena.ai/?leaderboard", desc: "Category: Hard Prompts" },
      { id: "vote_creative",name: "LMSYS – Creative Writing", url: "https://lmarena.ai/?leaderboard", desc: "Category: Creative Writing" },
      { id: "vote_multi",   name: "LMSYS – Multi-turn",       url: "https://lmarena.ai/?leaderboard", desc: "Category: Multi-turn" },
      { id: "vote_inst",    name: "LMSYS – Instruction",      url: "https://lmarena.ai/?leaderboard", desc: "Category: Instruction Following" },
      { id: "vote_kr",      name: "LMSYS – Korean",           url: "https://lmarena.ai/?leaderboard", desc: "Category: Korean" },
    ],
  },
  Image: {
    label: "이미지 AI", icon: "🎨", color: "pink",
    desc: "LMSYS Text-to-Image & Image Edit",
    sources: [
      { id: "img_t2i",  name: "LMSYS – Text-to-Image", url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Image' 탭 랭킹 표 복사" },
      { id: "img_edit", name: "LMSYS – Image Edit",    url: "https://lmarena.ai/?leaderboard", desc: "'Image Edit' 탭 랭킹 표 복사" },
    ],
  },
  Video: {
    label: "영상 AI", icon: "🎬", color: "rose",
    desc: "VBench(정량) + LMSYS T2V/I2V(정성)",
    sources: [
      { id: "video_test",     name: "VBench (Test)",          url: "https://huggingface.co/spaces/Vchitect/VBench_Leaderboard", desc: "VBench Leaderboard 표 전체 복사" },
      { id: "video_vote_t2v", name: "LMSYS – Text-to-Video",  url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Video' 탭" },
      { id: "video_vote_i2v", name: "LMSYS – Image-to-Video", url: "https://lmarena.ai/?leaderboard", desc: "'Image-to-Video' 탭" },
    ],
  },
  TTS: {
    label: "TTS (음성 합성)", icon: "🗣️", color: "violet",
    desc: "AA API 자동수집(Elo) + 선택입력(속도·가격·오픈소스)",
    sources: [
      { id: "tts_models", name: "AA Models Page (Speed·Price)", url: "https://artificialanalysis.ai/text-to-speech/models", desc: "모델 표 전체 복사. Elo는 자동 수집." },
    ],
  },
  STT: {
    label: "STT (음성 인식)", icon: "👂", color: "emerald",
    desc: "AA STT 1개 붙여넣기 — 정확도(WER)·속도·가격 포함",
    sources: [
      { id: "stt_aa", name: "Artificial Analysis STT", url: "https://artificialanalysis.ai/speech-to-text", desc: "표 전체 드래그 선택 후 복사. AA-WER / Speed / Price 포함." },
    ],
  },
};

const TYPES = Object.keys(REPORT_CONFIG);
const getTodayDate = () => new Date().toISOString().split("T")[0];

const colorMap: Record<string, { bg: string; ring: string; badge: string }> = {
  indigo:  { bg: "bg-indigo-600",  ring: "ring-indigo-500",  badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  pink:    { bg: "bg-pink-600",    ring: "ring-pink-500",    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"         },
  rose:    { bg: "bg-rose-600",    ring: "ring-rose-500",    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"         },
  violet:  { bg: "bg-violet-600",  ring: "ring-violet-500",  badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  emerald: { bg: "bg-emerald-600", ring: "ring-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

const ExternalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const SpinnerIcon = () => <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />;
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

function SectionHeader({ step, title, desc }: { step: number; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-white text-xs font-bold flex items-center justify-center mt-0.5">{step}</span>
      <div>
        <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">{title}</h3>
        {desc && <p className="text-gray-400 dark:text-zinc-500 text-xs mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [adminTab, setAdminTab]         = useState<'report' | 'feedback' | 'tools'>('report');
  const [selectedType, setSelectedType] = useState("LLM");
  const [inputs, setInputs]             = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [testDate, setTestDate]         = useState(getTodayDate());
  const [voteDate, setVoteDate]         = useState(getTodayDate());
  const [ttsLoading, setTtsLoading]     = useState(false);
  const [ttsOk, setTtsOk]               = useState(false);
  const [ttsPreview, setTtsPreview]     = useState<any[] | null>(null);
  const [ttsError, setTtsError]         = useState<string | null>(null);
  const [ttsCount, setTtsCount]         = useState(0);
  // 피드백함
  const [feedbacks, setFeedbacks]       = useState<any[]>([]);
  const [fbLoading, setFbLoading]       = useState(false);
  // 데이터 관리
  const [catStats, setCatStats]         = useState<Record<string, number>>({});
  const [catTotal, setCatTotal]         = useState(0);
  const [catLoading, setCatLoading]     = useState(false);
  const [migrRunning, setMigrRunning]   = useState(false);
  const [migrResult, setMigrResult]     = useState<ReCategorizeStats | null>(null);
  const [migrError, setMigrError]       = useState<string | null>(null);

  const loadFeedbacks = async () => {
    setFbLoading(true);
    const data = await getAllFeedbacks();
    setFeedbacks(data as any[]);
    setFbLoading(false);
  };

  const loadCatStats = async () => {
    setCatLoading(true);
    const res = await getNewsCategoryStats();
    if (res.success) { setCatStats(res.stats); setCatTotal(res.total); }
    setCatLoading(false);
  };

  const runMigration = async () => {
    if (!confirm(`전체 기사(${catTotal}건)을 다시 분류합니다. Gemini API를 사용합니다. 계속하시겠습니까?`)) return;
    setMigrRunning(true); setMigrResult(null); setMigrError(null);
    const res = await reCategorizeAllNews();
    if (res.success) { setMigrResult(res.stats); loadCatStats(); }
    else { setMigrError(res.error || '알 수 없는 오류'); }
    setMigrRunning(false);
  };

  useEffect(() => {
    if (adminTab === 'feedback') loadFeedbacks();
    if (adminTab === 'tools') loadCatStats();
  }, [adminTab]);

  useEffect(() => {
    setInputs({}); setAnalysisResult(null); setTtsOk(false);
    setTtsPreview(null); setTtsError(null); setTtsCount(0);
  }, [selectedType]);

  const cfg           = REPORT_CONFIG[selectedType];
  const colors        = colorMap[cfg.color] || colorMap.indigo;
  const isTTS         = selectedType === "TTS";
  const isSTT         = selectedType === "STT";
  const needsDualDate = selectedType === "LLM" || selectedType === "Video";

  const handleAutoFetch = async () => {
    setTtsLoading(true); setTtsError(null);
    try {
      const res = await fetchTTSEloFromAPI();
      if (res.success && res.data) {
        setInputs(p => ({ ...p, tts_api_elo: JSON.stringify(res.data, null, 2) }));
        setTtsPreview(res.data.slice(0, 5)); setTtsCount(res.data.length); setTtsOk(true);
      } else { setTtsError(res.error || "알 수 없는 오류"); }
    } catch { setTtsError("API 호출 중 오류가 발생했습니다."); }
    finally { setTtsLoading(false); }
  };

  const handleAnalyze = async () => {
    if (isTTS && !inputs["tts_api_elo"]) { alert("'Elo 자동 수집' 버튼을 먼저 클릭해 주세요."); return; }
    if (!isTTS && !cfg.sources.some(s => inputs[s.id]?.trim().length > 0)) { alert("데이터를 최소 하나 이상 입력하세요."); return; }
    setLoading(true); setAnalysisResult(null);
    try {
      const reportData = isTTS
        ? [{ siteName: "1. AA API ELO Data (JSON)", content: inputs["tts_api_elo"] || "" },
           { siteName: "2. AA Models Page (Speed/Price)", content: inputs["tts_models"]?.trim() || "(없음)" }]
        : cfg.sources.map(s => ({ siteName: s.name, content: inputs[s.id] || "(없음)" }));
      const result = await analyzeReports(reportData, selectedType);
      if (result.success && result.data) {
        setAnalysisResult({ ...result.data.analysisResult, data_dates: { test_date: testDate, vote_date: voteDate } });
      } else { alert(`분석 실패: ${result.error}`); }
    } catch (e) { console.error(e); alert("오류가 발생했습니다."); }
    finally { setLoading(false); }
  };

  const handleSave = async (dataToSave?: any) => {
    const target = dataToSave || analysisResult;
    if (!target) return;
    setSaving(true);
    try {
      const result = await saveReportToDB(target.report_title || `${selectedType} 분석 리포트`, target);
      if (result.success) { alert("✅ 발행 완료!"); setAnalysisResult(null); setInputs({}); setTtsOk(false); setTtsPreview(null); }
      else { alert(`저장 실패: ${result.error}`); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const canAnalyze = (isTTS ? ttsOk : cfg.sources.some(s => inputs[s.id]?.trim().length > 0)) && !loading;

  // 프리뷰 화면
  if (analysisResult) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
        <div className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-gray-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
          <button onClick={() => setAnalysisResult(null)} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            ← 입력으로 돌아가기
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Preview Mode</span>
            <ThemeToggle />
          </div>
        </div>
        <ReportView data={analysisResult} onSave={handleSave} onReanalyze={() => setAnalysisResult(null)} isSaving={saving} isEditable={true} />
      </div>
    );
  }

  // 입력 화면
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col">

      {/* 헤더 */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-8 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-black text-white">A</div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">AI Trend Lab</h1>
            <p className="text-gray-400 dark:text-zinc-500 text-[10px] uppercase tracking-widest">Admin Console</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-400/20">● ONLINE</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* 사이드바 */}
        <aside className="w-56 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col py-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-5 mb-3">리포트 타입</p>
          {TYPES.map(type => {
            const c = REPORT_CONFIG[type];
            const isActive = selectedType === type && adminTab === 'report';
            return (
              <button key={type} onClick={() => { setSelectedType(type); setAdminTab('report'); }}
                className={`flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 text-left
                  ${isActive
                    ? `bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white ring-1 ${colorMap[c.color].ring}`
                    : "text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                  }`}
              >
                <span className="text-xl w-6 text-center flex-shrink-0">{c.icon}</span>
                <div className="leading-tight">
                  <div className="font-bold text-xs">{c.label}</div>
                  <div className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">{c.sources.length}개 소스{type === "TTS" && " + API"}</div>
                </div>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
              </button>
            );
          })}

          {/* 피드백함 버튼 */}
          <div className="mx-3 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              onClick={() => setAdminTab('feedback')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                adminTab === 'feedback'
                  ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white ring-1 ring-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-xl w-6 text-center flex-shrink-0">📬</span>
              <div className="leading-tight">
                <div className="font-bold text-xs">피드백함</div>
                <div className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">오류 제보 · 건의사항</div>
              </div>
              {feedbacks.filter((f: any) => f.status === 'pending').length > 0 && (
                <span className="ml-auto text-[10px] font-black text-white bg-rose-500 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {feedbacks.filter((f: any) => f.status === 'pending').length}
                </span>
              )}
              {adminTab === 'feedback' && feedbacks.filter((f: any) => f.status === 'pending').length === 0 && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* 데이터 관리 버튼 */}
          <div className="mx-3 mt-2">
            <button
              onClick={() => setAdminTab('tools')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                adminTab === 'tools'
                  ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white ring-1 ring-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-xl w-6 text-center flex-shrink-0">🔧</span>
              <div className="leading-tight">
                <div className="font-bold text-xs">데이터 관리</div>
                <div className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">재분류 · 통계</div>
              </div>
              {adminTab === 'tools' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
            </button>
          </div>

          <div className="mt-auto px-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mb-1">단축키</p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-600">Ctrl+A → 전체 선택</p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-600">Ctrl+C → 복사</p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-600">Ctrl+V → 붙여넣기</p>
          </div>
        </aside>

        {/* 메인 */}
        {adminTab === 'tools' ? (
          /* ─── 데이터 관리 ─── */
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-8">

              <div className="mb-8">
                <h2 className="text-xl font-black text-gray-900 dark:text-white">🔧 데이터 관리</h2>
                <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">뉴스 기사 카테고리 통계 및 Gemini 자동 재분류</p>
              </div>

              {/* 현재 디스트리부션 */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">현재 카테고리 분포</h3>
                  <button onClick={loadCatStats} disabled={catLoading}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                    {catLoading ? '로딩 중...' : '↺ 새로고침'}
                  </button>
                </div>
                {catTotal === 0 && !catLoading ? (
                  <p className="text-sm text-gray-400">새로고침을 눈러주세요.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-3">
                      <span>전체 기사</span>
                      <span className="font-black text-gray-800 dark:text-white">{catTotal}건</span>
                    </div>
                    {/* 새 카테고리 */}
                    {Object.values(NEWS_CATEGORIES).map(cat => (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-base flex-shrink-0">{cat.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{cat.name}</span>
                            <span className="text-xs font-black text-gray-800 dark:text-white">{catStats[cat.id] || 0}건</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: catTotal ? `${((catStats[cat.id] || 0) / catTotal) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* 구버전/미분류 */}
                    {Object.entries(catStats)
                      .filter(([id]) => !Object.keys(NEWS_CATEGORIES).includes(id))
                      .map(([id, count]) => (
                        <div key={id} className="flex items-center gap-3 opacity-50">
                          <span className="text-base flex-shrink-0">❓</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-500">{id} <span className="text-[10px]">(구버전)</span></span>
                              <span className="text-xs font-black text-gray-500">{count}건</span>
                            </div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* 재분류 실행 */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-2">Gemini 자동 재분류</h3>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 leading-relaxed">
                  전체 기사를 새 카테고리 기준으로 재분류합니다.<br />
                  Gemini가 제목+요약을 분석하여 <strong>대분류 카테고리</strong>와 <strong>하위 태그(subTags)</strong>를 동시에 업데이트합니다.
                </p>

                {migrError && (
                  <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                    ⚠️ {migrError}
                  </div>
                )}

                {migrResult && (
                  <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-xs space-y-1">
                    <p className="font-black text-emerald-700 dark:text-emerald-300 text-sm mb-2">✅ 재분류 완료</p>
                    <p className="text-gray-600 dark:text-zinc-400">전체: <strong>{migrResult.total}</strong>건</p>
                    <p className="text-gray-600 dark:text-zinc-400">업데이트: <strong>{migrResult.updated}</strong>건 (카테고리 + 하위 태그)</p>
                    {migrResult.skipped > 0 && <p className="text-amber-600">스킵: {migrResult.skipped}건 (유효하지 않은 분류)</p>}
                    {migrResult.errors > 0 && <p className="text-red-600">오류: {migrResult.errors}건</p>}
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 mt-2">
                      <p className="font-bold text-gray-700 dark:text-zinc-300 mb-1">결과 분포:</p>
                      {Object.entries(migrResult.distribution).map(([cat, count]) => (
                        <p key={cat} className="text-gray-600 dark:text-zinc-400">
                          {Object.values(NEWS_CATEGORIES).find(c => c.id === cat)?.icon || '❓'} {cat}: <strong>{count}건</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={runMigration}
                  disabled={migrRunning || catTotal === 0}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                    migrRunning || catTotal === 0
                      ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {migrRunning ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gemini 재분류 중... (시간 소요)</>
                  ) : (
                    <>🧠 전체 기사 {catTotal}건 재분류 실행</>
                  )}
                </button>
              </div>

            </div>
          </main>
        ) : adminTab === 'feedback' ? (
          /* ─── 피드백함 ─── */
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">📬 피드백함</h2>
                  <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">
                    총 {feedbacks.length}건 ·
                    미처리 <span className="text-rose-500 font-bold">{feedbacks.filter((f: any) => f.status === 'pending').length}건</span>
                  </p>
                </div>
                <button onClick={loadFeedbacks} disabled={fbLoading}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                  {fbLoading ? '불러오는 중...' : '↺ 새로고침'}
                </button>
              </div>

              {fbLoading && feedbacks.length === 0 ? (
                <div className="text-center py-20 text-gray-400">불러오는 중...</div>
              ) : feedbacks.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-gray-400 dark:text-zinc-500">아직 접수된 피드백이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((fb: any) => (
                    <div key={fb.id}
                      className={`rounded-xl border p-5 transition-all ${
                        fb.status === 'resolved'
                          ? 'bg-gray-50 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800 opacity-60'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 유형 뱃지 */}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            fb.type === '오류 제보' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                            : fb.type === '기능 건의' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {fb.type === '오류 제보' ? '🐛 오류 제보' : fb.type === '기능 건의' ? '💡 기능 건의' : '💬 기타'}
                          </span>
                          {fb.status === 'resolved' && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">✓ 해결됨</span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 flex-shrink-0">
                          {new Date(fb.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {fb.title && (
                        <p className="text-sm font-bold text-gray-800 dark:text-zinc-200 mt-3">{fb.title}</p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-zinc-400 mt-2 leading-relaxed whitespace-pre-wrap">{fb.content}</p>

                      {fb.contact && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">📧 {fb.contact}</p>
                      )}

                      {fb.status === 'pending' && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
                          <button
                            onClick={async () => {
                              await markFeedbackResolved(fb.id);
                              setFeedbacks(prev => prev.map((f: any) => f.id === fb.id ? { ...f, status: 'resolved' } : f));
                            }}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            ✓ 해결됨으로 표시
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        ) : (
          /* ─── 리포트 생성 (기존) ─── */
          <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">

            {/* 제목 */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
              <span className="text-4xl">{cfg.icon}</span>
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{cfg.label} 리포트 생성</h2>
                <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">{cfg.desc}</p>
              </div>
              <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
                {cfg.sources.length + (isTTS ? 1 : 0)}개 소스
              </div>
            </div>

            {/* 날짜 */}
            <div className="mb-8">
              <SectionHeader step={1} title="데이터 기준일 설정" />
              {needsDualDate ? (
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: "정량(Test) 기준일", val: testDate, fn: setTestDate }, { label: "정성(Vote) 기준일", val: voteDate, fn: setVoteDate }].map(({ label, val, fn }) => (
                    <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{label}</label>
                      <input type="date" value={val} onChange={e => fn(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800 max-w-xs">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">데이터 수집일</label>
                  <input type="date" value={voteDate} onChange={e => setVoteDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              )}
            </div>

            {/* 데이터 입력 */}
            <div className="mb-8">
              <SectionHeader step={2} title="데이터 입력" desc="각 소스에서 표 전체를 복사해 붙여넣으세요" />
              <div className="space-y-5">

                {/* TTS 자동수집 */}
                {isTTS && (
                  <div className={`rounded-xl border-2 transition-all overflow-hidden ${
                    ttsOk ? "border-violet-400 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-950/30"
                          : "border-dashed border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  }`}>
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                          ttsOk ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                        }`}>
                          {ttsOk ? <CheckIcon /> : "⚡"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            AA API — Elo 순위 자동 수집
                            {ttsOk && <span className="ml-2 text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-400/10 px-1.5 py-0.5 rounded">{ttsCount}개 모델</span>}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">Artificial Analysis TTS 전체 Elo 순위 · 무료 API 키 인증</p>
                        </div>
                      </div>
                      <button onClick={handleAutoFetch} disabled={ttsLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50 flex-shrink-0 shadow-sm">
                        {ttsLoading ? <><SpinnerIcon /> 수집 중</> : ttsOk ? "↺ 재수집" : "자동 수집"}
                      </button>
                    </div>
                    {ttsError && (
                      <div className="mx-5 mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-600 dark:text-red-400">⚠ {ttsError}</div>
                    )}
                    {ttsOk && ttsPreview && (
                      <div className="border-t border-gray-200 dark:border-zinc-800 px-5 pb-4 pt-3">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">상위 5위 미리보기</p>
                        <div className="space-y-1.5">
                          {ttsPreview.map((m: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center flex-shrink-0 ${
                                i === 0 ? "bg-yellow-500 text-black" : "bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300"
                              }`}>{m.rank}</span>
                              <span className="text-gray-700 dark:text-zinc-300 flex-1 truncate">{m.name}</span>
                              <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{m.elo?.toLocaleString()} Elo</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 소스 입력 */}
                {cfg.sources.map((source, idx) => {
                  const filled = inputs[source.id]?.trim().length > 0;
                  return (
                    <div key={source.id} className={`rounded-xl border transition-all ${
                      filled ? "border-gray-300 dark:border-zinc-600" : "border-gray-200 dark:border-zinc-800"
                    } bg-white dark:bg-zinc-900`}>
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                            filled ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-zinc-400"
                          }`}>{filled ? "✓" : (isTTS ? 2 : idx + 1)}</div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">{source.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{source.desc}</p>
                          </div>
                        </div>
                        <a href={source.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                          사이트 열기 <ExternalIcon />
                        </a>
                      </div>
                      <div className="relative">
                        <textarea rows={isSTT ? 10 : 7}
                          placeholder={`여기에 ${source.name} 데이터를 붙여넣으세요 (Ctrl+V)...`}
                          value={inputs[source.id] || ""}
                          onChange={e => setInputs(p => ({ ...p, [source.id]: e.target.value }))}
                          className="w-full bg-transparent px-5 py-4 font-mono text-xs text-gray-600 dark:text-zinc-400 placeholder-gray-300 dark:placeholder-zinc-700 resize-none focus:outline-none" />
                        {filled && (
                          <div className="absolute bottom-3 right-4 text-[10px] text-emerald-600 dark:text-emerald-500 font-bold">
                            {inputs[source.id].length.toLocaleString()} chars
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* STT 가이드 */}
                {isSTT && (
                  <div className="bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-800 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">📋 복사 가이드</p>
                    <ol className="text-xs text-gray-600 dark:text-zinc-500 space-y-1 list-decimal list-inside">
                      <li>위 <span className="text-gray-800 dark:text-zinc-300 font-bold">&apos;사이트 열기&apos;</span> 클릭</li>
                      <li>모델 비교 표까지 스크롤</li>
                      <li>표 전체 드래그 선택 → Ctrl+C</li>
                      <li>위 입력창에 Ctrl+V</li>
                    </ol>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-2">* AA-WER / Speed Factor / Price 3가지 지표가 포함됩니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* 분석 버튼 (sticky) */}
            <div className="sticky bottom-0 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur -mx-8 px-8 py-5 border-t border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                  {isTTS && (
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${ttsOk ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-zinc-600"}`}>
                      {ttsOk ? <CheckIcon /> : <span className="w-3 h-3 rounded-full border border-current block" />}
                      Elo 수집
                    </div>
                  )}
                  {cfg.sources.map(s => {
                    const ok = inputs[s.id]?.trim().length > 0;
                    return (
                      <div key={s.id} className={`flex items-center gap-1.5 text-xs font-bold ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-zinc-600"}`}>
                        {ok ? <CheckIcon /> : <span className="w-3 h-3 rounded-full border border-current block" />}
                        {s.name.split("–")[0].split("(")[0].trim()}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleAnalyze} disabled={!canAnalyze}
                  className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex-shrink-0 ${
                    canAnalyze
                      ? `${colors.bg} text-white hover:opacity-90`
                      : "bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed"
                  }`}>
                  {loading ? <><SpinnerIcon /> Gemini 분석 중...</> : <>✨ {cfg.label} 리포트 생성</>}
                </button>
              </div>
            </div>

          </div>
        </main>
        )}
      </div>
    </div>
  );
}
