"use client";

import { useState, useEffect } from "react";
import { AIService, SERVICE_CATEGORIES, ServiceCategory } from "@/types/service";
import { analyzeService, createService, updateService } from "@/app/actions/serviceActions";
import { auth } from "@/lib/firebase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: AIService | null;
  onSuccess: () => void;
}

type ModalStep = "url" | "preview";

export default function SubmitServiceModal({ isOpen, onClose, initialData, onSuccess }: Props) {
  const [step, setStep] = useState<ModalStep>("url");
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Partial<AIService> | null>(null);

  // 인라인 편집용 상태
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLongDesc, setEditLongDesc] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [editPros, setEditPros] = useState("");
  const [editCons, setEditCons] = useState("");
  const [editTargetUser, setEditTargetUser] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editPricing, setEditPricing] = useState<"FREE" | "PAID" | "FREEMIUM">("PAID");
  const [editSupportsKorean, setEditSupportsKorean] = useState(false);
  const [editIsTrending, setEditIsTrending] = useState(false);
  const [editCategory, setEditCategory] = useState<ServiceCategory>("LLM");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // 수정 모드: 바로 프리뷰에서 수정 가능하게
        setData(initialData);
        setStep("preview");
        setIsEditing(false);
        setUrl(initialData.url || "");
      } else {
        // 신규 등록: URL 입력부터
        setData(null);
        setStep("url");
        setUrl("");
        setIsEditing(false);
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 수정 모드 시작: 현재 data를 편집 상태로 복사
  const startEditing = () => {
    if (!data) return;
    setEditName(data.name || "");
    setEditDesc(data.description || "");
    setEditLongDesc(data.longDescription || "");
    setEditFeatures((data.features || []).join("\n"));
    setEditPros((data.pros || []).join("\n"));
    setEditCons((data.cons || []).join("\n"));
    setEditTargetUser((data.targetUser || []).join(", "));
    setEditTags((data.tags || []).join(", "));
    setEditPricing(data.pricing || "PAID");
    setEditSupportsKorean(data.supportsKorean || false);
    setEditIsTrending(data.isTrending || false);
    setEditCategory((data.category as ServiceCategory) || "LLM");
    setIsEditing(true);
  };

  // 수정 완료: 편집 상태를 data로 저장
  const saveEdits = () => {
    const updated: Partial<AIService> = {
      ...data,
      name: editName,
      description: editDesc,
      longDescription: editLongDesc,
      features: editFeatures.split("\n").map(s => s.trim()).filter(Boolean),
      pros: editPros.split("\n").map(s => s.trim()).filter(Boolean),
      cons: editCons.split("\n").map(s => s.trim()).filter(Boolean),
      targetUser: editTargetUser.split(",").map(s => s.trim()).filter(Boolean),
      tags: editTags.split(",").map(s => s.trim()).filter(Boolean),
      pricing: editPricing,
      supportsKorean: editSupportsKorean,
      isTrending: editIsTrending,
      category: editCategory,
    };
    setData(updated);
    setIsEditing(false);
  };

  // URL 유효성 검사
  const validateUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        alert("http:// 또는 https://로 시작하는 URL을 입력해주세요.");
        return false;
      }
      return true;
    } catch {
      alert("올바른 URL 형식이 아닙니다.\n예시: https://claude.ai");
      return false;
    }
  };

  // AI 분석 실행
  const handleAnalyze = async () => {
    if (!url.trim()) return alert("URL을 입력해주세요!");
    if (!validateUrl(url.trim())) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeService(url.trim());
      if (result.success && result.data) {
        setData({ ...result.data, url: url.trim() });
        setStep("preview");
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

  // 재분석 (수정 모드에서)
  const handleReanalyze = async () => {
    const targetUrl = data?.url || url;
    if (!targetUrl || !validateUrl(targetUrl)) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeService(targetUrl);
      if (result.success && result.data) {
        setData({ ...result.data, url: targetUrl });
        setIsEditing(false);
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

  // 게시/저장
  const handleSubmit = async () => {
    if (!data?.name || !data?.url || !data?.description) {
      return alert("필수 정보(서비스명, URL, 설명)가 부족합니다.\n수정하기를 눌러 내용을 확인해주세요.");
    }
    setIsLoading(true);
    const user = auth.currentUser;
    try {
      if (initialData?.id) {
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

  const pricingLabel: Record<string, string> = { FREE: "무료", PAID: "유료", FREEMIUM: "부분유료" };

  // ──────────────────────────────────────────
  // STEP 1: URL 입력
  // ──────────────────────────────────────────
  if (step === "url") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl p-8"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">서비스 등록</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                URL을 입력하면 AI가 자동으로 분석해드려요.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-1 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* URL 입력 */}
          <div className="space-y-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAnalyze()}
              placeholder="https://example.com"
              autoFocus
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-3.5 bg-gray-50 dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm placeholder-gray-400"
            />
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !url.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI 분석 중...
                </>
              ) : (
                "🤖 AI로 분석하기"
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // STEP 2: 프리뷰 + 인라인 편집
  // ──────────────────────────────────────────
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <p className={`text-xs font-bold mb-0.5 ${isEditing ? "text-amber-500" : "text-indigo-500"}`}>
              {isEditing ? "✎ 수정 중 — 내용을 자유롭게 편집하세요" : initialData ? "🔄 AI 재분석 결과" : "✨ AI 분석 완료"}
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEditing ? "내용 수정" : "게시 전 확인"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* 재분석 버튼 (수정 모드 아닐 때) */}
            {!isEditing && initialData && (
              <button
                onClick={handleReanalyze}
                disabled={isAnalyzing}
                className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isAnalyzing ? (
                  <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                ) : "🤖"}
                재분석
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 (스크롤) */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">

          {/* 서비스명 + 뱃지 */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* 카테고리 */}
              {isEditing ? (
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value as ServiceCategory)}
                  className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800 outline-none cursor-pointer"
                >
                  {Object.entries(SERVICE_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {SERVICE_CATEGORIES[data.category as ServiceCategory] || data.category}
                </span>
              )}

              {/* 가격 */}
              {isEditing ? (
                <select
                  value={editPricing}
                  onChange={e => setEditPricing(e.target.value as "FREE" | "PAID" | "FREEMIUM")}
                  className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300 rounded-full border border-gray-200 dark:border-zinc-700 outline-none cursor-pointer"
                >
                  <option value="FREE">무료</option>
                  <option value="FREEMIUM">부분유료</option>
                  <option value="PAID">유료</option>
                </select>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 rounded-full border border-gray-200 dark:border-zinc-700">
                  {pricingLabel[data.pricing || "PAID"]}
                </span>
              )}

              {/* 한국어 */}
              {isEditing ? (
                <label className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800 cursor-pointer select-none">
                  <input type="checkbox" checked={editSupportsKorean} onChange={e => setEditSupportsKorean(e.target.checked)} className="w-3 h-3 accent-blue-600" />
                  🇰🇷 한국어
                </label>
              ) : data.supportsKorean ? (
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">
                  🇰🇷 한국어 지원
                </span>
              ) : null}

              {/* 트렌딩 */}
              {isEditing ? (
                <label className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-full border border-red-100 dark:border-red-800 cursor-pointer select-none">
                  <input type="checkbox" checked={editIsTrending} onChange={e => setEditIsTrending(e.target.checked)} className="w-3 h-3 accent-red-500" />
                  🔥 요즘 뜨는
                </label>
              ) : data.isTrending ? (
                <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-full border border-red-100 dark:border-red-800">
                  🔥 요즘 뜨는
                </span>
              ) : null}
            </div>

            {/* 서비스명 */}
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="서비스명"
                className="w-full text-xl font-extrabold bg-transparent border-b-2 border-indigo-400 text-gray-900 dark:text-white outline-none pb-1 mb-2 placeholder-gray-300"
              />
            ) : (
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">{data.name}</h3>
            )}

            {/* 한 줄 설명 */}
            {isEditing ? (
              <input
                type="text"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="한 줄 설명"
                className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-gray-400 outline-none pb-1 placeholder-gray-300"
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{data.description}</p>
            )}
          </div>

          {/* 상세 설명 */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-4">
            {isEditing ? (
              <>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1.5">상세 설명</p>
                <textarea
                  value={editLongDesc}
                  onChange={e => setEditLongDesc(e.target.value)}
                  rows={4}
                  placeholder="서비스에 대한 상세 설명을 입력하세요..."
                  className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300 leading-relaxed outline-none resize-none"
                />
              </>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {data.longDescription || <span className="text-gray-400 text-xs italic">상세 설명 없음</span>}
              </p>
            )}
          </div>

          {/* 주요 기능 */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <span>⚡</span> 주요 기능
            </h4>
            {isEditing ? (
              <textarea
                value={editFeatures}
                onChange={e => setEditFeatures(e.target.value)}
                rows={4}
                placeholder={"기능 1\n기능 2\n기능 3\n(한 줄에 하나씩)"}
                className="w-full text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 text-gray-700 dark:text-gray-300 outline-none resize-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(data.features || []).length > 0 ? (
                  (data.features || []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/15 rounded-lg px-3 py-2">
                      <span className="text-indigo-500 text-xs font-black">✓</span>
                      <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">{f}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic col-span-2">정보 없음</p>
                )}
              </div>
            )}
          </div>

          {/* 장점 / 단점 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 border border-green-100 dark:border-green-900/30">
              <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">👍 장점</p>
              {isEditing ? (
                <textarea
                  value={editPros}
                  onChange={e => setEditPros(e.target.value)}
                  rows={3}
                  placeholder={"장점 1\n장점 2\n(한 줄에 하나씩)"}
                  className="w-full text-xs bg-white dark:bg-zinc-800 rounded-lg p-2 text-green-800 dark:text-green-300 outline-none resize-none border border-green-200 dark:border-green-900/50 focus:ring-1 focus:ring-green-400"
                />
              ) : (
                <ul className="space-y-1">
                  {(data.pros || []).length > 0 ? (
                    (data.pros || []).map((p, i) => (
                      <li key={i} className="text-xs text-green-800 dark:text-green-300 flex gap-1.5">
                        <span className="flex-shrink-0">•</span>{p}
                      </li>
                    ))
                  ) : <li className="text-xs text-gray-400 italic">정보 없음</li>}
                </ul>
              )}
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/30">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">👎 단점</p>
              {isEditing ? (
                <textarea
                  value={editCons}
                  onChange={e => setEditCons(e.target.value)}
                  rows={3}
                  placeholder={"단점 1\n단점 2\n(한 줄에 하나씩)"}
                  className="w-full text-xs bg-white dark:bg-zinc-800 rounded-lg p-2 text-red-800 dark:text-red-300 outline-none resize-none border border-red-200 dark:border-red-900/50 focus:ring-1 focus:ring-red-400"
                />
              ) : (
                <ul className="space-y-1">
                  {(data.cons || []).length > 0 ? (
                    (data.cons || []).map((c, i) => (
                      <li key={i} className="text-xs text-red-800 dark:text-red-300 flex gap-1.5">
                        <span className="flex-shrink-0">•</span>{c}
                      </li>
                    ))
                  ) : <li className="text-xs text-gray-400 italic">정보 없음</li>}
                </ul>
              )}
            </div>
          </div>

          {/* 추천 대상 */}
          <div>
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">👤 추천 대상</h4>
            {isEditing ? (
              <input
                type="text"
                value={editTargetUser}
                onChange={e => setEditTargetUser(e.target.value)}
                placeholder="개발자, 마케터, 디자이너 (쉼표로 구분)"
                className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(data.targetUser || []).length > 0 ? (
                  (data.targetUser || []).map((u, i) => (
                    <span key={i} className="text-xs font-medium px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 rounded-full border border-purple-100 dark:border-purple-800">
                      {u}
                    </span>
                  ))
                ) : <span className="text-xs text-gray-400 italic">정보 없음</span>}
              </div>
            )}
          </div>

          {/* 태그 */}
          <div>
            {isEditing ? (
              <>
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">🏷️ 태그</h4>
                <input
                  type="text"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="태그1, 태그2, 태그3 (쉼표로 구분)"
                  className="w-full text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(data.tags || []).map((tag, i) => (
                  <span key={i} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
          {isEditing ? (
            // 수정 모드 버튼
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-sm"
              >
                취소
              </button>
              <button
                onClick={saveEdits}
                className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm"
              >
                ✓ 수정 완료
              </button>
            </>
          ) : (
            // 프리뷰 모드 버튼
            <>
              {!initialData && (
                <button
                  onClick={() => setStep("url")}
                  className="py-3 px-4 text-gray-500 bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-sm"
                  title="URL 다시 입력"
                >
                  ←
                </button>
              )}
              <button
                onClick={startEditing}
                className="flex-1 py-3 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm"
              >
                ✎ 수정하기
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
              >
                {isLoading ? "저장 중..." : initialData ? "✅ 업데이트" : "🚀 게시하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}