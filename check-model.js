const { GoogleGenerativeAI } = require("@google/generative-ai");

// 여기에 ...blnw 키를 직접 붙여넣으세요
const API_KEY = "AIzaSyBYqXVTOVfxt-7799EdT6yYRNBhVp0bInw"; 

async function listModels() {
  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    console.log("📡 구글에 모델 목록 요청 중...");
    // 모델 목록을 다 가져옵니다
    const modelList = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).apiKey; // 단순 초기화
    
    // 실제 목록 조회 (fetch 사용)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();

    if (data.models) {
      console.log("\n✅ 사용 가능한 모델 목록:");
      data.models.forEach(m => {
        // 우리가 쓰려는 flash 모델이 있는지 확인
        if (m.name.includes("flash")) {
            console.log(`👉 [발견!] ${m.name}`);
        }
      });
    } else {
      console.log("❌ 모델 목록이 비어있음 (Error):", data);
    }
  } catch (error) {
    console.error("❌ 연결 실패:", error);
  }
}

listModels();