"use client";

import { useState, useEffect } from "react";
import { analyzeReports, saveReportToDB, fetchTTSEloFromAPI } from "@/app/actions/analyze";
import ReportView from "./ReportView";

// ─── 리포트 타입별 설정 (LLM/Image/Video 불변) ──────────────────────────────
const REPORT_CONFIG: Record<string, {
  label: string;
  desc: string;
  sources: { id: string; name: string; url: string; desc: string; }[];
}> = {
  // 🔴 LLM — 절대 건드리지 않음
  LLM: {
    label: "🤖 LLM (High-End)",
    desc: "LiveBench(정량)와 LMSYS 7대 분야(정성) 교차 검증",
    sources: [
      { id: "test",        name: "1. LiveBench (Test)",        url: "https://livebench.ai/",          desc: "표 전체 복사" },
      { id: "vote_overall",name: "2. LMSYS (Overall)",        url: "https://lmarena.ai/?leaderboard", desc: "Category: Overall → 전체 복사" },
      { id: "vote_coding", name: "3. LMSYS (Coding)",         url: "https://lmarena.ai/?leaderboard", desc: "Category: Coding → 전체 복사" },
      { id: "vote_hard",   name: "4. LMSYS (Hard)",           url: "https://lmarena.ai/?leaderboard", desc: "Category: Hard Prompts → 전체 복사" },
      { id: "vote_creative",name:"5. LMSYS (Creative)",       url: "https://lmarena.ai/?leaderboard", desc: "Category: Creative Writing → 전체 복사" },
      { id: "vote_multi",  name: "6. LMSYS (Multi-turn)",     url: "https://lmarena.ai/?leaderboard", desc: "Category: Multi-turn → 전체 복사" },
      { id: "vote_inst",   name: "7. LMSYS (Instruction)",    url: "https://lmarena.ai/?leaderboard", desc: "Category: Instruction Following → 전체 복사" },
      { id: "vote_kr",     name: "8. LMSYS (Korean)",         url: "https://lmarena.ai/?leaderboard", desc: "Category: Korean → 전체 복사" },
    ],
  },
  // 🔵 Image
  Image: {
    label: "🎨 이미지 AI",
    desc: "LMSYS Text-to-Image & Image Edit",
    sources: [
      { id: "img_vote_t2i", name: "1. LMSYS Text-to-Image", url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Image' 탭 랭킹 표 복사" },
      { id: "img_vote_edit",name: "2. LMSYS Image Edit",    url: "https://lmarena.ai/?leaderboard", desc: "'Image Edit' 탭 랭킹 표 복사" },
    ],
  },
  // 🟣 Video
  Video: {
    label: "🎬 영상 AI",
    desc: "VBench(정량) + LMSYS T2V/I2V(정성)",
    sources: [
      { id: "video_test",    name: "1. VBench (Test)",         url: "https://huggingface.co/spaces/Vchitect/VBench_Leaderboard", desc: "VBench Leaderboard 표 전체 복사" },
      { id: "video_vote_t2v",name: "2. LMSYS Text-to-Video",  url: "https://lmarena.ai/?leaderboard", desc: "'Text-to-Video' 탭 랭킹 표 복사" },
      { id: "video_vote_i2v",name: "3. LMSYS Image-to-Video", url: "https://lmarena.ai/?leaderboard", desc: "'Image-to-Video' 탭 랭킹 표 복사" },
    ],
  },
  // 🗣️ TTS — AA API 자동수집 + 선택 입력
  TTS: {
    label: "🗣️ TTS (음성 합성)",
    desc: "AA API 자동수집(Elo 순위) + 선택입력(속도/가격/오픈소스)",
    sources: [
      {
        id:   "tts_models",
        name: "2. AA Models Page (속도 & 가격 — 선택)",
        url:  "https://artificialanalysis.ai/text-to-speech/models",
        desc: "사이트에서 모델 표 전체 복사 (Speed & Price 컬럼 포함). Elo는 위에서 자동 가져오기 버튼 사용.",
      },
    ],
  },
  // 👂 STT — AA STT 페이지 1개 붙여넣기
  STT: {
    label: "👂 STT (음성 인식)",
    desc: "AA STT 1개 붙여넣기 — 정확도(WER) + 속도 + 가격 모두 포함",
    sources: [
      {
        id:   "stt_aa",
        name: "1. Artificial Analysis STT",
        url:  "https://artificialanalysis.ai/speech-to-text",
        desc: "페이지에서 표 전체 드래그 선택 후 복사(Ctrl+C). AA-WER / Speed Factor / Price 3가지 지표 모두 포함됨.",
      },
    ],
  },
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [selectedType,   setSelectedType]   = useState("LLM");
  const [inputs,         setInputs]         = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);

  // 날짜
  const [testDate, setTestDate] = useState(getTodayDate());
  const [voteDate, setVoteDate] = useState(getTodayDate());

  // TTS 자동수집 상태
  const [ttsAutoLoading,  setTtsAutoLoading]  = useState(false);
  const [ttsAutoFetched,  setTtsAutoFetched]  = useState(false);
  const [ttsAutoPreview,  setTtsAutoPreview]  = useState<any[] | null>(null);
  const [ttsAutoError,    setTtsAutoError]    = useState<string | null>(null);

  useEffect(() => {
    setInputs({});
    setAnalysisResult(null);
    setTtsAutoFetched(false);
    setTtsAutoPreview(null);
    setTtsAutoError(null);
  }, [selectedType]);

  const handleInputChange = (id: string, value: string) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  // ─── TTS AA API 자동 수집 ──────────────────────────────────────────────────
  const handleTTSAutoFetch = async () => {
    setTtsAutoLoading(true);
    setTtsAutoError(null);
    try {
      const res = await fetchTTSEloFromAPI();
      if (res.success && res.data) {
        // API 데이터를 Source 1 텍스트로 직렬화해서 인풋에 저장
        const jsonStr = JSON.stringify(res.data, null, 2);
        setInputs(prev => ({ ...prev, tts_api_elo: jsonStr }));
        setTtsAutoPreview(res.data.slice(0, 5));
        setTtsAutoFetched(true);
      } else {
        setTtsAutoError(res.error || "알 수 없는 오류");
      }
    } catch (e) {
      setTtsAutoError("API 호출 중 오류가 발생했습니다.");
    } finally {
      setTtsAutoLoading(false);
    }
  };

  // ─── 분석 실행 ────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    const currentConfig = REPORT_CONFIG[selectedType];
    const isTTS = selectedType === "TTS";

    // TTS는 API Elo 필수 체크
    if (isTTS && !inputs["tts_api_elo"]) {
      alert("TTS 리포트 생성을 위해 'Elo 자동 가져오기' 버튼을 먼저 클릭해 주세요.");
      return;
    }

    // 일반 타입은 최소 1개 소스 필요
    if (!isTTS) {
      const hasData = currentConfig.sources.some(src => inputs[src.id]?.trim().length > 0);
      if (!hasData) {
        alert("데이터를 최소 하나 이상 붙여넣어야 분석할 수 있습니다.");
        return;
      }
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      let reportData;

      if (isTTS) {
        // TTS: Source 1 = AA API JSON, Source 2 = 선택 복붙
        reportData = [
          { siteName: "1. AA API ELO Data (JSON)", content: inputs["tts_api_elo"] || "" },
          { siteName: "2. AA Models Page (Speed/Price)", content: inputs["tts_models"]?.trim() ? inputs["tts_models"] : "(데이터 없음)" },
        ];
      } else {
        reportData = currentConfig.sources.map(src => ({
          siteName: src.name,
          content:  inputs[src.id] || "(데이터 없음)",
        }));
      }

      const result = await analyzeReports(reportData, selectedType);

      if (result.success && result.data) {
        const enrichedResult = {
          ...result.data.analysisResult,
          data_dates: { test_date: testDate, vote_date: voteDate },
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

  // ─── 저장 ─────────────────────────────────────────────────────────────────
  const handleSave = async (dataToSave?: any) => {
    const targetData = dataToSave || analysisResult;
    if (!targetData) return;
    setSaving(true);
    try {
      const result = await saveReportToDB(
        targetData.report_title || `${selectedType} 분석 리포트`,
        targetData,
      );
      if (result.success) {
        alert("✅ 발행 완료!");
        setAnalysisResult(null);
        setInputs({});
        setTtsAutoFetched(false);
        setTtsAutoPreview(null);
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
  const isTTS = selectedType === "TTS";
  const isSTT = selectedType === "STT";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-zinc-500 mt-2">
            LLM은 <b>교차 검증</b>, 그 외 분야는 <b>카테고리별 특화 데이터</b>를 입력하세요.
          </p>
        </div>

        {!analysisResult ? (
          <div className="space-y-8">
            {/* 탭 선택 */}
            <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
              {Object.keys(REPORT_CONFIG).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all min-w-[80px] whitespace-nowrap
                    ${selectedType === type
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                >
                  {REPORT_CONFIG[type].label.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* 날짜 설정 (LLM, Video) */}
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
                    <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)}
                      className="w-full p-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-xl border border-pink-200 dark:border-pink-800">
                    <label className="block text-sm font-bold text-pink-700 dark:text-pink-300 mb-2">
                      👥 정성(Vote) 기준일
                    </label>
                    <p className="text-xs text-pink-500 dark:text-pink-400 mb-2">LMSYS Arena 데이터 수집일</p>
                    <input type="date" value={voteDate} onChange={(e) => setVoteDate(e.target.value)}
                      className="w-full p-3 rounded-lg border border-pink-300 dark:border-pink-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* 날짜 설정 (STT, TTS — 단일) */}
            {(isSTT || isTTS) && (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">📅 데이터 기준일</h3>
                <div className="max-w-xs">
                  <input type="date" value={voteDate} onChange={(e) => setVoteDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            )}

            {/* 메인 입력 패널 */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{currentConfig.label}</h3>
                <p className="text-zinc-500 dark:text-zinc-400">{currentConfig.desc}</p>
              </div>

              <div className="grid grid-cols-1 gap-6">

                {/* ── TTS 전용: AA API 자동 수집 블록 ── */}
                {isTTS && (
                  <div className={`p-5 rounded-xl border-2 transition-all
                    ${ttsAutoFetched
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
                      : "border-dashed border-violet-300 bg-violet-50/50 dark:bg-violet-900/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-bold text-violet-700 dark:text-violet-300">
                          1. AA API — Elo 순위 자동 가져오기 ✨
                        </span>
                        <p className="text-xs text-violet-500 mt-0.5">
                          Artificial Analysis API에서 TTS 전체 모델 Elo 순위를 자동 수집합니다
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTTSAutoFetch}
                        disabled={ttsAutoLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm
                          ${ttsAutoFetched
                            ? "bg-violet-600 text-white hover:bg-violet-700"
                            : "bg-violet-600 text-white hover:bg-violet-700"
                          } disabled:opacity-60`}
                      >
                        {ttsAutoLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            수집 중...
                          </>
                        ) : ttsAutoFetched ? (
                          "✅ 재수집"
                        ) : (
                          "⚡ 자동 가져오기"
                        )}
                      </button>
                    </div>

                    {/* 에러 */}
                    {ttsAutoError && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                        ⚠️ {ttsAutoError}
                      </div>
                    )}

                    {/* 미리보기 */}
                    {ttsAutoFetched && ttsAutoPreview && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-violet-600 mb-2">
                          ✅ {JSON.parse(inputs["tts_api_elo"] || "[]").length}개 모델 수집 완료 — 상위 5개 미리보기:
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {ttsAutoPreview.map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 border border-violet-100">
                              <span className="font-bold text-violet-700">#{m.rank}</span>
                              <span className="flex-1 mx-3 text-zinc-700 dark:text-zinc-300 truncate">{m.name}</span>
                              <span className="font-mono text-violet-600 font-bold">{m.elo} Elo</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 소스 입력 텍스트에어리어 */}
                {currentConfig.sources.map((source) => (
                  <div key={source.id} className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {source.name}
                        {isTTS && <span className="ml-2 text-xs text-zinc-400 font-normal">(선택 — 없어도 분석 가능)</span>}
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
                      rows={isSTT ? 12 : 8}
                      placeholder="사이트에서 표를 드래그하여 전체 복사(Ctrl+A) 후 여기에 붙여넣으세요(Ctrl+V)..."
                      value={inputs[source.id] || ""}
                      onChange={(e) => handleInputChange(source.id, e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs text-zinc-600 dark:text-zinc-300 resize-none"
                    />
                  </div>
                ))}
              </div>

              {/* STT 가이드 */}
              {isSTT && (
                <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">📋 STT 데이터 복사 가이드</p>
                  <ol className="text-xs text-emerald-600 dark:text-emerald-400 space-y-1 list-decimal list-inside">
                    <li><a href="https://artificialanalysis.ai/speech-to-text" target="_blank" rel="noreferrer" className="underline">artificialanalysis.ai/speech-to-text</a> 페이지 열기</li>
                    <li>페이지 스크롤 하여 모델 비교 표 확인</li>
                    <li>표 전체를 드래그하거나 Ctrl+A로 전체 선택 후 복사(Ctrl+C)</li>
                    <li>위 텍스트 박스에 붙여넣기 (WER, Speed Factor, Price 모두 포함됨)</li>
                  </ol>
                </div>
              )}

              {/* 분석 버튼 */}
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