import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
        
        {/* 메인 컨텐츠 영역 */}
        <div className="flex-grow">
          {children}
        </div>

        {/* 🌟 [수정됨] 이름만 명확하게 표시하는 푸터 */}
        <footer className="py-8 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black text-center">
          <p className="text-lg text-indigo-600 dark:text-indigo-400 font-bold tracking-wide">
            Yujin Kang
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            © 2025 AI Insight. All rights reserved.
          </p>
        </footer>

      </body>
    </html>
  );
}