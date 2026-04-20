"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 저장된 테마 불러오기
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved ? saved === "dark" : prefersDark;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all
        hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300
        border border-gray-200 dark:border-zinc-700 ${className}`}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-label="테마 토글"
    >
      <span className="text-base select-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
