"use client";

import { useEffect, useState, useMemo, Suspense } from "react"; // 🌟 Suspense 추가
import { getAllReports } from "@/app/actions/analyze";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import TrendBackButton from "@/app/components/TrendBackButton";

// Chart.js 등록
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const getOrgInfo = (org: string) => {
  const lower = org?.toLowerCase() || "";
  if (lower.includes("openai") || lower.includes("gpt")) return { color: "#10a37f", name: "OpenAI" };
  if (lower.includes("anthropic") || lower.includes("claude")) return { color: "#d97757", name: "Anthropic" };
  if (lower.includes("google") || lower.includes("gemini")) return { color: "#4285f4", name: "Google" };
  if (lower.includes("xai") || lower.includes("grok")) return { color: "#1d1d1f", name: "xAI" };
  if (lower.includes("meta") || lower.includes("llama")) return { color: "#0668E1", name: "Meta" };
  return { color: "#6b7280", name: "Others" };
};

const LLM_TREND_CATEGORIES = [
  { key: "org_overall", label: "🏢 제조사 종합 순위 (평균)", type: "RANK" },
  { key: "test_overall", label: "📊 Test 전체 순위 (LiveBench)", type: "RANK" },
  { key: "vote_overall", label: "👥 Vote 전체 순위 (LMSYS Arena)", type: "RANK" },
  { key: "reasoning", label: "🧠 추론 (Reasoning)", type: "TEST" },
  { key: "coding", label: "💻 코딩 (Coding/Test)", type: "TEST" },
  { key: "math", label: "🧮 수학 (Math)", type: "TEST" },
  { key: "data_analysis", label: "📊 데이터 분석 (Data)", type: "TEST" },
  { key: "korean", label: "🇰🇷 한국어 (Korean)", type: "VOTE" },
  { key: "coding_vote", label: "⌨️ 코딩 체감 (Coding/Vote)", type: "VOTE" },
  { key: "creative_writing", label: "📝 창의적 글쓰기 (Creative)", type: "VOTE" },
  { key: "multi_turn", label: "🗣️ 대화 맥락 (Multi-turn)", type: "VOTE" },
  { key: "hard_prompts", label: "🔥 고난도 질문 (Hard)", type: "VOTE" },
  { key: "instruction_following", label: "✅ 지시 이행 (Instruction)", type: "VOTE" },
];

const getRankScore = (rank: number) => 10 - rank; 

