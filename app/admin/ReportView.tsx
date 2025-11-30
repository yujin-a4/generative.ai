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

// 시드 기반 난수 생성기
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

// 아이콘 컴포넌트들
const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

// 날짜 포맷 함수
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '.');
}

// 리포트 제목 생성 함수 (년 + 월 + 분야 + 순위 리포트)
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

// 📖 평가 기준 설명 데이터
const BENCHMARK_INFO = {
  // 섹션 전체 설명
  test_section: {
    title: "LiveBench란?",
    description: "오염되지 않은 최신 데이터로 LLM을 평가하는 벤치마크입니다. 기존 벤치마크는 학습 데이터에 포함될 수 있어 신뢰도가 떨어지는 문제가 있었습니다.",
    features: ["자동 채점: 정답이 명확해서 LLM 판정자 불필요", "매월 업데이트: 새 문제 추가로 데이터 오염 방지", "점수 범위: 0~100점 (정답률 기반)"],
    source: "livebench.ai"
  },
  vote_section: {
    title: "LMSYS Chatbot Arena란?",
    description: "실제 사용자 블라인드 투표 기반 평가입니다. 두 모델의 답변을 익명으로 보여주고 어떤 게 더 좋은지 사용자가 직접 선택합니다.",
    features: ["Elo 점수: 체스 랭킹처럼 강자를 이기면 점수 상승", "100만+ 투표: 통계적으로 유의미한 대규모 샘플", "실사용 반영: 벤치마크가 아닌 실제 사용 패턴 기반"],
    source: "lmarena.ai"
  },
  // Test 영역별 설명
  reasoning: {
    title: "추론 (Reasoning)",
    description: "논리 퍼즐, 공간 추론, Web of Lies(거짓말 탐지) 등의 문제를 통해 논리적 사고력을 측정합니다.",
    example: "예: \"A가 B에게 거짓말을 했고, B는 C에게...\" 류의 다단계 논리 추론",
    scoring: "자동 채점 (정답 일치 여부)"
  },
  coding: {
    title: "코딩 (Coding)",
    description: "최신 LeetCode 스타일 알고리즘 문제를 풀고, 실제 테스트케이스로 정답을 검증합니다.",
    example: "예: 배열 조작, 그래프 탐색, 동적 프로그래밍 문제",
    scoring: "테스트케이스 통과율로 채점"
  },
  math: {
    title: "수학 (Math)",
    description: "AMC, AIME 등 최신 수학 경시대회 문제로 수학적 추론 능력을 평가합니다.",
    example: "예: 증명, 복잡한 계산, 수열 및 조합 문제",
    scoring: "정답 일치 여부로 채점"
  },
  data_analysis: {
    title: "데이터 분석 (Data Analysis)",
    description: "주어진 표나 데이터에서 특정 값을 추출하거나 계산하는 능력을 측정합니다.",
    example: "예: 표에서 조건에 맞는 행 찾기, 평균/합계 계산",
    scoring: "정답 일치 여부로 채점"
  },
  // Vote 영역별 설명
  multi_turn: {
    title: "대화 맥락 (Multi-turn)",
    description: "2턴 이상의 대화에서 이전 맥락을 얼마나 잘 기억하고 활용하는지 평가합니다.",
    example: "예: 이전 대화 내용을 참조한 후속 질문 처리",
    scoring: "사용자 블라인드 투표"
  },
  instruction_following: {
    title: "지시 이행 (Instruction Following)",
    description: "\"5문장으로 작성해줘\", \"JSON 형식으로\", \"~하지 마\" 등 구체적 지시사항 준수율을 평가합니다.",
    example: "예: 형식, 길이, 스타일, 제약조건 준수 여부",
    scoring: "사용자 블라인드 투표"
  },
  creative_writing: {
    title: "창의적 글쓰기 (Creative Writing)",
    description: "소설, 시, 광고 카피, 롤플레이 등 창작 콘텐츠의 품질을 평가합니다.",
    example: "예: 스토리텔링, 문체, 독창성, 감정 표현",
    scoring: "사용자 블라인드 투표"
  },
  hard_prompts: {
    title: "고난도 질문 (Hard Prompts)",
    description: "전문 지식이 필요하거나 복잡한 분석이 요구되는 어려운 질문 처리 능력을 평가합니다.",
    example: "예: 학술적 질문, 멀티스텝 추론, 전문 분야 지식",
    scoring: "사용자 블라인드 투표"
  },
  coding_vote: {
    title: "체감 코딩 (Coding)",
    description: "실제 사용자가 코딩 도움을 요청했을 때 느끼는 만족도를 평가합니다.",
    example: "예: 버그 수정, 코드 설명, 리팩토링 제안",
    scoring: "사용자 블라인드 투표"
  },
  korean: {
    title: "한국어 (Korean)",
    description: "한국어 질문에 대한 이해도와 응답 품질을 한국 사용자들이 직접 평가합니다.",
    example: "예: 자연스러운 한국어 표현, 문화적 맥락 이해",
    scoring: "한국어 사용자 블라인드 투표"
  }
};

