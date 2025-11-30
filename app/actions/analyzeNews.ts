"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeNewsArticle(url: string) {
  console.log("🔍 분석 시작 URL:", url); // 로그 추가

  try {
    // 1. URL에서 HTML 가져오기 (기존 로직 유지)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    if (!response.ok) throw new Error(`사이트 접속 실패 (${response.status})`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 불필요한 태그 제거
    $("script, style, nav, footer, header, aside, iframe").remove();
    
    // 본문 텍스트 추출
    const title = $("title").text().trim() || $("meta[property='og:title']").attr("content") || "";
    
    // 본문 추출 시도
    let bodyText = $("article").text() || $("#content").text() || $(".article_view").text() || $("main").text() || $("body").text();
    bodyText = bodyText.replace(/\s+/g, " ").trim().slice(0, 15000);

    console.log("✅ 본문 추출 완료 (길이):", bodyText.length); // 로그 추가

    if (bodyText.length < 50) throw new Error("본문 내용을 추출할 수 없습니다.");

    // 2. Gemini 모델 설정 (기존 로직 유지)
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp", 
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. 프롬프트 작성 (기존 로직 유지)
    const prompt = `
    다음 뉴스 기사를 분석하고 JSON 포맷으로 요약해줘.
    
    [기사 정보]
    - URL: ${url}
    - 제목: ${title}
    - 본문 일부: ${bodyText}

    [필수 요청 사항]
    1. shortSummary: 뉴스 목록 카드에 들어갈 50자 이내의 아주 핵심적인 한 줄 요약 (한국어).
    2. detailedSummary: 상세 요약 문장 3개 배열 (한국어).
    3. insight: 이 뉴스가 '에듀테크'나 'AI 산업'에 미치는 영향이나 시사점 (150자 이내, 한국어).
    4. category: 다음 중 가장 적절한 ID 선택 (EDUTECH_AI, AI_TECH, AI_TOOLS, INDUSTRY_TREND, COMPANY_NEWS, POLICY_ETHICS, RESEARCH, PRODUCT_RELEASE).
    5. tags: 관련 해시태그 3~5개.
    6. 영어 기사라도 제목 및 내용은 모두 한국어로 번역해서 작성할 것.

    [출력 JSON 형식]
    {
      "title": "${title}", 
      "source": "언론사명",
      "date": "YYYY-MM-DD",
      "shortSummary": "한 줄 요약",
      "detailedSummary": ["요약1", "요약2", "요약3"],
      "insight": "인사이트",
      "category": "EDUTECH_AI",
      "tags": ["#태그1", "#태그2"]
    }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // 🚨 [디버그 강화] Gemini의 RAW 응답 확인
    console.log("🤖 Gemini RAW Response for Debugging:", text); 

    // ⚠️ 중요: Markdown 코드 블록(```json ... ```) 제거 로직 추가
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const parsedData = JSON.parse(text);
        // 🚨 [디버그 강화] 최종 파싱된 JSON 확인
        console.log("✅ Parsed Data Success:", parsedData); 

        // 데이터가 비어있을 경우를 대비한 최소한의 유효성 검사
        if (!parsedData.title || !parsedData.shortSummary || parsedData.detailedSummary?.length === 0) {
             throw new Error("AI 분석 결과에 필수 필드(제목, 요약)가 누락되었거나 내용이 비어있습니다.");
        }
        
        return parsedData;

    } catch (e) {
        // 🚨 JSON 파싱 자체에 실패했을 경우
        console.error("❌ JSON Parsing Failed:", e);
        throw new Error(`AI 분석 결과 형식이 잘못되었습니다. (JSON Parsing Error): ${e}`);
    }

  } catch (error: any) {
    console.error("❌ News Analysis Error:", error);
    throw new Error(error.message || "뉴스 분석 중 오류가 발생했습니다.");
  }
}