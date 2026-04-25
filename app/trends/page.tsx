"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAllReports } from "@/app/actions/analyze";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import TrendBackButton from "@/app/components/TrendBackButton";
import { trackEvent, trackPageView } from "@/lib/analytics";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type CategoryDef = {
  key: string;
  label: string;
  path: string;
  higher?: boolean;
};

const ORG_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d97757",
  Google: "#4285f4",
  xAI: "#6b7280",
  Meta: "#0668E1",
  Microsoft: "#0078d4",
  ElevenLabs: "#7c3aed",
  Deepgram: "#0891b2",
  AssemblyAI: "#ea580c",
  Mistral: "#d97706",
  Nvidia: "#16a34a",
  Amazon: "#f59e0b",
  Gladia: "#8b5cf6",
  Inworld: "#059669",
  Cartesia: "#7c3aed",
  MiniMax: "#8b5cf6",
  StepFun: "#f97316",
  Anysphere: "#0ea5e9",
  "Perplexity AI": "#7c3aed",
  ByteDance: "#fe2c55",
  Adobe: "#e44025",
  Runway: "#111827",
  Others: "#94a3b8",
};

const getOrgColor = (org: string) => ORG_COLORS[org] || ORG_COLORS.Others;

const CATEGORIES_BY_TYPE: Record<string, CategoryDef[]> = {
  LLM: [
    { key: "mfr_overall", label: "제조사 종합", path: "org_overall", higher: true },
    { key: "test_overall", label: "LiveBench 종합", path: "test_benchmarks.total_ranking", higher: true },
    { key: "vote_overall", label: "LMArena 종합", path: "vote_rankings.overall", higher: true },
    { key: "sub_test_reasoning", label: "추론", path: "test_benchmarks.sub_categories.reasoning", higher: true },
    { key: "sub_test_coding", label: "코딩 Test", path: "test_benchmarks.sub_categories.coding", higher: true },
    { key: "sub_test_math", label: "수학", path: "test_benchmarks.sub_categories.math", higher: true },
    { key: "sub_test_data", label: "데이터 분석", path: "test_benchmarks.sub_categories.data_analysis", higher: true },
    { key: "sub_vote_coding", label: "코딩 Vote", path: "vote_rankings.sub_categories.coding", higher: true },
    { key: "sub_vote_creative", label: "창의적 글쓰기", path: "vote_rankings.sub_categories.creative_writing", higher: true },
    { key: "sub_vote_multi", label: "멀티턴 대화", path: "vote_rankings.sub_categories.multi_turn", higher: true },
    { key: "sub_vote_hard", label: "고난도 프롬프트", path: "vote_rankings.sub_categories.hard_prompts", higher: true },
    { key: "sub_vote_instruction", label: "지시 이행", path: "vote_rankings.sub_categories.instruction_following", higher: true },
    { key: "sub_vote_korean", label: "한국어", path: "vote_rankings.sub_categories.korean", higher: true },
  ],
  IMAGE: [
    { key: "img_overall", label: "Text-to-Image 종합", path: "vote_rankings.overall", higher: true },
    { key: "img_t2i", label: "T2I 일반", path: "vote_rankings.sub_categories.text_to_image", higher: true },
    { key: "img_product", label: "제품", path: "vote_rankings.sub_categories.text_to_image_product", higher: true },
    { key: "img_3d", label: "3D", path: "vote_rankings.sub_categories.text_to_image_3d", higher: true },
    { key: "img_cartoon", label: "카툰", path: "vote_rankings.sub_categories.text_to_image_cartoon", higher: true },
    { key: "img_photo", label: "포토", path: "vote_rankings.sub_categories.text_to_image_photo", higher: true },
    { key: "img_art", label: "아트", path: "vote_rankings.sub_categories.text_to_image_art", higher: true },
    { key: "img_portrait", label: "인물", path: "vote_rankings.sub_categories.text_to_image_portrait", higher: true },
    { key: "img_text", label: "텍스트 렌더링", path: "vote_rankings.sub_categories.text_to_image_text", higher: true },
    { key: "img_edit_single", label: "단일 이미지 편집", path: "vote_rankings.sub_categories.image_edit_single", higher: true },
    { key: "img_edit_multi", label: "다중 이미지 편집", path: "vote_rankings.sub_categories.image_edit_multi", higher: true },
    { key: "img_speed", label: "생성 속도", path: "test_benchmarks.sub_categories.speed", higher: false },
    { key: "img_price", label: "가격", path: "test_benchmarks.sub_categories.price", higher: false },
  ],
  VIDEO: [
    { key: "vid_mfr", label: "제조사 종합", path: "org_overall", higher: false },
    { key: "vid_test", label: "VBench 종합", path: "test_benchmarks.total_ranking", higher: true },
    { key: "vid_human_anatomy", label: "인체 구조", path: "test_benchmarks.sub_categories.human_anatomy", higher: true },
    { key: "vid_motion", label: "모션 합리성", path: "test_benchmarks.sub_categories.motion_rationality", higher: true },
    { key: "vid_instance", label: "객체 일관성", path: "test_benchmarks.sub_categories.instance_preservation", higher: true },
    { key: "vid_identity", label: "인물 동일성", path: "test_benchmarks.sub_categories.human_identity", higher: true },
    { key: "vid_dynamic", label: "동적 속성", path: "test_benchmarks.sub_categories.dynamic_attribute", higher: true },
    { key: "vid_plot", label: "복합 플롯", path: "test_benchmarks.sub_categories.complex_plot", higher: true },
    { key: "vid_camera", label: "카메라 무빙", path: "test_benchmarks.sub_categories.camera_motion", higher: true },
    { key: "vid_landscape", label: "복합 배경", path: "test_benchmarks.sub_categories.complex_landscape", higher: true },
    { key: "vid_vote_t2v", label: "Text-to-Video", path: "vote_rankings.sub_categories.text_to_video", higher: true },
    { key: "vid_vote_i2v", label: "Image-to-Video", path: "vote_rankings.sub_categories.image_to_video", higher: true },
    { key: "vid_vote_edit", label: "Video Edit", path: "vote_rankings.sub_categories.video_edit", higher: true },
    { key: "vid_speed", label: "생성 속도", path: "test_benchmarks.aa_speed", higher: false },
    { key: "vid_price", label: "가격", path: "test_benchmarks.aa_price", higher: false },
  ],
  TTS: [
    { key: "tts_elo", label: "TTS Elo", path: "vote_rankings.overall", higher: true },
    { key: "tts_mfr", label: "제조사 종합 Elo", path: "org_overall", higher: true },
    { key: "tts_open", label: "오픈웨이트", path: "vote_rankings.sub_categories.open_weights", higher: true },
    { key: "tts_speed", label: "속도", path: "vote_rankings.sub_categories.speed", higher: true },
    { key: "tts_price", label: "가격", path: "vote_rankings.sub_categories.price", higher: false },
  ],
  STT: [
    { key: "stt_wer", label: "WER", path: "test_benchmarks.total_ranking", higher: false },
    { key: "stt_mfr", label: "제조사 Best WER", path: "org_wer", higher: false },
    { key: "stt_speed", label: "Speed Factor", path: "test_benchmarks.sub_categories.speed", higher: true },
    { key: "stt_price", label: "가격", path: "test_benchmarks.sub_categories.price", higher: false },
  ],
  CODE: [
    { key: "code_test_overall", label: "정량 종합", path: "test_benchmarks.total_ranking", higher: true },
    { key: "code_swe", label: "SWE-bench", path: "test_benchmarks.sub_categories.swe_bench", higher: true },
    { key: "code_aider", label: "Aider", path: "test_benchmarks.sub_categories.aider", higher: true },
    { key: "code_vote_overall", label: "WebDev 종합", path: "vote_rankings.overall", higher: true },
    { key: "code_webdev", label: "WebDev Overall", path: "vote_rankings.sub_categories.webdev_overall", higher: true },
    { key: "code_html", label: "WebDev HTML", path: "vote_rankings.sub_categories.webdev_html", higher: true },
    { key: "code_react", label: "WebDev React", path: "vote_rankings.sub_categories.webdev_react", higher: true },
    { key: "code_image_to_webdev", label: "Image to WebDev", path: "vote_rankings.sub_categories.image_to_webdev", higher: true },
  ],
  SERVICE: [
    { key: "svc_overall", label: "전체 종합", path: "overall", higher: true },
    { key: "svc_chatbot", label: "챗봇", path: "categories.chatbot", higher: true },
    { key: "svc_coding", label: "코딩", path: "categories.coding", higher: true },
    { key: "svc_image", label: "이미지", path: "categories.image", higher: true },
    { key: "svc_video", label: "비디오", path: "categories.video", higher: true },
    { key: "svc_other", label: "기타", path: "categories.other", higher: true },
  ],
};

