"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getAllReports } from "@/app/actions/analyze";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend,
} from "chart.js";
import TrendBackButton from "@/app/components/TrendBackButton";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// ─── 색상 헬퍼 ─────────────────────────────────────────────────
const ORG_COLORS: Record<string, string> = {
  OpenAI:      "#10a37f",
  Anthropic:   "#d97757",
  Google:      "#4285f4",
  xAI:         "#6b7280",
  Meta:        "#0668E1",
  Microsoft:   "#0078d4",
  ElevenLabs:  "#7c3aed",
  Deepgram:    "#0891b2",
  AssemblyAI:  "#ea580c",
  Mistral:     "#d97706",
  Nvidia:      "#16a34a",
  Amazon:      "#f59e0b",
  Gladia:      "#8b5cf6",
  Inworld:     "#059669",
  Cartesia:    "#7c3aed",
  MiniMax:     "#8b5cf6",
  StepFun:     "#f97316",
  Others:      "#94a3b8",
};
const getOrgColor = (org: string) =>
  ORG_COLORS[org] || ORG_COLORS["Others"];

// ─── 리포트 타입별 카테고리 정의 ─────────────────────────────────
const CATEGORIES_BY_TYPE: Record<string, { key: string; label: string; path: string; higher?: boolean }[]> = {
  LLM: [
    { key: "mfr_overall",          label: "🏢 제조사 종합",                      path: "org_overall",      higher: true },
    { key: "test_overall",         label: "📊 Test 전체 (LiveBench)",            path: "test_benchmarks.total_ranking", higher: true },
    { key: "vote_overall",         label: "👥 Vote 전체 (LMSYS)",               path: "vote_rankings.overall", higher: true },
    { key: "sub_test_reasoning",   label: "🧠 추론 (Reasoning)",                path: "test_benchmarks.sub_categories.reasoning" },
    { key: "sub_test_coding",      label: "💻 코딩-Test",                        path: "test_benchmarks.sub_categories.coding" },
    { key: "sub_test_math",        label: "🧮 수학 (Math)",                      path: "test_benchmarks.sub_categories.math" },
    { key: "sub_test_data",        label: "📊 데이터 분석",                      path: "test_benchmarks.sub_categories.data_analysis" },
    { key: "sub_vote_coding",      label: "⌨️ 코딩-Vote",                        path: "vote_rankings.sub_categories.coding" },
    { key: "sub_vote_creative",    label: "📝 창의적 글쓰기",                    path: "vote_rankings.sub_categories.creative_writing" },
    { key: "sub_vote_multi",       label: "🗣️ 대화 맥락",                        path: "vote_rankings.sub_categories.multi_turn" },
    { key: "sub_vote_hard",        label: "🔥 고난도 질문",                      path: "vote_rankings.sub_categories.hard_prompts" },
    { key: "sub_vote_instruction", label: "✅ 지시 이행",                        path: "vote_rankings.sub_categories.instruction_following" },
    { key: "sub_vote_korean",      label: "🇰🇷 한국어",                           path: "vote_rankings.sub_categories.korean" },
  ],
  Image: [
    { key: "img_t2i",   label: "🖼️ Text-to-Image Elo",   path: "vote_rankings.overall", higher: true },
    { key: "img_edit",  label: "✏️ Image Edit Elo",        path: "vote_rankings.sub_categories.image_editing", higher: true },
  ],
  Video: [
    { key: "vid_mfr",   label: "🏢 제조사 종합",           path: "org_overall", higher: true },
    { key: "vid_test",  label: "📊 VBench (Test)",         path: "test_benchmarks.total_ranking", higher: true },
    { key: "vid_vote_t2v", label: "👥 T2V Elo",           path: "vote_rankings.sub_categories.text_to_video", higher: true },
    { key: "vid_vote_i2v", label: "🎬 I2V Elo",           path: "vote_rankings.sub_categories.image_to_video", higher: true },
  ],
  TTS: [
    { key: "tts_elo",   label: "🏆 TTS 품질 Elo Top5",    path: "vote_rankings.overall", higher: true },
    { key: "tts_mfr",   label: "🏢 제조사 종합 Elo",       path: "org_overall", higher: true },
    { key: "tts_open",  label: "🆓 오픈소스 Elo",          path: "vote_rankings.sub_categories.open_weights", higher: true },
  ],
  STT: [
    { key: "stt_wer",   label: "🎯 정확도 WER (낮을수록 ↓)", path: "test_benchmarks.total_ranking", higher: false },
    { key: "stt_mfr",   label: "🏢 제조사 Best WER",         path: "org_wer", higher: false },
    { key: "stt_speed", label: "⚡ 속도 Speed Factor",       path: "test_benchmarks.sub_categories.speed", higher: true },
    { key: "stt_price", label: "💰 가격 (낮을수록 ↓)",       path: "test_benchmarks.sub_categories.price", higher: false },
  ],
};

