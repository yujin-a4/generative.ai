import { getReportById } from "@/app/actions/analyze";
import ReportView from "@/app/admin/ReportView";
import Link from "next/link";

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const report: any = await getReportById(params.id);

  if (!report) {
    return <div className="p-10 text-center">리포트를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* 네비게이션 */}
      <nav className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2">
            ← 목록으로 돌아가기
          </Link>
          <div className="font-bold text-xl text-indigo-600 dark:text-indigo-400">LLM Insight 🧠</div>
        </div>
      </nav>

      <main className="p-4 md:p-8 animate-fade-in-up">
        {/* isEditable 미전달 (기본값 false) → 일반 사용자는 편집 불가 */}
        <ReportView data={report} />
      </main>
    </div>
  );
}
