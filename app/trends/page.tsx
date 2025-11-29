"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAllReports } from "@/app/actions/analyze";
import Link from "next/link";
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
import { Line } from "react-chartjs-2";

// Radar 관련 등록 제거
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const CATEGORIES = [
  "Coding & Dev", "Writing & Creation", "Math & Logic", 
  "Research & Analysis", "Chat & Conversation", "Multilingual", "Agents"
];

function TrendsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "Coding & Dev";
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  useEffect(() => {
    async function fetchData() {
      const data = await getAllReports();
      
      const monthlyDataMap = new Map();
      data.forEach((report: any) => {
        const date = new Date(report.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyDataMap.has(key) || new Date(monthlyDataMap.get(key).created_at) < date) {
          monthlyDataMap.set(key, report);
        }
      });

      const sortedMonthlyData = Array.from(monthlyDataMap.values()).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setReports(sortedMonthlyData);
      setLoading(false);
    }
    fetchData();
  }, []);

  const getCompetitionData = () => {
    const labels = reports.map((r) => {
        const d = new Date(r.created_at);
        return `${d.getFullYear()}. ${d.getMonth() + 1}`;
    });

    const getRankScore = (rank: number) => {
      return reports.map((r) => {
        const catData = r.analysis_result?.deep_analysis?.find(
          (d: any) => d.category?.includes(selectedCategory) || d.category === selectedCategory
        );
        return catData?.top_models?.[rank - 1]?.score || null;
      });
    };

    return {
      labels,
      datasets: [
        {
          label: "1위",
          data: getRankScore(1),
          borderColor: "#4F46E5", backgroundColor: "#4F46E5",
          tension: 0.3, pointRadius: 6, pointHoverRadius: 8,
        },
        {
          label: "2위",
          data: getRankScore(2),
          borderColor: "#9333EA", backgroundColor: "#9333EA",
          tension: 0.3, borderDash: [5, 5],
        },
        {
          label: "3위",
          data: getRankScore(3),
          borderColor: "#EC4899", backgroundColor: "#EC4899",
          tension: 0.3, borderDash: [2, 2],
        },
      ],
    };
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <nav className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2">
            ← 메인으로 돌아가기
          </Link>
          <div className="font-bold text-xl text-indigo-600 dark:text-indigo-400">Trend Analytics 📈</div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">기간별 AI 성능 분석</h1>
          <p className="text-gray-500 mt-2">월별 데이터 집계를 통해 AI 모델의 장기적인 발전 흐름을 추적합니다.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">분석할 데이터가 충분하지 않습니다.</p>
            <Link href="/admin" className="text-indigo-600 font-bold hover:underline">리포트 생성하러 가기</Link>
          </div>
        ) : (
          <>
            {/* 1. 경쟁 구도 그래프 (Line Chart) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg border border-gray-100 mb-8">
              <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  🏆 {selectedCategory} 경쟁 구도
                </h2>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="p-2 text-sm border rounded-lg bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="h-[400px] w-full">
                <Line 
                  data={getCompetitionData()} 
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: false } },
                    plugins: {
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                          afterLabel: (ctx: any) => {
                            const r = reports[ctx.dataIndex];
                            const catData = r.analysis_result?.deep_analysis?.find((d: any) => d.category?.includes(selectedCategory));
                            const model = catData?.top_models?.[ctx.datasetIndex]?.model;
                            return model ? ` (${model})` : "";
                          }
                        }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* 2. 월간 챔피언 히스토리 (Full Width로 변경) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                📅 월간 챔피언 히스토리
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-6 py-3">기간</th>
                      <th className="px-6 py-3">분야</th>
                      <th className="px-6 py-3">1위 모델</th>
                      <th className="px-6 py-3">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice().reverse().map((r, idx) => {
                      const catData = r.analysis_result?.deep_analysis?.find((d: any) => d.category?.includes(selectedCategory));
                      const d = new Date(r.created_at);
                      return (
                        <tr key={idx} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{d.getFullYear()}. {d.getMonth() + 1}</td>
                          <td className="px-6 py-4 text-indigo-600 text-xs font-bold">{selectedCategory}</td>
                          <td className="px-6 py-4 font-bold text-gray-800">{catData?.top_models?.[0]?.model || "-"}</td>
                          <td className="px-6 py-4 text-gray-500">{catData?.top_models?.[0]?.score || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">로딩 중...</div>}>
      <TrendsContent />
    </Suspense>
  );
}