export default function TrendsPage() {
  const [allReports, setAllReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(LLM_TREND_CATEGORIES[0].key);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getAllReports();
      setAllReports(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const { labels, competitionData, chartMin, chartMax, yAxisTitle } = useMemo(() => {
    if (allReports.length === 0) return { labels: [], competitionData: [], chartMin: 0, chartMax: 100, yAxisTitle: "" };

    const monthlyDataMap = new Map();
    allReports.forEach((report: any) => {
      const date = new Date(report.created_at);
      const key = `${date.getFullYear()}-${date.getMonth()}`; 
      if (!monthlyDataMap.has(key) || monthlyDataMap.get(key).created_at < report.created_at) {
         monthlyDataMap.set(key, report);
      }
    });

    const sortedReports = Array.from(monthlyDataMap.values()).sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const labels: string[] = [];
    const modelScores: Record<string, number[]> = {};

    const currentCategoryInfo = LLM_TREND_CATEGORIES.find(c => c.key === selectedCategory);
    const categoryType = currentCategoryInfo?.type;

    let yTitle = "";
    let fixedMin = 0;
    let fixedMax = 100;

    if (categoryType === "RANK") {
      yTitle = "Rank Score (10점 만점)";
      fixedMin = 5; 
      fixedMax = 10;
    } else if (categoryType === "TEST") {
      yTitle = "Test Score (점)";
      fixedMin = 0;
      fixedMax = 100;
    } else if (categoryType === "VOTE") {
      yTitle = "Elo Score";
      fixedMin = 1200; 
      fixedMax = 1600; 
    }

    sortedReports.forEach((report: any) => {
      const date = new Date(report.created_at);
      labels.push(`${date.getFullYear()}. ${date.getMonth() + 1}`);
      
      const analysis = report.analysis_result;
      
      let items: any[] = [];
      const actualCategoryKey = (selectedCategory === "coding_vote") ? "coding" : selectedCategory;
      
      if (selectedCategory === "org_overall") {
          items = [
              { model: "Anthropic", score: 8.5, org: "Anthropic" }, 
              { model: "OpenAI", score: 8.0, org: "OpenAI" },
              { model: "Google", score: 7.5, org: "Google" },
          ]; 
      } else if (selectedCategory === "test_overall") {
          items = analysis?.raw_data?.test_benchmarks?.total_ranking?.slice(0, 5) || [];
          items = items.map(item => ({ ...item, score: getRankScore(item.rank) })); 
      } else if (selectedCategory === "vote_overall") {
          items = analysis?.raw_data?.vote_rankings?.overall?.slice(0, 5) || [];
          items = items.map(item => ({ ...item, score: getRankScore(item.rank) }));
      }
      
      if (analysis?.raw_data?.test_benchmarks?.sub_categories?.[actualCategoryKey] && categoryType === "TEST") {
          items = analysis.raw_data.test_benchmarks.sub_categories[actualCategoryKey].items.slice(0, 5);
      } else if (analysis?.raw_data?.vote_rankings?.sub_categories?.[actualCategoryKey] && categoryType === "VOTE") {
          items = analysis.raw_data.vote_rankings.sub_categories[actualCategoryKey].items.slice(0, 5);
      }
      
      items.forEach((item: any) => {
        const modelKey = item.org; 
        const score = categoryType === "VOTE" ? item.elo : (categoryType === "RANK" ? item.score : item.score);
        
        if (!modelScores[modelKey]) {
          modelScores[modelKey] = Array(labels.length - 1).fill(NaN); 
        }

        Object.keys(modelScores).forEach(key => {
            if (modelScores[key].length < labels.length) {
                modelScores[key].push(NaN); 
            }
        });
        
        modelScores[modelKey][labels.length - 1] = Number(score) || NaN;
      });
      
       Object.keys(modelScores).forEach(key => {
          if (modelScores[key].length < labels.length) modelScores[key].push(NaN);
        });
    });

    const datasets: any[] = Object.entries(modelScores).map(([modelName, scores]) => {
      const orgInfo = getOrgInfo(modelName);
      return {
        label: `${modelName} (Top)`,
        data: scores,
        borderColor: orgInfo.color,
        backgroundColor: orgInfo.color + '40',
        borderWidth: 3,
        pointRadius: 6, 
        fill: false,
        tension: 0.2, 
      };
    }).filter(d => d.data.some((score: number) => !isNaN(score))); 

    return { 
        labels, 
        competitionData: datasets, 
        chartMin: fixedMin, 
        chartMax: fixedMax,
        yAxisTitle: yTitle
    };
  }, [allReports, selectedCategory]);

  const currentCategoryInfo = LLM_TREND_CATEGORIES.find(c => c.key === selectedCategory);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: `${currentCategoryInfo?.label} 성능 추이 (Top 제조사 기준)` },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}${yAxisTitle.includes('점') || yAxisTitle.includes('Score') ? '' : ''}`,
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: '리포트 기준 월' }
      },
      y: {
        title: { display: true, text: yAxisTitle },
        min: chartMin, 
        max: chartMax, 
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-10">
        
        {/* 🌟 [수정] Suspense로 감싸서 빌드 에러 해결 */}
        <div className="mb-4">
          <Suspense fallback={<div className="h-10 bg-gray-100 rounded animate-pulse"></div>}>
            <TrendBackButton />
          </Suspense>
        </div>

        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-6">
          📈 기간별 성능 트렌드 분석
        </h1>
        <p className="text-gray-500 mb-8">
          저장된 월별 LLM 리포트를 기반으로, 주요 모델들의 카테고리별 점수 추이를 확인합니다.
        </p>

        <div className="flex flex-wrap gap-2 mb-8 border-b pb-4">
          {LLM_TREND_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all
                ${selectedCategory === cat.key
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">Loading Chart...</div>
        ) : competitionData.length > 0 ? (
          <div className="h-[500px] w-full border border-gray-200 dark:border-zinc-800 rounded-xl p-6 bg-gray-50 dark:bg-zinc-800">
            <Line data={{ labels, datasets: competitionData }} options={chartOptions} />
          </div>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            선택된 카테고리에 대한 데이터가 부족하거나, 리포트가 아직 등록되지 않았습니다.
          </div>
        )}
      </div>
    </div>
  );
}