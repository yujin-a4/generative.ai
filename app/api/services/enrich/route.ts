import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export const maxDuration = 300; // Vercel Pro: 최대 300초

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/** 서비스 1개를 Gemini로 분석해 보강 필드를 반환 */
async function enrichOne(service: any): Promise<Record<string, any> | null> {
  const { name, url, description, category } = service;

  // 페이지 메타 추출 시도
  let pageMeta = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
    const desc =
      html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ||
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] ||
      "";
    pageMeta = [title && `Title: ${title}`, desc && `Description: ${desc}`]
      .filter(Boolean)
      .join("\n");
  } catch {
    pageMeta = `Name: ${name}\nDescription: ${description || ""}`;
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `
당신은 AI 서비스 분석 전문가입니다. 아래 AI 서비스의 정보를 바탕으로 상세 정보를 한국어로 채워 JSON을 반환하세요.

서비스명: ${name}
카테고리: ${category}
URL: ${url}
페이지 정보:
${pageMeta}

반환 JSON 형식:
{
  "longDescription": "서비스의 특징, 강점, 활용 분야를 담은 한글 상세 소개 (150~250자)",
  "features": ["핵심 기능 1 (15자 이내)", "핵심 기능 2", "핵심 기능 3", "핵심 기능 4"],
  "pros": ["장점 1 (20자 이내)", "장점 2", "장점 3"],
  "cons": ["단점 1 (20자 이내)", "단점 2"],
  "targetUser": ["추천 대상 1", "추천 대상 2", "추천 대상 3"],
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

규칙: 모든 항목은 반드시 한글로 작성. features 3~5개, pros 2~4개, cons 1~3개, targetUser 2~4개, tags 3~6개.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const adminEmail = "yujinkang1008@gmail.com";

  // 간단한 어드민 확인
  if (body.adminEmail !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getDocs(collection(db, "ai_services"));
  const results: { name: string; status: "enriched" | "skipped" | "error"; reason?: string }[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const name: string = data.name || docSnap.id;

    // 이미 내용이 있으면 스킵
    const hasContent =
      typeof data.longDescription === "string" &&
      data.longDescription.trim().length > 20 &&
      Array.isArray(data.features) &&
      data.features.length > 0;

    if (hasContent) {
      results.push({ name, status: "skipped", reason: "already has content" });
      continue;
    }

    if (!data.url) {
      results.push({ name, status: "skipped", reason: "no URL" });
      continue;
    }

    const enriched = await enrichOne({ ...data, id: docSnap.id });

    if (!enriched) {
      results.push({ name, status: "error", reason: "Gemini analysis failed" });
      continue;
    }

    try {
      await updateDoc(doc(db, "ai_services", docSnap.id), {
        longDescription: enriched.longDescription || "",
        features: Array.isArray(enriched.features) ? enriched.features : [],
        pros: Array.isArray(enriched.pros) ? enriched.pros : [],
        cons: Array.isArray(enriched.cons) ? enriched.cons : [],
        targetUser: Array.isArray(enriched.targetUser) ? enriched.targetUser : [],
        tags: Array.isArray(enriched.tags) ? enriched.tags : [],
        updatedAt: serverTimestamp(),
      });
      results.push({ name, status: "enriched" });
    } catch (e: any) {
      results.push({ name, status: "error", reason: e.message });
    }

    // Gemini rate limit 방지
    await new Promise((r) => setTimeout(r, 600));
  }

  const summary = {
    total: results.length,
    enriched: results.filter((r) => r.status === "enriched").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    details: results,
  };

  return NextResponse.json({ success: true, summary });
}
