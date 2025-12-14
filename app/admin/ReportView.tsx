"use client";

import ReportViewLLM from "./ReportViewLLM";
import ReportViewGeneric from "./ReportViewGeneric";

interface ReportViewProps {
  data: any;
  onSave?: (updatedData: any) => void;
  onReanalyze?: () => void;
  isSaving?: boolean;
  isEditable?: boolean;
}

export default function ReportView({ data, ...props }: ReportViewProps) {
  if (!data) return null;

  // 🛠️ [Fix] report_type 확인 로직 강화 (대소문자 무시, 공백 제거)
  const reportType = data.analysis_result?.report_type?.toUpperCase().trim();

  // "LLM"이거나 "TEXT"가 포함되어 있으면 LLM 뷰로 보냄
  if (reportType === "LLM" || reportType?.includes("LLM")) {
    return <ReportViewLLM data={data} {...props} />;
  } else {
    // 그 외 (Video, Image, TTS 등)는 Generic 뷰로 보냄
    return <ReportViewGeneric data={data} {...props} />;
  }
}