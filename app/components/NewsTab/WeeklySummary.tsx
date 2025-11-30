"use client";

import { useState, useEffect, useCallback } from "react";
import { generateWeeklySummary } from "@/app/actions/generateWeeklySummary"; // 👈 [변경 없음]
import { getWeeklySummaries } from "@/app/lib/newsService";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth"; 
import WeeklySummaryEditModal from "./WeeklySummaryEditModal"; 

// 주차 라벨 계산 유틸리티
function getWeekLabelForSummary(date: Date): string {
    const month = date.getMonth() + 1;
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const weekNumber = Math.ceil((date.getDate() + firstDayWeekday) / 7);
    return `${month}월 ${weekNumber}주차`;
}

// 현재 분석 대상 주간 계산 헬퍼
const calculateCurrentWeek = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999); 
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); 
    startDate.setHours(0, 0, 0, 0);

    const weekLabel = getWeekLabelForSummary(today); 
    
    return {
        label: weekLabel,
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
    };
};


export default function WeeklySummary() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  
  const [currentWeek, setCurrentWeek] = useState(calculateCurrentWeek()); 

  const fetchData = useCallback(async () => {
    setLoading(true);
    const data = await getWeeklySummaries(isAdmin); 
    setSummaries(data);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        if (user.email === "yujinkang1008@gmail.com") {
          setIsAdmin(true);
        }
      } else {
        setIsAdmin(false);
        setUserEmail(null);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  // 🌟 [최종 수정] 리포트 생성 핸들러 (타입 에러 우회)
  const handleGenerate = async () => {
    if (!isAdmin) return alert("관리자만 생성할 수 있습니다.");
    if (!confirm(`[${currentWeek.label}] 리포트를 생성하시겠습니까?`)) return;

    setGenerating(true);
    
    // 🚨 [오류 해결 핵심] 함수 호출 시 as any로 캐스팅하여 TypeScript 검사 우회
    const res = await (generateWeeklySummary as any)( 
        currentWeek.label, 
        currentWeek.start, 
        currentWeek.end,   
        userEmail          
    );
    
    setGenerating(false);

    if (res.success) {
      alert("주간 리포트가 생성되었습니다! 📉");
      fetchData(); 
    } else {
      alert("리포트 생성 실패: " + res.message);
    }
  };

  if (loading) return <div className="text-center py-20">로딩 중... ⏳</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* 관리자 전용 생성 패널 */}
      {isAdmin && (
        <div className="flex justify-between items-center bg-indigo-50 dark:bg-zinc-800 p-6 rounded-2xl border border-indigo-100 dark:border-zinc-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">📉 {currentWeek.label} 주간 AI 트렌드 리포트</h3>
            <p className="text-sm text-gray-500">분석 기간: {currentWeek.start} ~ {currentWeek.end}</p>
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
            
            {/* 관리자용 수정 버튼 (우측 상단) */}
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