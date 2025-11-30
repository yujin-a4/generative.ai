"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function TrendBackButton() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "LLM"; 

  // 카테고리(searchKey)를 ID(소문자)로 변환
  // 예: "LLM" -> "llm", "Image" -> "image"
  const targetSubTab = category.toLowerCase();

  return (
    <Link
      href={`/?tab=reports&sub=${targetSubTab}`}
      className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm"
    >
      <span>←</span>
      <span>돌아가기</span>
    </Link>
  );
}