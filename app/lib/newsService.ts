import { 
    collection, addDoc, getDocs, deleteDoc, updateDoc, doc, 
    query, orderBy, limit, serverTimestamp, Timestamp 
  } from "firebase/firestore";
  import { db, auth } from "@/lib/firebase"; // auth 추가 (작성자 ID 가져오기 위함)
  
  // authorId가 추가된 인터페이스
  export interface NewsArticle {
    id?: string;
    url: string;
    title: string;
    source: string;
    shortSummary: string;
    detailedSummary: string[];
    insight: string;
    category: string;
    tags: string[];
    publishedAt?: any;
    createdAt?: any;
    views?: number;
    likes?: number;
    authorId?: string; 
  }
  
  // 뉴스 저장하기 (자동으로 작성자 ID 저장)
  export async function addNews(data: any) {
    try {
      const pubDate = data.date ? new Date(data.date) : new Date();
      
      // 현재 로그인한 사용자 확인
      const user = auth.currentUser;
      const authorId = user ? user.uid : 'anonymous'; // 로그인 안 했으면 'anonymous'
  
      const docRef = await addDoc(collection(db, "news"), {
        ...data,
        publishedAt: Timestamp.fromDate(pubDate),
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        isVisible: true,
        authorId: authorId // DB에 작성자 ID 저장
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
  
  // 목록 가져오기
  export async function getRecentNews(limitCount = 20) {
    try {
      const q = query(
        collection(db, "news"),
        orderBy("publishedAt", "desc"),
        limit(limitCount)
      );
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
  
  // 주간 요약 목록 가져오기
  export async function getWeeklySummaries() {
    try {
      const q = query(
        collection(db, "weekly_summaries"),
        orderBy("created_at", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching summaries:", error);
      return [];
    }
  }
  
  // 🌟 [신규] 주간 요약 수정하기 (추가된 부분)
  export async function updateWeeklySummary(id: string, data: any) {
    try {
      const summaryRef = doc(db, "weekly_summaries", id);
      await updateDoc(summaryRef, data);
    } catch (error) {
      console.error("Error updating summary: ", error);
      throw error;
    }
  }