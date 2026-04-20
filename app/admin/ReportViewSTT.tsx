"use client";

import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
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

// ─── 제조사 색상 ───────────────────────────────────────────────
function getOrgColor(org: string): { color: string; bgColor: string; name: string } {
  const lower = (org || "").toLowerCase();
  if (lower.includes("elevenlabs"))   return { color: "#7c3aed", bgColor: "#ede9fe", name: "ElevenLabs" };
  if (lower.includes("openai"))       return { color: "#10a37f", bgColor: "#d1fae5", name: "OpenAI" };
  if (lower.includes("google"))       return { color: "#2563eb", bgColor: "#dbeafe", name: "Google" };
  if (lower.includes("microsoft") || lower.includes("azure"))
                                      return { color: "#0284c7", bgColor: "#e0f2fe", name: "Microsoft" };
  if (lower.includes("deepgram"))     return { color: "#0891b2", bgColor: "#cffafe", name: "Deepgram" };
  if (lower.includes("assemblyai"))   return { color: "#ea580c", bgColor: "#ffedd5", name: "AssemblyAI" };
  if (lower.includes("speechmatics")) return { color: "#65a30d", bgColor: "#ecfccb", name: "Speechmatics" };
  if (lower.includes("mistral"))      return { color: "#d97706", bgColor: "#fef3c7", name: "Mistral" };
  if (lower.includes("nvidia"))       return { color: "#16a34a", bgColor: "#dcfce7", name: "NVIDIA" };
  if (lower.includes("amazon") || lower.includes("aws"))
                                      return { color: "#f59e0b", bgColor: "#fef3c7", name: "Amazon" };
  if (lower.includes("meta"))         return { color: "#3b82f6", bgColor: "#eff6ff", name: "Meta" };
  if (lower.includes("gladia"))       return { color: "#8b5cf6", bgColor: "#f5f3ff", name: "Gladia" };
  return { color: "#64748b", bgColor: "#f1f5f9", name: org || "Other" };
}

// ─── 공통 아이콘 ───────────────────────────────────────────────
const PencilIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
const XIcon   = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>);

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(Math.sin(hash) * 10000) % 1;
}

// ─── Rank Badge ───────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-3xl drop-shadow">🥇</span>;
  if (rank === 2) return <span className="text-3xl drop-shadow">🥈</span>;
  if (rank === 3) return <span className="text-3xl drop-shadow">🥉</span>;
  return <span className="text-xl font-black text-slate-400">{rank}</span>;
}

