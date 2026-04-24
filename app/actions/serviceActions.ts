"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, limit, arrayUnion, arrayRemove } from "firebase/firestore";
import type { AIService } from "@/types/service";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 🛠️ 데이터 변환 헬퍼 (구버전 데이터 호환성 완벽 지원)
 */
function mapDocToService(docSnapshot: any): AIService {
  const data = docSnapshot.data();
  
  // 1. 가격 정보 정규화 (객체 -> 문자열 변환 로직 강화)
  let pricingEnum: 'FREE' | 'PAID' | 'FREEMIUM' = 'PAID'; // 기본값

  if (typeof data.pricing === 'string') {
    // 이미 문자열인 경우 (신규 데이터)
    const upper = data.pricing.toUpperCase();
    if (['FREE', 'PAID', 'FREEMIUM'].includes(upper)) {
      pricingEnum = upper as any;
    }
  } else if (typeof data.pricing === 'object' && data.pricing !== null) {
    // ⚠️ 예전 데이터(객체)인 경우 호환성 처리
    if (data.pricing.free === true) {
      pricingEnum = 'FREE';
    } else if (data.pricing.paid === true && data.pricing.free === false) {
      pricingEnum = 'PAID';
    }
  }

  // 2. 카테고리 정규화 (혹시 소문자로 저장되었거나 없는 경우 대비)
  let category = data.category || "OTHER";
  if (category === "LLM/채팅") category = "LLM"; // 예전 이름 매핑

  // 3. 날짜 변환 로직 (Timestamp -> ISO String)
  const toIsoString = (timestamp: any) => {
    if (!timestamp) return new Date().toISOString();
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    return new Date().toISOString();
  };

  return {
    id: docSnapshot.id,
    name: data.name || "이름 없음",
    url: data.url || "",
    category: category,
    description: data.description || "",
    longDescription: data.longDescription || "",
    
    // 정규화된 가격 정보 사용
    pricing: pricingEnum,
    
    thumbnailUrl: data.thumbnailUrl || data.ogImage || "",
    
    // 🌟 [추가] 작성자 ID 매핑
    authorId: data.authorId || "",
    
    // 배열 필드가 없으면 빈 배열로 초기화 (UI 깨짐 방지)
    pros: Array.isArray(data.pros) ? data.pros : [],
    cons: Array.isArray(data.cons) ? data.cons : [],
    targetUser: Array.isArray(data.targetUser) ? data.targetUser : [],
    features: Array.isArray(data.features) ? data.features : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    
    // 상태 필드
    isPublished: data.isPublished ?? true,
    supportsKorean: data.supportsKorean ?? false,
    isTrending: data.isTrending ?? false,
    
    likes: typeof data.likes === 'number' ? data.likes : 0,
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    bookmarkedBy: Array.isArray(data.bookmarkedBy) ? data.bookmarkedBy : [],
    
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  } as AIService;
}

// 1. 서비스 목록 조회
export async function getAllServices(): Promise<AIService[]> {
  try {
    const q = query(collection(db, "ai_services"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToService);
  } catch (error) {
    console.warn("정렬 조회 실패, 일반 조회 시도:", error);
    try {
      const fallbackQ = query(collection(db, "ai_services"));
      const fallbackSnapshot = await getDocs(fallbackQ);
      return fallbackSnapshot.docs.map(mapDocToService);
    } catch (e) {
      console.error("서비스 목록 조회 최종 실패:", e);
      return [];
    }
  }
}

export async function getAiServices() {
  return getAllServices();
}

// 3. URL 분석
export async function analyzeService(url: string) {
  // 서버 측 URL 유효성 검사
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { success: false, error: "http/https URL만 분석할 수 있습니다." };
    }
  } catch {
    return { success: false, error: "올바른 URL 형식이 아닙니다." };
  }

  try {
    // 페이지 메타데이터 추출 시도
    let pageContent = "";
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
      const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);

      pageContent = [
        `Title: ${titleMatch?.[1] || ogTitleMatch?.[1] || "Unknown"}`,
        `Description: ${metaDescMatch?.[1] || ogDescMatch?.[1] || "Unknown"}`,
        ogImageMatch?.[1] ? `OG Image: ${ogImageMatch[1]}` : "",
      ].filter(Boolean).join("\n");
    } catch (e) { console.log("메타데이터 추출 실패"); }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
당신은 AI 서비스 분석 전문가입니다. 다음 URL의 AI 서비스를 분석하여 JSON을 반환하세요.

URL: ${url}
페이지 정보:
${pageContent}

