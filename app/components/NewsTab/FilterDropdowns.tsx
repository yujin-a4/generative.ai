"use client";

import { useState, useRef, useEffect } from "react";

// =====================
// 카테고리 드롭다운
// =====================
interface CategoryDropdownProps {
  selected: string;
  onSelect: (category: string) => void;
}

const CATEGORIES = [
  { id: "ALL", label: "전체", icon: "📋" },
  { id: "에듀테크 x AI", label: "에듀테크 x AI", icon: "🎓" },
  { id: "AI 기술", label: "AI 기술", icon: "🤖" },
  { id: "AI 서비스/플랫폼", label: "AI 서비스/플랫폼", icon: "🛠️" },
  { id: "업계 동향", label: "업계 동향", icon: "📊" },
  { id: "기업/투자", label: "기업/투자", icon: "💼" },
  { id: "정책/규제", label: "정책/규제", icon: "📜" },
  { id: "연구/논문", label: "연구/논문", icon: "📚" },
  { id: "신제품 출시", label: "신제품 출시", icon: "🚀" },
];

export function CategoryDropdown({ selected, onSelect }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedItem = CATEGORIES.find(c => c.id === selected) || CATEGORIES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <span>{selectedItem.icon}</span>
        <span className="hidden sm:inline">{selectedItem.label}</span>
        <span className="sm:hidden">{selected === "ALL" ? "전체" : selectedItem.icon}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 z-50 py-1 max-h-64 overflow-y-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { onSelect(cat.id); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors
                ${selected === cat.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-700 dark:text-gray-200"}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================
// 기간 드롭다운
// =====================
interface DateDropdownProps {
  startDate: string | null;
  endDate: string | null;
  onChangeStart: (date: string | null) => void;
  onChangeEnd: (date: string | null) => void;
}

const DATE_PRESETS = [
  { id: "all", label: "전체 기간" },
  { id: "1week", label: "최근 1주" },
  { id: "1month", label: "최근 1개월" },
  { id: "3months", label: "최근 3개월" },
  { id: "custom", label: "직접 선택" },
];

export function DateDropdown({ startDate, endDate, onChangeStart, onChangeEnd }: DateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState("all");
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    
    setShowCustom(false);
    setIsOpen(false);
    
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

  const handleCustomApply = () => {
    setIsOpen(false);
    setShowCustom(false);
  };

  const getLabel = () => {
    if (activePreset === "custom" && startDate && endDate) {
      return `${startDate} ~ ${endDate}`;
    }
    return DATE_PRESETS.find(p => p.id === activePreset)?.label || "전체 기간";
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <span>📅</span>
        <span className="hidden sm:inline">{getLabel()}</span>
        <span className="sm:hidden">기간</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 z-50 py-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors
                ${activePreset === preset.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-700 dark:text-gray-200"}`}
            >
              {preset.label}
            </button>
          ))}
          
          {showCustom && (
            <div className="p-3 border-t border-gray-200 dark:border-zinc-700 mt-1">
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">시작일</label>
                  <input 
                    type="date" 
                    value={startDate || ""} 
                    onChange={(e) => onChangeStart(e.target.value || null)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">종료일</label>
                  <input 
                    type="date" 
                    value={endDate || ""} 
                    onChange={(e) => onChangeEnd(e.target.value || null)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button 
                  onClick={handleCustomApply}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================
// 정렬 드롭다운
// =====================
interface SortDropdownProps {
  selected: "latest" | "likes";
  onSelect: (sort: "latest" | "likes") => void;
}

export function SortDropdown({ selected, onSelect }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { id: "latest" as const, label: "최신순", icon: "🕒" },
    { id: "likes" as const, label: "좋아요순", icon: "🔥" },
  ];

  const selectedItem = options.find(o => o.id === selected) || options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <span>{selectedItem.icon}</span>
        <span>{selectedItem.label}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onSelect(opt.id); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors
                ${selected === opt.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-700 dark:text-gray-200"}`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
