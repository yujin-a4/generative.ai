"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
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

// ------------------- [데이터 매핑] -------------------
const CATEGORY_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  // VBench 8대 지표
  human_anatomy: { label: "인체 품질 (Anatomy)", desc: "손가락 개수, 얼굴 형태 등 인체가 얼마나 자연스럽게 생성되었는지 평가합니다.", icon: "🦴" },
  motion_rationality: { label: "움직임 합리성 (Physics)", desc: "물리 법칙을 무시하거나 기괴하게 움직이지 않고 자연스러운지 평가합니다.", icon: "🏃" },
  instance_preservation: { label: "객체 유지력 (Consistency)", desc: "영상 시작부터 끝까지 주인공(객체)의 모습이 변하지 않고 유지되는지 평가합니다.", icon: "🔒" },
  human_identity: { label: "인물 유지력 (Identity)", desc: "특정 인물의 얼굴이 영상 내내 동일하게 유지되는지 평가합니다.", icon: "🆔" },
  dynamic_attribute: { label: "역동성 (Dynamic)", desc: "영상이 정지 화면 같지 않고, 시간 흐름에 따라 얼마나 생동감 있게 변하는지 평가합니다.", icon: "🌊" },
  complex_plot: { label: "복잡한 구성 (Plot)", desc: "단순한 줌인이 아니라, 복합적인 스토리나 사건 전개를 얼마나 잘 표현하는지 평가합니다.", icon: "🎬" },
  camera_motion: { label: "카메라 워킹 (Camera)", desc: "줌인, 줌아웃, 패닝 등 사용자가 지시한 카메라 무빙을 얼마나 잘 수행하는지 평가합니다.", icon: "🎥" },
  complex_landscape: { label: "복잡한 풍경 (Landscape)", desc: "배경이나 풍경의 디테일이 뭉개지지 않고 섬세하게 표현되는지 평가합니다.", icon: "🏞️" },
  
  // LMSYS
  text_to_video:  { label: "텍스트→영상",   desc: "텍스트 프롬프트만으로 영상을 생성했을 때, 사용자가 느끔는 주관적 만족도(Elo)입니다.", icon: "📝" },
  image_to_video: { label: "이미지→영상",   desc: "이미지를 입력으로 주어 영상을 생성했을 때, 원본 이미지를 잘 살리면서 자연스럽게 움직이는지 평가합니다.", icon: "🖼️" },
  video_edit:     { label: "비디오 편집",   desc: "영상의 특정 부분을 수정하거나 변환하는 능력을 사용자 블라인드 테스트로 평가합니다.", icon: "✂️" },
  
  // Image — Text-to-Image 카테고리
  text_to_image:          { label: "이미지 생성 (종합)",    desc: "전체 모델 대상 사용자 블라인드 테스트 기반 종합 Elo 순위입니다.",                          icon: "🏆" },
  text_to_image_product:  { label: "제품 · 브랜딩",         desc: "제품 사진, 브랜드 로고, 커머스용 이미지 생성 능력을 평가합니다.",                         icon: "🛍️" },
  text_to_image_3d:       { label: "3D 이미징 · 모델링",     desc: "3D 렌더링 스타일의 입체감 있는 이미지 생성 능력을 평가합니다.",                           icon: "🎲" },
  text_to_image_cartoon:  { label: "만화 · 애니 · 판타지",   desc: "만화·애니메이션·판타지 스타일의 이미지 생성 능력을 평가합니다.",                          icon: "✨" },
  text_to_image_photo:    { label: "사진 · 영화적 사실감", desc: "실제 사진이나 영화처럼 사실적인 이미지를 얼마나 잘 생성하는지 평가합니다.",                icon: "📸" },
  text_to_image_art:      { label: "예술 (Art)",                desc: "회화·디지털 아트 등 예술적 스타일의 이미지 생성 능력을 평가합니다.",                       icon: "🎨" },
  text_to_image_portrait: { label: "인물 초상화",                desc: "인물 초상화를 얼마나 자연스럽고 정확하게 생성하는지 평가합니다.",                          icon: "🧑" },
  text_to_image_text:     { label: "텍스트 렌더링",             desc: "이미지 안에 텍스트를 정확하게 표현하는 능력입니다. 기존 AI 모델의 대표적 약점입니다.",    icon: "🔤" },
  // Image — Image Edit 카테고리
  image_edit:             { label: "이미지 편집 (종합)",       desc: "이미지의 특정 부분을 수정하거나 변환하는 능력입니다.",                                       icon: "🪄" },
  image_edit_single:      { label: "단일 이미지 편집",          desc: "하나의 이미지에서 특정 부분만 수정·변환하는 단일 이미지 편집 능력입니다.",                icon: "✏️" },
  image_edit_multi:       { label: "다중 이미지 편집",           desc: "여러 이미지를 조합하거나 교차 편집하는 다중 이미지 편집 능력입니다.",                      icon: "🖼️" },
};

// ------------------- [공통 헬퍼] -------------------
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
const QuestionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-indigo-600 transition-colors cursor-help">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
  </svg>
);
const ChevronLeft = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>);
const ChevronRight = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>);

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

