"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 주간 리포트 생성
 * @param weekLabel - 주차 라벨 (예: "11월 4주차") - 필수 ✅ 새로 추가
 * @param startDateStr - 시작 날짜 (YYYY-MM-DD) - 필수
 * @param endDateStr - 종료 날짜 (YYYY-MM-DD) - 필수
 */
export async function generateWeeklySummary(
  weekLabel: string,  // ✅ 첫 번째 파라미터로 추가
  startDateStr: string,
  endDateStr: string
) {
  try {
    // 날짜 파싱
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // ✅ [핵심 수정] weekLabel을 파라미터로 받아서 그대로 사용 (재계산 하지 않음)
    console.log(`[SUMMARY] 📅 분석 기간: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`);
    console.log(`[SUMMARY] 📊 주차 라벨: ${weekLabel}`);
    
    // 🌟 publishedAt으로 쿼리
    const newsRef = collection(db, "news");
    const q = query(
      newsRef,
      where("publishedAt", ">=", Timestamp.fromDate(startDate)),
      where("publishedAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("publishedAt", "desc")
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { 
        success: false, 
        error: `${startDate.toLocaleDateString()}부터 ${endDate.toLocaleDateString()}까지 분석할 뉴스가 없습니다.` 
      };
    }

    console.log(`[SUMMARY] ✅ ${snapshot.size}개 뉴스 발견`);

    // Gemini에게 보낼 텍스트 만들기
    const newsData = snapshot.docs.map(doc => {
      const d = doc.data();
      return `- [${d.title}] (${d.category}): ${d.shortSummary}`;
    }).join("\n");

    // Gemini 프롬프트 작성
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      다음은 ${startDate.toLocaleDateString()}부터 ${endDate.toLocaleDateString()}까지 수집된 주요 AI 뉴스 목록이야.
      이 뉴스들을 분석해서 '주간 AI 트렌드 리포트'를 JSON 형태로 작성해줘.

      [뉴스 목록]
      ${newsData}

      [요청사항]
      1. trends: 이번 주를 관통하는 핵심 트렌드 키워드 3가지와 설명.
      2. summary: 이번 주 전체 흐름을 아우르는 **30자 이내의 짧고 강렬한 뉴스 헤드라인 스타일 제목**. (예: "OpenAI, GPT-5 출시로 AI 판도 뒤집나")
      3. top_picks: 가장 중요하다고 생각되는 뉴스 3가지의 제목과 선정 이유.

      [JSON 형식]
      {
        "week_label": "${weekLabel}",
        "trends": [
          {"keyword": "키워드1", "desc": "설명..."},
          {"keyword": "키워드2", "desc": "설명..."}
        ],
        "summary": "헤드라인 제목",
        "top_picks": [
          {"title": "뉴스제목", "reason": "이유..."}
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    console.log("🤖 [SUMMARY] Gemini RAW Response:", text);
    
    const summaryData = JSON.parse(text);
    
    console.log("✅ [SUMMARY] Parsed Data Success:", summaryData);

    // DB에 저장 (isPublished: false로 생성)
    await addDoc(collection(db, "weekly_summaries"), {
      ...summaryData,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp(),
      isPublished: false
    });

    console.log(`[SUMMARY] ✅ 리포트 저장 성공: ${weekLabel}`);

    return { success: true, message: `${weekLabel} 리포트 생성 완료` };

  } catch (error: any) {
    console.error("Weekly Summary Error:", error);
    return { success: false, error: error.message };
  }
}
