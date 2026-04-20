"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getWeeklySummaryByWeek,
  getMonthlySummaryByMonth,
  publishWeeklySummary,
  publishMonthlySummary,
  deleteWeeklySummary,
  deleteMonthlySummary
} from "@/app/lib/newsService";
import { generateWeeklySummary } from "@/app/actions/generateWeeklySummary";
import { generateMonthlySummary } from "@/app/actions/generateMonthlySummary";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "weekly" | "monthly";
  weekLabel?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  year?: number;
  month?: number;
}

const WEEKLY_SECTIONS = [
  { id: "trends",    icon: "🔥", label: "핵심 트렌드" },
  { id: "impact",   icon: "📚", label: "업계 임팩트" },
  { id: "companies",icon: "🏢", label: "기업 동향" },
  { id: "picks",    icon: "🏆", label: "Editor's Pick" },
];
const MONTHLY_SECTIONS = [
  { id: "trends",     icon: "🔥", label: "핵심 트렌드" },
  { id: "impact",     icon: "📚", label: "업계 임팩트" },
  { id: "opprisk",   icon: "⚖️", label: "기회 · 리스크" },
  { id: "companies",  icon: "🏢", label: "기업 동향" },
  { id: "categories",icon: "📂", label: "카테고리별" },
  { id: "picks",      icon: "🏆", label: "Editor's Pick" },
  { id: "next",       icon: "🔭", label: "다음 달 전망" },
];

