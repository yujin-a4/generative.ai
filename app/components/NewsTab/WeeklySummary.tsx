"use client";

import { useState, useEffect } from "react";
import { generateWeeklySummary } from "@/app/actions/generateWeeklySummary";
import { getWeeklySummaries } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth"; // Auth 리스너 추가
import WeeklySummaryEditModal from "./WeeklySummaryEditModal"; // 모달 추가

export default function WeeklySummary() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // 관리자 여부 및 수정 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  // 데이터 불러오기
  const fetchData = async () => {
    setLoading(true);
    const data = await getWeeklySummaries();
    setSummaries(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    // 관리자 체크 (이메일 하드코딩)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === "yujinkang1008@gmail.com") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 리포트 생성 핸들러 (관리자만)
  const handleGenerate = async () => {
    if (!isAdmin) return alert("관리자만 생성할 수 있습니다.");
    if (!confirm("지난 7일간의 뉴스를 분석해 리포트를 생성하시겠습니까?")) return;

    setGenerating(true);
    const res = await generateWeeklySummary();
    setGenerating(false);

    if (res.success) {
      alert("주간 리포트가 생성되었습니다! 📉");
      fetchData(); 
    } else {
      alert("실패: " + res.error);
    }
  };

  if (loading) return <div className="text-center py-20">로딩 중... ⏳</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* 관리자 전용 생성 패널 */}
      {isAdmin && (
        <div className="flex justify-between items-center bg-indigo-50 dark:bg-zinc-800 p-6 rounded-2xl border border-indigo-100 dark:border-zinc-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">📉 주간 AI 트렌드 리포트 (관리자)</h3>
            <p className="text-sm text-gray-500">생성 버튼은 관리자(yujin...)에게만 보입니다.</p>
          </div>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
          >
            {generating ? "분석 중..." : "✨ 새 리포트 생성"}
          </button>
        </div>
      )}

      {/* 리포트 목록 */}
      {summaries.length === 0 ? (
        <div className="text-center py-20 text-gray-500">아직 생성된 주간 리포트가 없습니다.</div>
      ) : (
        summaries.map((summary) => (
          <div key={summary.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden relative group">
            
            {/* 🌟 관리자용 수정 버튼 (우측 상단) */}
            {isAdmin && (
              <button 
                onClick={() => setEditTarget(summary)}
                className="absolute top-4 right-4 px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-600 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                ✏️ 수정
              </button>
            )}

            <div className="bg-gray-50 dark:bg-zinc-800/50 p-6 border-b border-gray-100 dark:border-zinc-800">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold mb-2">
                {summary.week_label}
              </span>
              {/* 제목 (이제 헤드라인처럼 짧게 나옴) */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                {summary.summary}
              </h2>
            </div>
            
            <div className="p-8 grid md:grid-cols-2 gap-8">
              {/* 트렌드 키워드 */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">🔥 핵심 트렌드</h4>
                <ul className="space-y-4">
                  {summary.trends?.map((trend: any, i: number) => (
                    <li key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{trend.keyword}</div>
                        <div className="text-sm text-gray-500">{trend.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top Picks */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">🏆 Editor's Pick</h4>
                <div className="space-y-3">
                  {summary.top_picks?.map((pick: any, i: number) => (
                    <div key={i} className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                      <div className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">
                        {pick.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        "{pick.reason}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* 수정 모달 */}
      {isAdmin && editTarget && (
        <WeeklySummaryEditModal 
          isOpen={!!editTarget}
          summaryData={editTarget}
          onClose={() => setEditTarget(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}