const TYPE_LABELS: Record<string, string> = {
  LLM: "LLM",
  IMAGE: "이미지 AI",
  VIDEO: "비디오 AI",
  TTS: "TTS",
  STT: "STT",
  CODE: "코딩 AI",
  SERVICE: "AI 서비스",
};

const TREND_VISIBLE_TYPES = ["LLM", "IMAGE", "VIDEO", "TTS", "STT", "CODE"];

const TYPE_MAP: Record<string, string> = {
  LLM: "LLM",
  IMAGE: "IMAGE",
  Image: "IMAGE",
  VIDEO: "VIDEO",
  Video: "VIDEO",
  TTS: "TTS",
  STT: "STT",
  CODE: "CODE",
  Code: "CODE",
  SERVICE: "SERVICE",
  Service: "SERVICE",
};

function getByPath(obj: any, path: string): any[] {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return [];
    cur = cur[p];
  }
  if (Array.isArray(cur)) return cur;
  if (Array.isArray(cur?.items)) return cur.items;
  return [];
}

function getMetricValue(item: any): number | null {
  if (typeof item?.monthly_visits === "number") return item.monthly_visits;
  const raw = item?.elo ?? item?.score;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function calcMfrBest(items: any[], higher: boolean): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach((item: any) => {
    const org = item.org || "Others";
    const score = getMetricValue(item);
    if (score == null) return;

    if (map[org] == null) {
      map[org] = score;
      return;
    }

    if (higher) map[org] = Math.max(map[org], score);
    else map[org] = Math.min(map[org], score);
  });
  return map;
}

