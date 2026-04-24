"use client";

import { useState } from "react";

interface PdfDownloadButtonProps {
  reportTitle: string;
}

export default function PdfDownloadButton({ reportTitle }: PdfDownloadButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);

    // ── 1. 모든 canvas를 img로 교체 (Chart.js 그래프 인쇄 깨짐 방지) ──
    const canvasElements = document.querySelectorAll("canvas");
    const replacements: { canvas: HTMLCanvasElement; placeholder: HTMLImageElement }[] = [];

    canvasElements.forEach((canvas) => {
      try {
        const dataUrl = canvas.toDataURL("image/png", 1.0);
        const img = document.createElement("img");
        img.src = dataUrl;
        img.style.width = canvas.offsetWidth + "px";
        img.style.height = canvas.offsetHeight + "px";
        img.style.display = "block";
        img.className = "print-canvas-snapshot";

        canvas.parentNode?.insertBefore(img, canvas);
        canvas.style.display = "none";

        replacements.push({ canvas, placeholder: img });
      } catch {
        // cross-origin canvas이면 toDataURL이 실패할 수 있음 — 무시
      }
    });

    // ── 2. document title을 리포트 제목으로 변경 (저장 파일명 반영) ──
    const originalTitle = document.title;
    document.title = reportTitle || "AI 순위 리포트";

    // ── 3. DOM 반영 대기 후 인쇄 ──
    await new Promise((resolve) => setTimeout(resolve, 150));

    // ── 4. 인쇄 완료 후 canvas 복원 ──
    const restore = () => {
      replacements.forEach(({ canvas, placeholder }) => {
        canvas.style.display = "";
        placeholder.remove();
      });
      document.title = originalTitle;
      setIsPrinting(false);
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);

    // afterprint 미지원 브라우저 대비 타임아웃 fallback
    setTimeout(restore, 6000);

    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      disabled={isPrinting}
      title="브라우저 인쇄 다이얼로그 → 대상: PDF로 저장"
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold rounded-full shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed no-print"
    >
      {isPrinting ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          PDF 준비 중...
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF 저장
        </>
      )}
    </button>
  );
}