export default function SummaryModal({
  isOpen, onClose, type, weekLabel, weekStartDate, weekEndDate, year, month
}: SummaryModalProps) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState("trends");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === "yujinkang1008@gmail.com");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveSection("trends");
    async function fetchSummary() {
      setLoading(true);
      setSummary(null);
      if (type === "weekly" && weekLabel) {
        setSummary(await getWeeklySummaryByWeek(weekLabel, isAdmin));
      } else if (type === "monthly" && year && month) {
        setSummary(await getMonthlySummaryByMonth(year, month, isAdmin));
      }
      setLoading(false);
    }
    fetchSummary();
  }, [isOpen, type, weekLabel, year, month, isAdmin]);

  // ── 스크롤 이벤트로 사이드바 active 동기화 ──────────────────
  const handleScroll = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const sectionEls = container.querySelectorAll<HTMLElement>('[id^="sec-"]');
    if (sectionEls.length === 0) return;

    // 맨 아래까지 스크롤한 경우 → 마지막 섹션 강제 활성화
    const isAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 16;
    if (isAtBottom) {
      const lastId = sectionEls[sectionEls.length - 1].id.replace("sec-", "");
      setActiveSection(lastId);
      return;
    }

    // 일반 스크롤: 상단 OFFSET 이내에 진입한 마지막 섹션을 active로
    const containerTop = container.getBoundingClientRect().top;
    const OFFSET = 100;
    let currentId = "";

    sectionEls.forEach((el) => {
      const top = el.getBoundingClientRect().top - containerTop;
      if (top <= OFFSET) {
        currentId = el.id.replace("sec-", "");
      }
    });

    if (currentId) setActiveSection(currentId);
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !summary) return;

    // 첫 렌더 후 초기 active 설정
    handleScroll();

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [summary, handleScroll]);

  // ── 사이드바 클릭 → 스크롤 ─────────────────────────────────
  const scrollToSection = (id: string) => {
    const container = contentRef.current;
    const el = container?.querySelector<HTMLElement>(`#sec-${id}`);
    if (!el || !container) return;
    const offset = el.offsetTop - 24;
    container.scrollTo({ top: offset, behavior: "smooth" });
  };

  // ── PDF 인쇄 ───────────────────────────────────────────────
  const handlePrint = () => {
    if (!summary) return;
    const headline = summary.headline || summary.summary || "";
    const periodStr = type === "weekly" && weekStartDate && weekEndDate
      ? `${weekStartDate} ~ ${weekEndDate}`
      : `${year}년 ${month}월`;
    const label = summary.week_label || summary.month_label || "";

    const trends = (summary.key_trends || summary.trends || [])
      .map((t: any, i: number) => `
        <div class="trend-card">
          <div class="trend-header"><span class="num">${i+1}</span><strong>${t.keyword}</strong></div>
          <p>${t.desc}</p>
          ${t.edu_impact ? `<div class="edu-impact">📚 ${t.edu_impact}</div>` : ""}
        </div>`).join("");

    const companies = (summary.company_moves || [])
      .map((m: any) => `
        <div class="card">
          <strong class="badge">${m.company}</strong>
          <p>${m.action}</p>
          ${m.significance ? `<p class="muted">💡 ${m.significance}</p>` : ""}
        </div>`).join("");

    const picks = (summary.top_picks || [])
      .map((p: any, i: number) => `
        <div class="card">
          <div class="pick-header"><span class="num">${i+1}</span><strong>${p.title}</strong></div>
          <p class="muted">${p.reason}</p>
          ${p.relevance ? `<p class="relevance">🏭 ${p.relevance}</p>` : ""}
        </div>`).join("");

    const catHighlights = type === "monthly" && summary.category_highlights
      ? summary.category_highlights.map((c: any) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong>${c.category}</strong>
            ${c.count ? `<span class="muted">${c.count}건</span>` : ""}
          </div>
          <p>${c.summary}</p>
        </div>`).join("") : "";

    const opps = type === "monthly" && summary.opportunities
      ? `<div class="section">
          <h3>✅ 기회</h3>
          ${summary.opportunities.map((o: any, i: number) => `
            <div class="card green">
              <div class="pick-header"><span class="num green">${i+1}</span><strong>${o.title}</strong></div>
              <p>${o.desc}</p>
            </div>`).join("")}
        </div>` : "";

    const risks = type === "monthly" && summary.risks
      ? `<div class="section">
          <h3>⚠️ 리스크</h3>
          ${summary.risks.map((r: any) => `
            <div class="card red">
              <strong>${r.title}</strong>
              <p>${r.desc}</p>
            </div>`).join("")}
        </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${headline || label}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans KR', sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; line-height: 1.7; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 32px 40px; }
  .header .type-badge { font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 12px; }
  .header h1 { font-size: 22px; font-weight: 900; margin-bottom: 8px; line-height: 1.4; }
  .header .period { font-size: 11px; opacity: 0.65; }
  .content { padding: 32px 40px; max-width: 820px; margin: 0 auto; }
  .section { margin-bottom: 32px; }
  .section h3 { font-size: 12px; font-weight: 900; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; background: #fafafa; }
  .card.green { background: #f0fdf4; border-color: #bbf7d0; }
  .card.red { background: #fef2f2; border-color: #fecaca; }
  .trend-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
  .trend-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .trend-card p { padding: 12px 16px; color: #4b5563; }
  .num { width: 24px; height: 24px; border-radius: 50%; background: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .num.green { background: #d1fae5; color: #065f46; }
  .badge { background: #e0e7ff; color: #3730a3; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 6px; }
  .edu-impact { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin: 0 16px 14px; font-size: 12px; color: #92400e; }
  .pick-header { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; }
  .muted { color: #6b7280; font-size: 12px; margin-top: 6px; }
  .relevance { color: #4338ca; font-size: 12px; background: #eef2ff; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-top: 6px; }
  .impact-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 20px; color: #78350f; white-space: pre-line; }
  .next-box { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 16px 20px; color: #312e81; white-space: pre-line; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div class="type-badge">${type === "weekly" ? "📅 주간 리포트" : "📊 월간 리포트"} · ${label}</div>
  <h1>${headline}</h1>
  <div class="period">📅 분석 기간: ${periodStr}</div>
</div>
<div class="content">
  ${trends ? `<div class="section"><h3>🔥 핵심 트렌드</h3>${trends}</div>` : ""}
  ${summary.edu_industry_impact ? `<div class="section"><h3>📚 교육·출판 업계 임팩트</h3><div class="impact-box">${summary.edu_industry_impact}</div></div>` : ""}
  ${opps}${risks}
  ${companies ? `<div class="section"><h3>🏢 주요 기업 동향</h3>${companies}</div>` : ""}
  ${catHighlights ? `<div class="section"><h3>📂 카테고리별 동향</h3>${catHighlights}</div>` : ""}
  ${picks ? `<div class="section"><h3>🏆 Editor's Pick</h3>${picks}</div>` : ""}
  ${(summary.watch_next || summary.outlook) ? `<div class="section"><h3>🔭 ${type === "weekly" ? "다음 주 주목 이슈" : "다음 달 전망"}</h3><div class="next-box">${summary.watch_next || summary.outlook}</div></div>` : ""}
  <div class="footer">AI Trend Lab · 자동 생성 리포트 · ${new Date().toLocaleDateString("ko-KR")}</div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("팝업이 차단되어 있습니다. 허용 후 다시 시도해주세요."); return; }
    win.document.write(html);
    win.document.close();
  };

  const handleGenerate = async () => {
    if (!isAdmin) return;
    const msg = type === "weekly"
      ? `${weekLabel} 주간 리포트를 생성할까요?\n기간: ${weekStartDate} ~ ${weekEndDate}`
      : `${year}년 ${month}월 월간 리포트를 생성할까요?`;
    if (!confirm(msg)) return;
    setGenerating(true);
    let res;
    if (type === "weekly" && weekLabel && weekStartDate && weekEndDate) {
      res = await generateWeeklySummary(weekLabel, weekStartDate, weekEndDate);
    } else if (year && month) {
      res = await generateMonthlySummary(`${year}년 ${month}월`, year, month);
    }
    setGenerating(false);
    if (res?.success) { alert("리포트가 생성됐습니다! 📊\n모달을 닫고 다시 열어주세요."); onClose(); }
    else alert("생성 실패: " + res?.error);
  };

  const handlePublish = async () => {
    if (!isAdmin || !summary?.id) return;
    if (!confirm("이 리포트를 공개할까요?")) return;
    try {
      if (type === "weekly") await publishWeeklySummary(summary.id);
      else await publishMonthlySummary(summary.id);
      setSummary({ ...summary, isPublished: true });
    } catch { alert("공개 실패"); }
  };

  const handleDelete = async () => {
    if (!isAdmin || !summary?.id) return;
    if (!confirm("정말 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      if (type === "weekly") await deleteWeeklySummary(summary.id);
      else await deleteMonthlySummary(summary.id);
      onClose();
    } catch { alert("삭제 실패"); }
  };

  if (!isOpen) return null;

  const isV2 = summary?.version === 2;
  const headline = summary?.headline || summary?.summary || "";
  const sections = type === "monthly" ? MONTHLY_SECTIONS : WEEKLY_SECTIONS;
  const periodStr = type === "weekly" && weekStartDate && weekEndDate
    ? `${weekStartDate} ~ ${weekEndDate}`
    : `${year}년 ${month}월`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6">
      <div
        className="bg-white dark:bg-zinc-950 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ height: "min(92vh, 900px)" }}
      >
        {/* ── 헤더 ── */}
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-8 py-5 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10 pointer-events-none">
            <div className="w-48 h-48 rounded-full bg-white absolute -right-12 -top-12" />
            <div className="w-28 h-28 rounded-full bg-white absolute right-8 top-16" />
          </div>
          <div className="flex justify-between items-start relative">
            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                  {type === "weekly" ? "📅 주간 리포트" : "📊 월간 리포트"}
                </span>
                {isAdmin && summary && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    summary.isPublished ? "bg-emerald-400/30 text-white" : "bg-yellow-400/30 text-yellow-100"
                  }`}>
                    {summary.isPublished ? "✅ 공개" : "🔒 비공개"}
                  </span>
                )}
                {isV2 && <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full">v2</span>}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white leading-snug">
                {headline || periodStr}
              </h2>
              <p className="text-xs text-white/50 mt-2">📅 {periodStr}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {summary && (
                <button
                  onClick={handlePrint}
                  title="PDF로 저장"
                  className="text-white/70 hover:text-white hover:bg-white/10 px-3 h-9 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all"
                >
                  <span>📄</span><span className="hidden sm:inline">PDF</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white hover:bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* ── 바디 ── */}
        <div className="flex flex-1 min-h-0">

          {/* 왼쪽 사이드 네비 */}
          {summary && isV2 && (
            <nav className="flex-shrink-0 w-44 border-r border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 py-4 overflow-y-auto hidden md:flex md:flex-col">
              <p className="text-[9px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest px-4 mb-2">섹션</p>
              <div className="flex-1">
                {sections.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-all ${
                      activeSection === sec.id
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold border-r-2 border-indigo-500"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 font-medium"
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{sec.icon}</span>
                    <span className="truncate">{sec.label}</span>
                  </button>
                ))}
              </div>

              {/* 관리자 액션 */}
              {isAdmin && (
                <div className="px-3 pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-2 mt-2">
                  {!summary.isPublished && (
                    <button onClick={handlePublish}
                      className="w-full py-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all">
                      ✅ 공개하기
                    </button>
                  )}
                  <button onClick={handleGenerate} disabled={generating}
                    className="w-full py-2 text-[11px] font-bold bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1 transition-all">
                    {generating ? <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />생성중</> : "🔄 재생성"}
                  </button>
                  <button onClick={handleDelete}
                    className="w-full py-2 text-[11px] font-bold bg-red-100 hover:bg-red-200 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-all">
                    🗑️ 삭제
                  </button>
                </div>
              )}
            </nav>
          )}

          {/* 메인 콘텐츠 */}
          <div ref={contentRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Gemini 분석 결과 불러오는 중...</p>
              </div>
            ) : !summary ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-lg font-bold text-gray-700 dark:text-zinc-300 mb-2">
                  {isAdmin ? "아직 생성된 리포트가 없습니다" : "아직 공개된 리포트가 없습니다"}
                </p>
                <p className="text-sm text-gray-400 dark:text-zinc-500 mb-6">📅 분석 기간: {periodStr}</p>
                {isAdmin && (
                  <button onClick={handleGenerate} disabled={generating}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">
                    {generating
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gemini 심층 분석 중...</>
                      : "✨ AI 리포트 생성하기"}
                  </button>
                )}
              </div>
            ) : isV2 ? (
              <>
                {/* 1. 핵심 트렌드 */}
                <section id="sec-trends">
                  <SectionTitle icon="🔥" title="핵심 트렌드" count={(summary.key_trends || summary.trends || []).length} />
                  <div className="space-y-4">
                    {(summary.key_trends || summary.trends || []).map((trend: any, i: number) => (
                      <TrendCard key={i} index={i} trend={trend} />
                    ))}
                  </div>
                </section>

                {/* 2. 업계 임팩트 */}
                <section id="sec-impact">
                  <SectionTitle icon="📚" title="교육·출판 업계 임팩트" />
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-6">
                    <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">{summary.edu_industry_impact}</p>
                  </div>
                </section>

                {/* 3. 기회·리스크 (월간) */}
                {type === "monthly" && (summary.opportunities || summary.risks) && (
                  <section id="sec-opprisk">
                    <SectionTitle icon="⚖️" title="기회 · 리스크" />
                    <div className="grid md:grid-cols-2 gap-4">
                      {summary.opportunities && (
                        <div>
                          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">✅ 기회</p>
                          <div className="space-y-3">
                            {summary.opportunities.map((opp: any, i: number) => (
                              <div key={i} className="flex gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl">
                                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                                <div>
                                  <div className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-1">{opp.title}</div>
                                  <div className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">{opp.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {summary.risks && (
                        <div>
                          <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">⚠️ 리스크</p>
                          <div className="space-y-3">
                            {summary.risks.map((risk: any, i: number) => (
                              <div key={i} className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                                <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">!</span>
                                <div>
                                  <div className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">{risk.title}</div>
                                  <div className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{risk.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 4. 기업 동향 */}
                {summary.company_moves && summary.company_moves.length > 0 && (
                  <section id="sec-companies">
                    <SectionTitle icon="🏢" title="주요 기업 동향" count={summary.company_moves.length} />
                    <div className="grid md:grid-cols-2 gap-3">
                      {summary.company_moves.map((move: any, i: number) => (
                        <div key={i} className="p-4 border border-gray-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black rounded-md">{move.company}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-2">{move.action}</p>
                          {move.significance && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed pt-2 border-t border-gray-100 dark:border-zinc-800">💡 {move.significance}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. 카테고리별 (월간) */}
                {type === "monthly" && summary.category_highlights && (
                  <section id="sec-categories">
                    <SectionTitle icon="📂" title="카테고리별 동향" />
                    <div className="space-y-3">
                      {summary.category_highlights.map((item: any, i: number) => (
                        <div key={i} className="p-4 border border-gray-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{item.category}</span>
                            {item.count && <span className="text-xs font-black text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{item.count}건</span>}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 6. Editor's Pick */}
                {summary.top_picks && summary.top_picks.length > 0 && (
                  <section id="sec-picks">
                    <SectionTitle icon="🏆" title="Editor's Pick" count={summary.top_picks.length} />
                    <div className="space-y-3">
                      {summary.top_picks.map((pick: any, i: number) => (
                        <div key={i} className="flex gap-4 p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl">
                          <span className="w-8 h-8 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center text-sm font-black flex-shrink-0">{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white text-sm mb-1 leading-snug">{pick.title}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">{pick.reason}</p>
                            {pick.relevance && (
                              <span className="inline-block text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">🏭 {pick.relevance}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 7. 다음 달 전망 (월간 전용) */}
                {type === "monthly" && (summary.watch_next || summary.outlook) && (
                  <section id="sec-next">
                    <SectionTitle icon="🔭" title={type === "weekly" ? "다음 주 주목 이슈" : "다음 달 전망"} />
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl p-6">
                      <p className="text-sm text-gray-800 dark:text-indigo-100 leading-relaxed whitespace-pre-line">{summary.watch_next || summary.outlook}</p>
                    </div>
                  </section>
                )}

                {/* 모바일 어드민 버튼 */}
                {isAdmin && (
                  <div className="flex gap-3 flex-wrap pt-2 border-t border-gray-100 dark:border-zinc-800 md:hidden">
                    {!summary.isPublished && (
                      <button onClick={handlePublish} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">✅ 공개</button>
                    )}
                    <button onClick={handleGenerate} disabled={generating} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold disabled:opacity-50">
                      {generating ? "생성 중..." : "🔄 재생성"}
                    </button>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold">🗑️ 삭제</button>
                  </div>
                )}
              </>
            ) : (
              /* v1 구형 하위 호환 */
              <div className="space-y-8">
                <section>
                  <SectionTitle icon="🔥" title="핵심 트렌드" />
                  <div className="space-y-3">
                    {(summary.trends || []).map((trend: any, i: number) => (
                      <div key={i} className="flex gap-4 p-4 border border-gray-200 dark:border-zinc-800 rounded-xl">
                        <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">{i+1}</span>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white mb-1">{trend.keyword}</div>
                          <div className="text-sm text-gray-500">{trend.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                {summary.top_picks && (
                  <section>
                    <SectionTitle icon="🏆" title="Editor's Pick" />
                    <div className="space-y-3">
                      {summary.top_picks.map((pick: any, i: number) => (
                        <div key={i} className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl">
                          <div className="font-bold text-sm text-gray-800 dark:text-zinc-200 mb-1">{pick.title}</div>
                          <div className="text-xs text-gray-500">{pick.reason}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {isAdmin && (
                  <div className="flex gap-3 flex-wrap pt-4 border-t border-gray-100 dark:border-zinc-800">
                    {!summary.isPublished && (
                      <button onClick={handlePublish} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">✅ 공개</button>
                    )}
                    <button onClick={handleGenerate} disabled={generating} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold disabled:opacity-50">
                      {generating ? "생성 중..." : "🔄 재생성"}
                    </button>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold">🗑️ 삭제</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{icon}</span>
      <h3 className="text-sm font-black text-gray-700 dark:text-zinc-300 uppercase tracking-wide">{title}</h3>
      {count !== undefined && (
        <span className="text-xs text-gray-400 dark:text-zinc-600 font-bold bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{count}개</span>
      )}
    </div>
  );
}

function TrendCard({ index, trend }: { index: number; trend: any }) {
  return (
    <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 dark:bg-zinc-800/60">
        <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black flex-shrink-0">{index + 1}</span>
        <span className="font-black text-gray-900 dark:text-white">{trend.keyword}</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{trend.desc}</p>
        {trend.edu_impact && (
          <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg px-4 py-3">
            <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">📚</span>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">{trend.edu_impact}</p>
          </div>
        )}
      </div>
    </div>
  );
}
