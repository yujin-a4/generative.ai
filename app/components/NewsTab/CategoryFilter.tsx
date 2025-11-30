"use client";

import { useRef, useState, MouseEvent } from "react";
import { NEWS_CATEGORIES } from "@/app/lib/newsCategories";

interface CategoryFilterProps {
  selectedCategory: string;
  onSelect: (category: string) => void;
}

export default function CategoryFilter({ selectedCategory, onSelect }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // 드래그 시작
  const handleMouseDown = (e: MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  // 드래그 중단 (마우스 뗌/영역 벗어남)
  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // 드래그 이동 중
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // 스크롤 속도 조절 (2배)
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div 
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseUpOrLeave}
      onMouseUp={handleMouseUpOrLeave}
      onMouseMove={handleMouseMove}
      className="flex overflow-x-auto pb-2 mb-6 gap-2 cursor-grab active:cursor-grabbing select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {/* 전체보기 버튼 */}
      <button
        onClick={() => onSelect("ALL")}
        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex-shrink-0 ${
          selectedCategory === "ALL"
            ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900"
            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700"
        }`}
      >
        전체
      </button>

      {/* 카테고리 버튼들 */}
      {Object.values(NEWS_CATEGORIES).map((cat) => (
        <button
          key={cat.id}
          onClick={() => {
            // 드래그 중이 아닐 때만 클릭 이벤트 발생 (오작동 방지)
            if (!isDragging) onSelect(cat.id);
          }}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 flex-shrink-0 ${
            selectedCategory === cat.id
              ? `${cat.color} bg-opacity-100 border-transparent shadow-sm`
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700"
          }`}
        >
          <span>{cat.icon}</span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}