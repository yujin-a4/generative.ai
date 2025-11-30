import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "./components/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Service Insight",
  description: "AI 모델 성능 비교 및 트렌드 분석 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} flex flex-col min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white`}>
        
        <QueryProvider>
          {/* 메인 컨텐츠 영역 */}
          <div className="flex-grow">
            {children}
          </div>

          {/* 🌟 최종 수정된 글로벌 푸터 (작고 옅은 회색으로 변경 및 문구 수정) */}
          <footer className="py-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black text-center">
            {/* 제작자 표시: 작게, 회색으로 변경 */}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-600">
              Insight Platform by <span className="font-bold">Yujin Kang</span>
            </p>
            {/* 저작권 표시: 간결하게 변경 */}
            <p className="text-xs text-gray-400 dark:text-gray-700 mt-1">
              © 2025. All Data Sourced from Public Benchmarks.
            </p>
          </footer>
        </QueryProvider>

      </body>
    </html>
  );
}