const TYPE_LABELS: Record<string, string> = {
  LLM: "LLM", Image: "이미지 AI", Video: "영상 AI", TTS: "TTS", STT: "STT",
};

// ─── 중첩 경로로 데이터 꺼내기 ───────────────────────────────────
function getByPath(obj: any, path: string): any[] {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return [];
    cur = cur[p];
  }
  if (Array.isArray(cur)) return cur;
  if (cur?.items) return cur.items;
  return [];
}

// ─── 제조사별 Best score 계산 ─────────────────────────────────────
function calcMfrBest(items: any[], higher: boolean): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach((item: any) => {
    const org   = item.org || "Others";
    const score = Number(item.elo ?? item.score) || (higher ? -Infinity : Infinity);
    if (map[org] == null)                     map[org] = score;
    else if (higher  && score > map[org])     map[org] = score;
    else if (!higher && score < map[org])     map[org] = score;
  });
  return map;
}

// ─── 내부 컴포넌트 (useSearchParams 사용) ────────────────────────
function TrendsContent() {
  const searchParams = useSearchParams();
  const urlCategory  = searchParams.get("category") || "LLM";

  // URL category → 타입 매핑 (ReportTab에서 넘기는 searchKey 기준)
  const TYPE_MAP: Record<string, string> = {
    LLM: "LLM", Image: "Image", Video: "Video", TTS: "TTS", STT: "STT",
  };
  const initType = TYPE_MAP[urlCategory] || "LLM";

  const [allReports,      setAllReports]      = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [reportType,      setReportType]      = useState(initType);
  const [selectedCatKey,  setSelectedCatKey]  = useState(
    CATEGORIES_BY_TYPE[initType]?.[0]?.key || "mfr_overall",
  );

  useEffect(() => {
    getAllReports().then(d => { setAllReports(d); setLoading(false); });
  }, []);

  // 타입 변경 시 카테고리 초기화
  const handleTypeChange = (t: string) => {
    setReportType(t);
    setSelectedCatKey(CATEGORIES_BY_TYPE[t]?.[0]?.key || "");
  };

  const cats     = CATEGORIES_BY_TYPE[reportType] || [];
  const selCat   = cats.find(c => c.key === selectedCatKey) || cats[0];
  const isWER    = selectedCatKey === "stt_wer" || selectedCatKey === "stt_price";
  const isMfr    = selCat?.path === "org_overall" || selCat?.path === "org_wer";
  const higher   = selCat?.higher ?? true;

  // ─── 차트 데이터 계산 ────────────────────────────────────────
  const { labels, datasets } = (() => {
    if (!allReports.length || !selCat) return { labels: [], datasets: [] };

    // 1) 이 타입의 리포트만 필터
    const typeReports = allReports.filter((r: any) =>
      (r.analysis_result?.report_type || "").toUpperCase() === reportType.toUpperCase()
    );
    if (!typeReports.length) return { labels: [], datasets: [] };

    // 2) 월별 가장 최신 1개
    const monthMap = new Map<string, any>();
    typeReports.forEach((r: any) => {
      const d   = new Date(r.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthMap.has(key) || monthMap.get(key).created_at < r.created_at)
        monthMap.set(key, r);
    });

    const sorted = Array.from(monthMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const labels: string[] = sorted.map(r => {
      const d = new Date(r.created_at);
      return `${d.getFullYear()}.${d.getMonth() + 1}`;
    });

    const orgScores: Record<string, (number | null)[]> = {};

    sorted.forEach((report: any, idx: number) => {
      const raw  = report.analysis_result?.raw_data;
      if (!raw) return;

      let scores: Record<string, number> = {};

      if (isMfr) {
        // 제조사 종합 — 각 제조사 best score
        const baseItems = getByPath(raw, reportType === "STT"
          ? "test_benchmarks.total_ranking"
          : "vote_rankings.overall",
        );
        scores = calcMfrBest(baseItems, higher);
      } else {
        // 일반 경로
        const items = getByPath(raw, selCat.path).slice(0, 6);
        items.forEach((item: any) => {
          const org   = item.org || "Others";
          const val   = Number(item.elo ?? item.score) || 0;
          scores[org] = scores[org] != null
            ? (higher ? Math.max(scores[org], val) : Math.min(scores[org], val))
            : val;
        });
      }

      Object.entries(scores).forEach(([org, val]) => {
        if (!orgScores[org]) orgScores[org] = Array(sorted.length).fill(null);
        orgScores[org][idx] = val;
      });

      // 이번 리포트에 없는 org에는 null 유지
    });

    const chartDatasets = Object.entries(orgScores)
      .filter(([, vals]) => vals.some(v => v !== null))
      .map(([org, vals]) => ({
        label:            org,
        data:             vals,
        borderColor:      getOrgColor(org),
        backgroundColor:  getOrgColor(org) + "30",
        borderWidth:      2.5,
        pointRadius:      5,
        pointHoverRadius: 8,
        fill:             false,
        tension:          0.25,
        spanGaps:         true,
      }));

    return { labels, datasets: chartDatasets };
  })();

  // Y축 범위 자동
  const allVals  = datasets.flatMap(d => d.data).filter(v => v !== null) as number[];
  const minVal   = allVals.length ? Math.min(...allVals) : 0;
  const maxVal   = allVals.length ? Math.max(...allVals) : 100;
  const pad      = (maxVal - minVal) * 0.1 || 5;
  const yMin     = higher ? Math.floor(minVal - pad) : Math.floor(minVal - pad);
  const yMax     = higher ? Math.ceil(maxVal  + pad) : Math.ceil(maxVal  + pad);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { position: "top" as const },
      title:  {
        display: true,
        text:    `${TYPE_LABELS[reportType]} — ${selCat?.label} 추이`,
        font: { size: 14, weight: "bold" as const },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed.y;
            if (v == null) return "";
            if (isWER)  return `${ctx.dataset.label}: ${v.toFixed(2)}%`;
            if (Number.isInteger(v)) return `${ctx.dataset.label}: ${v.toLocaleString()}`;
            return `${ctx.dataset.label}: ${v.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: { title: { display: true, text: "리포트 기준 월" } },
      y: {
        min: yMin,
        max: yMax,
        title: {
          display: true,
          text: isWER ? "WER / Price (낮을수록 좋음)" : higher ? "Score / Elo (높을수록 좋음)" : "Score (낮을수록 좋음)",
        },
        reverse: isWER,  // WER 계열은 Y축 반전 (낮을수록 위에)
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6 md:p-10">
      <div className="max-w-6xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 md:p-10">

        {/* 뒤로가기 */}
        <div className="mb-6">
          <TrendBackButton />
        </div>

        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          📈 기간별 성능 트렌드 분석
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          저장된 월별 리포트 기반 · 제조사/모델별 점수 추이 시각화
        </p>

        {/* 리포트 타입 선택 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.keys(CATEGORIES_BY_TYPE).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all border
                ${reportType === t
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg"
                  : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-indigo-400 hover:text-indigo-600"
                }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 카테고리 선택 */}
        <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
          {cats.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCatKey(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${selectedCatKey === cat.key
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600"
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 차트 */}
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : datasets.length > 0 ? (
          <>
            <div className="h-[480px] w-full border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 bg-gray-50 dark:bg-zinc-800">
              <Line data={{ labels, datasets }} options={chartOptions} />
            </div>
            {isWER && (
              <p className="text-xs text-center text-gray-400 mt-3">
                ↑ Y축이 반전됩니다 — 낮을수록 더 위쪽 = 더 좋음
              </p>
            )}
            <div className="mt-4 text-xs text-gray-400 text-center">
              데이터 포인트: {labels.length}개 월 · 제조사 수: {datasets.length}개
            </div>
          </>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-gray-400 gap-3">
            <span className="text-5xl">📭</span>
            <p className="font-bold">
              {reportType} 리포트 데이터가 없습니다
            </p>
            <p className="text-sm">
              어드민 페이지에서 {TYPE_LABELS[reportType]} 리포트를 먼저 발행해 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 페이지 래퍼 (Suspense 필수) ────────────────────────────────
export default function TrendsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    }>
      <TrendsContent />
    </Suspense>
  );
}