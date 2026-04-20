"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateMonthlySummary(
  monthLabel: string,
  year: number,
  month: number
) {
  try {
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(`[MONTHLY] 분석 기간: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`);

    const q = query(
      collection(db, "news"),
      where("publishedAt", ">=", Timestamp.fromDate(startDate)),
      where("publishedAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("publishedAt", "desc")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: `${monthLabel}에 분석할 뉴스가 없습니다.` };
    }

    console.log(`[MONTHLY] ${snapshot.size}개 뉴스 발견`);

    // 카테고리별 카운트
    const catCount: Record<string, number> = {};
    const newsData = snapshot.docs.map(doc => {
      const d = doc.data();
      catCount[d.category] = (catCount[d.category] || 0) + 1;
      return `[${d.category}] ${d.title} — ${d.shortSummary}`;
    }).join("\n");

    const catSummary = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cnt]) => `${cat}: ${cnt}건`)
      .join(", ");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
너는 교육 출판사(교재 개발·에듀테크 서비스 운영)의 AI 트렌드 애널리스트야.
아래 ${monthLabel} 수집 뉴스(총 ${snapshot.size}건, 카테고리별: ${catSummary})를 심층 분석해서 '월간 AI 트렌드 리포트'를 작성해줘.
단순 요약이 아닌, 우리 회사(교육 출판사)의 전략 수립에 실질적으로 도움이 되는 인사이트를 제공해야 해.

[뉴스 목록]
${newsData}

[작성 지침]
1. headline: 이달을 압축하는 강렬한 헤드라인 (40자 이내)
2. overview: 이달 전체 흐름을 3~4문장으로 서술. 단순 사실 나열이 아닌 거시적 트렌드 방향성 분석
3. key_trends: 핵심 트렌드 5개. 각 트렌드마다:
   - keyword: 트렌드 키워드 (5~10자)
   - desc: 트렌드 설명 (2~3문장)
   - edu_impact: 이 트렌드가 교육·출판 업계에 미치는 구체적 영향 (1~2문장)
4. company_moves: 이달 중요한 기업 움직임 3~4개
   - company: 기업명
   - action: 한 줄 행동 요약
   - significance: 교육/에듀테크 업계 관점에서의 의미
5. edu_industry_impact: 교육·출판 업계 종합 임팩트 분석 (4~5문장). 이달 AI 발전이 교육 시장에 미치는 영향을 구체적으로 서술
6. opportunities: 이달 트렌드에서 발견한 교육 출판사의 기회 3가지
   - title: 기회 키워드
   - desc: 구체적 설명 (1~2문장)
7. risks: 이달 트렌드에서 발견한 주의해야 할 리스크 2~3가지
   - title: 리스크 키워드
   - desc: 구체적 설명 (1~2문장)
8. top_picks: 이달 가장 중요한 기사 5개
   - title: 기사 제목
   - reason: 선정 이유
   - relevance: 교육 출판사 입장에서의 관련성 (한 문장)
9. category_highlights: 카테고리별 이달 주요 동향 요약 (AI_TECH, AI_SERVICE, EDUTECH_AI, EDU_INDUSTRY, POLICY 중 뉴스가 있는 것만)
   - category: 카테고리명
   - count: 기사 수
   - summary: 이달 해당 카테고리 주요 흐름 요약 (2~3문장)
10. outlook: 다음 달 전망 및 주목할 이슈 (3~4문장). 후속 트렌드, 예상되는 발표, 교육 업계 대응 방향 포함

[JSON 형식 — 반드시 이 구조 그대로 출력]
{
  "month_label": "${monthLabel}",
  "headline": "...",
  "overview": "...",
  "key_trends": [
    { "keyword": "...", "desc": "...", "edu_impact": "..." }
  ],
  "company_moves": [
    { "company": "...", "action": "...", "significance": "..." }
  ],
  "edu_industry_impact": "...",
  "opportunities": [
    { "title": "...", "desc": "..." }
  ],
  "risks": [
    { "title": "...", "desc": "..." }
  ],
  "top_picks": [
    { "title": "...", "reason": "...", "relevance": "..." }
  ],
  "category_highlights": [
    { "category": "...", "count": 0, "summary": "..." }
  ],
  "outlook": "..."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const summaryData = JSON.parse(text);

    await addDoc(collection(db, "monthly_summaries"), {
      ...summaryData,
      summary: summaryData.headline,
      year,
      month,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp(),
      isPublished: false,
      version: 2,
    });

    console.log(`[MONTHLY] 저장 성공: ${monthLabel}`);
    return { success: true, message: `${monthLabel} 리포트 생성 완료` };

  } catch (error: any) {
    console.error("Monthly Summary Error:", error);
    return { success: false, error: error.message };
  }
}
