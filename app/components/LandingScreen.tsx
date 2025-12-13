"use client";

import { useState, useEffect } from "react";

interface LandingScreenProps {
  onEnter: () => void;
}

export default function LandingScreen({ onEnter }: LandingScreenProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleEnter = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onEnter();
    }, 500); // 애니메이션 완료 후 콜백
  };

  return (
    <div 
      className={`
        fixed inset-0 z-50 
        bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/30
        dark:from-gray-900 dark:via-blue-950/50 dark:to-indigo-950/30
        flex items-center justify-center
        transition-opacity duration-500
        ${isAnimating ? 'opacity-0' : 'opacity-100'}
        overflow-hidden
      `}
    >
      {/* 미묘한 패턴 배경 */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, rgb(59, 130, 246) 1px, transparent 0)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* 부드러운 그라데이션 오브 */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-blue-100/20 to-purple-100/20 dark:via-blue-900/10 dark:to-purple-900/10" />

      {/* 미묘한 글로우 효과 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 dark:bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 text-center px-6">
        {/* 로고/아이콘 */}
        <div className="mb-8 animate-bounce-in">
          <div className="relative inline-block">
            <div className="text-8xl mb-4 relative z-10">🤖</div>
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl transform scale-150" />
          </div>
        </div>

        {/* 타이틀 */}
        <h1 className="text-6xl md:text-8xl font-extrabold mb-6 animate-fade-in-up">
          <span className="text-gray-900 dark:text-white">AI </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient">
            Trend
          </span>
          <span className="text-gray-900 dark:text-white"> Lab</span>
        </h1>

        {/* 부제 */}
        <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-12 animate-fade-in-up-delay font-medium">
          함께 만들어 나가는 AI 트렌드 지도
        </p>

        {/* 시작하기 버튼 */}
        <button
          onClick={handleEnter}
          className="
            px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 
            text-white text-lg font-bold rounded-full
            shadow-lg hover:shadow-xl transform hover:scale-105
            transition-all duration-300
            animate-fade-in-up-delay-2
          "
        >
          시작하기 →
        </button>

        {/* 추가 정보 */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-8 animate-fade-in-up-delay-2">
          AI 뉴스 수집 • 트렌드 분석 • 순위 리포트
        </p>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }


        .animate-bounce-in {
          animation: bounce-in 0.8s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }

        .animate-fade-in-up-delay {
          animation: fade-in-up 0.8s ease-out 0.2s both;
        }

        .animate-fade-in-up-delay-2 {
          animation: fade-in-up 0.8s ease-out 0.4s both;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

      `}</style>
    </div>
  );
}

