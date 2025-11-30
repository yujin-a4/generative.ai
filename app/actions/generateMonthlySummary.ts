"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateMonthlySummary(year: number, month: number) {
  try {
    // 1. 해당 월의 시작/끝 날짜
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const newsRef = collection(db, "news");
    const q = query(
      newsRef,
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      where("createdAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: false, error: "해당 월에 분석할 뉴스가 없습니다." };
    }

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

    const monthLabel = `${year}년 ${month}월`;

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
    const summaryData = JSON.parse(text);

    // 4. DB에 저장 (isPublished: false로 생성)
    await addDoc(collection(db, "monthly_summaries"), {
      ...summaryData,
      year,
      month,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp(),
      isPublished: false  // 🌟 기본값: 비공개
    });

    return { success: true };

  } catch (error: any) {
    console.error("Monthly Summary Error:", error);
    return { success: false, error: error.message };
  }
}
