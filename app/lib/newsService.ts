import { 
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc, 
  query, where, orderBy, limit, serverTimestamp, Timestamp,
  arrayUnion, arrayRemove 
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; 

export interface NewsArticle {
  id?: string;
  url: string;
  title: string;
  source: string;
  author?: string; // 🌟 [추가] 작성자 이름 필드
  shortSummary: string;
  detailedSummary: string[];
  insight: string;
  category: string;
  tags: string[];
  publishedAt?: any;
  createdAt?: any;
  views?: number;
  likes?: number;
  likedBy?: string[]; 
  bookmarkedBy?: string[];
  authorId?: string; 
}

// 뉴스 저장하기
export async function addNews(data: any) {
  try {
    const pubDate = data.date ? new Date(data.date) : new Date();
    const user = auth.currentUser;
    const authorId = user ? user.uid : 'anonymous'; 

    const docRef = await addDoc(collection(db, "news"), {
      ...data,
      publishedAt: Timestamp.fromDate(pubDate),
      createdAt: serverTimestamp(),
      views: 0,
      likes: 0,
      likedBy: [],
      bookmarkedBy: [],
      isVisible: true,
      authorId: authorId 
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding news: ", error);
    throw error;
  }
}

// 뉴스 수정하기
export async function updateNews(id: string, data: any) {
  try {
    const newsRef = doc(db, "news", id);
    const pubDate = data.date ? new Date(data.date) : null;
    
    const updateData: any = { ...data };
    if (pubDate) {
      updateData.publishedAt = Timestamp.fromDate(pubDate);
    }
    delete updateData.date;

    await updateDoc(newsRef, updateData);
  } catch (error) {
    console.error("Error updating news: ", error);
    throw error;
  }
}

// 뉴스 삭제하기
export async function deleteNews(id: string) {
  try {
    await deleteDoc(doc(db, "news", id));
  } catch (error) {
    console.error("Error deleting news: ", error);
    throw error;
  }
}

// [수정] sortBy 타입에 'created' 추가
export async function getRecentNews(limitCount = 20, sortBy: 'latest' | 'likes' | 'created' = 'latest') {
  try {
    const newsCollection = collection(db, "news");
    let q;

    if (sortBy === 'likes') {
      q = query(newsCollection, orderBy("likes", "desc"), limit(limitCount));
    } else if (sortBy === 'created') {
      // 🌟 [추가] 등록순(createdAt) 정렬 로직
      q = query(newsCollection, orderBy("createdAt", "desc"), limit(limitCount));
    } else {
      q = query(newsCollection, orderBy("publishedAt", "desc"), limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as NewsArticle[];
  } catch (error) {
    console.error("Error fetching news: ", error);
    return [];
  }
}

// 내가 즐겨찾기한 뉴스만 가져오기
export async function getBookmarkedNews(userId: string) {
  try {
    const q = query(
      collection(db, "news"),
      where("bookmarkedBy", "array-contains", userId),
      orderBy("publishedAt", "desc"),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as NewsArticle[];
  } catch (error) {
    console.error("Error fetching bookmarks: ", error);
    return [];
  }
}

// =====================
// 주간 요약 관련
// =====================

// getNewsForSummary 함수: 특정 기간의 뉴스 데이터를 Gemini에게 전달하기 위해 조회
export async function getNewsForSummary(startDate: Date, endDate: Date) {
  try {
    const q = query(
      collection(db, "news"),
      where("publishedAt", ">=", Timestamp.fromDate(startDate)),
      where("publishedAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("publishedAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      title: doc.data().title,
      shortSummary: doc.data().shortSummary,
      tags: doc.data().tags,
      category: doc.data().category,
    }));
  } catch (error) {
    console.error("Error fetching news for summary:", error);
    return [];
  }
}

// addWeeklySummary 함수: Gemini가 생성한 최종 리포트 저장
export async function addWeeklySummary(summaryData: any) {
  try {
    const docRef = await addDoc(collection(db, "weekly_summaries"), {
      ...summaryData,
      created_at: serverTimestamp(),
      isPublished: false, // 기본적으로 비공개
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding weekly summary:", error);
    throw error;
  }
}

// 주간 요약 목록 가져오기
export async function getWeeklySummaries(includeUnpublished = false) {
  try {
    const q = query(collection(db, "weekly_summaries"));
    const snapshot = await getDocs(q);
    
    let summaries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    if (!includeUnpublished) {
      summaries = summaries.filter((s: any) => s.isPublished === true);
    }
    
    summaries.sort((a: any, b: any) => {
      const aTime = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
      const bTime = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
      return bTime - aTime;
    });
    
    return summaries.slice(0, 10);
  } catch (error) {
    console.error("Error fetching weekly summaries:", error);
    return [];
  }
}

// 특정 주차의 주간 요약 가져오기
export async function getWeeklySummaryByWeek(weekLabel: string, includeUnpublished = false) {
  try {
    let q;
    if (includeUnpublished) {
      q = query(
        collection(db, "weekly_summaries"),
        where("week_label", "==", weekLabel),
        limit(1)
      );
    } else {
      q = query(
        collection(db, "weekly_summaries"),
        where("week_label", "==", weekLabel),
        where("isPublished", "==", true),
        limit(1)
      );
    }
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching weekly summary:", error);
    return null;
  }
}

// 주간 요약 수정하기
export async function updateWeeklySummary(id: string, data: any) {
  try {
    const summaryRef = doc(db, "weekly_summaries", id);
    await updateDoc(summaryRef, data);
  } catch (error) {
    console.error("Error updating summary: ", error);
    throw error;
  }
}

// 주간 요약 공개하기
export async function publishWeeklySummary(id: string) {
  try {
    const summaryRef = doc(db, "weekly_summaries", id);
    await updateDoc(summaryRef, { isPublished: true });
  } catch (error) {
    console.error("Error publishing weekly summary: ", error);
    throw error;
  }
}

// 주간 요약 삭제하기
export async function deleteWeeklySummary(id: string) {
  try {
    await deleteDoc(doc(db, "weekly_summaries", id));
  } catch (error) {
    console.error("Error deleting weekly summary: ", error);
    throw error;
  }
}

// =====================
// 월간 요약 관련
// =====================

export async function getMonthlySummaries(includeUnpublished = false) {
  try {
    const q = query(collection(db, "monthly_summaries"));
    const snapshot = await getDocs(q);
    
    let summaries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    if (!includeUnpublished) {
      summaries = summaries.filter((s: any) => s.isPublished === true);
    }
    
    summaries.sort((a: any, b: any) => {
      const aTime = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
      const bTime = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
      return bTime - aTime;
    });
    
    return summaries.slice(0, 12);
  } catch (error) {
    console.error("Error fetching monthly summaries:", error);
    return [];
  }
}

export async function getMonthlySummaryByMonth(year: number, month: number, includeUnpublished = false) {
  try {
    let q;
    if (includeUnpublished) {
      q = query(
        collection(db, "monthly_summaries"),
        where("year", "==", year),
        where("month", "==", month),
        limit(1)
      );
    } else {
      q = query(
        collection(db, "monthly_summaries"),
        where("year", "==", year),
        where("month", "==", month),
        where("isPublished", "==", true),
        limit(1)
      );
    }
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return null;
  }
}

export async function updateMonthlySummary(id: string, data: any) {
  try {
    const summaryRef = doc(db, "monthly_summaries", id);
    await updateDoc(summaryRef, data);
  } catch (error) {
    console.error("Error updating monthly summary: ", error);
    throw error;
  }
}

export async function publishMonthlySummary(id: string) {
  try {
    const summaryRef = doc(db, "monthly_summaries", id);
    await updateDoc(summaryRef, { isPublished: true });
  } catch (error) {
    console.error("Error publishing monthly summary: ", error);
    throw error;
  }
}

export async function deleteMonthlySummary(id: string) {
  try {
    await deleteDoc(doc(db, "monthly_summaries", id));
  } catch (error) {
    console.error("Error deleting monthly summary: ", error);
    throw error;
  }
}

// =====================
// 좋아요 / 북마크
// =====================

export async function toggleLikeNews(newsId: string, userId: string, currentLikedBy: string[] = []) {
  try {
    const newsRef = doc(db, "news", newsId);
    const isLiked = currentLikedBy.includes(userId);
  
    if (isLiked) {
      await updateDoc(newsRef, {
          likedBy: arrayRemove(userId),
          likes: (currentLikedBy.length - 1)
      });
    } else {
      await updateDoc(newsRef, {
          likedBy: arrayUnion(userId),
          likes: (currentLikedBy.length + 1)
      });
    }
  } catch (error) {
    console.error("Error toggling like: ", error);
    throw error;
  }
}

export async function toggleBookmarkNews(newsId: string, userId: string, currentBookmarkedBy: string[] = []) {
  try {
    const newsRef = doc(db, "news", newsId);
    const isBookmarked = currentBookmarkedBy.includes(userId);
  
    if (isBookmarked) {
      await updateDoc(newsRef, {
          bookmarkedBy: arrayRemove(userId)
      });
    } else {
      await updateDoc(newsRef, {
          bookmarkedBy: arrayUnion(userId)
      });
    }
  } catch (error) {
    console.error("Error toggling bookmark: ", error);
    throw error;
  }
}

// 🌟 [추가] 대시보드 헤드라인용: 최근 2주간의 뉴스 가져오기
export async function getRecentHeadlines(days = 14) {
  try {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    // 토큰 절약을 위해 최소한의 필드만 가져옵니다.
    const q = query(
      collection(db, "news"),
      where("publishedAt", ">=", Timestamp.fromDate(dateLimit)),
      orderBy("publishedAt", "desc"),
      limit(30) // Gemini 컨텍스트 고려하여 최대 30개로 제한
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      title: doc.data().title,
      summary: doc.data().shortSummary || doc.data().summary
    }));
  } catch (error) {
    console.error("Error fetching headlines:", error);
    return [];
  }
}


/**
 * 🛠️ [마이그레이션] 기존 뉴스 카테고리를 새로운 ID 체계로 일괄 변경합니다.
 */
export async function migrateNewsCategories() {
  const newsCollection = collection(db, "news");
  const querySnapshot = await getDocs(newsCollection);
  
  // 구버전 ID -> 신버전 ID 매핑 테이블
  const MIGRATION_MAP: Record<string, string> = {
    'RESEARCH': 'AI_TECH',
    'AI_TOOLS': 'AI_SERVICE',
    'INDUSTRY_TREND': 'TREND',
    'COMPANY_NEWS': 'INVESTMENT',
    'POLICY_ETHICS': 'POLICY',
    'PRODUCT_RELEASE': 'NEW_PRODUCT'
  };

  let count = 0;

  console.log("🚀 카테고리 마이그레이션 시작...");

  for (const newsDoc of querySnapshot.docs) {
    const data = newsDoc.data();
    const oldCategory = data.category;

    // 매핑 테이블에 해당되는 구버전 카테고리가 있다면 업데이트
    if (MIGRATION_MAP[oldCategory]) {
      const newsRef = doc(db, "news", newsDoc.id);
      await updateDoc(newsRef, {
        category: MIGRATION_MAP[oldCategory]
      });
      console.log(`✅ [${newsDoc.id}] ${oldCategory} -> ${MIGRATION_MAP[oldCategory]} 변경 완료`);
      count++;
    }
  }

  console.log(`✨ 총 ${count}개의 뉴스 카테고리가 성공적으로 업데이트되었습니다.`);
  return count;
}