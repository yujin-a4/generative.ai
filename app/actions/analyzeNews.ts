"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 🌟 구글 뉴스 암호화 주소(CBMi...)를 즉시 해독하는 함수
 * 스크린샷에서 발생한 search() 문법 오류를 해결하고 정밀하게 추출합니다.
 */
function resolveGoogleUrl(url: string): string {
  if (!url || !url.includes("news.google.com")) return url;

  try {
    const parts = url.split("/");
    const encodedData = parts[parts.length - 1]?.split("?")[0];
    
    if (encodedData) {
      const buffer = Buffer.from(encodedData, "base64");
      const decoded = buffer.toString("binary");
      
      const start = decoded.indexOf("http");
      if (start !== -1) {
        // search()는 인자를 하나만 받으므로 자른 후 검색함
        const suffix = decoded.substring(start);
        const endOfUrl = suffix.search(/[^\x20-\x7E]/);
        const actualUrl = endOfUrl !== -1 ? suffix.substring(0, endOfUrl) : suffix;
        
        console.log("🎯 구글 주소 해독 성공 -> 원문 접속:", actualUrl);
        return actualUrl;
      }
    }
  } catch (e) {
    console.error("구글 URL 해독 실패:", e);
  }
  return url;
}

export async function analyzeNewsArticle(url: string, manualText?: string) {
  console.log("🔍 분석 시작 URL:", url);

  try {
    let bodyText = "";
    let title = "";
    
    // 1. 🌟 구글 주소를 진짜 언론사 주소로 즉시 변환
    const targetUrl = resolveGoogleUrl(url);

    if (manualText && manualText.trim().length > 0) {
      bodyText = manualText.trim().slice(0, 15000);
      title = "직접 입력된 콘텐츠";
    } else {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });
      
      if (!response.ok) throw new Error(`사이트 접속 실패 (${response.status})`);
      
      const html = await response.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer, header, aside, iframe, noscript").remove();
      
      title = $("title").text().trim() || $("meta[property='og:title']").attr("content") || "";
      
      bodyText = $("article").text() || $("#content").text() || $(".article_view").text() || $(".article-body").text() || $("main").text() || "";

      if (bodyText.replace(/\s+/g, " ").trim().length < 100) {
        bodyText = $("p").map((i, el) => $(el).text()).get().join(" ");
      }

      bodyText = bodyText.replace(/\s+/g, " ").trim().slice(0, 15000);
      console.log("✅ 본문 추출 완료 (길이):", bodyText.length);

      if (bodyText.length < 50) throw new Error("본문을 읽어올 수 없습니다.");
    }

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp", 
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    다음 뉴스 기사를 분석하고 JSON 포맷으로 요약해줘.
    오늘 날짜는 ${new Date().toISOString().split('T')[0]}이야.
    
    [기사 정보]
    - URL: ${targetUrl}
    - 제목: ${title}
    - 본문 내용: ${bodyText}

    [필수 요청 사항]
    1. shortSummary: 뉴스 목록 카드에 들어갈 50자 이내의 아주 핵심적인 한 줄 요약 (한국어).
    2. detailedSummary: 상세 요약 문장 3개 배열 (한국어).
    3. insight: 이 뉴스가 '에듀테크'나 'AI 산업'에 미치는 영향이나 시사점 (150자 이내, 한국어).
    4. category: 다음 중 가장 적절한 ID 선택 (EDUTECH_AI, AI_TECH, AI_SERVICE, TREND, INVESTMENT, POLICY, RESEARCH, NEW_PRODUCT).
    5. tags: 관련 해시태그 3~5개.
    6. 영어 기사라도 제목 및 내용은 모두 한국어로 번역해서 작성할 것.

    [출력 JSON 형식]
    {
      "title": "${title.replace(/"/g, "'")}", 
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
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        let parsedData = JSON.parse(text);
        if (Array.isArray(parsedData)) parsedData = parsedData[0];
        
        // 🌟 해독된 진짜 URL을 결과에 포함시켜 반환
        return { ...parsedData, resolvedUrl: targetUrl };
    } catch (e) {
        throw new Error("AI 분석 결과 형식이 잘못되었습니다.");
    }

  } catch (error: any) {
    console.error("❌ 최종 분석 실패:", error);
    throw new Error(error.message || "뉴스 분석 과정에서 오류가 발생했습니다.");
  }
}

export async function generateTrendHeadline(newsList: { title: string; summary: string }[]) {
  if (!newsList || newsList.length === 0) return { headline: "현재 분석할 뉴스가 충분하지 않습니다." };

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" },
    });

    const combinedText = newsList.map((n, i) => `${i + 1}. ${n.title} (${n.summary})`).join("\n");

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
      \${combinedText}

      [출력 JSON]
      { "headline": "여기에 헤드라인 작성" }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    return { headline: "AI 트렌드 분석 중..." };
  }
}