function formatTooltipValue(value: number, selectedCatKey: string, higher: boolean) {
  if (selectedCatKey === "stt_wer" || selectedCatKey === "stt_mfr") {
    return `${value.toFixed(2)}%`;
  }

  if (selectedCatKey.includes("price")) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }

  if (selectedCatKey.startsWith("svc_")) {
    return value.toLocaleString();
  }

  if (!higher && value < 100) {
    return value.toFixed(2);
  }

  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function TrendsContent() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category") || "LLM";
  const initType = TYPE_MAP[urlCategory] || "LLM";

  const [allReports, setAllReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState(initType);
  const [selectedCatKey, setSelectedCatKey] = useState(
    CATEGORIES_BY_TYPE[initType]?.[0]?.key || "mfr_overall",
  );

  useEffect(() => {
    getAllReports().then((data) => {
      setAllReports(data);
      setLoading(false);
    });
    trackPageView("/trends", "AI Trend Lab | 기간별 성능 분석");
  }, []);

  const handleTypeChange = (nextType: string) => {
    setReportType(nextType);
    setSelectedCatKey(CATEGORIES_BY_TYPE[nextType]?.[0]?.key || "");
    trackEvent("trend_type_change", { type: nextType });
  };

  const cats = CATEGORIES_BY_TYPE[reportType] || [];
  const selCat = cats.find((cat) => cat.key === selectedCatKey) || cats[0];
  const higher = selCat?.higher ?? true;
  const isWER = selectedCatKey === "stt_wer" || selectedCatKey === "stt_mfr";
  const isMfr = selCat?.path === "org_overall" || selCat?.path === "org_wer";

  const chartData = useMemo(() => {
    if (!selCat) return { labels: [] as string[], datasets: [] as any[] };

    const typeReports = allReports.filter((report: any) => {
      const type = (report.analysis_result?.report_type || "").toUpperCase();
      return type === reportType;
    });
    if (!typeReports.length) return { labels: [], datasets: [] };

    const monthMap = new Map<string, any>();
    typeReports.forEach((report: any) => {
      const createdAt = new Date(report.created_at);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const prev = monthMap.get(key);
      if (!prev || new Date(prev.created_at).getTime() < createdAt.getTime()) {
        monthMap.set(key, report);
      }
    });

    const sorted = Array.from(monthMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const labels = sorted.map((report) => {
      const d = new Date(report.created_at);
      return `${d.getFullYear()}.${d.getMonth() + 1}`;
    });

    const orgScores: Record<string, (number | null)[]> = {};

    sorted.forEach((report: any, index: number) => {
      const raw = report.analysis_result?.raw_data;
      if (!raw) return;

      let scores: Record<string, number> = {};

      if (isMfr) {
        const basePath =
          reportType === "STT"
            ? "test_benchmarks.total_ranking"
            : "vote_rankings.overall";
        scores = calcMfrBest(getByPath(raw, basePath), higher);
      } else {
        const items = getByPath(raw, selCat.path).slice(0, 10);
        items.forEach((item: any) => {
          const org = item.org || "Others";
          const value = getMetricValue(item);
          if (value == null) return;

          if (scores[org] == null) scores[org] = value;
          else scores[org] = higher ? Math.max(scores[org], value) : Math.min(scores[org], value);
        });
      }

      Object.entries(scores).forEach(([org, value]) => {
        if (!orgScores[org]) orgScores[org] = Array(sorted.length).fill(null);
        orgScores[org][index] = value;
      });
    });

    const datasets = Object.entries(orgScores)
      .filter(([, values]) => values.some((value) => value !== null))
      .sort((a, b) => {
        const aLast = [...a[1]].reverse().find((v) => v != null) ?? (higher ? -Infinity : Infinity);
        const bLast = [...b[1]].reverse().find((v) => v != null) ?? (higher ? -Infinity : Infinity);
        return higher ? Number(bLast) - Number(aLast) : Number(aLast) - Number(bLast);
      })
      .slice(0, 12)
      .map(([org, values]) => ({
        label: org,
        data: values,
        borderColor: getOrgColor(org),
        backgroundColor: `${getOrgColor(org)}30`,
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 8,
        fill: false,
        tension: 0.25,
        spanGaps: true,
      }));

    return { labels, datasets };
  }, [allReports, higher, isMfr, reportType, selCat]);

  const allValues = chartData.datasets.flatMap((dataset: any) => dataset.data).filter((v: any) => v !== null) as number[];
  const minValue = allValues.length ? Math.min(...allValues) : 0;
  const maxValue = allValues.length ? Math.max(...allValues) : 100;
  const padding = (maxValue - minValue) * 0.1 || 5;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { position: "top" as const },
      title: {
        display: true,
        text: `${TYPE_LABELS[reportType]} - ${selCat?.label} 추이`,
        font: { size: 14, weight: "bold" as const },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const value = ctx.parsed.y;
            if (value == null) return "";
            return `${ctx.dataset.label}: ${formatTooltipValue(value, selectedCatKey, higher)}`;
          },
        },
      },
    },
    scales: {
      x: { title: { display: true, text: "리포트 월" } },
      y: {
        min: Math.floor(minValue - padding),
        max: Math.ceil(maxValue + padding),
        title: {
          display: true,
          text: isWER
            ? "WER (낮을수록 좋음)"
            : higher
              ? "점수 / Elo / 트래픽 (높을수록 좋음)"
              : "값 (낮을수록 좋음)",
        },
        reverse: isWER,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6 md:p-10">
      <div className="max-w-6xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 md:p-10">
        <div className="mb-6">
          <TrendBackButton />
        </div>

        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          AI 기간별 성능 분석
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          월별 리포트를 기준으로 제조사별 주요 지표 추이를 비교합니다.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {TREND_VISIBLE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                reportType === type
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg"
                  : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-indigo-400 hover:text-indigo-600"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
          {cats.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCatKey(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedCatKey === cat.key
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : chartData.datasets.length > 0 ? (
          <>
            <div className="h-[480px] w-full border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 bg-gray-50 dark:bg-zinc-800">
              <Line data={chartData} options={chartOptions} />
            </div>
            {isWER && (
              <p className="text-xs text-center text-gray-400 mt-3">
                WER 차트는 Y축이 반전되어 있으며 위로 갈수록 더 좋습니다.
              </p>
            )}
            <div className="mt-4 text-xs text-gray-400 text-center">
              데이터 포인트 {chartData.labels.length}개월 · 제조사 {chartData.datasets.length}개
            </div>
          </>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-gray-400 gap-3">
            <span className="text-5xl">📉</span>
            <p className="font-bold">{TYPE_LABELS[reportType]} 리포트 데이터가 없습니다.</p>
            <p className="text-sm">
              어드민 페이지에서 {TYPE_LABELS[reportType]} 리포트를 먼저 발행해 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }
    >
      <TrendsContent />
    </Suspense>
  );
}
