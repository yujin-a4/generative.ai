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
  try {
    let pageContent = "";
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      pageContent = `Title: ${titleMatch?.[1] || "Unknown"}, Desc: ${metaDescMatch?.[1] || "Unknown"}`;
    } catch (e) { console.log("메타데이터 추출 실패"); }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
      Analyze this URL: ${url}
      Context: ${pageContent}
      
      Return JSON:
      {
        "name": "Service Name",
        "category": "One of [LLM, IMAGE, VIDEO, TTS, STT, CODING, UIUX, PRESENTATION, RESEARCH, WORKSPACE, AGENT, OTHER]",
        "description": "한글로 100자 이내 요약",
        "pricing": "One of [FREE, PAID, FREEMIUM]",
        "supportsKorean": true/false,
        "isTrending": true/false,
        "tags": ["태그1", "태그2", "태그3"]
      }

      [Important Rules]
      1. "tags": Extract 3-5 key features as keywords. **MUST BE IN KOREAN.** (e.g., "이미지생성", "무료", "고화질")
      2. "description": Must be in Korean.
      3. "pricing": Must be strictly "FREE", "PAID", or "FREEMIUM".
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