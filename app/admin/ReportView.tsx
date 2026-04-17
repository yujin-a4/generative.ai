"use client";

import ReportViewLLM     from "./ReportViewLLM";
import ReportViewGeneric from "./ReportViewGeneric";
import ReportViewSTT     from "./ReportViewSTT";
import ReportViewTTS     from "./ReportViewTTS";

interface ReportViewProps {
  data: any;
  onSave?: (updatedData: any) => void;
  onReanalyze?: () => void;
  isSaving?: boolean;
  isEditable?: boolean;
}

export default function ReportView({ data, ...props }: ReportViewProps) {
  if (!data) return null;

  const rawType = (
    data.analysis_result?.report_type ||
    data.report_type ||
    ''
  ).toUpperCase().trim();

  if (rawType === 'LLM')   return <ReportViewLLM     data={data} {...props} />;
  if (rawType === 'STT')   return <ReportViewSTT     data={data} {...props} />;
  if (rawType === 'TTS')   return <ReportViewTTS     data={data} {...props} />;
  return                          <ReportViewGeneric data={data} {...props} />;
}