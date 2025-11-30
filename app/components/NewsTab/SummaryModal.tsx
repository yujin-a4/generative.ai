"use client";

import { useState, useEffect } from "react";
import { 
  getWeeklySummaryByWeek, 
  getMonthlySummaryByMonth,
  updateWeeklySummary,
  updateMonthlySummary,
  publishWeeklySummary,
  publishMonthlySummary,
  deleteWeeklySummary,
  deleteMonthlySummary
} from "@/app/lib/newsService";
import { generateWeeklySummary } from "@/app/actions/generateWeeklySummary";
import { generateMonthlySummary } from "@/app/actions/generateMonthlySummary";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "weekly" | "monthly";
  weekLabel?: string;
  year?: number;
  month?: number;
}

export default function SummaryModal({ 
  isOpen, onClose, type, weekLabel, year, month 
}: SummaryModalProps) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // 관리자 체크
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === "yujinkang1008@gmail.com");
    });
    return () => unsubscribe();
  }, []);

  // 데이터 불러오기
  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchSummary() {
      setLoading(true);
      setSummary(null);
      
      // 관리자는 비공개 포함, 일반 사용자는 공개된 것만
      if (type === "weekly" && weekLabel) {
        const data = await getWeeklySummaryByWeek(weekLabel, isAdmin);
        setSummary(data);
      } else if (type === "monthly" && year && month) {
        const data = await getMonthlySummaryByMonth(year, month, isAdmin);
        setSummary(data);
      }
      
      setLoading(false);
    }
    
    fetchSummary();
  }, [isOpen, type, weekLabel, year, month, isAdmin]);

  // 요약 생성 (관리자만)
  const handleGenerate = async () => {
    if (!isAdmin) return;
    
    const confirmMsg = type === "weekly" 
      ? `${weekLabel} 주간 리포트를 생성하시겠습니까?`
      : `${year}년 ${month}월 월간 리포트를 생성하시겠습니까?`;
    
    if (!confirm(confirmMsg)) return;

    setGenerating(true);
    
    let res;
    if (type === "weekly") {
      res = await generateWeeklySummary();
    } else if (year && month) {
      res = await generateMonthlySummary(year, month);
    }

    setGenerating(false);

    if (res?.success) {
      alert("리포트가 생성되었습니다! 📊\n확인 후 '공개하기' 버튼을 눌러주세요.");
      // 다시 불러오기
      if (type === "weekly" && weekLabel) {
        const data = await getWeeklySummaryByWeek(weekLabel, true);
        setSummary(data);
      } else if (year && month) {
        const data = await getMonthlySummaryByMonth(year, month, true);
        setSummary(data);
      }
    } else {
      alert("실패: " + res?.error);
    }
  };

  // 공개하기 (관리자만)
  const handlePublish = async () => {
    if (!isAdmin || !summary?.id) return;
    
    if (!confirm("이 리포트를 공개하시겠습니까?\n공개 후 모든 사용자가 볼 수 있습니다.")) return;

    try {
      if (type === "weekly") {
        await publishWeeklySummary(summary.id);
      } else {
        await publishMonthlySummary(summary.id);
      }
      
      setSummary({ ...summary, isPublished: true });
      alert("리포트가 공개되었습니다! ✅");
    } catch (error) {
      alert("공개 실패");
    }
  };

  // 삭제하기 (관리자만)
  const handleDelete = async () => {
    if (!isAdmin || !summary?.id) return;
    
    if (!confirm("정말 이 리포트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

    try {
      if (type === "weekly") {
        await deleteWeeklySummary(summary.id);
      } else {
        await deleteMonthlySummary(summary.id);
      }
      
      alert("리포트가 삭제되었습니다.");
      setSummary(null);
      onClose();
    } catch (error) {
      alert("삭제 실패");
    }
  };

  // 수정 모드 진입
  const handleEditStart = () => {
    setEditData({ ...summary });
    setIsEditing(true);
  };

  // 수정 저장
  const handleEditSave = async () => {
    if (!editData?.id) return;
    
    try {
      if (type === "weekly") {
        await updateWeeklySummary(editData.id, {
          summary: editData.summary,
          trends: editData.trends,
          top_picks: editData.top_picks,
        });
      } else {
        await updateMonthlySummary(editData.id, {
          summary: editData.summary,
          trends: editData.trends,
          top_picks: editData.top_picks,
          category_highlights: editData.category_highlights,
        });
      }
      
      setSummary(editData);
      setIsEditing(false);
      alert("수정되었습니다!");
    } catch (error) {
      alert("수정 실패");
    }
  };

  // 트렌드 수정
  const handleTrendChange = (index: number, field: string, value: string) => {
    const newTrends = [...editData.trends];
    newTrends[index] = { ...newTrends[index], [field]: value };
    setEditData({ ...editData, trends: newTrends });
  };

  if (!isOpen) return null;

  const title = type === "weekly" ? `📊 ${weekLabel} 주간 리포트` : `📊 ${year}년 ${month}월 월간 리포트`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
            {/* 공개/비공개 뱃지 */}
            {summary && isAdmin && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                summary.isPublished 
                  ? "bg-green-100 text-green-700" 
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {summary.isPublished ? "공개" : "비공개"}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-500">로딩 중... ⏳</div>
          ) : !summary ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin ? "아직 생성된 리포트가 없습니다." : "아직 공개된 리포트가 없습니다."}
              </p>
              {isAdmin && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {generating ? "분석 중..." : "✨ 리포트 생성하기"}
                </button>
              )}
            </div>
          ) : isEditing ? (
            /* 수정 모드 */
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">메인 헤드라인</label>
                <input 
                  value={editData.summary}
                  onChange={(e) => setEditData({...editData, summary: e.target.value})}
                  className="w-full mt-1 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl font-bold text-lg border border-transparent focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">핵심 트렌드</label>
                <div className="space-y-3">
                  {editData.trends?.map((trend: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                      <input 
                        value={trend.keyword}
                        onChange={(e) => handleTrendChange(i, 'keyword', e.target.value)}
                        className="w-full bg-transparent font-bold border-b border-gray-300 dark:border-zinc-600 focus:border-indigo-500 outline-none px-1 mb-2"
                        placeholder="키워드"
                      />
                      <textarea 
                        value={trend.desc}
                        onChange={(e) => handleTrendChange(i, 'desc', e.target.value)}
                        className="w-full bg-transparent text-sm text-gray-600 dark:text-gray-300 border-none p-1 resize-none"
                        rows={2}
                        placeholder="설명"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleEditSave}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
                >
                  저장
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            /* 보기 모드 */
            <div className="space-y-6">
              {/* 헤드라인 */}
              <div className="text-center pb-4 border-b border-gray-100 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {summary.summary}
                </h2>
              </div>

              {/* 트렌드 */}
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">🔥 핵심 트렌드</h4>
                <ul className="space-y-3">
                  {summary.trends?.map((trend: any, i: number) => (
                    <li key={i} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
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
              {summary.top_picks && (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">🏆 Editor's Pick</h4>
                  <div className="space-y-2">
                    {summary.top_picks?.map((pick: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
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
              )}

              {/* 월간 전용: 카테고리별 하이라이트 */}
              {type === "monthly" && summary.category_highlights && (
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">📂 카테고리별 동향</h4>
                  <div className="space-y-2">
                    {summary.category_highlights?.map((item: any, i: number) => (
                      <div key={i} className="p-3 bg-blue-50 dark:bg-zinc-800 rounded-xl">
                        <div className="font-bold text-blue-700 dark:text-blue-400 text-sm mb-1">
                          {item.category}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {item.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 관리자 버튼들 */}
              {isAdmin && (
                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                  {/* 공개하기 버튼 (비공개 상태일 때만) */}
                  {!summary.isPublished && (
                    <button
                      onClick={handlePublish}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm"
                    >
                      ✅ 공개하기
                    </button>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleEditStart}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm"
                    >
                      ✏️ 수정
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex-1 py-2.5 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-sm disabled:opacity-50"
                    >
                      {generating ? "생성 중..." : "🔄 다시 생성"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-bold text-sm"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
