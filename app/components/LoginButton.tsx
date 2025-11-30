"use client";

import { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase"; // @/app/lib/firebase 일수도 있으니 경로 확인!

export default function LoginButton() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 로그인 상태 감지 리스너
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("로그인에 실패했습니다.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // 로그아웃 후 새로고침 (깔끔한 상태 초기화)
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <img 
          src={user.photoURL || ""} 
          alt="Profile" 
          className="w-8 h-8 rounded-full border border-gray-300"
        />
        <span className="text-sm font-medium hidden md:block text-gray-700 dark:text-gray-300">
          {user.displayName}님
        </span>
        <button 
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-500 underline"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
    >
      <span className="text-lg">G</span> 
      <span>로그인</span>
    </button>
  );
}