// ------------------- [Generic 전용 컴포넌트] -------------------
export default function ReportViewGeneric({ data, onSave, onReanalyze, isSaving, isEditable = false }: ReportViewProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  
  // Carousel State
  const [vbenchIndex, setVbenchIndex] = useState(0);
  const [lmsysIndex, setLmsysIndex] = useState(0);
  const [t2iIndex, setT2iIndex] = useState(0);
  const [ieIndex, setIeIndex] = useState(0);
  const [svcCatTab, setSvcCatTab] = useState<'chatbot'|'coding'|'image'|'video'|'other'>('chatbot');
  const [codeTestIndex, setCodeTestIndex] = useState(0);
  const [codeLmsysIndex, setCodeLmsysIndex] = useState(0);
  
  const VBENC_KEYS = [
    "human_anatomy", "motion_rationality", "instance_preservation", "human_identity",
    "dynamic_attribute", "complex_plot", "camera_motion", "complex_landscape"
  ];
  const LMSYS_KEYS = ["text_to_video", "image_to_video", "video_edit"];
  const T2I_KEYS = ["text_to_image", "text_to_image_product", "text_to_image_3d", "text_to_image_cartoon", "text_to_image_photo", "text_to_image_art", "text_to_image_portrait", "text_to_image_text"];
  const IE_KEYS = ["image_edit_single", "image_edit_multi"];
  const CODE_TEST_KEYS = ["swe_bench", "aider"];
  const CODE_LMSYS_KEYS = ["webdev_overall", "webdev_html", "webdev_react", "image_to_webdev"];

  useEffect(() => { if (data) setReportData(data.analysis_result || data); }, [data]);

  if (!reportData) return null;

  const startEditing = (key: string, val: string) => { setEditingFields(p => ({ ...p, [key]: true })); setTempValues(p => ({ ...p, [key]: val })); };
  const cancelEditing = (key: string) => { setEditingFields(p => ({ ...p, [key]: false })); setTempValues(p => { const n = { ...p }; delete n[key]; return n; }); };
  const updateTempValue = (key: string, val: string) => setTempValues(p => ({ ...p, [key]: val }));
  
  const confirmVBenchCommentEdit = (cat: string) => {
    const key = `test_benchmarks.${cat}`; const val = tempValues[key];
    if (val !== undefined) setReportData((p: any) => ({ ...p, raw_data: { ...p.raw_data, test_benchmarks: { ...p.raw_data.test_benchmarks, sub_categories: { ...p.raw_data.test_benchmarks.sub_categories, [cat]: { ...p.raw_data.test_benchmarks.sub_categories[cat], comment: val } } } } }));
    setEditingFields(p => ({ ...p, [key]: false }));
  };

  const confirmCommentEdit = (section: string, cat: string) => {
    const key = `vote_rankings.${cat}`; const val = tempValues[key];
    if (val !== undefined) setReportData((p: any) => ({ ...p, raw_data: { ...p.raw_data, [section]: { ...p.raw_data[section], sub_categories: { ...p.raw_data[section].sub_categories, [cat]: { ...p.raw_data[section].sub_categories[cat], comment: val } } } } }));
    setEditingFields(p => ({ ...p, [key]: false }));
  };
  
  const confirmSummaryEdit = (idx: number) => {
    const key = `summary.${idx}`; const val = tempValues[key];
    if (val !== undefined) { const n = [...reportData.summary_insights]; n[idx] = val; setReportData((p: any) => ({ ...p, summary_insights: n })); }
    setEditingFields(p => ({ ...p, [key]: false }));
  };

  const handleSaveClick = () => { if (onSave) onSave(reportData); };

  // Carousel Handlers
  const handlePrevVBench = () => setVbenchIndex((p) => Math.max(0, p - 1));
  const handleNextVBench = () => setVbenchIndex((p) => Math.min(VBENC_KEYS.length - 1, p + 1));
  const handlePrevLmsys = () => setLmsysIndex((p) => Math.max(0, p - 1));
  const handleNextLmsys = () => setLmsysIndex((p) => Math.min(LMSYS_KEYS.length - 1, p + 1));
  const handlePrevT2i = () => setT2iIndex((p) => Math.max(0, p - 1));
  const handleNextT2i = () => setT2iIndex((p) => Math.min(T2I_KEYS.length - 1, p + 1));
  const handlePrevIe = () => setIeIndex((p) => Math.max(0, p - 1));
  const handleNextIe = () => setIeIndex((p) => Math.min(IE_KEYS.length - 1, p + 1));

  const { raw_data, data_dates, summary_insights, report_type } = reportData;
  const testTotal = raw_data?.test_benchmarks?.total_ranking || [];
  const testSubCategories = raw_data?.test_benchmarks?.sub_categories || {};
  const voteOverall = raw_data?.vote_rankings?.overall || [];
  
  const lmsysRepresentative = raw_data?.vote_rankings?.sub_categories?.text_to_video?.items || [];

  const reportTitle = generateReportTitle(data_dates, report_type);
  const isImage = report_type?.toUpperCase() === 'IMAGE';
  const isVideo = report_type?.toUpperCase() === 'VIDEO';
  const isService = report_type?.toUpperCase() === 'SERVICE';
  const isCode = report_type?.toUpperCase() === 'CODE';

  // CODE 카테고리 레이블 매핑
  const CODE_TEST_LABEL: Record<string, { label: string; icon: string; desc: string }> = {
    swe_bench: { label: 'SWE-bench Verified', icon: '🐛', desc: '실제 GitHub 이슈 해결률 (% Resolved)' },
    aider:     { label: 'Aider 리더보드',    icon: '✏️', desc: '코드 편집 정확도 (% Correct)' },
  };
  const CODE_LMSYS_LABEL: Record<string, { label: string; icon: string }> = {
    webdev_overall:  { label: 'WebDev 종합',        icon: '🌐' },
    webdev_html:     { label: 'HTML',              icon: '📄' },
    webdev_react:    { label: 'React',             icon: '⚛️'  },
    image_to_webdev: { label: '이미지→웹개발', icon: '🖼️' },
  };

  const formatVisits = (n: number | null) => {
    if (!n) return '-';
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  };

  const SERVICE_ORG_COLORS: Record<string, string> = {
    'OpenAI': '#10a37f', 'Google': '#4285f4', 'Anthropic': '#d97706',
    'Perplexity AI': '#7c3aed', 'xAI': '#374151', 'Meta': '#1877f2',
    'Microsoft': '#0078d4', 'Anysphere': '#0ea5e9', 'Midjourney': '#f59e0b',
    'Adobe': '#e44025', 'Runway': '#1a1a1a', 'Stability AI': '#6366f1',
    'ByteDance': '#fe2c55', 'Mistral': '#ff7000',
  };
  const getSvcOrgColor = (org: string) => SERVICE_ORG_COLORS[org] || '#64748b';

  const SVC_CATS = [
    { key: 'chatbot', label: '챗봇', icon: '💬' },
    { key: 'coding',  label: '코딩', icon: '👨‍💻' },
    { key: 'image',   label: '이미지', icon: '🎨' },
    { key: 'video',   label: '영상', icon: '🎬' },
    { key: 'other',   label: '기타', icon: '🔧' },
  ] as const;

  const formatScore = (val: any) => {
    if (!val) return "-";
    const num = Number(val);
    if (num < 110) return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };
  
  const cleanModelName = (name: string) => {
    if (!name) return "";
    let clean = name.replace(/-202\d{5}/g, "").replace(/_/g, " ").replace(/-preview/g, "").replace(/-image-generation/g, "").replace(/\(nano-.*?\)/g, "").replace(/-pro-image/g, "-pro").trim();
    return clean;
  };

  const getOrgInfoGeneric = (org: string) => {
    const lower = org?.toLowerCase() || "";

    // ── LLM 주요 제조사 (최우선) ──────────────────────────────
    if (lower.includes("anthropic") || lower.includes("claude"))
      return { color: "#d97706", bgColor: "#FEF3C7", index: 10, name: "Anthropic" };
    if (lower.includes("openai") || lower.includes("gpt") || lower.includes("sora") || lower.includes("dall"))
      return { color: "#10A37F", bgColor: "#D1FAE5", index: 9, name: "OpenAI" };
    if (lower.includes("google") || lower.includes("gemini") || lower.includes("veo") || lower.includes("imagen"))
      return { color: "#2563EB", bgColor: "#DBEAFE", index: 8, name: "Google" };
    if (lower.includes("meta") || lower.includes("llama"))
      return { color: "#1D4ED8", bgColor: "#EFF6FF", index: 7, name: "Meta" };
    if (lower.includes("xai") || lower.includes("x.ai") || lower.includes("grok"))
      return { color: "#111827", bgColor: "#F1F5F9", index: 6, name: "xAI" };
    if (lower.includes("mistral"))
      return { color: "#FF7000", bgColor: "#FFF7ED", index: 5, name: "Mistral" };
    if (lower.includes("deepseek"))
      return { color: "#0369A1", bgColor: "#E0F2FE", index: 5, name: "DeepSeek" };
    if (lower.includes("alibaba") || lower.includes("qwen") || lower.includes("wan"))
      return { color: "#EA580C", bgColor: "#FFEDD5", index: 4, name: "Alibaba" };
    if (lower.includes("microsoft"))
      return { color: "#0078D4", bgColor: "#E8F4FE", index: 4, name: "Microsoft" };
    if (lower.includes("amazon") || lower.includes("nova"))
      return { color: "#FF9900", bgColor: "#FFF8E1", index: 3, name: "Amazon" };
    if (lower.includes("nvidia") || lower.includes("nemotron"))
      return { color: "#76B900", bgColor: "#F1F8E9", index: 3, name: "NVIDIA" };
    if (lower.includes("cohere") || lower.includes("command"))
      return { color: "#6366f1", bgColor: "#EEF2FF", index: 3, name: "Cohere" };

    // ── Video 모델 ─────────────────────────────────────────────
    if (lower.includes("kuaishou") || lower.includes("kling"))
      return { color: "#F97316", bgColor: "#FFEDD5", index: 6, name: "Kuaishou" };
    if (lower.includes("tencent") || lower.includes("hunyuan"))
      return { color: "#0891B2", bgColor: "#CFFAFE", index: 5, name: "Tencent" };
    if (lower.includes("zhipu") || lower.includes("cogvideo"))
      return { color: "#4F46E5", bgColor: "#E0E7FF", index: 4, name: "Zhipu AI" };
    if (lower.includes("shengshu") || lower.includes("vidu"))
      return { color: "#DB2777", bgColor: "#FCE7F3", index: 3, name: "ShengShu" };
    if (lower.includes("runway") || lower.includes("gen-3"))
      return { color: "#E11D48", bgColor: "#FFE4E6", index: 2, name: "Runway" };
    if (lower.includes("luma"))
      return { color: "#0F172A", bgColor: "#F1F5F9", index: 1, name: "Luma" };
    if (lower.includes("hailuo") || lower.includes("minimax"))
      return { color: "#7C3AED", bgColor: "#EDE9FE", index: 0, name: "Hailuo" };
    if (lower.includes("stepfun") || lower.includes("stepvideo"))
      return { color: "#059669", bgColor: "#D1FAE5", index: 0, name: "StepFun" };
    if (lower.includes("wondershare") || lower.includes("tomoviee"))
      return { color: "#D946EF", bgColor: "#FAE8FF", index: 0, name: "Wondershare" };
    if (lower.includes("bytedance") || lower.includes("seedream") || lower.includes("seaweed"))
      return { color: "#fe2c55", bgColor: "#FFF1F3", index: 3, name: "ByteDance" };

    // ── Image 모델 ─────────────────────────────────────────────
    if (lower.includes("midjourney"))
      return { color: "#1e293b", bgColor: "#e2e8f0", index: 5, name: "Midjourney" };
    if (lower.includes("black forest") || lower.includes("flux"))
      return { color: "#166534", bgColor: "#dcfce7", index: 4, name: "Flux" };
    if (lower.includes("adobe"))
      return { color: "#dc2626", bgColor: "#fee2e2", index: 3, name: "Adobe" };
    if (lower.includes("stability") || lower.includes("stable diffusion"))
      return { color: "#6366f1", bgColor: "#EEF2FF", index: 2, name: "Stability AI" };

    return { color: "#94a3b8", bgColor: "#f1f5f9", index: -1, name: org || "Etc" };
  };

  const getScaleLimits = (categories: any) => {

    let min = Infinity, max = -Infinity;
    Object.values(categories || {}).forEach((obj: any) => obj.items?.forEach((i: any) => {
      const v = Number(i.elo || i.score); if (v > 100) { if (v < min) min = v; if (v > max) max = v; }
    }));
    if (min === Infinity) return { min: 800, max: 1300 };
    const padding = (max - min) * 0.1;
    return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
  };
  const voteScale = getScaleLimits(raw_data?.vote_rankings?.sub_categories);

  const DynamicOrgLegend = ({ items }: { items: any[] }) => {
    if (!items || items.length === 0) return null;
    const uniqueOrgs = Array.from(new Set(items.map((i: any) => i.org).filter(Boolean)));
    
    return (
      <div className="flex flex-wrap gap-3 mb-8 justify-center">
        {uniqueOrgs.map((org: any) => {
          const info = getOrgInfoGeneric(org);
          return (
            <div key={org} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-100 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }}></span>
              <span className="text-xs font-bold text-slate-600">{info.name}</span>
            </div>
          )
        })}
      </div>
    );
  };

  const ManufacturerRankingTable = ({ items }: any) => {
    // 🛠️ [Fix] 제조사 종합 순위: Score(평균 순위) 오름차순 정렬 (낮은 점수가 1등)
    const sortedItems = [...items]
        .sort((a, b) => Number(a.score) - Number(b.score))
        .slice(0, 5);

    return (
      <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden mb-16">
        <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-3xl bg-white p-2 rounded-xl shadow-sm">🏢</span> 제조사 종합 순위
          </h2>
          <p className="text-sm text-slate-500 mt-1 ml-14">Test(정량) + Vote(정성) 평균 순위 기준 (낮을수록 좋음)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFF8E1] border-b border-orange-100 text-slate-700">
                <th className="py-4 px-6 font-bold text-sm text-center w-20">순위</th>
                <th className="py-4 px-6 font-bold text-sm">제조사</th>
                <th className="py-4 px-6 font-bold text-sm text-blue-600">📊 Test (평균)</th>
                <th className="py-4 px-6 font-bold text-sm text-pink-600">👥 Vote (평균)</th>
                <th className="py-4 px-6 font-bold text-sm text-orange-600">🏆 종합 점수</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item: any, idx: number) => {
                let RankDisplay;
                if (idx === 0) RankDisplay = <span className="text-4xl drop-shadow-md">🥇</span>;
                else if (idx === 1) RankDisplay = <span className="text-4xl drop-shadow-md">🥈</span>;
                else if (idx === 2) RankDisplay = <span className="text-4xl drop-shadow-md">🥉</span>;
                else RankDisplay = <span className="text-xl font-black text-slate-400">{idx + 1}</span>;

                return (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-center">{RankDisplay}</td>
                    <td className="py-4 px-6 font-bold text-slate-700 text-lg">{item.org}</td>
                    <td className="py-4 px-6 font-bold text-blue-600">{item.test_rank ? `${Number(item.test_rank).toFixed(1)}위` : '-'}</td>
                    <td className="py-4 px-6 font-bold text-pink-600">{item.vote_rank ? `${Number(item.vote_rank).toFixed(1)}위` : '-'}</td>
                    <td className="py-4 px-6 font-black text-orange-600 text-xl">{item.score ? `${Number(item.score).toFixed(1)}` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const Top5Card = ({ item, idx }: any) => {
    const isFirst = idx === 0;
    const orgInfo = getOrgInfoGeneric(item.org);
    return (
      <div className={`flex flex-col h-[170px] rounded-2xl p-5 transition-all duration-300 ${isFirst ? 'bg-white shadow-xl ring-2 ring-indigo-500 scale-105 z-10' : 'bg-white shadow-md border border-slate-100 hover:-translate-y-1 hover:shadow-lg'}`}>
        <div className="flex justify-between items-start mb-3"><span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${isFirst ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>{isFirst && <span className="text-2xl animate-pulse">👑</span>}</div>
        <div className="flex-1 font-bold text-slate-800 leading-tight line-clamp-2 text-sm mb-2">{cleanModelName(item.model)}</div>
        <div className="flex justify-between items-end border-t border-slate-50 pt-2"><span className="text-[10px] font-bold px-2 py-1 rounded-md text-white truncate max-w-[80px] text-center" style={{backgroundColor: orgInfo.color}}>{orgInfo.name}</span><span className={`font-mono font-black text-xl ${isFirst ? 'text-indigo-600' : 'text-slate-400'}`}>{formatScore(item.elo || item.score)}</span></div>
      </div>
    );
  };

  const GenericChartCard = ({ title, items, comment, catKey, isVBench = false, theme = 'blue' }: any) => {
    if (!items || items.length === 0) return null;

    const fieldKey = isVBench ? `test_benchmarks.${catKey}` : `vote_rankings.${catKey}`;
    const isEditingThis = editingFields[fieldKey];
    
    const categoryInfo = CATEGORY_INFO[catKey] || { label: catKey, desc: "", icon: "📊" };
    const displayTitle = categoryInfo.label;
    const displayIcon = categoryInfo.icon;

    const chartData = useMemo(() => ({
      datasets: [{
        label: 'Models',
        data: items.slice(0, 10).map((item: any) => ({ 
          x: Number(item.elo || item.score) || 0, 
          y: getOrgInfoGeneric(item.org).index + (seededRandom(item.model) * 0.3), 
          org: item.org, 
          model: item.model 
        })).filter((d: any) => d.x > 0),
        backgroundColor: (ctx: any) => getOrgInfoGeneric(ctx.raw?.org).color, 
        borderColor: "#fff", 
        borderWidth: 2, 
        pointRadius: 7, 
        pointHoverRadius: 10,
        clip: false as any,
      }]
    }), [items]);

    const scaleOptions = isVBench 
      ? { min: 0, max: 100, grid: { color: '#f1f5f9' } }
      : { min: voteScale.min, max: voteScale.max, grid: { color: '#f1f5f9' } };

    const chartOptions: ChartOptions<'scatter'> = {
        maintainAspectRatio: false,
        interaction: {
            mode: 'nearest' as const,
            intersect: true,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: function(context: TooltipItem<'scatter'>) {
                        const raw = context.raw as any;
                        return [
                            `모델: ${cleanModelName(raw.model)}`,
                            `제조사: ${raw.org}`,
                            `점수: ${raw.x}`
                        ];
                    }
                }
            }
        },
        layout: {
            padding: { top: 16, bottom: 16, left: 8, right: 16 }
        },
        scales: { x: scaleOptions, y: { display: false, min: -2, max: 12 } }
    };

    // 🛠️ [Fix] 개별 카테고리: 점수(Score/Elo) 기준 내림차순 정렬 (높은 점수가 1등)
    const sortedItems = [...items].sort((a, b) => Number(b.score || b.elo) - Number(a.score || a.elo));

    const cardBgClass = theme === 'blue' ? 'bg-blue-100/40 border-blue-200' : 'bg-purple-100/40 border-purple-200';
    const listBgClass = theme === 'blue' ? 'bg-blue-200/40' : 'bg-purple-200/40';

    return (
      <div className={`rounded-[2rem] p-8 shadow-md border mb-6 transition-all hover:shadow-lg bg-white`}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
           <span className="text-3xl bg-slate-50 p-2 rounded-xl">{displayIcon}</span>
           <h4 className="text-xl font-bold text-slate-800">{displayTitle}</h4>
           
           <div className="relative group/tooltip">
             <QuestionIcon />
             <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
               {categoryInfo.desc || "설명이 없습니다."}
               <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-800 rotate-45"></div>
             </div>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 lg:max-w-[400px] flex flex-col gap-2">
              {sortedItems.slice(0, 5).map((item: any, idx: number) => {
                  const orgInfo = getOrgInfoGeneric(item.org);
                  return (
                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border border-transparent hover:bg-white hover:shadow-md transition-all group ${listBgClass}`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${idx === 0 ? 'bg-amber-400 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>{idx + 1}</span>
                            <div className="flex flex-col truncate">
                              <span className="font-bold text-slate-700 text-sm truncate group-hover:text-indigo-600 transition-colors">{cleanModelName(item.model)}</span>
                              <span className="text-[10px] font-bold mt-0.5" style={{color: orgInfo.color}}>{orgInfo.name}</span>
                            </div>
                        </div>
                        <span className="font-mono font-bold text-slate-800 text-lg">{formatScore(item.elo || item.score)}</span>
                    </div>
                  );
              })}
          </div>

          <div className="flex-1 h-[320px] bg-slate-50 rounded-2xl border border-slate-100 p-6 relative">
              <div className="absolute top-4 left-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Score Distribution</div>
              <div className="absolute top-4 right-6 text-xs font-bold text-slate-400">HIGH SCORE ➔</div>
              <div className="h-full mt-2">
                <Scatter data={chartData} options={chartOptions} />
              </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-50 rounded-xl p-5 flex items-start gap-3 border border-slate-100">
            <span className="text-xl mt-0.5">💡</span>
            {isEditingThis ? (
                <div className="flex-1 flex gap-2">
                    <input className="flex-1 bg-white border border-indigo-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" value={tempValues[fieldKey] ?? comment} onChange={(e) => updateTempValue(fieldKey, e.target.value)} autoFocus />
                    <button onClick={() => isVBench ? confirmVBenchCommentEdit(catKey) : confirmCommentEdit('vote_rankings', catKey)} className="p-2 bg-indigo-500 text-white rounded-lg"><CheckIcon /></button>
                </div>
            ) : (
                <div className="flex-1 flex justify-between items-center">
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">{comment || "AI가 분석한 코멘트가 없습니다."}</p>
                    {isEditable && <button onClick={() => startEditing(fieldKey, comment)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><PencilIcon /></button>}
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto bg-white min-h-screen pb-20">
      <header className="py-16 text-center border-b border-slate-100 bg-slate-50/50"><h1 className="text-4xl font-black text-slate-900 mb-2">{reportTitle}</h1></header>
      <div className="max-w-5xl mx-auto px-6 -mt-8">
        
        {/* 🌟 1. 종합 순위 (Overall) — LLM·Image 공용, Video/Code는 자체 섹션 사용 */}
        {voteOverall.length > 0 && !isVideo && !isCode && (
            <section className="mb-16 bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 rounded-[2.5rem] p-10 border border-indigo-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
                <div className="flex items-center gap-3 mb-8 relative z-10">
                    <span className="text-3xl bg-white p-2 rounded-xl shadow-sm">🏆</span>
                    <h2 className="text-3xl font-black text-slate-800">종합 순위 (Overall)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
                    {voteOverall.slice(0, 5).map((item: any, idx: number) => (<Top5Card key={idx} item={item} idx={idx} />))}
                </div>
              </section>
        )}


        {/* 🌟 2. Image 리포트 레이아웃 */}
        {isImage && (() => {
          const t2iOverall = raw_data?.vote_rankings?.sub_categories?.text_to_image?.items || [];
          const speedItems = raw_data?.test_benchmarks?.sub_categories?.speed?.items || [];
          const priceItems = raw_data?.test_benchmarks?.sub_categories?.price?.items || [];
          const speedComment = raw_data?.test_benchmarks?.sub_categories?.speed?.comment || '';
          const priceComment = raw_data?.test_benchmarks?.sub_categories?.price?.comment || '';
          const hasAA = speedItems.length > 0 || priceItems.length > 0;
          const hasT2iSubs = T2I_KEYS.some(k => (raw_data?.vote_rankings?.sub_categories?.[k]?.items?.length || 0) > 0);
          const hasIeSubs  = IE_KEYS.some(k => (raw_data?.vote_rankings?.sub_categories?.[k]?.items?.length || 0) > 0);

          return (
            <div className="animate-fade-in-up">

              {/* ── 섹션 B: LMArena 사용자 선호도 ── */}
              <div className="mb-16 bg-blue-100/40 rounded-[3rem] p-10 border border-blue-200">
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">🗳️</span>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800">사용자 선호도 (LMArena)</h2>
                    <p className="text-slate-500 text-sm mt-1">실제 사용자 블라인드 테스트 기반 Elo 랭킹 · {new Date().toLocaleDateString('ko-KR')} 기준</p>
                  </div>
                </div>

                {/* T2I Top 5 */}
                {t2iOverall.length > 0 && (
                  <div className="mb-10">
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">🏆 Text-to-Image 종합 Top 5</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {t2iOverall.slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} />))}
                    </div>
                  </div>
                )}

                <div className="my-8 w-full border-t border-blue-300/50" />
                <DynamicOrgLegend items={t2iOverall} />

                {/* T2I 카테고리 탭 */}
                {hasT2iSubs && (
                  <div className="mb-12">
                    <p className="text-sm font-bold text-slate-500 mb-4">📝 카테고리별 상세 분석</p>
                    <div className="flex gap-2 flex-wrap mb-6">
                      {T2I_KEYS.map((key, idx) => {
                        const info = CATEGORY_INFO[key as keyof typeof CATEGORY_INFO];
                        return (
                          <button key={key} onClick={() => setT2iIndex(idx)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                              idx === t2iIndex
                                ? 'bg-blue-600 text-white shadow-md scale-105'
                                : 'bg-white text-slate-600 hover:bg-blue-50 border border-slate-200'
                            }`}>
                            <span>{info?.icon}</span>{info?.label}
                          </button>
                        );
                      })}
                    </div>
                    <GenericChartCard
                      items={raw_data?.vote_rankings?.sub_categories?.[T2I_KEYS[t2iIndex]]?.items}
                      comment={raw_data?.vote_rankings?.sub_categories?.[T2I_KEYS[t2iIndex]]?.comment}
                      catKey={T2I_KEYS[t2iIndex]}
                      isVBench={false}
                      theme="blue"
                    />
                  </div>
                )}

                {/* Image Edit 서브셉션 */}
                {hasIeSubs && (
                  <>
                    <div className="my-8 w-full border-t border-blue-300/50" />
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl">✏️</span>
                      <h3 className="text-xl font-black text-slate-700">Image Edit Arena</h3>
                    </div>
                    <DynamicOrgLegend items={raw_data?.vote_rankings?.sub_categories?.image_edit_single?.items || []} />
                    <div className="flex gap-2 flex-wrap mb-6">
                      {IE_KEYS.map((key, idx) => {
                        const info = CATEGORY_INFO[key as keyof typeof CATEGORY_INFO];
                        return (
                          <button key={key} onClick={() => setIeIndex(idx)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                              idx === ieIndex
                                ? 'bg-blue-600 text-white shadow-md scale-105'
                                : 'bg-white text-slate-600 hover:bg-blue-50 border border-slate-200'
                            }`}>
                            <span>{info?.icon}</span>{info?.label}
                          </button>
                        );
                      })}
                    </div>
                    <GenericChartCard
                      items={raw_data?.vote_rankings?.sub_categories?.[IE_KEYS[ieIndex]]?.items}
                      comment={raw_data?.vote_rankings?.sub_categories?.[IE_KEYS[ieIndex]]?.comment}
                      catKey={IE_KEYS[ieIndex]}
                      isVBench={false}
                      theme="blue"
                    />
                  </>
                )}
              </div>

              {/* ── 섹션 C: Artificial Analysis 속도·가격 ── */}
              {hasAA && (
                <div className="mb-16 bg-emerald-100/40 rounded-[3rem] p-10 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">⚡</span>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800">속도 · 가격 (Artificial Analysis)</h2>
                      <p className="text-slate-500 text-sm mt-1">실측 생성 속도 및 API 가격 비교</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Speed */}
                    {speedItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">🚀 생성 속도 Top 5 <span className="text-xs font-normal text-slate-400">(초/이미지, 낮을수록 빠름)</span></h3>
                        <div className="space-y-2.5">
                          {[...speedItems].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 5).map((item: any, idx: number) => {
                            const orgInfo = getOrgInfoGeneric(item.org);
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{idx + 1}</span>
                                  <div className="overflow-hidden">
                                    <p className="font-bold text-slate-700 text-sm truncate">{cleanModelName(item.model)}</p>
                                    <p className="text-[10px] font-bold" style={{ color: orgInfo.color }}>{orgInfo.name}</p>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-emerald-700 text-sm flex-shrink-0">{Number(item.score).toFixed(1)}s</span>
                              </div>
                            );
                          })}
                        </div>
                        {speedComment && <p className="mt-4 text-xs text-slate-500 bg-emerald-50 rounded-xl p-3 border border-emerald-100">💡 {speedComment}</p>}
                      </div>
                    )}
                    {/* Price */}
                    {priceItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                        <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2">💰 가격 Top 5 <span className="text-xs font-normal text-slate-400">($/1,000장, 낮을수록 저렴)</span></h3>
                        <div className="space-y-2.5">
                          {[...priceItems].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 5).map((item: any, idx: number) => {
                            const orgInfo = getOrgInfoGeneric(item.org);
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{idx + 1}</span>
                                  <div className="overflow-hidden">
                                    <p className="font-bold text-slate-700 text-sm truncate">{cleanModelName(item.model)}</p>
                                    <p className="text-[10px] font-bold" style={{ color: orgInfo.color }}>{orgInfo.name}</p>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-emerald-700 text-sm flex-shrink-0">${Number(item.score).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                        {priceComment && <p className="mt-4 text-xs text-slate-500 bg-emerald-50 rounded-xl p-3 border border-emerald-100">💡 {priceComment}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* 🌟 3. Video 리포트 레이아웃 */}
        {isVideo && (
          <div className="animate-fade-in-up">
            
            {/* 3-1. 정량 벤치마크 - VBench 2.0 */}
            <div className="mb-16 bg-blue-100/40 rounded-[3rem] p-10 border border-blue-200">
                
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">📊</span>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">정량 벤치마크 - VBench 2.0</h2>
                        <p className="text-slate-500 text-sm mt-1">객관적인 성능 평가 지표 (Total Score & 8대 핵심 분석)</p>
                    </div>
                </div>

                {/* Total Score Cards */}
                {testTotal.length > 0 && (
                    <div className="mb-10">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">🏆 Total Score Ranking</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                            {testTotal.slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} />))}
                        </div>
                    </div>
                )}

                {/* 🛠️ 구분선 */}
                <div className="my-8 w-full border-t border-blue-300/50"></div>

                {/* 🛠️ [동적 범례] VBench 데이터 기반 */}
                <DynamicOrgLegend items={testTotal} />

                {/* 8대 핵심 분석 탭 */}
                {Object.keys(testSubCategories).length > 0 && (
                  <div>
                    <div className="flex gap-2 flex-wrap mb-6">
                      {VBENC_KEYS.map((key, idx) => {
                        const info = CATEGORY_INFO[key as keyof typeof CATEGORY_INFO];
                        return (
                          <button key={key} onClick={() => setVbenchIndex(idx)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                              idx === vbenchIndex
                                ? 'bg-blue-600 text-white shadow-md scale-105'
                                : 'bg-white text-slate-600 hover:bg-blue-50 border border-slate-200'
                            }`}>
                            <span>{info?.icon}</span>{info?.label}
                          </button>
                        );
                      })}
                    </div>
                    <GenericChartCard
                      items={testSubCategories[VBENC_KEYS[vbenchIndex]]?.items}
                      comment={testSubCategories[VBENC_KEYS[vbenchIndex]]?.comment}
                      catKey={VBENC_KEYS[vbenchIndex]}
                      isVBench={true}
                      theme="blue"
                    />
                  </div>
                )}
            </div>
            
            {/* 3-2. 사용자 선호도 (LMSYS) 섹션 */}
            <div className="mb-16 bg-purple-100/40 rounded-[3rem] p-10 border border-purple-200">
                
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">🗳️</span>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">사용자 선호도 (LMSYS)</h2>
                        <p className="text-slate-500 text-sm mt-1">실제 사용자 블라인드 테스트 기반 랭킹</p>
                    </div>
                </div>

                {/* LMSYS 종합 순위 (대표: Text-to-Video Top 5) */}
                {lmsysRepresentative.length > 0 && (
                    <div className="mb-10">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">🏆 Text-to-Video Ranking (Representative)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {lmsysRepresentative.slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} />))}
                        </div>
                    </div>
                )}

                {/* 🛠️ 구분선 */}
                <div className="my-8 w-full border-t border-purple-300/50"></div>

                {/* 🛠️ [동적 범례] LMSYS 데이터 기반 */}
                <DynamicOrgLegend items={lmsysRepresentative} />

                {/* LMSYS 상세 분석 탭 */}
                <div>
                  <div className="flex gap-2 flex-wrap mb-6">
                    {LMSYS_KEYS.map((key, idx) => {
                      const info = CATEGORY_INFO[key as keyof typeof CATEGORY_INFO];
                      return (
                        <button key={key} onClick={() => setLmsysIndex(idx)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                            idx === lmsysIndex
                              ? 'bg-purple-600 text-white shadow-md scale-105'
                              : 'bg-white text-slate-600 hover:bg-purple-50 border border-slate-200'
                          }`}>
                          <span>{info?.icon}</span>{info?.label}
                        </button>
                      );
                    })}
                  </div>
                  <GenericChartCard
                    items={raw_data?.vote_rankings?.sub_categories?.[LMSYS_KEYS[lmsysIndex]]?.items}
                    comment={raw_data?.vote_rankings?.sub_categories?.[LMSYS_KEYS[lmsysIndex]]?.comment}
                    catKey={LMSYS_KEYS[lmsysIndex]}
                    isVBench={false}
                    theme="purple"
                  />
                </div>
            </div>

            {/* 3-3. Artificial Analysis 속도·가격 (데이터 있을 때만) */}
            {(() => {
              const spd = raw_data?.test_benchmarks?.aa_speed;
              const prc = raw_data?.test_benchmarks?.aa_price;
              const spdItems = spd?.items || [];
              const prcItems = prc?.items || [];
              if (spdItems.length === 0 && prcItems.length === 0) return null;
              return (
                <div className="mb-16 bg-emerald-100/40 rounded-[3rem] p-10 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">⚡</span>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800">속도 · 가격 (Artificial Analysis)</h2>
                      <p className="text-slate-500 text-sm mt-1">실측 생성 속도 및 API 가격 비교</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {spdItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                        <h3 className="font-black text-lg text-slate-800 mb-4">🚀 생성 속도 Top 5 <span className="text-xs font-normal text-slate-400">(초/영상, 낮을수록 빠름)</span></h3>
                        <div className="space-y-2.5">
                          {[...spdItems].sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,5).map((item:any, idx:number) => {
                            const o = getOrgInfoGeneric(item.org);
                            return (<div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100"><div className="flex items-center gap-3 overflow-hidden"><span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${idx===0?'bg-amber-400 text-white':'bg-white text-slate-400 border border-slate-200'}`}>{idx+1}</span><div className="overflow-hidden"><p className="font-bold text-slate-700 text-sm truncate">{cleanModelName(item.model)}</p><p className="text-[10px] font-bold" style={{color:o.color}}>{o.name}</p></div></div><span className="font-mono font-bold text-emerald-700 text-sm">{Number(item.score).toFixed(1)}s</span></div>);
                          })}
                        </div>
                        {spd?.comment && <p className="mt-4 text-xs text-slate-500 bg-emerald-50 rounded-xl p-3">💡 {spd.comment}</p>}
                      </div>
                    )}
                    {prcItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                        <h3 className="font-black text-lg text-slate-800 mb-4">💰 가격 Top 5 <span className="text-xs font-normal text-slate-400">(낮을수록 저렴)</span></h3>
                        <div className="space-y-2.5">
                          {[...prcItems].sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,5).map((item:any, idx:number) => {
                            const o = getOrgInfoGeneric(item.org);
                            return (<div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100"><div className="flex items-center gap-3 overflow-hidden"><span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${idx===0?'bg-amber-400 text-white':'bg-white text-slate-400 border border-slate-200'}`}>{idx+1}</span><div className="overflow-hidden"><p className="font-bold text-slate-700 text-sm truncate">{cleanModelName(item.model)}</p><p className="text-[10px] font-bold" style={{color:o.color}}>{o.name}</p></div></div><span className="font-mono font-bold text-emerald-700 text-sm">${Number(item.score).toFixed(2)}</span></div>);
                          })}
                        </div>
                        {prc?.comment && <p className="mt-4 text-xs text-slate-500 bg-emerald-50 rounded-xl p-3">💡 {prc.comment}</p>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* 🌟 4. Service 리포트 레이아웃 */}
        {isService && (() => {
          const overall: any[] = raw_data?.overall || [];
          const categories = raw_data?.categories || {};
          const maxVisits = Math.max(...overall.map((s: any) => s.monthly_visits || 0), 1);
          return (
            <div className="animate-fade-in-up space-y-12">

              {/* 종합 트래픽 순위 */}
              <div className="bg-amber-100/40 rounded-[3rem] p-10 border border-amber-200">
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">🌐</span>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800">AI 서비스 월간 트래픽 종합 순위</h2>
                    <p className="text-slate-500 text-sm mt-1">SimilarWeb 기반 월간 방문자 수</p>
                  </div>
                </div>

                {/* Top 5 하이라이트 카드 */}
                {overall.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
                    {overall.slice(0, 5).map((s: any, idx: number) => (
                      <div key={idx} className={`rounded-2xl p-5 border text-center flex flex-col items-center gap-2 ${
                        idx === 0 ? 'bg-amber-400 border-amber-500 text-white' :
                        idx === 1 ? 'bg-amber-100 border-amber-300 text-amber-900' :
                        idx === 2 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        'bg-white border-slate-200 text-slate-700'
                      }`}>
                        <span className={`text-2xl font-black ${idx === 0 ? 'text-white' : 'text-amber-500'}`}>#{s.rank}</span>
                        <span className="font-black text-base leading-tight">{s.service}</span>
                        <span className="text-xs font-bold opacity-70">{s.org}</span>
                        <span className="font-mono font-bold text-lg">{formatVisits(s.monthly_visits)}</span>
                        {s.growth && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          s.growth.startsWith('+') || s.growth.startsWith('＋') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>{s.growth}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 전체 리스트 (막대 차트) */}
                <div className="space-y-3">
                  {overall.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="w-7 text-center font-black text-slate-400 text-sm flex-shrink-0">{s.rank}</span>
                      <div className="w-28 flex-shrink-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{s.service}</p>
                        <p className="text-[11px] font-bold" style={{color: getSvcOrgColor(s.org)}}>{s.org}</p>
                      </div>
                      <div className="flex-1 h-7 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-end pr-2 transition-all"
                          style={{width: `${((s.monthly_visits || 0) / maxVisits) * 100}%`}}>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-700 text-sm w-16 text-right flex-shrink-0">{formatVisits(s.monthly_visits)}</span>
                      {s.growth && <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-14 text-center flex-shrink-0 ${
                        s.growth.startsWith('+') || s.growth.startsWith('＋') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>{s.growth}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 카테고리별 탭 */}
              <div className="bg-white rounded-[3rem] p-10 border border-slate-200">
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-4xl bg-amber-50 shadow-sm p-3 rounded-2xl">📂</span>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800">카테고리별 서비스 순위</h2>
                    <p className="text-slate-500 text-sm mt-1">분야별 AI 서비스 트래픽 비교</p>
                  </div>
                </div>

                {/* 탭 버튼 */}
                <div className="flex gap-2 flex-wrap mb-8">
                  {SVC_CATS.map(cat => {
                    const items = categories[cat.key]?.items || [];
                    if (items.length === 0) return null;
                    return (
                      <button key={cat.key} onClick={() => setSvcCatTab(cat.key as any)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                          svcCatTab === cat.key
                            ? 'bg-amber-500 text-white shadow-md scale-105'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}>
                        <span>{cat.icon}</span>{cat.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          svcCatTab === cat.key ? 'bg-white/30 text-white' : 'bg-amber-200 text-amber-700'
                        }`}>{items.length}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 탭 콘텐츠 */}
                {SVC_CATS.map(cat => {
                  if (svcCatTab !== cat.key) return null;
                  const items: any[] = categories[cat.key]?.items || [];
                  const comment: string = categories[cat.key]?.comment || '';
                  const catMax = Math.max(...items.map((s: any) => s.monthly_visits || 0), 1);
                  return (
                    <div key={cat.key}>
                      <div className="space-y-3">
                        {items.map((s: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-amber-50 transition-colors">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black flex-shrink-0 ${
                              idx === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>{s.rank || idx + 1}</span>
                            <div className="w-32 flex-shrink-0">
                              <p className="font-bold text-slate-800 text-sm">{s.service}</p>
                              <p className="text-[11px] font-bold" style={{color: getSvcOrgColor(s.org)}}>{s.org}</p>
                            </div>
                            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-400"
                                style={{width: `${((s.monthly_visits || 0) / catMax) * 100}%`}} />
                            </div>
                            <span className="font-mono font-bold text-slate-700 text-sm w-14 text-right flex-shrink-0">{formatVisits(s.monthly_visits)}</span>
                            {s.growth && <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-12 text-center flex-shrink-0 ${
                              s.growth.startsWith('+') || s.growth.startsWith('＋') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>{s.growth}</span>}
                          </div>
                        ))}
                      </div>
                      {comment && <p className="mt-6 text-sm text-slate-500 bg-amber-50 rounded-2xl p-4 border border-amber-100">💡 {comment}</p>}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })()}

        {/* 🌟 CODE 리포트 레이아웃 */}
        {isCode && (() => {
          const codeTestSubs = raw_data?.test_benchmarks?.sub_categories || {};
          const codeVoteSubs = raw_data?.vote_rankings?.sub_categories || {};
          const activeTestKeys = CODE_TEST_KEYS.filter(k => (codeTestSubs[k]?.items?.length || 0) > 0);
          const activeLmsysKeys = CODE_LMSYS_KEYS.filter(k => (codeVoteSubs[k]?.items?.length || 0) > 0);

          // 제조사 종합 순위 계산 (정량 + 정성 평균 순위)
          const codeOrgRanking = (() => {
            const orgMap: Record<string, { test_sum: number; test_cnt: number; vote_sum: number; vote_cnt: number }> = {};
            testTotal.forEach((m: any, i: number) => {
              if (!m.org) return;
              if (!orgMap[m.org]) orgMap[m.org] = { test_sum: 0, test_cnt: 0, vote_sum: 0, vote_cnt: 0 };
              orgMap[m.org].test_sum += i + 1; orgMap[m.org].test_cnt += 1;
            });
            voteOverall.forEach((m: any, i: number) => {
              if (!m.org) return;
              if (!orgMap[m.org]) orgMap[m.org] = { test_sum: 0, test_cnt: 0, vote_sum: 0, vote_cnt: 0 };
              orgMap[m.org].vote_sum += i + 1; orgMap[m.org].vote_cnt += 1;
            });
            return Object.entries(orgMap).map(([org, v]) => {
              const test_rank = v.test_cnt > 0 ? v.test_sum / v.test_cnt : null;
              const vote_rank = v.vote_cnt > 0 ? v.vote_sum / v.vote_cnt : null;
              const parts = [test_rank, vote_rank].filter(x => x !== null) as number[];
              const score = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 999;
              return { org, test_rank, vote_rank, score };
            }).sort((a, b) => a.score - b.score);
          })();

          return (
            <div className="animate-fade-in-up space-y-12">

              {/* 제조사 종합 순위 */}
              {codeOrgRanking.length > 0 && <ManufacturerRankingTable items={codeOrgRanking} />}

              {/* 정량 벤치마크 */}
              {testTotal.length > 0 && (
                <div className="mb-16 bg-cyan-100/40 rounded-[3rem] p-10 border border-cyan-200">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">🐛</span>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800">정량 벤치마크 종합 순위</h2>
                      <p className="text-slate-500 text-sm mt-1">
                        {(codeTestSubs.aider?.items?.length || 0) > 0
                          ? 'SWE-bench + Aider 평균 점수 기준'
                          : 'SWE-bench Verified — 실제 GitHub 이슈 해결률 (%)'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
                    {testTotal.slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} />))}
                  </div>
                  <div className="my-8 w-full border-t border-cyan-300/50" />
                  <DynamicOrgLegend items={testTotal} />
                  {activeTestKeys.length > 0 && (
                    <>
                      <div className="flex gap-2 flex-wrap mb-6">
                        {activeTestKeys.map((key, idx) => (
                          <button key={key} onClick={() => setCodeTestIndex(idx)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                              idx === codeTestIndex ? 'bg-cyan-600 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-cyan-50 border border-slate-200'
                            }`}>
                            {CODE_TEST_LABEL[key]?.icon} {CODE_TEST_LABEL[key]?.label || key}
                          </button>
                        ))}
                      </div>
                      <GenericChartCard
                        items={codeTestSubs[activeTestKeys[codeTestIndex]]?.items}
                        comment={codeTestSubs[activeTestKeys[codeTestIndex]]?.comment}
                        catKey={activeTestKeys[codeTestIndex]}
                        isVBench={true}
                        theme="cyan"
                      />
                    </>
                  )}
                </div>
              )}

              {/* LMArena Code Arena 정성 평가 */}
              {activeLmsysKeys.length > 0 && (
                <div className="mb-16 bg-purple-100/40 rounded-[3rem] p-10 border border-purple-200">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-4xl bg-white shadow-sm p-3 rounded-2xl">⚔️</span>
                    <div>
                      <h2 className="text-3xl font-black text-slate-800">사용자 선호도 평가 — LMArena Code Arena</h2>
                      <p className="text-slate-500 text-sm mt-1">에이전틱 코딩 태스크 대상 다수위 투표 (Elo)</p>
                    </div>
                  </div>
                  {(codeVoteSubs.webdev_overall?.items || []).length > 0 && (
                    <div className="mb-10">
                      <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">🏆 WebDev Overall Top 5</h3>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                        {(codeVoteSubs.webdev_overall?.items || []).slice(0, 5).map((t: any, idx: number) => (<Top5Card key={idx} item={t} idx={idx} />))}
                      </div>
                    </div>
                  )}
                  <div className="my-8 w-full border-t border-purple-300/50" />
                  <DynamicOrgLegend items={codeVoteSubs.webdev_overall?.items || []} />
                  <div className="flex gap-2 flex-wrap mb-6">
                    {activeLmsysKeys.map((key, idx) => (
                      <button key={key} onClick={() => setCodeLmsysIndex(idx)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                          idx === codeLmsysIndex ? 'bg-purple-600 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-purple-50 border border-slate-200'
                        }`}>
                        {CODE_LMSYS_LABEL[key]?.icon} {CODE_LMSYS_LABEL[key]?.label || key}
                      </button>
                    ))}
                  </div>
                  <GenericChartCard
                    items={codeVoteSubs[activeLmsysKeys[codeLmsysIndex]]?.items}
                    comment={codeVoteSubs[activeLmsysKeys[codeLmsysIndex]]?.comment}
                    catKey={activeLmsysKeys[codeLmsysIndex]}
                    isVBench={false}
                    theme="purple"
                  />
                </div>
              )}

            </div>
          );
        })()}

        {/* 🌟 총평 (Summary) */}
        <section className="bg-white rounded-[2.5rem] p-10 shadow-lg border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white opacity-50 pointer-events-none"></div>
          <div className="relative z-10">
            <h3 className="font-black text-3xl mb-8 flex items-center gap-3 text-slate-800">
              <span className="text-4xl">📝</span> 핵심 요약
              {isEditable && <span className="text-sm font-normal text-indigo-500 ml-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">(클릭하여 수정 가능)</span>}
            </h3>
            <div className="space-y-4">
              {(summary_insights || []).map((text: string, idx: number) => {
                const fieldKey = `summary.${idx}`; 
                const isEditingThis = editingFields[fieldKey]; 
                const icons = ["✔️", "✔️", "✔️", "✔️", "✔️"];
                return (
                  <div key={idx} className={`rounded-2xl p-5 border transition-all duration-200 ${isEditingThis ? 'bg-white border-indigo-300 ring-4 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md'}`}>
                    {isEditingThis ? (
                      <div className="flex items-start gap-4">
                        <span className="text-2xl mt-1">{icons[idx] || "📌"}</span>
                        <div className="flex-1 flex flex-col gap-3">
                          <textarea 
                            value={tempValues[fieldKey] ?? text} 
                            onChange={(e) => updateTempValue(fieldKey, e.target.value)} 
                            autoFocus 
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none text-base leading-relaxed" 
                            rows={3} 
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => confirmSummaryEdit(idx)} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold"><CheckIcon /> 저장</button>
                            <button onClick={() => cancelEditing(fieldKey)} className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-bold"><XIcon /> 취소</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4 group cursor-pointer" onClick={isEditable ? () => startEditing(fieldKey, text) : undefined}>
                        <span className="text-2xl mt-0.5">{icons[idx] || "📌"}</span>
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
          </div>
        </section>
      </div>
      {isEditable && onSave && (<div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-white/90 backdrop-blur shadow-2xl p-4 rounded-2xl border border-slate-200 z-50"><button onClick={handleSaveClick} disabled={isSaving} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">{isSaving ? '저장 중...' : '🚀 리포트 발행'}</button><button onClick={onReanalyze} disabled={isSaving} className="px-8 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors">다시 분석</button></div>)}
    </div>
  );
}