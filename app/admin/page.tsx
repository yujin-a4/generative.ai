"use client";

import { useState, useEffect } from "react";
import { analyzeReports, saveReportToDB } from "@/app/actions/analyze";
import ReportView from "./ReportView";

interface ReportInputItem {
  id: number;
  siteName: string;
  content: string;
}

const REPORT_TYPES = [
  { id: "LLM", label: "🤖 LLM 순위", desc: "텍스트/대화 모델 종합" },
  { id: "Image", label: "🎨 이미지 AI", desc: "생성 및 편집 능력 (LMSYS)" }, // 설명 변경
  { id: "Video", label: "🎬 영상 AI", desc: "영상품질/일관성" },
  { id: "Coding", label: "💻 코딩/개발", desc: "코드생성/편집/디버깅" },
  { id: "Agent", label: "⚡ 에이전트", desc: "자율 수행/비서 능력" },
  { id: "Service", label: "🏆 서비스 랭킹", desc: "인기/만족도/트래픽" },
];

// 🌟 [수정됨] 이미지 소스를 LMSYS 2개로 단순화
const REPORT_CONFIG: Record<string, { 
  label: string; 
  desc: string;
  sources: { name: string; url: string; guide: string }[] 
}> = {
  LLM: {
    label: "🤖 LLM 순위 데이터 입력",
    desc: "정확한 분석을 위해 아래 6가지 데이터를 모두 입력해주세요.",
    sources: [
      { name: "Artificial Analysis (Main)", url: "https://artificialanalysis.ai/leaderboards/models", guide: "페이지 전체 복사" },
      { name: "LMSYS (Overall)", url: "https://lmarena.ai/leaderboard", guide: "Category: 'Overall' 선택 후 전체 복사" },
      { name: "LMSYS (Korean)", url: "https://lmarena.ai/leaderboard", guide: "Language: 'Korean' 선택 후 전체 복사" },
      { name: "LMSYS (Creative Writing)", url: "https://lmarena.ai/leaderboard", guide: "Category: 'Creative Writing' 선택 후 전체 복사" },
      { name: "LMSYS (Instruction Following)", url: "https://lmarena.ai/leaderboard", guide: "Category: 'Instruction Following' 선택 후 전체 복사" },
      { name: "LMSYS (Hard Prompts)", url: "https://lmarena.ai/leaderboard", guide: "Category: 'Hard Prompts' 선택 후 전체 복사" }
    ]
  },
  Image: {
    label: "🎨 이미지 AI 데이터 입력",
    desc: "LMSYS의 생성 및 편집 순위를 입력해주세요.",
    sources: [
      { 
        name: "LMSYS - Text to Image", 
        url: "https://lmarena.ai/leaderboard/text-to-image", 
        guide: "Text-to-Image Leaderboard 전체 복사 (기본 생성 능력)" 
      },
      { 
        name: "LMSYS - Image Editing", 
        url: "https://lmarena.ai/leaderboard/image-editing", 
        guide: "Image Editing Leaderboard 전체 복사 (편집 능력)" 
      }
    ]
  },
  Service: {
    label: "🏆 서비스 랭킹",
    desc: "인기/만족도/트래픽 평가",
    sources: [
      { name: "a16z Top 100 Apps", url: "https://a16z.com/100-gen-ai-apps/", guide: "Top 100 리스트 텍스트 복사" },
      { name: "G2 AI Chatbots", url: "https://www.g2.com/categories/ai-chatbots", guide: "카테고리 리스트 및 리뷰 요약 복사" }
    ]
  },
  Coding: {
    label: "💻 코딩/개발 (전용)",
    desc: "전문 코딩 툴 평가",
    sources: [
      { name: "Aider Leaderboard", url: "https://aider.chat/docs/leaderboards/", guide: "Leaderboard 표 전체 복사" },
      { name: "LiveCodeBench", url: "https://livecodebench.github.io/leaderboard.html", guide: "Leaderboard 표 전체 복사" }
    ]
  },
  Agent: {
    label: "⚡ 에이전트 (전용)",
    desc: "전문 에이전트 평가",
    sources: [
      { name: "GAIA Benchmark", url: "https://huggingface.co/spaces/gaia-benchmark/leaderboard", guide: "Leaderboard 탭 전체 복사" }
    ]
  },
  Video: {
    label: "🎬 영상 AI",
    desc: "영상품질/일관성 평가",
    sources: [
      { name: "VBench", url: "https://vbench.github.io/", guide: "Leaderboard 표 영역 복사" }
    ]
  }
};

export default function AdminPage() {
  const [selectedType, setSelectedType] = useState("LLM");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputs({});
    setAnalysisResult(null);
  }, [selectedType]);

  const handleInputChange = (sourceName: string, value: string) => {
    setInputs(prev => ({ ...prev, [sourceName]: value }));
  };

  const handleAnalyze = async () => {
    const currentConfig = REPORT_CONFIG[selectedType];
    const missingSources = currentConfig.sources.filter(src => !inputs[src.name]?.trim());
    
    if (missingSources.length > 0) {
      alert(`다음 데이터를 입력해야 합니다:\n${missingSources.map(s => s.name).join(", ")}`);
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const reportData = currentConfig.sources.map(src => ({
        siteName: src.name,
        content: inputs[src.name]
      }));

      const result = await analyzeReports(reportData, selectedType);

      if (result.success && result.data) {
        setAnalysisResult(result.data.analysisResult);
      } else {
        alert(`분석 실패: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("분석 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!analysisResult) return;
    setSaving(true);
    try {
      const result = await saveReportToDB(
        analysisResult.report_title || `${selectedType} 종합 리포트`,
        analysisResult
      );
      if (result.success) {
        alert("✅ 리포트가 성공적으로 발행(저장)되었습니다!");
        setAnalysisResult(null);
        setInputs({});
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const currentConfig = REPORT_CONFIG[selectedType];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">데이터를 입력하고 AI 리포트를 생성하세요.</p>
        </div>

        {!analysisResult ? (
          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
              {Object.keys(REPORT_CONFIG).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all min-w-[120px]
                    ${selectedType === type 
                      ? "bg-indigo-600 text-white shadow-md" 
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                >
                  {REPORT_CONFIG[type].label}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{currentConfig.label}</h3>
                <p className="text-zinc-500 dark:text-zinc-400">{currentConfig.desc}</p>
              </div>
              
              <div className="space-y-10">
                {currentConfig.sources.map((source, index) => (
                  <div key={source.name} className="relative">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-base font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 w-6 h-6 flex items-center justify-center rounded-full text-xs">{index + 1}</span>
                        {source.name}
                      </label>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-zinc-400 hover:text-indigo-600 flex items-center gap-1 transition-colors bg-zinc-50 dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                        🔗 사이트 열기 ↗
                      </a>
                    </div>
                    <div className="relative group">
                      <textarea
                        value={inputs[source.name] || ""}
                        onChange={(e) => handleInputChange(source.name, e.target.value)}
                        placeholder={source.guide}
                        rows={6}
                        className="w-full p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-black focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm transition-all resize-y"
                      />
                      {inputs[source.name]?.length > 50 && (
                        <div className="absolute top-4 right-4 text-green-500 animate-in fade-in zoom-in bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm">✅</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gemini가 분석 중입니다...
                    </span>
                  ) : (
                    `✨ ${selectedType} 리포트 생성하기`
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <ReportView
              data={analysisResult}
              onSave={handleSave}
              onReanalyze={() => setAnalysisResult(null)}
              isSaving={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}