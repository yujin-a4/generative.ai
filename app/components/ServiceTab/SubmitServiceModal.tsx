"use client";

import { useState, useEffect } from "react";
import { AIService, SERVICE_CATEGORIES, ServiceCategory } from "@/types/service";
import { analyzeService, createService, updateService } from "@/app/actions/serviceActions";

interface SubmitServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: AIService | null;
  onSuccess: () => void;
}

export default function SubmitServiceModal({ isOpen, onClose, initialData, onSuccess }: SubmitServiceModalProps) {
  const [formData, setFormData] = useState<Partial<AIService>>({
    name: "",
    url: "",
    category: "LLM",
    description: "",
    pricing: "PAID",
    supportsKorean: false,
    isTrending: false,
    tags: []
  });
  
  // 🌟 [추가] 태그 입력을 위한 로컬 상태
  const [tagInput, setTagInput] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 모달이 열릴 때 초기 데이터 설정
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...initialData,
          pricing: initialData.pricing || "PAID",
          tags: initialData.tags || [] // 기존 태그 불러오기
        });
      } else {
        setFormData({
          name: "",
          url: "",
          category: "LLM",
          description: "",
          pricing: "PAID",
          supportsKorean: false,
          isTrending: false,
          tags: []
        });
      }
      setTagInput(""); // 입력창 초기화
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // 🌟 [추가] 태그 입력 핸들러 (엔터키)
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      // 중복 방지 및 빈 값 체크
      if (val && !formData.tags?.includes(val)) {
        setFormData(prev => ({
          ...prev,
          tags: [...(prev.tags || []), val]
        }));
        setTagInput("");
      }
    }
  };

  // 🌟 [추가] 태그 삭제 핸들러
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  // AI 분석 핸들러
  const handleAnalyze = async () => {
    if (!formData.url) return alert("URL을 입력해주세요!");
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeService(formData.url);
      if (result.success && result.data) {
        const data = result.data;
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          category: (data.category as ServiceCategory) || "OTHER",
          description: data.description || prev.description,
          pricing: data.pricing || "PAID",
          supportsKorean: data.supportsKorean ?? false,
          isTrending: data.isTrending ?? false,
          // AI가 제안한 태그를 기존 태그와 합치거나 덮어쓰기
          tags: data.tags || [] 
        }));
        alert("AI 분석 완료! ✨ 태그 등 내용을 수정할 수 있습니다.");
      } else {
        alert("분석에 실패했습니다: " + (result.error || "알 수 없는 오류"));
      }
    } catch (e) {
      console.error(e);
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url || !formData.description) {
      return alert("필수 정보를 모두 입력해주세요.");
    }

    setIsLoading(true);
    try {
      if (initialData && initialData.id) {
        await updateService(initialData.id, formData);
        alert("수정되었습니다.");
      } else {
        await createService(formData as AIService);
        alert("등록되었습니다.");
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("저장 실패");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initialData ? "서비스 수정" : "서비스 등록"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        {/* 폼 영역 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          
          {/* URL & 분석 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
              서비스 URL <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://example.com"
                className="flex-1 border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !formData.url}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {isAnalyzing ? "분석 중..." : "🤖 AI 분석"}
              </button>
            </div>
          </div>

          {/* 서비스명 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">서비스명 *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">카테고리 *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {Object.entries(SERVICE_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">한 줄 설명 *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* 🌟 [수정] 해시태그 입력 영역 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">해시태그 (특징)</label>
            <div className="border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500">
              {/* 태그 리스트 */}
              {formData.tags?.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1.5 hover:text-indigo-900 dark:hover:text-white focus:outline-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              {/* 입력창 */}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={formData.tags?.length === 0 ? "태그 입력 후 엔터 (예: 무료, 이미지생성)" : ""}
                className="flex-1 bg-transparent outline-none text-sm min-w-[120px] dark:text-white placeholder-gray-400"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">엔터키를 눌러 태그를 추가할 수 있습니다.</p>
          </div>

          {/* 가격 정보 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">가격 정보</label>
            <div className="flex gap-4">
              {["FREE", "PAID", "FREEMIUM"].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pricing"
                    value={type}
                    checked={formData.pricing === type}
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {type === "FREE" ? "무료" : type === "PAID" ? "유료" : "부분유료"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 옵션 체크박스 */}
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="supportsKorean"
                checked={formData.supportsKorean}
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">🇰🇷 한국어 지원</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isTrending"
                checked={formData.isTrending}
                onChange={handleChange}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">🔥 요즘 뜨는</span>
            </label>
          </div>

        </form>

        {/* 하단 버튼 */}
        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "저장 중..." : (initialData ? "수정 완료" : "등록하기")}
          </button>
        </div>
      </div>
    </div>
  );
}