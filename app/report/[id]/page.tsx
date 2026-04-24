import { getReportById } from "@/app/actions/analyze";
import ReportView from "@/app/admin/ReportView";
import Link from "next/link";
import PdfDownloadButton from "./PdfDownloadButton";

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const report: any = await getReportById(params.id);

  if (!report) {
    return <div className="p-10 text-center">리포트를 찾을 수 없습니다.</div>;
  }

  // 🌟 리포트 타입에 따른 제목 설정
  const reportType = report.analysis_result?.report_type || "AI";
  const headerTitle = `${reportType.toUpperCase()} Insight 🧠`;
  const reportTitle = report.analysis_result?.report_title || `${reportType.toUpperCase()} 순위 리포트`;

  // 리포트 타입 → AI 순위 탭의 sub 파라미터 매핑
  const TYPE_TO_SUB: Record<string, string> = {
    LLM:     "llm",
    Image:   "image",
    IMAGE:   "image",
    Video:   "video",
    VIDEO:   "video",
    TTS:     "tts",
    STT:     "stt",
    Service: "service",
    SERVICE: "service",
  };
  const subTab = TYPE_TO_SUB[reportType] || TYPE_TO_SUB[reportType.toUpperCase()] || "llm";
  const backHref = `/?tab=reports&sub=${subTab}`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* 네비게이션 */}
      <nav className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <Link 
            href={backHref}
            className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2"
          >
            ← AI 순위 목록으로
          </Link>
          {/* 🌟 동적 타이틀 적용 */}
          <div className="font-bold text-xl text-indigo-600 dark:text-indigo-400">{headerTitle}</div>
          {/* PDF 다운로드 버튼 */}
          <PdfDownloadButton reportTitle={reportTitle} />
        </div>
      </nav>

      <main className="p-4 md:p-8 animate-fade-in-up">
        {/* ReportView는 수정 없이 데이터 구조가 통일되었으므로 그대로 작동함 */}
        <ReportView data={report} />
      </main>
    </div>
  );
}