// ⓘ 툴팁 컴포넌트
const InfoTooltip = ({ infoKey, isSection = false }: { infoKey: string; isSection?: boolean }) => {
  const info = BENCHMARK_INFO[infoKey as keyof typeof BENCHMARK_INFO];
  if (!info) return null;

  return (
    <div className="relative inline-block group">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs cursor-help hover:bg-gray-300 transition-colors ml-2">
        ?
      </span>
      <div className="absolute left-0 bottom-full mb-2 w-80 p-4 bg-slate-900 text-white text-sm rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {/* 화살표 */}
        <div className="absolute left-4 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-900"></div>
        
        {isSection ? (
          // 섹션 설명 (LiveBench / LMSYS 전체)
          <>
            <h4 className="font-bold text-base mb-2 text-amber-300">{(info as any).title}</h4>
            <p className="text-gray-300 mb-3 leading-relaxed">{(info as any).description}</p>
            <ul className="space-y-1.5 mb-3">
              {(info as any).features?.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
              🔗 {(info as any).source}
            </div>
          </>
        ) : (
          // 개별 영역 설명
          <>
            <h4 className="font-bold text-base mb-2 text-amber-300">{(info as any).title}</h4>
            <p className="text-gray-300 mb-2 leading-relaxed">{(info as any).description}</p>
            <p className="text-xs text-gray-400 mb-2 italic">{(info as any).example}</p>
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-2">
              📊 채점: {(info as any).scoring}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function ReportView({ 
  data, 
  onSave, 
  onReanalyze, 
  isSaving,
  isEditable = false
}: ReportViewProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) {
      setReportData(data.analysis_result || data);
    }
  }, [data]);

  if (!reportData) return null;

  // 편집 관련 함수들
  const startEditing = (fieldKey: string, currentValue: string) => {
    setEditingFields(prev => ({ ...prev, [fieldKey]: true }));
    setTempValues(prev => ({ ...prev, [fieldKey]: currentValue }));
  };

  const cancelEditing = (fieldKey: string) => {
    setEditingFields(prev => ({ ...prev, [fieldKey]: false }));
    setTempValues(prev => {
      const newTemp = { ...prev };
      delete newTemp[fieldKey];
      return newTemp;
    });
  };

  const confirmCommentEdit = (section: string, category: string) => {
    const fieldKey = `${section}.${category}`;
    const newValue = tempValues[fieldKey];
    
    if (newValue !== undefined) {
      setReportData((prev: any) => ({
        ...prev,
        raw_data: {
          ...prev.raw_data,
          [section]: {
            ...prev.raw_data[section],
            sub_categories: {
              ...prev.raw_data[section].sub_categories,
              [category]: {
                ...prev.raw_data[section].sub_categories[category],
                comment: newValue
              }
            }
          }
        }
      }));
    }
    
    setEditingFields(prev => ({ ...prev, [fieldKey]: false }));
  };

  // 총평 편집 완료
  const confirmSummaryEdit = (index: number) => {
    const fieldKey = `summary.${index}`;
    const newValue = tempValues[fieldKey];
    
    if (newValue !== undefined) {
      const newSummary = [...(reportData.summary_insights || [])];
      newSummary[index] = newValue;
      setReportData((prev: any) => ({ ...prev, summary_insights: newSummary }));
    }
    
    setEditingFields(prev => ({ ...prev, [fieldKey]: false }));
  };

  const updateTempValue = (fieldKey: string, value: string) => {
    setTempValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleSaveClick = () => {
    if (onSave) onSave(reportData);
  };

  if (reportData.report_type === "LLM") {
    const { raw_data, data_dates, summary_insights } = reportData;
    const testTotal = raw_data?.test_benchmarks?.total_ranking || [];
    const voteOverall = raw_data?.vote_rankings?.overall || [];
    
    // 리포트 제목 생성
    const reportTitle = generateReportTitle(data_dates, "LLM");
    
    const formatScore = (val: number | string) => {
      if (!val || val === 0) return "-";
      return Number(val).toLocaleString(undefined, { maximumFractionDigits: 1 });
    };

    const getOrgInfo = (org: string) => {
      const lower = org?.toLowerCase() || "";
      if (lower.includes("openai") || lower.includes("gpt")) return { color: "#10a37f", bgColor: "rgba(16,163,127,0.15)", index: 4, name: "OpenAI" };
      if (lower.includes("anthropic") || lower.includes("claude")) return { color: "#d97757", bgColor: "rgba(217,119,87,0.15)", index: 3, name: "Anthropic" };
      if (lower.includes("google") || lower.includes("gemini")) return { color: "#4285f4", bgColor: "rgba(66,133,244,0.15)", index: 2, name: "Google" };
      if (lower.includes("xai") || lower.includes("grok")) return { color: "#1d1d1f", bgColor: "rgba(29,29,31,0.15)", index: 1, name: "xAI" };
      if (lower.includes("meta") || lower.includes("llama")) return { color: "#0668E1", bgColor: "rgba(6,104,225,0.15)", index: 0, name: "Meta" };
      return { color: "#6b7280", bgColor: "rgba(107,114,128,0.15)", index: 0, name: "Others" };
    };

    const cleanModelName = (name: string) => {
      if(!name) return "";
      return name.replace(/-202\d{5}/g, "").replace(/_/g, " ").replace(/-thinking/g, "").replace(/-preview/g, "");
    };

    const getScaleLimits = (categories: any, isVote: boolean) => {
      let min = Infinity;
      let max = -Infinity;
      Object.values(categories || {}).forEach((obj: any) => {
        const items = obj.items || [];
        items.forEach((item: any) => {
          const val = Number(isVote ? item.elo : item.score);
          if (val > 0) {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        });
      });
      if (min === Infinity) return { min: 0, max: 100 };
      const padding = (max - min) * 0.05;
      return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
    };

    const testScale = getScaleLimits(raw_data?.test_benchmarks?.sub_categories, false);
    const voteScale = getScaleLimits(raw_data?.vote_rankings?.sub_categories, true);

    // 제조사 순위 계산
    const calculateOrgRankings = () => {
      const orgScores: Record<string, { test: number[], vote: number[], models: Set<string> }> = {};
      
      const testCategories = ['reasoning', 'coding', 'math', 'data_analysis'];
      testCategories.forEach(cat => {
        const items = raw_data?.test_benchmarks?.sub_categories?.[cat]?.items || [];
        items.slice(0, 10).forEach((item: any, idx: number) => {
          const orgName = getOrgInfo(item.org).name;
          if (!orgScores[orgName]) {
            orgScores[orgName] = { test: [], vote: [], models: new Set() };
          }
          const existingRank = orgScores[orgName].test.filter((_, i) => i % testCategories.length === testCategories.indexOf(cat));
          if (existingRank.length === 0) {
            orgScores[orgName].test.push(idx + 1);
          }
          orgScores[orgName].models.add(cleanModelName(item.model));
        });
      });

      const voteCategories = ['korean', 'coding', 'hard_prompts', 'creative_writing', 'multi_turn', 'instruction_following'];
      voteCategories.forEach(cat => {
        const items = raw_data?.vote_rankings?.sub_categories?.[cat]?.items || [];
        items.slice(0, 10).forEach((item: any, idx: number) => {
          const orgName = getOrgInfo(item.org).name;
          if (!orgScores[orgName]) {
            orgScores[orgName] = { test: [], vote: [], models: new Set() };
          }
          const existingRank = orgScores[orgName].vote.filter((_, i) => i % voteCategories.length === voteCategories.indexOf(cat));
          if (existingRank.length === 0) {
            orgScores[orgName].vote.push(idx + 1);
          }
          orgScores[orgName].models.add(cleanModelName(item.model));
        });
      });

      const rankings = Object.entries(orgScores)
        .filter(([name]) => name !== "Others")
        .map(([name, scores]) => {
          const testAvg = scores.test.length > 0 
            ? scores.test.reduce((a, b) => a + b, 0) / scores.test.length 
            : 10;
          const voteAvg = scores.vote.length > 0 
            ? scores.vote.reduce((a, b) => a + b, 0) / scores.vote.length 
            : 10;
          const totalAvg = (testAvg + voteAvg) / 2;
          
          return {
            name,
            testAvg: testAvg.toFixed(1),
            voteAvg: voteAvg.toFixed(1),
            totalAvg: totalAvg.toFixed(1),
            totalAvgNum: totalAvg,
            color: getOrgInfo(name).color,
            bgColor: getOrgInfo(name).bgColor,
            models: Array.from(scores.models).slice(0, 3)
          };
        })
        .sort((a, b) => a.totalAvgNum - b.totalAvgNum);

      return rankings;
    };

    const orgRankings = calculateOrgRankings();

    // 🌟 개선된 범례
    const LegendBox = () => (
      <div className="flex flex-wrap gap-3 justify-center items-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-6 py-3 shadow-lg mb-10 mx-auto w-fit">
        {[
          { name: "OpenAI", color: "#10a37f" },
          { name: "Anthropic", color: "#d97757" },
          { name: "Google", color: "#4285f4" },
          { name: "xAI", color: "#1d1d1f" },
          { name: "Meta", color: "#0668E1" },
        ].map(org => (
          <div key={org.name} className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105" style={{ backgroundColor: `${org.color}15` }}>
            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: org.color }}></span>
            <span className="text-xs font-bold" style={{ color: org.color }}>{org.name}</span>
          </div>
        ))}
      </div>
    );

    // 🌟 개선된 카테고리 섹션 - 차트 높이 증가 (리스트 5개와 맞춤)
    const CategorySection = ({ title, section, categoryKey, metricKey = "score", icon = "📄", scale, infoKey }: any) => {
      const categoryData = raw_data?.[section]?.sub_categories?.[categoryKey];
      const items = categoryData?.items || [];
      const comment = categoryData?.comment || "";
      const fieldKey = `${section}.${categoryKey}`;
      const isEditingThis = editingFields[fieldKey];

      const chartData = useMemo(() => {
        return {
          datasets: [{
            label: 'Models',
            data: items.slice(0, 10).map((item: any, idx: number) => {
              const seed = `${item.model}-${categoryKey}-${idx}`;
              const yOffset = seededRandom(seed) * 0.6 - 0.3;
              return {
                x: Number(item[metricKey] || item.elo) || 0,
                y: getOrgInfo(item.org).index + yOffset,
                org: item.org,
                model: item.model
              };
            }).filter((d: any) => d.x > 0),
            backgroundColor: (ctx: any) => getOrgInfo(ctx.raw?.org).color,
            borderColor: "white",
            borderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 12
          }]
        };
      }, [items, categoryKey, metricKey]);

      if (!items || items.length === 0) return null;

      const top5 = items.slice(0, 5);

      return (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* 왼쪽: 리스트 */}
            <div className="flex-1 xl:max-w-[420px]">
              <h4 className="font-bold text-gray-800 mb-5 pb-3 border-b-2 border-gray-100 flex items-center gap-3 text-xl">
                <span className="text-3xl">{icon}</span> {title}
                <InfoTooltip infoKey={infoKey} />
              </h4>
              <ul className="space-y-3">
                {top5.map((item: any, idx: number) => (
                  <li key={idx} 
                    className={`flex justify-between items-center p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] ${
                      idx === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-md' : 'bg-gray-50 hover:bg-gray-100'
                    }`}>
                    <div className="flex items-center gap-3 truncate max-w-[75%]">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black shadow-sm ${
                        idx === 0 ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white" : "bg-white text-gray-500 border border-gray-200"
                      }`}>{idx + 1}</span>
                      <div className="flex flex-col truncate">
                        <span className={`font-bold truncate ${idx === 0 ? "text-gray-900 text-base" : "text-gray-700"}`}>{cleanModelName(item.model)}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 w-fit" 
                          style={{ color: getOrgInfo(item.org).color, backgroundColor: getOrgInfo(item.org).bgColor }}>
                          {item.org}
                        </span>
                      </div>
                    </div>
                    <span className={`font-mono font-black px-3 py-1.5 rounded-lg ${
                      idx === 0 ? 'text-lg text-amber-700 bg-amber-100' : 'text-sm text-gray-600 bg-white border border-gray-200'
                    }`}>
                      {formatScore(item[metricKey] || item.elo)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 오른쪽: 차트 - 제목 분리 + 차트 위치 내리기 */}
            <div className="flex-1 min-w-[320px] flex flex-col">
              {/* 차트 제목 - 독립된 한 줄 */}
              <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center mb-2">
                <span className="flex items-center gap-1">📊 Distribution</span>
                <span className="text-gray-400">High Score ➔</span>
              </div>
              {/* 차트 영역 - 리스트 1위와 높이 맞춤 */}
              <div className="flex-1 h-[300px] bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-slate-200 relative p-3 shadow-inner">
                <Scatter
                  data={chartData}
                  options={{
                    maintainAspectRatio: false,
                    animation: false,
                    layout: { padding: { left: 5, right: 15, top: 5, bottom: 10 } },
                    scales: {
                      x: { 
                        min: scale.min, 
                        max: scale.max, 
                        grid: { display: true, color: "rgba(0,0,0,0.06)", lineWidth: 1 },
                        ticks: { font: { size: 11, weight: 'bold' }, color: "#9ca3af" }
                      },
                      y: { 
                        display: false,
                        min: -0.5, max: 4.5 
                      }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(15,23,42,0.9)',
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 10,
                        callbacks: { 
                          title: (ctx: any) => ctx[0]?.raw?.model || '',
                          label: (ctx: any) => `Score: ${ctx.raw.x}` 
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* 한줄평 */}
          <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <span className="text-2xl">💡</span>
            
            {isEditingThis ? (
              <div className="flex-1 flex items-center gap-2">
                <input 
                  type="text" 
                  value={tempValues[fieldKey] ?? comment}
                  onChange={(e) => updateTempValue(fieldKey, e.target.value)}
                  autoFocus
                  className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmCommentEdit(section, categoryKey);
                    if (e.key === 'Escape') cancelEditing(fieldKey);
                  }}
                />
                <button onClick={() => confirmCommentEdit(section, categoryKey)} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                  <CheckIcon />
                </button>
                <button onClick={() => cancelEditing(fieldKey)} className="p-2.5 bg-gray-300 text-gray-600 rounded-xl hover:bg-gray-400 transition-colors">
                  <XIcon />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-between gap-2">
                <p className="text-sm text-gray-700 font-medium leading-relaxed flex-1">
                  {comment || "분석 코멘트가 없습니다."}
                </p>
                {isEditable && (
                  <button
                    onClick={() => startEditing(fieldKey, comment)}
                    className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                    title="편집"
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    };

    // 🌟 Top5 카드 컴포넌트 - 레이아웃 고정
    const Top5Card = ({ item, idx, isFirst, scoreKey, gradientClass }: any) => (
      <div 
        className={`rounded-2xl transition-all duration-300 hover:-translate-y-2 flex flex-col ${
          isFirst 
            ? "bg-white text-gray-900 shadow-2xl scale-105 ring-4 ring-amber-400/50" 
            : "bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20"
        }`}
        style={{ height: '180px' }}
      >
        {/* 상단: 순위 + 왕관 */}
        <div className="flex justify-between items-center px-5 pt-5">
          <span className={`text-xs font-black px-3 py-1.5 rounded-full ${
            isFirst ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg' : 'bg-white/20 text-white'
          }`}>{idx + 1}위</span>
          {isFirst && <span className="text-2xl">👑</span>}
        </div>
        
        {/* 중앙: 모델명 */}
        <div className="flex-1 flex items-center px-5">
          <div className={`font-bold text-base leading-snug line-clamp-2 ${isFirst ? 'text-gray-900' : 'text-white'}`}>
            {cleanModelName(item.model)}
          </div>
        </div>
        
        {/* 하단: 제조사 + 점수 */}
        <div className={`px-5 pb-5 pt-3 border-t flex justify-between items-end ${isFirst ? 'border-gray-200' : 'border-white/20'}`}>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isFirst ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-white/70'}`}>
            {item.org || "Unknown"}
          </span>
          <span className={`text-2xl font-black tracking-tight ${isFirst ? gradientClass : 'text-white'}`}>
            {formatScore(item[scoreKey] || item.score || item.average_score)}
          </span>
        </div>
      </div>
    );

    return (
      <div className="max-w-[1400px] mx-auto bg-gradient-to-b from-slate-50 to-white rounded-[2.5rem] shadow-2xl overflow-hidden text-gray-800 my-10 font-sans border border-slate-200">
        
        {/* 🌟 개선된 헤더 */}
        <header className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-16 text-center overflow-hidden">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, rgba(99,102,241,0.4) 0%, transparent 50%),
                               radial-gradient(circle at 75% 75%, rgba(168,85,247,0.4) 0%, transparent 50%)`
            }}></div>
          </div>
          <div className="relative z-10">
            {isEditable && (
              <span className="inline-block py-2 px-5 rounded-full bg-amber-500/20 border border-amber-400/30 text-xs font-bold mb-5 tracking-widest text-amber-300">
                ✏️ ADMIN PREVIEW - 편집 모드
              </span>
            )}
            {!isEditable && (
              <span className="inline-block py-2 px-5 rounded-full bg-white/10 border border-white/20 text-xs font-bold mb-5 tracking-widest text-indigo-200">
                PUBLISHED REPORT
              </span>
            )}
            <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
              {reportTitle}
            </h1>
            <p className="text-slate-400 text-lg">
              AI Benchmark Analysis Report
            </p>
          </div>
        </header>

        <div className="p-8 md:p-14 space-y-20">

          {/* 🌟 SECTION 0: 제조사 종합 순위 */}
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-3xl shadow-lg shadow-amber-200">🏢</div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">제조사 종합 순위</h2>
                <p className="text-gray-500 mt-1 font-medium">Test(정량) + Vote(정성) 평균 순위 기준</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-amber-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-100">
                      <th className="text-left py-5 px-4 text-sm font-bold text-gray-600 w-[70px]">순위</th>
                      <th className="text-left py-5 px-4 text-sm font-bold text-gray-600 w-[140px]">제조사</th>
                      <th className="text-center py-5 px-4 text-sm font-bold text-blue-600 w-[120px] whitespace-nowrap">📊 Test 평균</th>
                      <th className="text-center py-5 px-4 text-sm font-bold text-pink-600 w-[120px] whitespace-nowrap">👥 Vote 평균</th>
                      <th className="text-center py-5 px-4 text-sm font-bold text-amber-600 w-[100px]">🏆 종합</th>
                      <th className="text-left py-5 px-4 text-sm font-bold text-gray-600">대표 모델</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgRankings.map((org, idx) => (
                      <tr key={org.name} 
                        className={`border-b border-gray-50 transition-all hover:bg-gray-50 ${
                          idx === 0 ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50' : ''
                        }`}>
                        <td className="py-5 px-4">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-black shadow-md
                            ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : 
                              idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' : 
                              idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' : 
                              'bg-gray-100 text-gray-500'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-5 px-4">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: org.color }}></span>
                            <span className={`font-bold ${idx === 0 ? 'text-lg text-gray-900' : 'text-gray-700'}`}>{org.name}</span>
                          </div>
                        </td>
                        <td className="py-5 px-4 text-center">
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg whitespace-nowrap">{org.testAvg}위</span>
                        </td>
                        <td className="py-5 px-4 text-center">
                          <span className="font-mono font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-lg whitespace-nowrap">{org.voteAvg}위</span>
                        </td>
                        <td className="py-5 px-4 text-center">
                          <span className={`font-mono font-black text-xl whitespace-nowrap ${idx === 0 ? 'text-amber-600' : 'text-gray-700'}`}>{org.totalAvg}위</span>
                        </td>
                        <td className="py-5 px-4">
                          <span className="text-sm text-gray-500 font-medium line-clamp-2">{org.models.join(', ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          
          {/* 🌟 SECTION 1: Test (정량 평가) */}
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-blue-200">📊</div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 flex items-center">
                  정량적 벤치마크 (Test)
                  <InfoTooltip infoKey="test_section" isSection={true} />
                </h2>
                <p className="text-gray-500 mt-1 font-medium">
                  LiveBench 객관적 성능 평가 (0~100점)
                  {data_dates?.test_date && <span className="ml-3 text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full text-sm">📅 {formatDate(data_dates.test_date)} 기준</span>}
                </p>
              </div>
            </div>
            
            {/* 🌟 1위 강조 카드 - 레이아웃 고정 */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl shadow-2xl p-10 mb-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              
              <h3 className="text-sm font-bold mb-8 tracking-wider uppercase flex items-center gap-2 text-blue-200">
                🏆 종합 지능 랭킹 (Total)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
                {testTotal.slice(0, 5).map((t: any, idx: number) => (
                  <Top5Card 
                    key={idx}
                    item={t}
                    idx={idx}
                    isFirst={idx === 0}
                    scoreKey="score"
                    gradientClass="text-indigo-600"
                  />
                ))}
              </div>
            </div>

            <LegendBox />

            <div className="flex flex-col gap-10">
              <CategorySection title="추론 (Reasoning)" section="test_benchmarks" categoryKey="reasoning" icon="🧠" scale={testScale} infoKey="reasoning" />
              <CategorySection title="코딩 (Coding)" section="test_benchmarks" categoryKey="coding" icon="💻" scale={testScale} infoKey="coding" />
              <CategorySection title="수학 (Math)" section="test_benchmarks" categoryKey="math" icon="🧮" scale={testScale} infoKey="math" />
              <CategorySection title="데이터 분석 (Data)" section="test_benchmarks" categoryKey="data_analysis" icon="📊" scale={testScale} infoKey="data_analysis" />
            </div>
          </section>

          {/* 🌟 SECTION 2: Vote (정성 평가) */}
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-pink-200">👥</div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 flex items-center">
                  사용자 선호도 (Vote)
                  <InfoTooltip infoKey="vote_section" isSection={true} />
                </h2>
                <p className="text-gray-500 mt-1 font-medium">
                  LMSYS Chatbot Arena (1000+ Elo)
                  {data_dates?.vote_date && <span className="ml-3 text-pink-600 font-bold bg-pink-50 px-3 py-1 rounded-full text-sm">📅 {formatDate(data_dates.vote_date)} 기준</span>}
                </p>
              </div>
            </div>
            
            {/* 🌟 1위 강조 카드 - 레이아웃 고정 */}
            <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 rounded-3xl shadow-2xl p-10 mb-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
              
              <h3 className="text-sm font-bold mb-8 tracking-wider uppercase flex items-center gap-2 text-pink-200">
                🏆 종합 인기 랭킹 (Overall)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
                {voteOverall.slice(0, 5).map((m: any, idx: number) => (
                  <Top5Card 
                    key={idx}
                    item={m}
                    idx={idx}
                    isFirst={idx === 0}
                    scoreKey="elo"
                    gradientClass="text-pink-600"
                  />
                ))}
              </div>
            </div>

            <LegendBox />

            {/* 🌟 Vote 순서 변경: 대화 맥락 → 지시 이행 → 창의적 글쓰기 → 고난도 질문 → 체감 코딩 → 한국어 */}
            <div className="flex flex-col gap-10">
              <CategorySection title="대화 맥락 (Multi-turn)" section="vote_rankings" categoryKey="multi_turn" metricKey="elo" icon="🗣️" scale={voteScale} infoKey="multi_turn" />
              <CategorySection title="지시 이행 (Instruction)" section="vote_rankings" categoryKey="instruction_following" metricKey="elo" icon="✅" scale={voteScale} infoKey="instruction_following" />
              <CategorySection title="창의적 글쓰기 (Creative)" section="vote_rankings" categoryKey="creative_writing" metricKey="elo" icon="📝" scale={voteScale} infoKey="creative_writing" />
              <CategorySection title="고난도 질문 (Hard)" section="vote_rankings" categoryKey="hard_prompts" metricKey="elo" icon="🔥" scale={voteScale} infoKey="hard_prompts" />
              <CategorySection title="체감 코딩 (Coding)" section="vote_rankings" categoryKey="coding" metricKey="elo" icon="⌨️" scale={voteScale} infoKey="coding_vote" />
              <CategorySection title="한국어 (Korean)" section="vote_rankings" categoryKey="korean" metricKey="elo" icon="🇰🇷" scale={voteScale} infoKey="korean" />
            </div>
          </section>

          {/* 🌟 SECTION 3: 총평 (5문장) */}
          <section className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            {/* 배경 장식 */}
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
                        <div className="flex items-start gap-4">
                          <span className="text-2xl mt-0.5">{icons[idx] || "📌"}</span>
                          <p className="text-lg text-white/90 leading-relaxed flex-1">{text}</p>
                          {isEditable && (
                            <button
                              onClick={() => startEditing(fieldKey, text)}
                              className="p-2 text-indigo-300 hover:text-white hover:bg-indigo-700 rounded-lg transition-all flex-shrink-0"
                              title="편집"
                            >
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

        {/* 버튼 */}
        {isEditable && onSave && onReanalyze && (
          <div className="bg-gradient-to-r from-gray-50 to-white p-10 border-t border-gray-200 flex justify-center gap-5">
            <button onClick={handleSaveClick} disabled={isSaving} className="px-14 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-200">
              {isSaving ? '저장 중...' : '🚀 발행하기'}
            </button>
            <button onClick={onReanalyze} disabled={isSaving} className="px-14 py-5 bg-white text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-50 border-2 border-gray-200 shadow-lg">
              🔄 다시하기
            </button>
          </div>
        )}
      </div>
    );
  }

  return <div className="p-10 text-center">LLM 외 카테고리 뷰</div>;
}
