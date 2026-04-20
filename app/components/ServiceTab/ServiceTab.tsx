"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllServices, deleteService } from "@/app/actions/serviceActions";
import ServiceCard from "./ServiceCard";
import SubmitServiceModal from "./SubmitServiceModal";
import type { AIService, ServiceCategory } from "@/types/service";
import { SERVICE_CATEGORIES } from "@/types/service";
import { auth } from "@/lib/firebase";

// 검색 유의어 사전
const SEARCH_SYNONYMS: Record<string, string[]> = {
  "gpt": ["지피티", "chatgpt", "챗지피티", "openai", "오픈ai"],
  "claude": ["클로드", "anthropic", "앤스로픽"],
  "gemini": ["제미나이", "구글", "google", "bard", "바드"],
  "midjourney": ["미드저니"],
  "stable diffusion": ["스테이블", "디퓨전"],
  "sora": ["소라"],
  "runway": ["런웨이"],
  "notion": ["노션"],
  "wrtn": ["뤼튼"],
  "perplexity": ["퍼플렉시티"],
};

export default function ServiceTab() {
  // 🛠️ [수정 1] 기본값을 "ALL"에서 "LLM"으로 변경하고 타입에서 "ALL" 제거
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>("LLM");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFree, setFilterFree] = useState(false);
  const [filterKorean, setFilterKorean] = useState(false);
  const [filterTrending, setFilterTrending] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AIService | null>(null);

  const queryClient = useQueryClient();

  const { data: allServices = [], isLoading, refetch } = useQuery<AIService[]>({
    queryKey: ["aiServices"],
    queryFn: () => getAllServices(), 
    staleTime: 0, 
  });

  // 필터링된 서비스 목록
  const filteredServices = useMemo(() => {
    let filtered = Array.isArray(allServices) ? allServices : [];

    // 🛠️ [수정 2] '전체' 로직 삭제 및 항상 선택된 카테고리로 필터링
    filtered = filtered.filter((s) => s.category === selectedCategory);

    // 2. 검색어 필터 (유의어 포함)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().replace(/\s+/g, ""); 
      let searchKeywords = [query];
      Object.entries(SEARCH_SYNONYMS).forEach(([key, synonyms]) => {
        if (query.includes(key) || synonyms.some(s => query.includes(s))) {
          searchKeywords = [...searchKeywords, key, ...synonyms];
        }
      });
      searchKeywords = Array.from(new Set(searchKeywords));

      filtered = filtered.filter((s) => {
        const name = s.name.toLowerCase().replace(/\s+/g, "");
        const desc = (s.description || "").toLowerCase().replace(/\s+/g, "");
        return searchKeywords.some(keyword => name.includes(keyword) || desc.includes(keyword));
      });
    }

    // 3. 무료만 보기
    if (filterFree) {
      filtered = filtered.filter((s) => s.pricing === "FREE");
    }

    // 4. 한국어 지원
    if (filterKorean) {
      filtered = filtered.filter((s) => s.supportsKorean || s.tags?.includes("한국어"));
    }

    // 5. 요즘 뜨는
    if (filterTrending) {
      filtered = filtered.filter((s) => (s.likes || 0) > 10 || s.isTrending);
    }

    // 6. 즐겨찾기 필터
    if (filterBookmarked) {
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        filtered = filtered.filter((s) => s.bookmarkedBy?.includes(currentUid));
      } else {
        filtered = [];
      }
    }

    return filtered;
  }, [allServices, selectedCategory, searchQuery, filterFree, filterKorean, filterTrending, filterBookmarked]);

  const handleAddClick = () => {
    if (!auth.currentUser) {
      alert("로그인이 필요한 기능입니다. \n우측 상단의 로그인 버튼을 눌러주세요! 🔒");
      return;
    }
    setEditingService(null);
    setIsModalOpen(true);
  };

  const handleEdit = (service: AIService) => {
    setEditingService(service);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    
    const result = await deleteService(id);
    if (result.success) {
      refetch();
    } else {
      alert("삭제 실패");
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleModalSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["aiServices"] });
    await refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black font-sans px-5 py-5">
      <div className="w-full">
        {/* 헤더 영역 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI 서비스</h1>
        </div>

        {/* 카테고리 필터 */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 mb-4 border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {/* 🛠️ [수정 3] '전체' 버튼 삭제됨 */}
            {Object.entries(SERVICE_CATEGORIES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as ServiceCategory)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === key
                    ? "bg-black text-white dark:bg-white dark:text-black shadow-md"
                    : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                {/* 🛠️ [수정 4] LLM인 경우 강제로 'LLM'으로 표시 (types 파일 미수정 대비) */}
                {key === "LLM" ? "LLM" : label}
              </button>
            ))}
          </div>
        </div>

        {/* 소분류 필터 및 검색창 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-1">
          {/* 좌측: 필터 버튼들 */}
          <div className="flex flex-wrap gap-2">
            {/* 즐겨찾기 버튼 */}
            <button
              onClick={() => {
                if (!auth.currentUser && !filterBookmarked) return alert("로그인이 필요합니다.");
                setFilterBookmarked(!filterBookmarked);
              }}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-1 ${
                filterBookmarked
                  ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700"
              }`}
            >
              ⭐ 즐겨찾기
            </button>

            <button
              onClick={() => setFilterFree(!filterFree)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors border ${
                filterFree
                  ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700"
              }`}
            >
              💰 무료만 보기
            </button>
            <button
              onClick={() => setFilterKorean(!filterKorean)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors border ${
                filterKorean
                  ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700"
              }`}
            >
              🇰🇷 한국어 지원
            </button>
            <button
              onClick={() => setFilterTrending(!filterTrending)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors border ${
                filterTrending
                  ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                  : "bg-white text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700"
              }`}
            >
              🔥 요즘 뜨는
            </button>
          </div>

          {/* 우측: 검색창 + 추가 버튼 */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                placeholder="서비스 검색 (예: 지피티, 클로드)"
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-full focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </span>
            </div>
            <button
              onClick={handleAddClick}
              className="flex-shrink-0 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-md hover:shadow-xl transition-all flex items-center gap-1.5 text-sm whitespace-nowrap"
            >
              + 추가
            </button>
          </div>
        </div>

        {/* 서비스 목록 */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
          </div>
        ) : filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">검색 결과가 없습니다.</p>
            <p className="text-sm text-gray-400">
              {filterBookmarked ? "즐겨찾기한 서비스가 없습니다." : "필터 조건을 변경해보세요."}
            </p>
          </div>
        )}

        <SubmitServiceModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          initialData={editingService}
          onSuccess={handleModalSuccess}
        />
      </div>
    </div>
  );
}