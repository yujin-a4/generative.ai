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
  if (lower.includes("elevenlabs"))                     return { color: "#7c3aed", bgColor: "#ede9fe", name: "ElevenLabs" };
  if (lower.includes("openai"))                         return { color: "#10a37f", bgColor: "#d1fae5", name: "OpenAI" };
  if (lower.includes("google"))                         return { color: "#2563eb", bgColor: "#dbeafe", name: "Google" };
  if (lower.includes("microsoft") || lower.includes("azure")) return { color: "#0284c7", bgColor: "#e0f2fe", name: "Microsoft" };
  if (lower.includes("cartesia"))                       return { color: "#7c3aed", bgColor: "#f5f3ff", name: "Cartesia" };
  if (lower.includes("hume"))                           return { color: "#ec4899", bgColor: "#fdf2f8", name: "Hume AI" };
  if (lower.includes("amazon") || lower.includes("aws")) return { color: "#f59e0b", bgColor: "#fef3c7", name: "Amazon" };
  if (lower.includes("inworld"))                        return { color: "#059669", bgColor: "#d1fae5", name: "Inworld" };
  if (lower.includes("fish"))                           return { color: "#0891b2", bgColor: "#cffafe", name: "Fish Audio" };
  if (lower.includes("naver") || lower.includes("hyperclova")) return { color: "#16a34a", bgColor: "#dcfce7", name: "Naver" };
  if (lower.includes("kakao"))                          return { color: "#fbbf24", bgColor: "#fef3c7", name: "Kakao" };
  if (lower.includes("minimax") || lower.includes("speech-02")) return { color: "#8b5cf6", bgColor: "#f5f3ff", name: "MiniMax" };
  if (lower.includes("stepfun") || lower.includes("step audio")) return { color: "#f97316", bgColor: "#ffedd5", name: "StepFun" };
  if (lower.includes("xai"))                            return { color: "#374151", bgColor: "#f9fafb", name: "xAI" };
  if (lower.includes("mistral") || lower.includes("voxtral")) return { color: "#d97706", bgColor: "#fef3c7", name: "Mistral" };
  if (lower.includes("kokoro"))                         return { color: "#a855f7", bgColor: "#faf5ff", name: "Kokoro" };
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

