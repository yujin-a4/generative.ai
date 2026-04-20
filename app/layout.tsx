import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "./components/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Trend Lab",
  description: "AI 모델 성능 비교 및 트렌드 분석 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 깜빡임 방지: 페이지 로드 전 저장된 테마 즉시 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var dark = saved ? saved === 'dark' : prefersDark;
                if (dark) document.documentElement.classList.add('dark');
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white`}>

        
        <QueryProvider>
          {/* 메인 컨텐츠 영역 */}
          <div className="flex-grow">
            {children}
          </div>

          {/* 🌟 최종 수정된 글로벌 푸터 (작고 옅은 회색으로 변경 및 문구 수정) */}
          <footer className="py-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black text-center">
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