반환할 JSON 형식:
{
  "name": "서비스 공식 이름 (영문 유지)",
  "category": "LLM | IMAGE | VIDEO | TTS | STT | CODING | UIUX | PRESENTATION | RESEARCH | WORKSPACE | AGENT | OTHER 중 하나",
  "description": "핵심 기능을 담은 한글 한 줄 소개 (70자 이내)",
  "longDescription": "서비스의 특징, 강점, 활용 분야를 포함한 한글 상세 소개 (200~300자)",
  "features": ["핵심 기능 1 (한글, 15자 이내)", "핵심 기능 2", "핵심 기능 3", "핵심 기능 4", "핵심 기능 5"],
  "pros": ["장점 1 (한글, 20자 이내)", "장점 2", "장점 3"],
  "cons": ["단점 또는 제한사항 1 (한글, 20자 이내)", "단점 2"],
  "targetUser": ["추천 대상 1 (예: 개발자, 마케터, 디자이너 등)", "추천 대상 2", "추천 대상 3"],
  "pricing": "FREE | PAID | FREEMIUM 중 하나",
  "supportsKorean": true 또는 false,
  "isTrending": true 또는 false,
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}

[반드시 지킬 규칙]
1. description, longDescription, features, pros, cons, targetUser, tags: 반드시 한글로 작성
2. pricing: 반드시 "FREE", "PAID", "FREEMIUM" 중 정확히 하나
3. features: 정확히 3~5개
4. pros: 정확히 2~4개
5. cons: 정확히 1~3개
6. targetUser: 정확히 2~4개
7. tags: 정확히 3~6개의 핵심 키워드
8. isTrending: 최근 1~2년 내 주목받는 서비스면 true
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);
    
    if (parsed.pricing) parsed.pricing = parsed.pricing.toUpperCase();
    
    return { success: true, data: { ...parsed, url } };

  } catch (error: any) {
    console.error("Analyze Error:", error);
    return { success: false, error: error.message };
  }
}

// 4. 생성
export async function createService(data: AIService) {
  try {
    const docRef = await addDoc(collection(db, "ai_services"), {
      ...data,
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: 0,
      likedBy: [],
      bookmarkedBy: []
    });
    return { success: true, id: docRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 5. 삭제
export async function deleteService(id: string) {
  await deleteDoc(doc(db, "ai_services", id));
  return { success: true };
}

// 6. 수정
export async function updateService(id: string, data: Partial<AIService>) {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
  
  await updateDoc(doc(db, "ai_services", id), { 
    ...cleanData,
    updatedAt: serverTimestamp() 
  });
  return { success: true };
}

// 7. 대시보드 빠른 등록
export async function upsertServiceUrl(name: string, url: string, category: string) {
  try {
    const q = query(collection(db, "ai_services"), where("name", "==", name), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(db, "ai_services", docId), { 
        url: url,
        updatedAt: serverTimestamp()
      });
      return { success: true, message: "기존 서비스의 링크를 업데이트했습니다." };
    } else {
      await addDoc(collection(db, "ai_services"), {
        name: name,
        url: url,
        category: category,
        description: "대시보드에서 관리자가 빠른 추가한 서비스입니다.",
        pricing: "PAID",
        supportsKorean: false,
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        bookmarkedBy: []
      });
      return { success: true, message: "새로운 서비스를 등록하고 링크를 연결했습니다." };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleLikeService(serviceId: string, userId: string, currentLikedBy: string[] = []) {
  try {
    const ref = doc(db, "ai_services", serviceId);
    const isLiked = currentLikedBy.includes(userId);
    if (isLiked) {
      await updateDoc(ref, { likedBy: arrayRemove(userId), likes: (currentLikedBy.length - 1) });
    } else {
      await updateDoc(ref, { likedBy: arrayUnion(userId), likes: (currentLikedBy.length + 1) });
    }
    return { success: true };
  } catch (error: any) {
    console.error("Like Error:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleBookmarkService(serviceId: string, userId: string, currentBookmarkedBy: string[] = []) {
  try {
    const ref = doc(db, "ai_services", serviceId);
    const isBookmarked = currentBookmarkedBy.includes(userId);
    if (isBookmarked) {
      await updateDoc(ref, { bookmarkedBy: arrayRemove(userId) });
    } else {
      await updateDoc(ref, { bookmarkedBy: arrayUnion(userId) });
    }
    return { success: true };
  } catch (error: any) {
    console.error("Bookmark Error:", error);
    return { success: false, error: error.message };
  }
}