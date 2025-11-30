"use client";

import { useEffect, useState } from "react";

export default function NewsLoading() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        // 90%까지만 자동으로 차오르고, 실제 로딩 완료 시 100%
        if (prev >= 90) return 90;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* 아이콘 + 메시지 */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-4 animate-bounce">🤖</div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          최신 AI 뉴스를 가져오는 중이에요
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          첫 로딩만 조금 느려요. 잠시만 기다려 주세요!
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-64 h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
