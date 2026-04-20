"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, orderBy } from "firebase/firestore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateWeeklySummary(
  weekLabel: string,
  startDateStr: string,
  endDateStr: string
) {
  try {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    console.log(`[WEEKLY] 분석 기간: ${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`);

    const q = query(
      collection(db, "news"),
      where("publishedAt", ">=", Timestamp.fromDate(startDate)),
      where("publishedAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("publishedAt", "desc")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: `${weekLabel}에 분석할 뉴스가 없습니다.` };
    }

    console.log(`[WEEKLY] ${snapshot.size}개 뉴스 발견`);

    const newsData = snapshot.docs.map(doc => {
      const d = doc.data();
      return `[${d.category}] ${d.title} — ${d.shortSummary}`;
    }).join("\n");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
너는 교육 출판사(교재 개발·에듀테크 서비스 운영)의 AI 트렌드 애널리스트야.
아래 ${weekLabel} 수집 뉴스(${snapshot.size}건)를 심층 분석해서 '주간 AI 트렌드 리포트'를 작성해줘.
단순 요약이 아닌, 우리 회사(교육 출판사)에 실질적으로 유용한 인사이트를 제공해야 해.

[뉴스 목록]
${newsData}

[작성 지침]
1. headline: 이번 주를 압축하는 강렬한 뉴스 헤드라인 (30자 이내, 예: "에이전트 전쟁 본격화, 교육 AI 격변 시작")
2. overview: 이번 주 전체 흐름을 2~3문장으로 서술. 단순 사실 나열 말고 흐름·방향성 분석
3. key_trends: 핵심 트렌드 3개. 각 트렌드마다:
   - keyword: 트렌드 키워드 (5~10자)
   - desc: 트렌드 설명 (2~3문장)
   - edu_impact: 이 트렌드가 교육·출판 업계에 미치는 구체적 영향 (1~2문장, '우리에게...' 형식으로)
4. company_moves: 이번 주 중요한 기업 움직임 2~3개
   - company: 기업명
   - action: 한 줄 행동 요약
   - significance: 교육/에듀테크 업계 관점에서의 의미
5. edu_industry_impact: 교육·출판 업계 종합 임팩트 분석 (3~4문장). 우리 업계가 주목해야 할 점, 대비해야 할 변화, 활용 가능한 기회를 구체적으로 서술
6. watch_next: 다음 주에 주목해야 할 예상 이슈 또는 후속 동향 (2~3문장)
7. top_picks: 이번 주 가장 중요한 기사 3개
   - title: 기사 제목
   - reason: 선정 이유
   - relevance: 교육 출판사 입장에서의 관련성 (한 문장)

[JSON 형식 — 반드시 이 구조 그대로 출력]
{
  "week_label": "${weekLabel}",
  "headline": "...",
  "overview": "...",
  "key_trends": [
    { "keyword": "...", "desc": "...", "edu_impact": "..." }
  ],
  "company_moves": [
    { "company": "...", "action": "...", "significance": "..." }
  ],
  "edu_industry_impact": "...",
  "watch_next": "...",
  "top_picks": [
    { "title": "...", "reason": "...", "relevance": "..." }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const summaryData = JSON.parse(text);

    await addDoc(collection(db, "weekly_summaries"), {
      ...summaryData,
      // 하위 호환: 기존 summary 필드도 유지
      summary: summaryData.headline,
      period_start: Timestamp.fromDate(startDate),
      period_end: Timestamp.fromDate(endDate),
      created_at: serverTimestamp(),
      isPublished: false,
      version: 2,
    });

    console.log(`[WEEKLY] 저장 성공: ${weekLabel}`);
    return { success: true, message: `${weekLabel} 리포트 생성 완료` };

  } catch (error: any) {
    console.error("Weekly Summary Error:", error);
    return { success: false, error: error.message };
  }
}
