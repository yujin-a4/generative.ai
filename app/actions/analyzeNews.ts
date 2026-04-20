"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Google News 리다이렉트 URL → 실제 기사 URL 해석
 * 1차: HTTP redirect follow (가장 신뢰도 높음)
 * 2차: base64 디코딩 시도
 */
async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url || !url.includes("news.google.com")) return url;

  // 1차: HTTP redirect follow
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const finalUrl = res.url;
    if (finalUrl && !finalUrl.includes("news.google.com")) {
      console.log("🎯 HTTP 리다이렉트 해독:", finalUrl);
      return finalUrl;
    }
    // JavaScript 리다이렉트 파싱 시도
    const html = await res.text();
    const jsRedirect = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/);
    if (jsRedirect?.[1] && !jsRedirect[1].includes("news.google.com")) {
      console.log("🎯 JS 리다이렉트 해독:", jsRedirect[1]);
      return jsRedirect[1];
    }
  } catch (e) {
    console.warn("HTTP redirect 추적 실패:", e);
  }

  // 2차: base64 디코딩
  try {
    const parts = url.split("/");
    const encoded = parts[parts.length - 1]?.split("?")?.[0];
    if (encoded) {
      const buf = Buffer.from(encoded, "base64");
      const decoded = buf.toString("binary");
      const start = decoded.indexOf("http");
      if (start !== -1) {
        const suffix = decoded.substring(start);
        const end = suffix.search(/[^\x20-\x7E]/);
        const resolved = end !== -1 ? suffix.substring(0, end) : suffix;
        if (resolved.startsWith("http") && !resolved.includes("news.google.com")) {
          console.log("🎯 base64 해독 성공:", resolved);
          return resolved;
        }
      }
    }
  } catch (e) {
    console.warn("base64 해독 실패:", e);
  }

  return url;
}

export async function analyzeNewsArticle(
  url: string,
  manualText?: string,
  fallbackText?: string  // RSS 요약 텍스트 (URL fetch 실패 시 사용)
) {
  console.log("🔍 분석 시작 URL:", url);

  try {
    let bodyText = "";
    let title = "";

    // Google URL → 실제 기사 URL 변환
    const targetUrl = await resolveGoogleNewsUrl(url);
    console.log("🔗 최종 접속 URL:", targetUrl);

    if (manualText && manualText.trim().length > 0) {
      // 사용자 직접 입력
      bodyText = manualText.trim().slice(0, 15000);
      title = "직접 입력된 콘텐츠";
    } else {
      // URL에서 본문 fetch
      let fetchSuccess = false;
      try {
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (response.ok) {
          const html = await response.text();
          const { load } = await import("cheerio");
          const $ = load(html);
          $("script, style, nav, footer, header, aside, iframe, noscript").remove();

          title =
            $("title").text().trim() ||
            $("meta[property='og:title']").attr("content") ||
            "";

          bodyText =
            $("article").text() ||
            $("#content").text() ||
            $(".article_view").text() ||
            $(".article-body").text() ||
            $("main").text() ||
            "";

          if (bodyText.replace(/\s+/g, " ").trim().length < 100) {
            bodyText = $("p")
              .map((_, el) => $(el).text())
              .get()
              .join(" ");
          }

          bodyText = bodyText.replace(/\s+/g, " ").trim().slice(0, 15000);
          console.log("✅ 본문 추출 완료 (길이):", bodyText.length);
          if (bodyText.length >= 50) fetchSuccess = true;
        }
      } catch (fetchErr) {
        console.warn("⚠️ URL fetch 실패:", fetchErr);
      }

      // fetch 실패 또는 본문 부족 → RSS 요약 텍스트 사용
      if (!fetchSuccess) {
        if (fallbackText && fallbackText.trim().length >= 30) {
          console.log("📋 RSS 요약 텍스트로 대체 분석");
          bodyText = fallbackText.trim().slice(0, 5000);
        } else {
          throw new Error("본문을 읽어올 수 없습니다. (URL fetch 실패, RSS 요약도 없음)");
        }
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
    다음 뉴스 기사를 분석하고 JSON 포맷으로 요약해줘.
    이 뉴스 사이트는 교육 출판사 직원들이 사용하는 AI 트렌드 모니터링 플랫폼이야.
    오늘 날짜는 ${new Date().toISOString().split("T")[0]}이야.
    
    [기사 정보]
    - URL: ${targetUrl}
    - 제목: ${title}
    - 본문 내용: ${bodyText}

    [필수 요청 사항]
    1. shortSummary: 뉴스 목록 카드에 들어갈 50자 이내의 핵심 한 줄 요약 (한국어).
    2. detailedSummary: 상세 요약 문장 3개 배열 (한국어).
    3. insight: 교육 출판사 관점에서 이 뉴스의 시사점 (150자 이내, 한국어).
    4. category: 아래 5개 카테고리 중 하나만 선택.
    5. tags: subTags 목록에서 1~2개 반드시 포함 + 기타 관련 해시태그 2~3개, 총 3~5개.
    6. 영어 기사라도 제목 및 내용은 모두 한국어로 번역해서 작성할 것.

    [카테고리 판단 기준]
    - AI_TECH     : AI 모델 출시(GPT·Claude·Gemini 등), 연구/논문, 오픈소스, AI 에이전트, 이미지·영상·음성 AI 기술 자체
    - AI_SERVICE  : 사용자가 직접 쓸 수 있는 AI 앱·SaaS·플랫폼(Notion AI, Copilot, Cursor 등), B2B 솔루션·API
    - EDUTECH_AI  : AI가 교육 현장·방법론에 적용된 구체적 사례 (AI 튜터, 자동채점, 개인화학습 효과 연구)
    - EDU_INDUSTRY: 에듀테크·출판 기업 동향, 교육 정책, 교재 시장 변화, 해외 에듀테크, 교육업계 투자·M&A
    - POLICY      : AI 관련 법률·규제·저작권·윤리·개인정보·고용 정책 (교육 정책은 → EDU_INDUSTRY)

    [subTags — 카테고리에 맞는 것 1~2개 반드시 포함]
    AI_TECH    : #LLM/챗봇, #멀티모달, #AI에이전트, #이미지생성, #영상/음성AI
    AI_SERVICE : #업무생산성, #콘텐츠제작, #코딩/개발, #B2B솔루션, #검색/정보
    EDUTECH_AI : #AI튜터/코치, #디지털교재, #평가/채점AI, #교육현장사례, #맞춤학습
    EDU_INDUSTRY: #에듀테크기업, #출판/교재시장, #해외에듀테크
    POLICY     : #AI규제, #저작권/지재권, #AI윤리, #고용/노동, #개인정보

    [출력 JSON 형식]
    {
      "title": "${title.replace(/"/g, "'")}",
      "source": "언론사명",
      "date": "YYYY-MM-DD",
      "shortSummary": "한 줄 요약",
      "detailedSummary": ["요약1", "요약2", "요약3"],
      "insight": "교육 출판사 관점 인사이트",
      "category": "EDU_INDUSTRY",
      "tags": ["#교육정책", "#에듀테크기업", "#AI교육"]
    }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      let parsedData = JSON.parse(text);
      if (Array.isArray(parsedData)) parsedData = parsedData[0];
      return { ...parsedData, resolvedUrl: targetUrl };
    } catch {
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
      model: "gemini-2.5-flash",
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