"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateWeeklySummary() {
  try {
    // 1. 지난 7일간의 뉴스 가져오기
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const newsRef = collection(db, "news");
    const q = query(
      newsRef,
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: false, error: "지난 7일간 분석할 뉴스가 없습니다." };
    }

    // 2. Gemini에게 보낼 텍스트 만들기
    const newsData = snapshot.docs.map(doc => {
      const d = doc.data();
      return `- [${d.title}] (${d.category}): ${d.shortSummary}`;
    }).join("\n");

    // 3. Gemini 프롬프트 작성 (제목 스타일 변경 🌟)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      다음은 지난 7일간 수집된 주요 AI 뉴스 목록이야.
      이 뉴스들을 분석해서 '주간 AI 트렌드 리포트'를 JSON 형태로 작성해줘.

      [뉴스 목록]
      ${newsData}

      [요청사항]
      1. trends: 이번 주를 관통하는 핵심 트렌드 키워드 3가지와 설명.
      2. summary: 이번 주 전체 흐름을 아우르는 **30자 이내의 짧고 강렬한 뉴스 헤드라인 스타일 제목**. (예: "OpenAI, GPT-5 출시로 AI 판도 뒤집나")
      3. top_picks: 가장 중요하다고 생각되는 뉴스 3가지의 제목과 선정 이유.

      [JSON 형식]
      {
        "week_label": "11월 4주차", 
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
    const summaryData = JSON.parse(text);

    // 4. DB에 저장
    await addDoc(collection(db, "weekly_summaries"), {
      ...summaryData,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp()
    });

    return { success: true };

  } catch (error: any) {
    console.error("Weekly Summary Error:", error);
    return { success: false, error: error.message };
  }
}