"use client";

import { useState } from "react";
import { submitFeedback, FeedbackType } from "@/app/actions/feedbackActions";

const FEEDBACK_TYPES: { type: FeedbackType; icon: string; label: string }[] = [
  { type: "오류 제보", icon: "🐛", label: "오류 제보" },
  { type: "기능 건의", icon: "💡", label: "기능 건의" },
  { type: "기타",     icon: "💬", label: "기타 의견" },
];

interface FeedbackModalProps {
  isOpen:   boolean;
  onClose:  () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType>("오류 제보");
  const [title,        setTitle]        = useState("");
  const [content,      setContent]      = useState("");
  const [contact,      setContact]      = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess,    setIsSuccess]    = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);

    const result = await submitFeedback({
      type:    selectedType,
      title:   title.trim(),
      content: content.trim(),
      contact: contact.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle("");
        setContent("");
        setContact("");
        setSelectedType("오류 제보");
        onClose();
      }, 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-700 animate-fade-in">

        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📬 의견 보내기
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              오류 제보나 개선 제안을 자유롭게 남겨주세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all text-lg"
          >
            ✕
          </button>
        </div>

        {/* 성공 화면 */}
        {isSuccess ? (
          <div className="p-14 text-center">
            <div className="text-6xl mb-5 animate-bounce">✅</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">감사합니다!</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              소중한 의견이 전달되었습니다. 빠르게 검토하겠습니다.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* 유형 선택 */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                유형 선택
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FEEDBACK_TYPES.map(({ type, icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-3 rounded-xl border-2 text-center transition-all duration-200 hover:-translate-y-0.5 ${
                      selectedType === type
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md"
                        : "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className={`text-xs font-bold ${
                      selectedType === type
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                제목 <span className="text-gray-300">(선택)</span>
              </label>
              <input
                type="text"
                placeholder="핵심 내용을 한 줄로 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all placeholder-gray-400"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                내용 <span className="text-red-400">*</span>
              </label>
              <textarea
                placeholder={
                  selectedType === "오류 제보"
                    ? "어떤 상황에서 오류가 발생했나요? 자세히 설명해주세요."
                    : selectedType === "기능 건의"
                    ? "어떤 기능이 있으면 좋을 것 같으신가요?"
                    : "자유롭게 의견을 남겨주세요."
                }
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all resize-none placeholder-gray-400"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
                연락처 <span className="text-gray-300">(선택 — 답변을 원하시면 입력해주세요)</span>
              </label>
              <input
                type="text"
                placeholder="이메일 또는 연락 가능한 수단"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all placeholder-gray-400"
              />
            </div>

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 dark:shadow-none text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  전송 중...
                </>
              ) : (
                <>📨 의견 보내기</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
