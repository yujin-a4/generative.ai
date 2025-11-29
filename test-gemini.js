require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testConnection() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("---------------------------------------------------");
    console.log("🔑 API Key 확인:", apiKey ? `${apiKey.substring(0, 10)}...` : "없음 (실패!)");
    
    if (!apiKey) {
      throw new Error("키를 못 찾았습니다. .env.local 파일을 확인하세요.");
    }

    console.log("🤖 구글 서버에 연결 시도 중...");
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 가장 기본 모델로 테스트
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("안녕? 너 살아있니?");
    const response = await result.response;
    
    console.log("✅ 성공! 응답:", response.text());
    console.log("---------------------------------------------------");
    console.log("결론: 키와 구글 계정은 정상입니다. 웹사이트 코드 문제였습니다.");

  } catch (error) {
    console.error("❌ 실패! 에러 내용:");
    console.error(error);
    console.log("---------------------------------------------------");
    console.log("결론: 구글 계정이나 키 권한 자체에 문제가 있습니다.");
  }
}

testConnection();