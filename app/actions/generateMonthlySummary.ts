"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 월간 리포트 생성
 * @param monthLabel - 월 라벨 (예: "2025년 11월") - 필수 ✅ 새로 추가
 * @param year - 연도 (예: 2025)
 * @param month - 월 (예: 11)
 */
export async function generateMonthlySummary(
  monthLabel: string,  // ✅ 첫 번째 파라미터로 추가
  year: number, 
  month: number
) {
  try {
    // 1. 해당 월의 시작/끝 날짜
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(`[MONTHLY] 📅 분석 기간: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`);
    console.log(`[MONTHLY] 📊 월 라벨: ${monthLabel}`);

    // publishedAt으로 쿼리
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
        error: `${monthLabel}에 분석할 뉴스가 없습니다.` 
      };
    }

    console.log(`[MONTHLY] ✅ ${snapshot.size}개 뉴스 발견`);

    // 2. Gemini에게 보낼 텍스트 만들기
    const newsData = snapshot.docs.map(doc => {
      const d = doc.data();
      return `- [${d.title}] (${d.category}): ${d.shortSummary}`;
    }).join("\n");

    // 3. Gemini 프롬프트 작성
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      다음은 ${monthLabel}에 수집된 주요 AI 뉴스 목록이야.
      이 뉴스들을 분석해서 '월간 AI 트렌드 리포트'를 JSON 형태로 작성해줘.

      [뉴스 목록]
      ${newsData}

      [요청사항]
      1. trends: 이번 달을 관통하는 핵심 트렌드 키워드 5가지와 설명.
      2. summary: 이번 달 전체 흐름을 아우르는 **40자 이내의 짧고 강렬한 뉴스 헤드라인 스타일 제목**. (예: "11월, AI 에이전트 전쟁의 서막이 열리다")
      3. top_picks: 가장 중요하다고 생각되는 뉴스 5가지의 제목과 선정 이유.
      4. category_highlights: 카테고리별 주요 동향 요약 (에듀테크, AI기술, 기업/투자 등)

      [JSON 형식]
      {
        "month_label": "${monthLabel}",
        "trends": [
          {"keyword": "키워드1", "desc": "설명..."},
          {"keyword": "키워드2", "desc": "설명..."}
        ],
        "summary": "헤드라인 제목",
        "top_picks": [
          {"title": "뉴스제목", "reason": "이유..."}
        ],
        "category_highlights": [
          {"category": "카테고리명", "summary": "요약..."}
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    console.log("🤖 [MONTHLY] Gemini RAW Response:", text);
    
    const summaryData = JSON.parse(text);
    
    console.log("✅ [MONTHLY] Parsed Data Success:", summaryData);

    // 4. DB에 저장 (isPublished: false로 생성)
    await addDoc(collection(db, "monthly_summaries"), {
      ...summaryData,
      year,
      month,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp(),
      isPublished: false
    });

    console.log(`[MONTHLY] ✅ 리포트 저장 성공: ${monthLabel}`);

    return { success: true, message: `${monthLabel} 리포트 생성 완료` };

  } catch (error: any) {
    console.error("Monthly Summary Error:", error);
    return { success: false, error: error.message };
  }
}
