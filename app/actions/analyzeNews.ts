"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeNewsArticle(url: string) {
  console.log("🔍 분석 시작 URL:", url);

  try {
    // 1. URL에서 HTML 가져오기
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

    console.log("✅ 본문 추출 완료 (길이):", bodyText.length);

    if (bodyText.length < 50) throw new Error("본문 내용을 추출할 수 없습니다.");

    // 2. Gemini 모델 설정
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp", 
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. 프롬프트 작성
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
    
    console.log("🤖 Gemini RAW Response for Debugging:", text); 

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        let parsedData = JSON.parse(text);

        // 🛠️ [수정] 만약 결과가 배열([])로 왔다면 첫 번째 요소를 사용
        if (Array.isArray(parsedData)) {
            console.log("⚠️ 배열 형태로 반환됨, 첫 번째 요소 추출");
            parsedData = parsedData[0];
        }

        console.log("✅ Parsed Data Success:", parsedData); 

        if (!parsedData.title || !parsedData.shortSummary || parsedData.detailedSummary?.length === 0) {
             throw new Error("AI 분석 결과에 필수 필드(제목, 요약)가 누락되었거나 내용이 비어있습니다.");
        }
        
        return parsedData;

    } catch (e) {
        console.error("❌ JSON Parsing Failed:", e);
        throw new Error(`AI 분석 결과 형식이 잘못되었습니다. (JSON Parsing Error): ${e}`);
    }

  } catch (error: any) {
    console.error("❌ News Analysis Error:", error);
    throw new Error(error.message || "뉴스 분석 중 오류가 발생했습니다.");
  }
}

// 🌟 [추가] 대시보드 헤드라인 생성용 함수
export async function generateTrendHeadline(newsList: { title: string; summary: string }[]) {
  if (!newsList || newsList.length === 0) {
    return { headline: "현재 분석할 뉴스가 충분하지 않습니다." };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" },
    });

    const combinedText = newsList
      .map((n, i) => `${i + 1}. ${n.title} (${n.summary})`)
      .join("\n");

    const prompt = `
      너는 'AI 트렌드 헤드라인 작가'야.
      아래는 최근 2주간의 주요 AI/에듀테크 뉴스들이야.
      이 뉴스들을 종합해서, 지금 가장 핫한 트렌드를 **단 한 문장의 뉴스 헤드라인처럼** 요약해줘.

      [규칙]
      1. **문체:** 뉴스 속보 자막처럼 간결하고 임팩트 있게 (예: "OpenAI, GPT-5 출시 임박설에 AI 업계 긴장").
      2. **길이:** 띄어쓰기 포함 60자 이내.
      3. **언어:** 한국어.
      4. 특정 기업이나 모델이 반복되면 그걸 메인으로 잡고, 아니면 전반적인 흐름을 요약해.

      [입력 데이터]
      ${combinedText}

      [출력 JSON]
      { "headline": "여기에 헤드라인 작성" }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Headline Generation Error:", error);
    return { headline: "AI 트렌드 분석 중..." };
  }
}