// ─── Top5 Card (STT WER — 낮을수록 좋음) ──────────────────────
function WERTop5Card({ item, idx }: { item: any; idx: number }) {
  const isFirst = idx === 0;
  const org = getOrgColor(item.org);
  return (
    <div className={`flex flex-col h-[180px] rounded-2xl p-5 transition-all duration-300 relative overflow-hidden
      ${isFirst
        ? "bg-white shadow-xl ring-2 ring-emerald-500 scale-105 z-10"
        : "bg-white shadow-md border border-slate-100 hover:-translate-y-1 hover:shadow-lg"
      }`}
    >
      {/* 낮을수록 좋음 배지 */}
      {isFirst && (
        <div className="absolute top-2 right-2 text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
          최고 정확도
        </div>
      )}
      <div className="flex justify-between items-start mb-2">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
          ${isFirst ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-500"}`}>
          {idx + 1}
        </span>
        {isFirst && <span className="text-2xl animate-pulse">🎯</span>}
      </div>
      <div className="flex-1 font-bold text-slate-800 leading-tight line-clamp-2 text-sm mb-2">
        {item.model}
      </div>
      <div className="flex justify-between items-end border-t border-slate-50 pt-2">
        <span className="text-[10px] font-bold px-2 py-1 rounded-md text-white truncate max-w-[90px] text-center"
          style={{ backgroundColor: org.color }}>
          {org.name}
        </span>
        <div className="text-right">
          <span className={`font-mono font-black text-xl ${isFirst ? "text-emerald-600" : "text-slate-400"}`}>
            {Number(item.score).toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 ml-0.5">%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Chart Card (속도/가격) ────────────────────────────
function MetricChartCard({
  title, icon, desc, items, comment, lowerIsBetter = false,
  unit = "", theme = "blue", fieldKey, isEditable,
  onEditStart, onEditConfirm, onEditCancel, onTempChange, isEditing, tempValue,
}: any) {
  if (!items || items.length === 0) return null;

  // 정렬: lowerIsBetter면 오름차순, 아니면 내림차순
  const sorted = [...items].sort((a, b) =>
    lowerIsBetter
      ? Number(a.score) - Number(b.score)
      : Number(b.score) - Number(a.score)
  );

  const scores = sorted.map((i: any) => Number(i.score)).filter(Boolean);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const pad = (maxScore - minScore) * 0.15 || 1;

  const chartData = useMemo(() => ({
    datasets: [{
      label: "Models",
      data: sorted.slice(0, 10).map((item: any) => ({
        x: Number(item.score) || 0,
        y: Object.values(getOrgColor(item.org)).indexOf(getOrgColor(item.org).color) +
           seededRandom(item.model) * 0.6,
        org: item.org,
        model: item.model,
      })).filter((d: any) => d.x > 0),
      backgroundColor: (ctx: any) => getOrgColor(ctx.raw?.org).color,
      borderColor: "#fff",
      borderWidth: 2,
      pointRadius: 7,
      pointHoverRadius: 10,
    }],
  }), [sorted]);

  const chartOptions: ChartOptions<"scatter"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(255,255,255,0.96)",
        titleColor: "#1e293b",
        bodyColor: "#475569",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx: TooltipItem<"scatter">) => {
            const raw = ctx.raw as any;
            return [
              `모델: ${raw.model}`,
              `제조사: ${raw.org}`,
              `${lowerIsBetter ? "↓ 낮을수록 좋음" : "↑ 높을수록 좋음"}: ${raw.x}${unit}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        min: lowerIsBetter ? Math.max(0, minScore - pad) : minScore - pad,
        max: maxScore + pad,
        grid: { color: "#f1f5f9" },
      },
      y: { display: false, min: -1, max: 5 },
    },
  };

  const bgMap: Record<string, string> = {
    blue: "bg-blue-50/60 border-blue-200",
    green: "bg-emerald-50/60 border-emerald-200",
    amber: "bg-amber-50/60 border-amber-200",
    purple: "bg-purple-50/60 border-purple-200",
  };
  const accentMap: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
  };

  return (
    <div className={`rounded-[2rem] p-8 border mb-6 bg-white shadow-md hover:shadow-lg transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <span className="text-3xl bg-slate-50 p-2 rounded-xl">{icon}</span>
        <div>
          <h4 className="text-xl font-bold text-slate-800">{title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
        {lowerIsBetter && (
          <span className="ml-auto text-xs font-bold bg-rose-100 text-rose-600 px-2.5 py-1 rounded-full">
            낮을수록 좋음 ↓
          </span>
        )}
        {!lowerIsBetter && (
          <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full">
            높을수록 좋음 ↑
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 순위 리스트 */}
        <div className="flex-1 lg:max-w-[380px] flex flex-col gap-2">
          {sorted.slice(0, 5).map((item: any, i: number) => {
            const org = getOrgColor(item.org);
            const isTop = i === 0;
            return (
              <div key={i}
                className={`flex justify-between items-center p-3 rounded-xl border border-transparent hover:bg-white hover:shadow-md transition-all
                  ${theme === "green" ? "bg-emerald-100/40" : theme === "amber" ? "bg-amber-100/40" : "bg-blue-100/40"}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
                    ${isTop ? "bg-amber-400 text-white shadow-sm" : "bg-white text-slate-400 border border-slate-200"}`}>
                    {i + 1}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-slate-700 text-sm truncate">{item.model}</span>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: org.color }}>{org.name}</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-800 text-lg">
                  {Number(item.score).toLocaleString(undefined, { maximumFractionDigits: 2 })}{unit}
                </span>
              </div>
            );
          })}
        </div>

        {/* 차트 */}
        <div className="flex-1 h-[300px] bg-slate-50 rounded-2xl border border-slate-100 p-6 relative">
          <div className="absolute top-4 left-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Score Distribution
          </div>
          <div className="absolute top-4 right-6 text-xs font-bold text-slate-400">
            {lowerIsBetter ? "← LOWER IS BETTER" : "HIGHER IS BETTER →"}
          </div>
          <div className="h-full mt-2">
            <Scatter data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Comment */}
      <div className="mt-6 bg-slate-50 rounded-xl p-5 flex items-start gap-3 border border-slate-100">
        <span className="text-xl mt-0.5">💡</span>
        {isEditing ? (
          <div className="flex-1 flex gap-2">
            <input
              className="flex-1 bg-white border border-indigo-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              value={tempValue ?? comment}
              onChange={(e) => onTempChange(e.target.value)}
              autoFocus
            />
            <button onClick={onEditConfirm} className="p-2 bg-indigo-500 text-white rounded-lg"><CheckIcon /></button>
            <button onClick={onEditCancel} className="p-2 bg-slate-200 text-slate-600 rounded-lg"><XIcon /></button>
          </div>
        ) : (
          <div className="flex-1 flex justify-between items-center">
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {comment || "AI 분석 코멘트가 없습니다."}
            </p>
            {isEditable && (
              <button onClick={() => onEditStart(comment)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                <PencilIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 제조사 종합 순위 계산 (STT — Best AA-WER 기준) ──────────────────
function calculateSTTManufacturerRanking(totalRanking: any[]): any[] {
  const orgMap: Record<string, { bestWER: number; bestModel: string; count: number }> = {};
  totalRanking.forEach((item: any) => {
    const org = item.org || 'Others';
    const wer = Number(item.score);
    if (isNaN(wer)) return;
    if (!orgMap[org]) orgMap[org] = { bestWER: wer, bestModel: item.model, count: 0 };
    orgMap[org].count++;
    if (wer < orgMap[org].bestWER) { orgMap[org].bestWER = wer; orgMap[org].bestModel = item.model; }
  });
  return Object.entries(orgMap)
    .map(([org, s]) => ({ org, bestWER: s.bestWER, bestModel: s.bestModel, count: s.count }))
    .sort((a, b) => a.bestWER - b.bestWER)
    .slice(0, 5)
    .map((item, idx) => ({ rank: idx + 1, ...item }));
}

// ─── STT 제조사 순위 테이블 ──────────────────────────────────────────
function STTManufacturerTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden mb-16">
      <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <span className="text-3xl bg-white p-2 rounded-xl shadow-sm">🏢</span>
          제조사 종합 순위
        </h2>
        <p className="text-sm text-slate-500 mt-1 ml-14">
          각 제조사 최고 모델 AA-WER 기준 — 어느 회사가 가장 정확한 STT를 만드는가? (낮을수록 우수)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-emerald-50 border-b border-emerald-100 text-slate-700">
              <th className="py-4 px-6 font-bold text-sm text-center w-20">순위</th>
              <th className="py-4 px-6 font-bold text-sm">제조사</th>
              <th className="py-4 px-6 font-bold text-sm text-slate-500">대표 모델 (Best WER)</th>
              <th className="py-4 px-6 font-bold text-sm text-center text-slate-400">참여 모델</th>
              <th className="py-4 px-6 font-bold text-sm text-right text-emerald-600">🎯 Best AA-WER ↓</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const org = getOrgColor(item.org);
              return (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 text-center">
                    {idx === 0 ? <span className="text-4xl drop-shadow-md">🥇</span>
                      : idx === 1 ? <span className="text-4xl drop-shadow-md">🥈</span>
                      : idx === 2 ? <span className="text-4xl drop-shadow-md">🥉</span>
                      : <span className="text-xl font-black text-slate-400">{idx + 1}</span>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: org.color }} />
                      <span className="font-bold text-slate-700 text-lg">{org.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500 max-w-[220px] truncate">{item.bestModel}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                      {item.count}개
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-emerald-600 text-xl">
                    {Number(item.bestWER).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 제조사 범례 ───────────────────────────────────────────────
function OrgLegend({ items }: { items: any[] }) {
  if (!items?.length) return null;
  const orgs = Array.from(new Set(items.map((i: any) => i.org).filter(Boolean)));
  return (
    <div className="flex flex-wrap gap-2 mb-6 justify-center">
      {orgs.map((org: any) => {
        const info = getOrgColor(org);
        return (
          <div key={org} className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-100 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
            <span className="text-xs font-bold text-slate-600">{info.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ReportViewSTT({ data, onSave, onReanalyze, isSaving, isEditable = false }: ReportViewProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [temps, setTemps] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (data) setReportData(data.analysis_result || data);
  }, [data]);

  if (!reportData) return null;

  const { raw_data, summary_insights, report_type, data_dates } = reportData;
  const totalRanking: any[] = raw_data?.test_benchmarks?.total_ranking || [];
  const mfrRanking = calculateSTTManufacturerRanking(totalRanking);
  const speedItems: any[]  = raw_data?.test_benchmarks?.sub_categories?.speed?.items  || [];
  const priceItems: any[]  = raw_data?.test_benchmarks?.sub_categories?.price?.items  || [];
  const speedComment = raw_data?.test_benchmarks?.sub_categories?.speed?.comment  || "";
  const priceComment = raw_data?.test_benchmarks?.sub_categories?.price?.comment  || "";

  // 날짜
  const dateStr = data_dates?.test_date || data_dates?.vote_date;
  const d = dateStr ? new Date(dateStr) : new Date();
  const reportTitle = `${d.getFullYear()}년 ${d.getMonth() + 1}월 STT 순위 리포트`;

  // 편집 핸들러
  const startEdit  = (key: string, val: string) => { setEditing(p => ({ ...p, [key]: true }));  setTemps(p => ({ ...p, [key]: val })); };
  const cancelEdit = (key: string) => { setEditing(p => ({ ...p, [key]: false })); };
  const changeTemp = (key: string, val: string) => setTemps(p => ({ ...p, [key]: val }));

  const confirmSubComment = (cat: string) => {
    const val = temps[cat];
    if (val !== undefined) {
      setReportData((p: any) => ({
        ...p,
        raw_data: {
          ...p.raw_data,
          test_benchmarks: {
            ...p.raw_data.test_benchmarks,
            sub_categories: {
              ...p.raw_data.test_benchmarks.sub_categories,
              [cat]: { ...p.raw_data.test_benchmarks.sub_categories[cat], comment: val },
            },
          },
        },
      }));
    }
    setEditing(p => ({ ...p, [cat]: false }));
  };

  const confirmSummary = (idx: number) => {
    const key = `summary.${idx}`;
    const val = temps[key];
    if (val !== undefined) {
      const ins = [...(reportData.summary_insights || [])];
      ins[idx] = val;
      setReportData((p: any) => ({ ...p, summary_insights: ins }));
    }
    setEditing(p => ({ ...p, [key]: false }));
  };

  return (
    <div className="max-w-[1200px] mx-auto bg-white min-h-screen pb-24">
      {/* Header */}
      <header className="py-16 text-center border-b border-slate-100 bg-gradient-to-b from-emerald-50 to-white">
        <div className="inline-flex items-center gap-3 mb-3 px-4 py-1.5 bg-emerald-100 rounded-full">
          <span className="text-emerald-600 font-bold text-sm">Speech-to-Text</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2">{reportTitle}</h1>
        <p className="text-slate-500 text-sm">
          정확도(AA-WER) · 처리속도(Speed Factor) · 가격($/1000분) 3축 비교
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-12">

        {/* ── Section 0: 제조사 종합 순위 ── */}
        {mfrRanking.length > 0 && <STTManufacturerTable items={mfrRanking} />}

        {/* ── Section 1: 정확도 순위 (AA-WER) ── */}
        {totalRanking.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">🎯</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">정확도 순위 (AA-WER)</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  낮을수록 정확 · 3개 실제 음성 데이터셋 가중 평균
                </p>
              </div>
              <span className="ml-auto text-sm font-bold bg-rose-100 text-rose-600 px-3 py-1 rounded-full">
                WER 낮을수록 최고 ↓
              </span>
            </div>

            {/* 범례 */}
            <OrgLegend items={totalRanking} />

            {/* Top 5 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {totalRanking.slice(0, 5).map((item: any, i: number) => (
                <WERTop5Card key={i} item={item} idx={i} />
              ))}
            </div>

            {/* 전체 순위 테이블 */}
            {totalRanking.length > 5 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-600">전체 순위 Top 10</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500 font-bold uppercase tracking-wide">
                      <th className="py-3 px-4 text-center w-12">순위</th>
                      <th className="py-3 px-4">모델</th>
                      <th className="py-3 px-4">제조사</th>
                      <th className="py-3 px-4 text-right text-rose-600">AA-WER ↓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalRanking.slice(0, 10).map((item: any, i: number) => {
                      const org = getOrgColor(item.org);
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-center">
                            {i < 3
                              ? <RankBadge rank={i + 1} />
                              : <span className="text-slate-400 font-bold">{i + 1}</span>}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 text-sm">{item.model}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: org.color }}>{org.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {Number(item.score).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Section 2: 속도 순위 ── */}
        {speedItems.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">⚡</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">처리 속도 순위</h2>
                <p className="text-sm text-slate-500 mt-0.5">Speed Factor — 실시간 대비 처리 배율 (높을수록 빠름)</p>
              </div>
            </div>
            <OrgLegend items={speedItems} />
            <MetricChartCard
              title="Speed Factor"
              icon="⚡"
              desc="음성 파일 길이 대비 처리 시간 배율. 100x = 1분 음성을 0.6초에 처리."
              items={speedItems}
              comment={speedComment}
              lowerIsBetter={false}
              unit="x"
              theme="blue"
              fieldKey="speed"
              isEditable={isEditable}
              isEditing={editing["speed"]}
              tempValue={temps["speed"]}
              onEditStart={(v: string) => startEdit("speed", v)}
              onEditConfirm={() => confirmSubComment("speed")}
              onEditCancel={() => cancelEdit("speed")}
              onTempChange={(v: string) => changeTemp("speed", v)}
            />
          </section>
        )}

        {/* ── Section 3: 가격 순위 ── */}
        {priceItems.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">💰</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">가격 효율 순위</h2>
                <p className="text-sm text-slate-500 mt-0.5">음성 1,000분 변환 비용 (USD, 낮을수록 저렴)</p>
              </div>
            </div>
            <OrgLegend items={priceItems} />
            <MetricChartCard
              title="Price ($/1,000 min)"
              icon="💰"
              desc="음성 1,000분 처리 비용(USD). 낮을수록 저렴."
              items={priceItems}
              comment={priceComment}
              lowerIsBetter={true}
              unit="$"
              theme="amber"
              fieldKey="price"
              isEditable={isEditable}
              isEditing={editing["price"]}
              tempValue={temps["price"]}
              onEditStart={(v: string) => startEdit("price", v)}
              onEditConfirm={() => confirmSubComment("price")}
              onEditCancel={() => cancelEdit("price")}
              onTempChange={(v: string) => changeTemp("price", v)}
            />
          </section>
        )}

        {/* ── Section 4: 핵심 요약 ── */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-lg border border-slate-200 relative overflow-hidden mb-8">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-blue-400" />
          <h3 className="font-black text-3xl mb-8 flex items-center gap-3 text-slate-800">
            <span className="text-4xl">📝</span> 핵심 요약
            {isEditable && (
              <span className="text-sm font-normal text-indigo-500 ml-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                클릭하여 수정 가능
              </span>
            )}
          </h3>
          <div className="space-y-4">
            {(summary_insights || []).map((text: string, idx: number) => {
              const key = `summary.${idx}`;
              const isEdit = editing[key];
              return (
                <div key={idx}
                  className={`rounded-2xl p-5 border transition-all duration-200 ${
                    isEdit
                      ? "bg-white border-indigo-300 ring-4 ring-indigo-50"
                      : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md"
                  }`}
                >
                  {isEdit ? (
                    <div className="flex items-start gap-4">
                      <span className="text-2xl mt-1">✔️</span>
                      <div className="flex-1 flex flex-col gap-3">
                        <textarea
                          value={temps[key] ?? text}
                          onChange={(e) => changeTemp(key, e.target.value)}
                          autoFocus
                          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-700 outline-none focus:border-indigo-500 resize-none text-base leading-relaxed"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => confirmSummary(idx)}
                            className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                            <CheckIcon /> 저장
                          </button>
                          <button onClick={() => cancelEdit(key)}
                            className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-bold">
                            <XIcon /> 취소
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex items-start gap-4 ${isEditable ? "cursor-pointer group" : ""}`}
                      onClick={isEditable ? () => startEdit(key, text) : undefined}>
                      <span className="text-2xl mt-0.5">✔️</span>
                      <p className="text-lg text-slate-700 leading-relaxed flex-1 font-medium">{text}</p>
                      {isEditable && (
                        <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-indigo-600 transition-opacity bg-white rounded-full shadow-sm border border-slate-100">
                          <PencilIcon />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 발행 버튼 */}
      {isEditable && onSave && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-white/90 backdrop-blur shadow-2xl p-4 rounded-2xl border border-slate-200 z-50">
          <button
            onClick={() => onSave(reportData)}
            disabled={isSaving}
            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg"
          >
            {isSaving ? "저장 중..." : "🚀 리포트 발행"}
          </button>
          <button
            onClick={onReanalyze}
            disabled={isSaving}
            className="px-8 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors"
          >
            다시 분석
          </button>
        </div>
      )}
    </div>
  );
}
