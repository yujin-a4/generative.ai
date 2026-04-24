"use client";

import { useState, useEffect } from "react";
import { AIService, SERVICE_CATEGORIES, ServiceCategory } from "@/types/service";
import { analyzeService, createService, updateService } from "@/app/actions/serviceActions";
import { auth } from "@/lib/firebase";

interface SubmitServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: AIService | null;
  onSuccess: () => void;
}

// step: 'form' = 일반 폼 (등록/수정), 'preview' = AI 분석 프리뷰
type ModalStep = 'form' | 'preview';

export default function SubmitServiceModal({ isOpen, onClose, initialData, onSuccess }: SubmitServiceModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
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
  const [tagInput, setTagInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<Partial<AIService> | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData, pricing: initialData.pricing || "PAID", tags: initialData.tags || [] });
        setStep('form');
      } else {
        setFormData({ name: "", url: "", category: "LLM", description: "", pricing: "PAID", supportsKorean: false, isTrending: false, tags: [] });
        setStep('form');
      }
      setTagInput("");
      setPreviewData(null);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !formData.tags?.includes(val)) {
        setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), val] }));
        setTagInput("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags?.filter(tag => tag !== tagToRemove) || [] }));
  };

  // AI 분석 → 프리뷰 단계로 이동
  const handleAnalyze = async () => {
    if (!formData.url) return alert("URL을 입력해주세요!");

    setIsAnalyzing(true);
    try {
      const result = await analyzeService(formData.url);
      if (result.success && result.data) {
        const data = result.data;
        const analyzed: Partial<AIService> = {
          ...formData,
          name: data.name || formData.name,
          category: (data.category as ServiceCategory) || "OTHER",
          description: data.description || formData.description,
          longDescription: data.longDescription || "",
          features: data.features || [],
          pros: data.pros || [],
          cons: data.cons || [],
          targetUser: data.targetUser || [],
          pricing: data.pricing || "PAID",
          supportsKorean: data.supportsKorean ?? false,
          isTrending: data.isTrending ?? false,
          tags: data.tags || [],
        };
        setPreviewData(analyzed);
        setStep('preview');
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

  const handleGoToEdit = () => {
    if (previewData) setFormData(previewData);
    setStep('form');
  };

  const handleSubmit = async (dataToSubmit?: Partial<AIService>) => {
    const data = dataToSubmit || formData;
    if (!data.name || !data.url || !data.description) {
      return alert("필수 정보(서비스명, URL, 설명)를 모두 입력해주세요.");
    }

    setIsLoading(true);
    const user = auth.currentUser;

    try {
      if (initialData && initialData.id) {
        await updateService(initialData.id, data);
      } else {
        await createService({ ...data, authorId: user?.uid } as AIService);
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

  // ── 프리뷰 단계 UI ──
  if (step === 'preview' && previewData) {
    const pricingLabel = { FREE: "무료", PAID: "유료", FREEMIUM: "부분유료" }[previewData.pricing || "PAID"] || "유료";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

          <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-zinc-800">
            <div>
              <p className="text-xs text-indigo-500 font-bold mb-0.5">✨ AI 분석 완료 — 미리보기</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">게시 전 확인</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
          </div>

          <div className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-4">

            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {SERVICE_CATEGORIES[previewData.category as ServiceCategory] || previewData.category}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 rounded-full border border-gray-200 dark:border-zinc-700">
                  {pricingLabel}
                </span>
                {previewData.supportsKorean && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">🇰🇷 한국어</span>
                )}
                {previewData.isTrending && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-full border border-red-100 dark:border-red-800">🔥 요즘 뜨는</span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{previewData.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{previewData.description}</p>
            </div>

            {previewData.longDescription && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{previewData.longDescription}</p>
              </div>
            )}

            {previewData.features && previewData.features.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">⚡ 주요 기능</p>
                <div className="grid grid-cols-2 gap-2">
                  {previewData.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/15 rounded-lg px-3 py-2">
                      <span className="text-indigo-500 text-xs font-black">✓</span>
                      <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {((previewData.pros?.length || 0) > 0 || (previewData.cons?.length || 0) > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {(previewData.pros?.length || 0) > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 border border-green-100 dark:border-green-900/30">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1.5">👍 장점</p>
                    <ul className="space-y-1">
                      {previewData.pros!.map((p, i) => <li key={i} className="text-xs text-green-800 dark:text-green-300 flex gap-1.5"><span>•</span>{p}</li>)}
                    </ul>
                  </div>
                )}
                {(previewData.cons?.length || 0) > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/30">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1.5">👎 단점</p>
                    <ul className="space-y-1">
                      {previewData.cons!.map((c, i) => <li key={i} className="text-xs text-red-800 dark:text-red-300 flex gap-1.5"><span>•</span>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {previewData.targetUser && previewData.targetUser.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">👤 추천 대상</p>
                <div className="flex flex-wrap gap-2">
                  {previewData.targetUser.map((u, i) => (
                    <span key={i} className="text-xs font-medium px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 rounded-full border border-purple-100 dark:border-purple-800">{u}</span>
                  ))}
                </div>
              </div>
            )}

            {previewData.tags && previewData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {previewData.tags.map((tag, i) => (
                  <span key={i} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
            <button
              onClick={handleGoToEdit}
              className="flex-1 py-3 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm"
            >
              ✎ 직접 수정
            </button>
            <button
              onClick={() => handleSubmit(previewData)}
              disabled={isLoading}
              className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isLoading ? "저장 중..." : initialData ? "✅ 정보 업데이트" : "🚀 바로 게시"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 폼 편집 단계 UI ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initialData ? "서비스 수정" : "서비스 등록"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-6 overflow-y-auto custom-scrollbar space-y-5">

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
                  {isAnalyzing ? (
                    <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />분석 중...</>
                  ) : initialData ? "🤖 AI 재분석" : "🤖 AI 분석"}
                </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {initialData
                ? "AI 재분석으로 장단점·주요 기능 등 상세 정보를 자동으로 보강할 수 있어요."
                : "URL 입력 후 AI 분석 버튼을 누르면 자동으로 내용이 채워져요."
              }
            </p>
          </div>

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

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">해시태그 (특징)</label>
            <div className="border border-gray-300 dark:border-zinc-700 rounded-lg p-2.5 bg-gray-50 dark:bg-zinc-800 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500">
              {formData.tags?.map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 hover:text-indigo-900 dark:hover:text-white focus:outline-none">×</button>
                </span>
              ))}
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

        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => handleSubmit()}
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