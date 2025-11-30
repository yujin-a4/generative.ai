"use client";

import { useState, useRef, useEffect } from "react";

interface DateRangeFilterProps {
  startDate: string | null;
  endDate: string | null;
  onChangeStart: (date: string | null) => void;
  onChangeEnd: (date: string | null) => void;
}

export default function DateRangeFilter({ 
  startDate, endDate, onChangeStart, onChangeEnd 
}: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("all");
  const customRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customRef.current && !customRef.current.contains(event.target as Node)) {
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    setShowCustom(false);
    
    const now = new Date();
    let start: Date | null = null;

    switch (preset) {
      case "1week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "3months":
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "all":
      default:
        onChangeStart(null);
        onChangeEnd(null);
        return;
    }

    onChangeStart(start.toISOString().split("T")[0]);
    onChangeEnd(now.toISOString().split("T")[0]);
  };

  const handleCustomSelect = () => {
    setActivePreset("custom");
    setShowCustom(!showCustom);
  };

  const handleCustomApply = () => {
    setShowCustom(false);
  };

  const buttonClass = (preset: string) => `
    px-3 py-1.5 text-xs font-medium rounded-full border transition-all
    ${activePreset === preset 
      ? "bg-indigo-600 text-white border-indigo-600" 
      : "bg-white dark:bg-zinc-800 text-gray-500 border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700"}
  `;

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 mr-1">📅 기간</span>
      
      <button onClick={() => handlePreset("all")} className={buttonClass("all")}>
        전체
      </button>
      <button onClick={() => handlePreset("1week")} className={buttonClass("1week")}>
        최근 1주
      </button>
      <button onClick={() => handlePreset("1month")} className={buttonClass("1month")}>
        최근 1개월
      </button>
      <button onClick={() => handlePreset("3months")} className={buttonClass("3months")}>
        최근 3개월
      </button>
      
      {/* 직접 선택 버튼 */}
      <div className="relative" ref={customRef}>
        <button onClick={handleCustomSelect} className={buttonClass("custom")}>
          직접 선택 📅
        </button>
        
        {/* 날짜 선택 드롭다운 */}
        {showCustom && (
          <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 z-50 min-w-[280px]">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작일</label>
                <input 
                  type="date" 
                  value={startDate || ""} 
                  onChange={(e) => onChangeStart(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input 
                  type="date" 
                  value={endDate || ""} 
                  onChange={(e) => onChangeEnd(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                />
              </div>
              <button 
                onClick={handleCustomApply}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                적용
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 선택된 기간 표시 */}
      {activePreset === "custom" && startDate && endDate && (
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium ml-2">
          {startDate} ~ {endDate}
        </span>
      )}
    </div>
  );
}
