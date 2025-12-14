"use client";

import { useState, useEffect } from "react";
import { analyzeReports, saveReportToDB } from "@/app/actions/analyze";
import ReportView from "./ReportView";

// 🌟 [수정] Image는 정량 제거 (LMSYS만), Video는 VBench 유지
const REPORT_CONFIG: Record<string, { 
  label: string; 
  desc: string;
  sources: { id: string; name: string; url: string; desc: string; }[] 
}> = {
  // 🔴 LLM: 절대 건드리지 않음
  LLM: {
    label: "🤖 LLM (High-End)",
    desc: "LiveBench(정량)와 LMSYS 7대 분야(정성) 교차 검증",
    sources: [
      { id: "test", name: "1. LiveBench (Test)", url: "https://livebench.ai/", desc: "표 전체 복사" },
      { id: "vote_overall", name: "2. LMSYS (Overall)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Overall -> 전체 복사" },
      { id: "vote_coding", name: "3. LMSYS (Coding)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Coding -> 전체 복사" },
      { id: "vote_hard", name: "4. LMSYS (Hard)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Hard Prompts -> 전체 복사" },
      { id: "vote_creative", name: "5. LMSYS (Creative)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Creative Writing -> 전체 복사" },
      { id: "vote_multi", name: "6. LMSYS (Multi-turn)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Multi-turn -> 전체 복사" },
      { id: "vote_inst", name: "7. LMSYS (Instruction)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Instruction Following -> 전체 복사" },
      { id: "vote_kr", name: "8. LMSYS (Korean)", url: "https://lmarena.ai/?leaderboard", desc: "Category: Korean -> 전체 복사" }
    ]

  },
  // 🔵 Image: 정량(AA) 삭제 -> LMSYS 생성/편집 2개로 집중
  Image: {
    label: "🎨 이미지 AI",
    desc: "LMSYS Text-to-Image & Image Edit",
    sources: [
      { id: "img_vote_t2i", name: "1. LMSYS Text-to-Image", url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Image' 탭 랭킹 표 복사" },
      { id: "img_vote_edit", name: "2. LMSYS Image Edit", url: "https://lmarena.ai/?leaderboard", desc: "'Image Edit' 탭 랭킹 표 복사" }
    ]
  },
  // 🟣 Video: 정량(VBench) + LMSYS 생성/변환
  Video: {
    label: "🎬 영상 AI",
    desc: "VBench(정량) + LMSYS T2V/I2V(정성)",
    sources: [
      { id: "video_test", name: "1. VBench (Test)", url: "https://huggingface.co/spaces/Vchitect/VBench_Leaderboard", desc: "VBench Leaderboard 표 전체 복사" },
      { id: "video_vote_t2v", name: "2. LMSYS Text-to-Video", url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Video' 탭 랭킹 표 복사" },
      { id: "video_vote_i2v", name: "3. LMSYS Image-to-Video", url: "https://lmarena.ai/?leaderboard", desc: "'Image-to-Video' 탭 랭킹 표 복사" }
    ]
  },
  TTS: {
    label: "🗣️ TTS (음성)",
    desc: "Artificial Analysis Speech Arena",
    sources: [
      { id: "tts_aa", name: "1. AA Speech Arena", url: "https://artificialanalysis.ai/speech-arena", desc: "Leaderboard 표 전체 복사" }
    ]
  },
  STT: {
    label: "👂 STT (인식)",
    desc: "Open ASR Leaderboard",
    sources: [
      { id: "stt_open", name: "1. Open ASR", url: "https://huggingface.co/spaces/open-asr-leaderboard/leaderboard", desc: "Leaderboard 표 전체 복사" }
    ]
  }
};

// 🌟 오늘 날짜를 YYYY-MM-DD 형식으로 반환
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function AdminPage() {
  const [selectedType, setSelectedType] = useState("LLM");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
    // 🌟 데이터 기준일 상태 추가
  const [testDate, setTestDate] = useState(getTodayDate());
  const [voteDate, setVoteDate] = useState(getTodayDate());

  useEffect(() => {
    setInputs({});
    setAnalysisResult(null);
  }, [selectedType]);

  const handleInputChange = (id: string, value: string) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleAnalyze = async () => {
    const currentConfig = REPORT_CONFIG[selectedType];
    const hasData = currentConfig.sources.some(src => inputs[src.id]?.trim().length > 0);

    if (!hasData) {
      alert("데이터를 최소 하나 이상 붙여넣어야 분석할 수 있습니다.");
      return;
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const reportData = currentConfig.sources.map(src => ({
        siteName: src.name,
        content: inputs[src.id] || "(데이터 없음)"
      }));

      const result = await analyzeReports(reportData, selectedType);

      if (result.success && result.data) {
        const enrichedResult = {
          ...result.data.analysisResult,
          data_dates: {
            test_date: testDate,
            vote_date: voteDate
          }
        };
        setAnalysisResult(enrichedResult);
      } else {
        alert(`분석 실패: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (dataToSave?: any) => {
    const targetData = dataToSave || analysisResult;
    
    if (!targetData) return;
    
    setSaving(true);
    try {
      const result = await saveReportToDB(
        targetData.report_title || `${selectedType} 분석 리포트`,
        targetData
      );
      if (result.success) {
        alert("✅ 발행 완료!");
        setAnalysisResult(null);
        setInputs({});
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const currentConfig = REPORT_CONFIG[selectedType] || REPORT_CONFIG.LLM;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-zinc-500 mt-2">
             LLM은 <b>교차 검증</b>, 그 외 분야는 <b>카테고리별 특화 데이터</b>를 입력하세요.
          </p>
        </div>

        {!analysisResult ? (
          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
              {Object.keys(REPORT_CONFIG).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all min-w-[100px] whitespace-nowrap
                    ${selectedType === type 
                      ? "bg-indigo-600 text-white shadow-md" 
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                >
                  {REPORT_CONFIG[type].label.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* 🌟 데이터 기준일 입력 (LLM, Video 등 정량/정성 복합 카테고리에서 표시) */}
            {(selectedType === "LLM" || selectedType === "Video") && (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  📅 데이터 기준일 설정
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <label className="block text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">
                      📊 정량(Test) 기준일
                    </label>
                    <p className="text-xs text-blue-500 dark:text-blue-400 mb-2">
                      {selectedType === "LLM" ? "LiveBench" : "VBench"} 데이터 수집일
                    </p>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="w-full p-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-xl border border-pink-200 dark:border-pink-800">
                    <label className="block text-sm font-bold text-pink-700 dark:text-pink-300 mb-2">
                      👥 정성(Vote) 기준일
                    </label>
                    <p className="text-xs text-pink-500 dark:text-pink-400 mb-2">LMSYS Arena 데이터 수집일</p>
                    <input
                      type="date"
                      value={voteDate}
                      onChange={(e) => setVoteDate(e.target.value)}
                      className="w-full p-3 rounded-lg border border-pink-300 dark:border-pink-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{currentConfig.label}</h3>
                <p className="text-zinc-500 dark:text-zinc-400">{currentConfig.desc}</p>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {currentConfig.sources.map((source) => (
                  <div key={source.id} className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {source.name}
                      </label>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 px-2 py-1 rounded transition-colors flex items-center gap-1 shadow-sm"
                      >
                        🔗 링크 열기 
                      </a>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{source.desc}</p>
                    <textarea
                      rows={8}
                      placeholder="사이트에서 표를 드래그하여 전체 복사(Ctrl+A, Ctrl+C) 후 여기에 붙여넣으세요(Ctrl+V)..."
                      value={inputs[source.id] || ""}
                      onChange={(e) => handleInputChange(source.id, e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs text-zinc-600 dark:text-zinc-300 resize-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg transition-all disabled:opacity-70"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gemini가 {selectedType} 데이터를 분석 중입니다... ⚡
                    </span>
                  ) : (
                    `✨ ${selectedType} 리포트 생성 시작`
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
              isEditable={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}