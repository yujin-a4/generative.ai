"use client";

import { useState } from "react";
import { updateWeeklySummary } from "@/app/lib/newsService";

interface WeeklySummaryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: any;
  onRefresh: () => void;
}

export default function WeeklySummaryEditModal({ isOpen, onClose, summaryData, onRefresh }: WeeklySummaryEditModalProps) {
  const [data, setData] = useState(summaryData);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleTrendChange = (index: number, field: string, value: string) => {
    const newTrends = [...data.trends];
    newTrends[index] = { ...newTrends[index], [field]: value };
    setData({ ...data, trends: newTrends });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateWeeklySummary(data.id, {
        summary: data.summary,
        trends: data.trends,
        // Top Picks 등 다른 필드도 필요하면 추가 가능
      });
      alert("리포트가 수정되었습니다.");
      onRefresh();
      onClose();
    } catch (error) {
      alert("저장 실패");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">📝 주간 리포트 수정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {/* 메인 헤드라인 수정 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">메인 헤드라인 (요약)</label>
            <input 
              value={data.summary}
              onChange={(e) => setData({...data, summary: e.target.value})}
              className="w-full mt-1 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl font-bold text-lg border border-transparent focus:border-indigo-500 outline-none"
            />
          </div>

          {/* 트렌드 키워드 수정 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">핵심 트렌드 3가지</label>
            <div className="space-y-4">
              {data.trends?.map((trend: any, i: number) => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{i+1}</span>
                    <input 
                      value={trend.keyword}
                      onChange={(e) => handleTrendChange(i, 'keyword', e.target.value)}
                      className="flex-1 bg-transparent font-bold border-b border-gray-300 dark:border-zinc-600 focus:border-indigo-500 outline-none px-1"
                      placeholder="키워드"
                    />
                  </div>
                  <textarea 
                    value={trend.desc}
                    onChange={(e) => handleTrendChange(i, 'desc', e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-600 dark:text-gray-300 border-none p-1 resize-none focus:ring-0"
                    rows={2}
                    placeholder="설명"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-zinc-800">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            {isSaving ? "저장 중..." : "수정 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}