// ─── Top5 ELO 카드 ────────────────────────────────────────────
function EloTop5Card({ item, idx }: { item: any; idx: number }) {
  const isFirst = idx === 0;
  const org = getOrgColor(item.org);
  return (
    <div className={`flex flex-col h-[180px] rounded-2xl p-5 transition-all duration-300 relative
      ${isFirst
        ? "bg-white shadow-xl ring-2 ring-violet-500 scale-105 z-10"
        : "bg-white shadow-md border border-slate-100 hover:-translate-y-1 hover:shadow-lg"}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
          ${isFirst ? "bg-violet-600 text-white shadow-md" : "bg-slate-100 text-slate-500"}`}>
          {idx + 1}
        </span>
        {isFirst && <span className="text-2xl animate-pulse">👑</span>}
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
          <span className={`font-mono font-black text-xl ${isFirst ? "text-violet-600" : "text-slate-400"}`}>
            {Number(item.elo || item.score).toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 ml-0.5">Elo</span>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Chart Card ────────────────────────────────────────
function MetricChartCard({
  title, icon, desc, items, comment, lowerIsBetter = false,
  unit = "", theme = "violet", fieldKey, isEditable,
  onEditStart, onEditConfirm, onEditCancel, onTempChange, isEditing, tempValue,
  useElo = false,
}: any) {
  if (!items || items.length === 0) return null;

  const getValue = (item: any) => Number(useElo ? (item.elo || item.score) : item.score) || 0;

  const sorted = [...items].sort((a, b) =>
    lowerIsBetter ? getValue(a) - getValue(b) : getValue(b) - getValue(a)
  );

  const scores = sorted.map(getValue).filter(Boolean);
  const minS   = Math.min(...scores);
  const maxS   = Math.max(...scores);
  const pad    = (maxS - minS) * 0.15 || 10;

  const chartData = useMemo(() => ({
    datasets: [{
      label: "Models",
      data: sorted.slice(0, 10).map((item: any, i) => ({
        x: getValue(item),
        y: i + seededRandom(item.model) * 0.5,
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
        min: Math.max(0, minS - pad),
        max: maxS + pad,
        grid: { color: "#f1f5f9" },
      },
      y: { display: false, min: -1, max: 12 },
    },
  };

  return (
    <div className="rounded-[2rem] p-8 border mb-6 bg-white shadow-md hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <span className="text-3xl bg-slate-50 p-2 rounded-xl">{icon}</span>
        <div>
          <h4 className="text-xl font-bold text-slate-800">{title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full
          ${lowerIsBetter ? "bg-rose-100 text-rose-600" : "bg-violet-100 text-violet-600"}`}>
          {lowerIsBetter ? "낮을수록 좋음 ↓" : "높을수록 좋음 ↑"}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 리스트 */}
        <div className="flex-1 lg:max-w-[380px] flex flex-col gap-2">
          {sorted.slice(0, 5).map((item: any, i: number) => {
            const org = getOrgColor(item.org);
            const val = getValue(item);
            return (
              <div key={i}
                className={`flex justify-between items-center p-3 rounded-xl border border-transparent hover:bg-white hover:shadow-md transition-all
                  ${theme === "amber" ? "bg-amber-100/40" : theme === "green" ? "bg-emerald-100/40" : "bg-violet-100/40"}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
                    ${i === 0 ? "bg-amber-400 text-white shadow-sm" : "bg-white text-slate-400 border border-slate-200"}`}>
                    {i + 1}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-slate-700 text-sm truncate">{item.model}</span>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: org.color }}>{org.name}</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-800 text-lg">
                  {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}{unit}
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
            <button onClick={onEditCancel}  className="p-2 bg-slate-200 text-slate-600 rounded-lg"><XIcon /></button>
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

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ReportViewTTS({ data, onSave, onReanalyze, isSaving, isEditable = false }: ReportViewProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [temps,   setTemps]   = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (data) setReportData(data.analysis_result || data);
  }, [data]);

  if (!reportData) return null;

  const { raw_data, summary_insights, data_dates } = reportData;

  const overall      = raw_data?.vote_rankings?.overall            || [];
  const subCats      = raw_data?.vote_rankings?.sub_categories     || {};
  const speedItems   = subCats?.speed?.items                       || [];
  const priceItems   = subCats?.price?.items                       || [];
  const openWItems   = subCats?.open_weights?.items                || [];
  const speedComment = subCats?.speed?.comment                     || "";
  const priceComment = subCats?.price?.comment                     || "";
  const openWComment = subCats?.open_weights?.comment              || "";

  const dateStr = data_dates?.vote_date || data_dates?.test_date;
  const d = dateStr ? new Date(dateStr) : new Date();
  const reportTitle = `${d.getFullYear()}년 ${d.getMonth() + 1}월 TTS 순위 리포트`;

  // 편집 핸들러
  const startEdit  = (key: string, val: string) => { setEditing(p => ({ ...p, [key]: true }));  setTemps(p => ({ ...p, [key]: val })); };
  const cancelEdit = (key: string) => setEditing(p => ({ ...p, [key]: false }));
  const changeTemp = (key: string, val: string) => setTemps(p => ({ ...p, [key]: val }));

  const confirmSubComment = (cat: string) => {
    const val = temps[cat];
    if (val !== undefined) {
      setReportData((p: any) => ({
        ...p,
        raw_data: {
          ...p.raw_data,
          vote_rankings: {
            ...p.raw_data.vote_rankings,
            sub_categories: {
              ...p.raw_data.vote_rankings.sub_categories,
              [cat]: { ...p.raw_data.vote_rankings.sub_categories?.[cat], comment: val },
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
      <header className="py-16 text-center border-b border-slate-100 bg-gradient-to-b from-violet-50 to-white">
        <div className="inline-flex items-center gap-3 mb-3 px-4 py-1.5 bg-violet-100 rounded-full">
          <span className="text-violet-600 font-bold text-sm">Text-to-Speech</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2">{reportTitle}</h1>
        <p className="text-slate-500 text-sm">
          품질(Elo 사용자 투표) · 처리속도(chars/sec) · 가격($/1M chars) · 오픈소스 비교
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-12">

        {/* ── Section 1: 품질 순위 (Elo) ── */}
        {overall.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">🏆</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">품질 순위 (Elo)</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  사용자 블라인드 투표 기반 · AA Speech Arena Elo 점수
                </p>
              </div>
              <span className="ml-auto text-sm font-bold bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                Elo 높을수록 최고 ↑
              </span>
            </div>

            <OrgLegend items={overall} />

            {/* Top 5 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {overall.slice(0, 5).map((item: any, i: number) => (
                <EloTop5Card key={i} item={item} idx={i} />
              ))}
            </div>

            {/* 전체 순위 테이블 */}
            {overall.length > 5 && (
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
                      <th className="py-3 px-4 text-right text-violet-600">Elo ↑</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overall.slice(0, 10).map((item: any, i: number) => {
                      const org = getOrgColor(item.org);
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-center">
                            {i === 0 ? <span className="text-2xl">🥇</span>
                              : i === 1 ? <span className="text-2xl">🥈</span>
                              : i === 2 ? <span className="text-2xl">🥉</span>
                              : <span className="text-slate-400 font-bold">{i + 1}</span>}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 text-sm">{item.model}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: org.color }}>{org.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-violet-700">
                            {Number(item.elo || item.score).toLocaleString()}
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

        {/* ── Section 2: 처리 속도 ── */}
        {speedItems.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">⚡</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">처리 속도 순위</h2>
                <p className="text-sm text-slate-500 mt-0.5">초당 처리 글자 수 (chars/sec) — 높을수록 빠름</p>
              </div>
            </div>
            <OrgLegend items={speedItems} />
            <MetricChartCard
              title="Speed (chars/sec)"
              icon="⚡"
              desc="초당 처리 글자 수. 높을수록 빠른 음성 생성."
              items={speedItems}
              comment={speedComment}
              lowerIsBetter={false}
              unit=""
              theme="violet"
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
                <p className="text-sm text-slate-500 mt-0.5">100만 글자 처리 비용 ($/1M chars) — 낮을수록 저렴</p>
              </div>
            </div>
            <OrgLegend items={priceItems} />
            <MetricChartCard
              title="Price ($/1M chars)"
              icon="💰"
              desc="100만 글자 변환 비용 (USD). 낮을수록 저렴."
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

        {/* ── Section 4: 오픈소스 Best ── */}
        {openWItems.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl bg-white p-2 rounded-xl shadow-sm">🆓</span>
              <div>
                <h2 className="text-3xl font-black text-slate-800">오픈소스 모델 Best</h2>
                <p className="text-sm text-slate-500 mt-0.5">공개 가중치 모델 중 Elo 기준 순위</p>
              </div>
            </div>
            <OrgLegend items={openWItems} />
            <MetricChartCard
              title="Open Weights — Elo"
              icon="🆓"
              desc="무료로 사용 가능한 오픈소스 TTS 모델의 품질 순위."
              items={openWItems}
              comment={openWComment}
              lowerIsBetter={false}
              useElo={true}
              unit=""
              theme="green"
              fieldKey="open_weights"
              isEditable={isEditable}
              isEditing={editing["open_weights"]}
              tempValue={temps["open_weights"]}
              onEditStart={(v: string) => startEdit("open_weights", v)}
              onEditConfirm={() => confirmSubComment("open_weights")}
              onEditCancel={() => cancelEdit("open_weights")}
              onTempChange={(v: string) => changeTemp("open_weights", v)}
            />
          </section>
        )}

        {/* ── Section 5: 핵심 요약 ── */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-lg border border-slate-200 relative overflow-hidden mb-8">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-400 to-pink-400" />
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
            className="px-8 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors shadow-lg"
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
