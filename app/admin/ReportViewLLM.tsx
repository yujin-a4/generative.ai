"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

interface ReportViewProps {
  data: any;
  onSave?: (updatedData: any) => void;
  onReanalyze?: () => void;
  isSaving?: boolean;
  isEditable?: boolean;
}

// ------------------- [공통 헬퍼 함수 및 아이콘] -------------------
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

const PencilIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>);

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '.');
}

function generateReportTitle(data_dates: any, reportType: string): string {
  let dateStr = data_dates?.test_date || data_dates?.vote_date;
  if (!dateStr) {
    const now = new Date();
    dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}년 ${month}월 ${reportType} 순위 리포트`;
}

// LLM용 벤치마크 정보
const BENCHMARK_INFO = {
  test_section: { title: "LiveBench란?", description: "오염되지 않은 최신 데이터로 LLM을 평가하는 벤치마크입니다. 기존 벤치마크는 학습 데이터에 포함될 수 있어 신뢰도가 떨어지는 문제가 있었습니다.", features: ["자동 채점: 정답이 명확해서 LLM 판정자 불필요", "매월 업데이트: 새 문제 추가로 데이터 오염 방지", "점수 범위: 0~100점 (정답률 기반)"], source: "livebench.ai" },
  vote_section: { title: "LMSYS Chatbot Arena란?", description: "실제 사용자 블라인드 투표 기반 평가입니다. 두 모델의 답변을 익명으로 보여주고 어떤 게 더 좋은지 사용자가 직접 선택합니다.", features: ["Elo 점수: 체스 랭킹처럼 강자를 이기면 점수 상승", "100만+ 투표: 통계적으로 유의미한 대규모 샘플", "실사용 반영: 벤치마크가 아닌 실제 사용 패턴 기반"], source: "lmarena.ai" },
  reasoning: { title: "추론 (Reasoning)", description: "논리 퍼즐, 공간 추론, Web of Lies(거짓말 탐지) 등의 문제를 통해 논리적 사고력을 측정합니다.", example: "예: \"A가 B에게 거짓말을 했고, B는 C에게...\" 류의 다단계 논리 추론", scoring: "자동 채점 (정답 일치 여부)" },
  coding: { title: "코딩 (Coding)", description: "최신 LeetCode 스타일 알고리즘 문제를 풀고, 실제 테스트케이스로 정답을 검증합니다.", example: "예: 배열 조작, 그래프 탐색, 동적 프로그래밍 문제", scoring: "테스트케이스 통과율로 채점" },
  math: { title: "수학 (Math)", description: "AMC, AIME 등 최신 수학 경시대회 문제로 수학적 추론 능력을 평가합니다.", example: "예: 증명, 복잡한 계산, 수열 및 조합 문제", scoring: "정답 일치 여부로 채점" },
  data_analysis: { title: "데이터 분석 (Data Analysis)", description: "주어진 표나 데이터에서 특정 값을 추출하거나 계산하는 능력을 측정합니다.", example: "예: 표에서 조건에 맞는 행 찾기, 평균/합계 계산", scoring: "정답 일치 여부로 채점" },
  multi_turn: { title: "대화 맥락 (Multi-turn)", description: "2턴 이상의 대화에서 이전 맥락을 얼마나 잘 기억하고 활용하는지 평가합니다.", example: "예: 이전 대화 내용을 참조한 후속 질문 처리", scoring: "사용자 블라인드 투표" },
  instruction_following: { title: "지시 이행 (Instruction Following)", description: "\"5문장으로 작성해줘\", \"JSON 형식으로\", \"~하지 마\" 등 구체적 지시사항 준수율을 평가합니다.", example: "예: 형식, 길이, 스타일, 제약조건 준수 여부", scoring: "사용자 블라인드 투표" },
  creative_writing: { title: "창의적 글쓰기 (Creative Writing)", description: "소설, 시, 광고 카피, 롤플레이 등 창작 콘텐츠의 품질을 평가합니다.", example: "예: 스토리텔링, 문체, 독창성, 감정 표현", scoring: "사용자 블라인드 투표" },
  hard_prompts: { title: "고난도 질문 (Hard Prompts)", description: "전문 지식이 필요하거나 복잡한 분석이 요구되는 어려운 질문 처리 능력을 평가합니다.", example: "예: 학술적 질문, 멀티스텝 추론, 전문 분야 지식", scoring: "사용자 블라인드 투표" },
  coding_vote: { title: "체감 코딩 (Coding)", description: "실제 사용자가 코딩 도움을 요청했을 때 느끼는 만족도를 평가합니다.", example: "예: 버그 수정, 코드 설명, 리팩토링 제안", scoring: "사용자 블라인드 투표" },
  korean: { title: "한국어 (Korean)", description: "한국어 질문에 대한 이해도와 응답 품질을 한국 사용자들이 직접 평가합니다.", example: "예: 자연스러운 한국어 표현, 문화적 맥락 이해", scoring: "한국어 사용자 블라인드 투표" }
};

const InfoTooltip = ({ infoKey, isSection = false }: { infoKey: string; isSection?: boolean }) => {
  const info = BENCHMARK_INFO[infoKey as keyof typeof BENCHMARK_INFO];
  if (!info) return null;
  return (
    <div className="relative inline-block group">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs cursor-help hover:bg-gray-300 transition-colors ml-2">?</span>
      <div className="absolute left-0 bottom-full mb-2 w-80 p-4 bg-slate-900 text-white text-sm rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="absolute left-4 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-900"></div>
        {isSection ? (
          <>
            <h4 className="font-bold text-base mb-2 text-amber-300">{(info as any).title}</h4>
            <p className="text-gray-300 mb-3 leading-relaxed">{(info as any).description}</p>
            <ul className="space-y-1.5 mb-3">
              {(info as any).features?.map((f: string, i: number) => <li key={i} className="flex items-start gap-2 text-xs text-gray-400"><span className="text-green-400 mt-0.5">✓</span><span>{f}</span></li>)}
            </ul>
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">🔗 {(info as any).source}</div>
          </>
        ) : (
          <>
            <h4 className="font-bold text-base mb-2 text-amber-300">{(info as any).title}</h4>
            <p className="text-gray-300 mb-2 leading-relaxed">{(info as any).description}</p>
            <p className="text-xs text-gray-400 mb-2 italic">{(info as any).example}</p>
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">📊 채점: {(info as any).scoring}</div>
          </>
        )}
      </div>
    </div>
  );
};

// ------------------- [LLM 전용 컴포넌트] -------------------
export default function ReportViewLLM({ data, onSave, onReanalyze, isSaving, isEditable = false }: ReportViewProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  const [testTab, setTestTab] = useState('reasoning');
  const [voteTab, setVoteTab] = useState('multi_turn');

  const TEST_TABS = [
    { key: 'reasoning',    label: '추론',        icon: '🧠' },
    { key: 'coding',       label: '코딩',        icon: '💻' },
    { key: 'math',         label: '수학',        icon: '🧮' },
    { key: 'data_analysis',label: '데이터 분석', icon: '📊' },
  ];
  const VOTE_TABS = [
    { key: 'multi_turn',           label: '대화 맥락',    icon: '🗣️' },
    { key: 'instruction_following',label: '지시 이행',    icon: '✅' },
    { key: 'creative_writing',     label: '창의적 글쓰기',icon: '📝' },
    { key: 'hard_prompts',         label: '고난도 질문',  icon: '🔥' },
    { key: 'coding',               label: '체감 코딩',    icon: '⌨️' },
    { key: 'korean',               label: '한국어',       icon: '🇰🇷' },
  ];

  useEffect(() => { if (data) setReportData(data.analysis_result || data); }, [data]);

  if (!reportData) return null;

  const startEditing = (key: string, val: string) => { setEditingFields(p => ({ ...p, [key]: true })); setTempValues(p => ({ ...p, [key]: val })); };
  const cancelEditing = (key: string) => { setEditingFields(p => ({ ...p, [key]: false })); setTempValues(p => { const n = { ...p }; delete n[key]; return n; }); };
  const updateTempValue = (key: string, val: string) => setTempValues(p => ({ ...p, [key]: val }));
  
  const confirmCommentEdit = (section: string, cat: string) => {
    const key = `${section}.${cat}`; const val = tempValues[key];
    if (val !== undefined) setReportData((p: any) => ({ ...p, raw_data: { ...p.raw_data, [section]: { ...p.raw_data[section], sub_categories: { ...p.raw_data[section].sub_categories, [cat]: { ...p.raw_data[section].sub_categories[cat], comment: val } } } } }));
    setEditingFields(p => ({ ...p, [key]: false }));
  };
  
  // ✅ 총평 편집 로직 복원
  const confirmSummaryEdit = (idx: number) => {
    const key = `summary.${idx}`; const val = tempValues[key];
    if (val !== undefined) { const n = [...reportData.summary_insights]; n[idx] = val; setReportData((p: any) => ({ ...p, summary_insights: n })); }
    setEditingFields(p => ({ ...p, [key]: false }));
  };

  const handleSaveClick = () => { if (onSave) onSave(reportData); };

  const { raw_data, data_dates, summary_insights } = reportData;
  const testTotal = raw_data?.test_benchmarks?.total_ranking || [];
  const voteOverall = raw_data?.vote_rankings?.overall || [];
  const reportTitle = generateReportTitle(data_dates, "LLM");
  
  const formatScore = (val: any) => val ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-";
  const cleanModelName = (name: string) => name?.replace(/-202\d{5}/g, "").replace(/_/g, " ").replace(/-thinking/g, "").replace(/-preview/g, "") || "";

  const getOrgInfo = (org: string) => {
    const lower = org?.toLowerCase() || "";
    if (lower.includes("openai") || lower.includes("gpt")) return { color: "#10a37f", bgColor: "rgba(16,163,127,0.15)", index: 4, name: "OpenAI" };
    if (lower.includes("anthropic") || lower.includes("claude")) return { color: "#d97757", bgColor: "rgba(217,119,87,0.15)", index: 3, name: "Anthropic" };
    if (lower.includes("google") || lower.includes("gemini")) return { color: "#4285f4", bgColor: "rgba(66,133,244,0.15)", index: 2, name: "Google" };
    if (lower.includes("xai") || lower.includes("grok")) return { color: "#1d1d1f", bgColor: "rgba(29,29,31,0.15)", index: 1, name: "xAI" };
    if (lower.includes("meta") || lower.includes("llama")) return { color: "#0668E1", bgColor: "rgba(6,104,225,0.15)", index: 0, name: "Meta" };
    return { color: "#6b7280", bgColor: "rgba(107,114,128,0.15)", index: 0, name: "Others" };
  };

  const getScaleLimits = (categories: any, isVote: boolean) => {
    let min = Infinity, max = -Infinity;
    Object.values(categories || {}).forEach((obj: any) => obj.items?.forEach((i: any) => {
      const v = Number(isVote ? i.elo : i.score); if (v > 0) { if (v < min) min = v; if (v > max) max = v; }
    }));
    if (min === Infinity) return { min: 0, max: 100 };
    const padding = (max - min) * 0.05;
    return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
  };
  const testScale = getScaleLimits(raw_data?.test_benchmarks?.sub_categories, false);
  const voteScale = getScaleLimits(raw_data?.vote_rankings?.sub_categories, true);

  const calculateOrgRankings = () => {
    const orgScores: Record<string, { test: number[], vote: number[], models: Set<string> }> = {};
    ['reasoning', 'coding', 'math', 'data_analysis'].forEach(cat => {
      raw_data?.test_benchmarks?.sub_categories?.[cat]?.items?.slice(0, 10).forEach((item: any, idx: number) => {
        const name = getOrgInfo(item.org).name;
        if (!orgScores[name]) orgScores[name] = { test: [], vote: [], models: new Set() };
        orgScores[name].test.push(idx + 1); orgScores[name].models.add(cleanModelName(item.model));
      });
    });
    ['korean', 'coding', 'hard_prompts', 'creative_writing', 'multi_turn', 'instruction_following'].forEach(cat => {
      raw_data?.vote_rankings?.sub_categories?.[cat]?.items?.slice(0, 10).forEach((item: any, idx: number) => {
        const name = getOrgInfo(item.org).name;
        if (!orgScores[name]) orgScores[name] = { test: [], vote: [], models: new Set() };
        orgScores[name].vote.push(idx + 1); orgScores[name].models.add(cleanModelName(item.model));
      });
    });
    return Object.entries(orgScores).filter(([n]) => n !== "Others").map(([name, s]) => {
      const tAvg = s.test.length ? s.test.reduce((a, b) => a + b, 0) / s.test.length : 10;
      const vAvg = s.vote.length ? s.vote.reduce((a, b) => a + b, 0) / s.vote.length : 10;
      const total = (tAvg + vAvg) / 2;
      return { name, testAvg: tAvg.toFixed(1), voteAvg: vAvg.toFixed(1), totalAvg: total.toFixed(1), totalAvgNum: total, color: getOrgInfo(name).color, bgColor: getOrgInfo(name).bgColor, models: Array.from(s.models).slice(0, 3) };
    }).sort((a, b) => a.totalAvgNum - b.totalAvgNum);
  };
  const orgRankings = calculateOrgRankings();

  const LegendBox = () => (
    <div className="flex flex-wrap gap-3 justify-center items-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-6 py-3 shadow-lg mb-10 mx-auto w-fit">
      {[{ name: "OpenAI", color: "#10a37f" }, { name: "Anthropic", color: "#d97757" }, { name: "Google", color: "#4285f4" }, { name: "xAI", color: "#1d1d1f" }, { name: "Meta", color: "#0668E1" }].map(org => (
        <div key={org.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105" style={{ backgroundColor: `${org.color}15` }}>
          <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: org.color }}></span><span className="text-xs font-bold" style={{ color: org.color }}>{org.name}</span>
        </div>
      ))}
    </div>
  );

  const CategorySection = ({ title, section, categoryKey, metricKey = "score", icon = "📄", scale, infoKey }: any) => {
    const categoryData = raw_data?.[section]?.sub_categories?.[categoryKey];
    const items = categoryData?.items || [];
    const comment = categoryData?.comment || "";
    const fieldKey = `${section}.${categoryKey}`;
    const isEditingThis = editingFields[fieldKey];
    const chartData = useMemo(() => ({
      datasets: [{
        label: 'Models',
        data: items.slice(0, 10).map((item: any, idx: number) => ({ x: Number(item[metricKey] || item.elo) || 0, y: getOrgInfo(item.org).index + (seededRandom(item.model) * 0.6 - 0.3), org: item.org, model: item.model })).filter((d: any) => d.x > 0),
        backgroundColor: (ctx: any) => getOrgInfo(ctx.raw?.org).color, borderColor: "white", borderWidth: 2, pointRadius: 8, pointHoverRadius: 12
      }]
    }), [items, categoryKey, metricKey]);

    if (!items.length) return null;

    return (
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div className="flex flex-col xl:flex-row gap-8">
          <div className="flex-1 xl:max-w-[420px]">
            <h4 className="font-bold text-gray-800 mb-5 pb-3 border-b-2 border-gray-100 flex items-center gap-3 text-xl"><span className="text-3xl">{icon}</span> {title} <InfoTooltip infoKey={infoKey} /></h4>
            <ul className="space-y-3">{items.slice(0, 5).map((item: any, idx: number) => (
              <li key={idx} className={`flex justify-between items-center p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${idx === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-md' : 'bg-gray-50 hover:bg-gray-100'}`}><div className="flex items-center gap-3 truncate max-w-[75%]"><span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black shadow-sm ${idx === 0 ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>{idx + 1}</span><div className="flex flex-col truncate"><span className={`font-bold truncate ${idx === 0 ? "text-gray-900 text-base" : "text-gray-700"}`}>{cleanModelName(item.model)}</span><span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 w-fit" style={{ color: getOrgInfo(item.org).color, backgroundColor: getOrgInfo(item.org).bgColor }}>{item.org}</span></div></div><span className={`font-mono font-black px-3 py-1.5 rounded-lg ${idx === 0 ? 'text-lg text-amber-700 bg-amber-100' : 'text-sm text-gray-600 bg-white border border-gray-200'}`}>{formatScore(item[metricKey] || item.elo)}</span></li>))}</ul>
          </div>
          <div className="flex-1 min-w-[320px] flex flex-col">
            <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center mb-2"><span>📊 Distribution</span><span>High Score ➔</span></div>
            <div className="flex-1 h-[300px] bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-slate-200 relative p-3 shadow-inner"><Scatter data={chartData} options={{ maintainAspectRatio: false, scales: { x: { min: scale.min, max: scale.max, grid: { color: "rgba(0,0,0,0.06)" } }, y: { display: false, min: -0.5, max: 4.5 } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 13 }, callbacks: { title: (c: any) => c[0].raw.model, label: (c: any) => `Score: ${c.raw.x}` } } } }} /></div>
          </div>
        </div>
        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3"><span className="text-2xl">💡</span>{isEditingThis ? (<div className="flex-1 flex items-center gap-2"><input type="text" value={tempValues[fieldKey] ?? comment} onChange={(e) => updateTempValue(fieldKey, e.target.value)} autoFocus className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-4 py-2.5 outline-none" onKeyDown={(e) => { if (e.key === 'Enter') confirmCommentEdit(section, categoryKey); if (e.key === 'Escape') cancelEditing(fieldKey); }} /><button onClick={() => confirmCommentEdit(section, categoryKey)} className="p-2.5 bg-indigo-600 text-white rounded-xl"><CheckIcon /></button><button onClick={() => cancelEditing(fieldKey)} className="p-2.5 bg-gray-300 rounded-xl"><XIcon /></button></div>) : (<div className="flex-1 flex justify-between"><p className="text-sm text-gray-700 font-medium leading-relaxed flex-1">{comment || "분석 코멘트가 없습니다."}</p>{isEditable && <button onClick={() => startEditing(fieldKey, comment)} className="p-2 text-indigo-400"><PencilIcon /></button>}</div>)}</div>
      </div>
    );
  };

  const Top5Card = ({ item, idx, isFirst, scoreKey, gradientClass }: any) => (
    <div className={`rounded-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col ${isFirst ? "bg-white text-gray-900 shadow-2xl scale-105 ring-4 ring-amber-400/50" : "bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20"}`} style={{ height: '180px' }}>
      <div className="flex justify-between items-center px-5 pt-5"><span className={`text-xs font-black px-3 py-1.5 rounded-full ${isFirst ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg' : 'bg-white/20 text-white'}`}>{idx + 1}위</span>{isFirst && <span className="text-2xl">👑</span>}</div>
      <div className="flex-1 flex items-center px-5"><div className={`font-bold text-base leading-snug line-clamp-2 ${isFirst ? 'text-gray-900' : 'text-white'}`}>{cleanModelName(item.model)}</div></div>
      <div className={`px-5 pb-5 pt-3 border-t flex justify-between items-end ${isFirst ? 'border-gray-200' : 'border-white/20'}`}><span className={`text-xs font-bold px-2 py-1 rounded-full ${isFirst ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-white/70'}`}>{item.org || "Unknown"}</span><span className={`text-2xl font-black ${isFirst ? gradientClass : 'text-white'}`}>{formatScore(item[scoreKey] || item.score)}</span></div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto bg-gradient-to-b from-slate-50 to-white rounded-[2.5rem] shadow-2xl overflow-hidden text-gray-800 my-10 font-sans border border-slate-200">
      <header className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-16 text-center"><div className="absolute inset-0 opacity-10 bg-white"></div><div className="relative z-10"><h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">{reportTitle}</h1><p className="text-slate-400 text-lg">AI Benchmark Analysis Report</p></div></header>
      <div className="p-8 md:p-14 space-y-20">
        <section><div className="flex items-center gap-4 mb-10"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-3xl shadow-lg">🏢</div><div><h2 className="text-3xl font-black text-gray-900">제조사 종합 순위</h2><p className="text-gray-500 mt-1 font-medium">Test(정량) + Vote(정성) 평균 순위 기준</p></div></div><div className="bg-white rounded-3xl shadow-xl border border-amber-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full table-fixed"><thead><tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-100"><th className="text-left py-5 px-4 text-sm font-bold text-gray-600 w-[70px]">순위</th><th className="text-left py-5 px-4 text-sm font-bold text-gray-600">제조사</th><th className="text-center py-5 px-4 text-sm font-bold text-blue-600">📊 Test</th><th className="text-center py-5 px-4 text-sm font-bold text-pink-600">👥 Vote</th><th className="text-center py-5 px-4 text-sm font-bold text-amber-600">🏆 종합</th></tr></thead><tbody>{orgRankings.map((org, idx) => (<tr key={org.name} className="border-b border-gray-50"><td className="py-5 px-4 font-black">{idx + 1}</td><td className="py-5 px-4 font-bold">{org.name}</td><td className="py-5 px-4 text-center font-bold text-blue-600">{org.testAvg}위</td><td className="py-5 px-4 text-center font-bold text-pink-600">{org.voteAvg}위</td><td className="py-5 px-4 text-center font-black text-amber-600">{org.totalAvg}위</td></tr>))}</tbody></table></div></div></section>
        <section><div className="flex items-center gap-4 mb-10"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-lg">📊</div><div><h2 className="text-3xl font-black text-gray-900">정량적 벤치마크 (Test) <InfoTooltip infoKey="test_section" isSection={true} /></h2></div></div><div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl shadow-2xl p-10 mb-10"><div className="grid grid-cols-1 md:grid-cols-5 gap-6">{testTotal.slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} isFirst={idx === 0} scoreKey="score" gradientClass="text-indigo-600" />))}</div></div><LegendBox /><div className="flex gap-2 flex-wrap mb-8">{TEST_TABS.map(tab => (<button key={tab.key} onClick={() => setTestTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${testTab === tab.key ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200'}`}><span>{tab.icon}</span>{tab.label}</button>))}</div>{TEST_TABS.map(tab => testTab === tab.key && (<CategorySection key={tab.key} title={tab.label} section="test_benchmarks" categoryKey={tab.key} icon={tab.icon} scale={testScale} infoKey={tab.key} />))}</section>
        <section><div className="flex items-center gap-4 mb-10"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center text-3xl shadow-lg">👥</div><div><h2 className="text-3xl font-black text-gray-900">사용자 선호도 (Vote) <InfoTooltip infoKey="vote_section" isSection={true} /></h2></div></div><div className="bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 rounded-3xl shadow-2xl p-10 mb-10"><div className="grid grid-cols-1 md:grid-cols-5 gap-6">{voteOverall.slice(0, 5).map((m: any, idx: number) => (<Top5Card key={idx} item={m} idx={idx} isFirst={idx === 0} scoreKey="elo" gradientClass="text-pink-600" />))}</div></div><LegendBox /><div className="flex gap-2 flex-wrap mb-8">{VOTE_TABS.map(tab => (<button key={tab.key} onClick={() => setVoteTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${voteTab === tab.key ? 'bg-pink-600 text-white shadow-md scale-105' : 'bg-white text-gray-600 hover:bg-pink-50 border border-gray-200'}`}><span>{tab.icon}</span>{tab.label}</button>))}</div>{VOTE_TABS.map(tab => voteTab === tab.key && (<CategorySection key={tab.key} title={tab.label} section="vote_rankings" categoryKey={tab.key} metricKey="elo" icon={tab.icon} scale={voteScale} infoKey={tab.key === 'coding' ? 'coding_vote' : tab.key} />))}</section>
        
        {/* ✅ [복원 완료] 총평 섹션: 아이콘 표시 + 편집 기능 완벽 구현 */}
        <section className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <h3 className="font-black text-3xl mb-10 flex items-center gap-3">
              <span className="text-4xl">📝</span> 총평
              {isEditable && <span className="text-sm font-normal text-indigo-300 ml-3 bg-indigo-800/50 px-3 py-1 rounded-full">(클릭하여 편집)</span>}
            </h3>
            
            <div className="space-y-5">
              {(summary_insights || []).map((text: string, idx: number) => {
                const fieldKey = `summary.${idx}`;
                const isEditingThis = editingFields[fieldKey];
                const icons = ["🎯", "📈", "💡", "⚡", "🔮"];
                
                return (
                  <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all">
                    {isEditingThis ? (
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{icons[idx] || "📌"}</span>
                        <textarea 
                          value={tempValues[fieldKey] ?? text}
                          onChange={(e) => updateTempValue(fieldKey, e.target.value)}
                          autoFocus
                          className="flex-1 bg-indigo-800/50 border-2 border-indigo-400 rounded-xl p-4 text-white placeholder-indigo-300 outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEditing(fieldKey);
                          }}
                        />
                        <div className="flex flex-col gap-2">
                          <button onClick={() => confirmSummaryEdit(idx)} className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 shadow-lg">
                            <CheckIcon />
                          </button>
                          <button onClick={() => cancelEditing(fieldKey)} className="p-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600">
                            <XIcon />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4 group cursor-pointer" onClick={isEditable ? () => startEditing(fieldKey, text) : undefined}>
                        <span className="text-2xl mt-0.5">{icons[idx] || "📌"}</span>
                        <p className="text-lg text-white/90 leading-relaxed flex-1 font-medium">{text}</p>
                        {isEditable && (
                          <button className="opacity-0 group-hover:opacity-100 p-2 text-indigo-300 hover:text-white hover:bg-indigo-700 rounded-lg transition-all" title="편집">
                            <PencilIcon />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {isEditable && onSave && (
        <div className="bg-gradient-to-r from-gray-50 to-white p-10 border-t border-gray-200 flex justify-center gap-5">
          <button onClick={handleSaveClick} disabled={isSaving} className="px-14 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-200">
            {isSaving ? '저장 중...' : '🚀 발행하기'}
          </button>
          {onReanalyze && (
            <button onClick={onReanalyze} disabled={isSaving} className="px-14 py-5 bg-white text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-50 border-2 border-gray-200 shadow-lg">
              🔄 다시하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}