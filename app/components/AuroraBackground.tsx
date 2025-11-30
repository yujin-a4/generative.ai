"use client";

import { useEffect, useState } from "react";

export default function AuroraBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 서버 사이드 렌더링 방지용 체크
    if (typeof window === "undefined") return;

    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

  const offsetX = mousePosition.x - centerX;
  const offsetY = mousePosition.y - centerY;

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl z-0 pointer-events-none overflow-visible">
      
      {/* 🔵 파란색 오로라: bg-blue-300으로 변경, opacity-30으로 낮춤 */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-30"
        style={{
          transform: `translate(${offsetX / 20}px, ${offsetY / 20}px)`, // 움직임은 부드럽게 유지
          transition: 'transform 0.4s ease-out'
        }}
      />

      {/* 🟣 보라색 오로라: bg-purple-300으로 변경, opacity-30으로 낮춤 */}
      <div 
        className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-30 delay-75"
        style={{
          transform: `translate(${offsetX * -1 / 25}px, ${offsetY * -1 / 25}px)`,
          transition: 'transform 0.4s ease-out'
        }}
      />

      {/* ✨ 중앙 하이라이트: 아주 연하게 */}
      <div 
         className="absolute top-[10%] left-[30%] w-[400px] h-[400px] bg-indigo-200 rounded-full blur-[120px] opacity-20 animate-pulse"
      />
    </div>
  );
}