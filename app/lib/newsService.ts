import { 
    collection, addDoc, getDocs, deleteDoc, updateDoc, doc, 
    query, where, orderBy, limit, serverTimestamp, Timestamp, // 👈 where 추가 확인
    arrayUnion, arrayRemove 
  } from "firebase/firestore";
  import { db, auth } from "@/lib/firebase"; 
  
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
    likedBy?: string[]; 
    bookmarkedBy?: string[]; // 🌟 [추가] 즐겨찾기한 유저 ID 목록
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
        bookmarkedBy: [], // 🌟 [추가] 초기값
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
  
  // 목록 가져오기 (정렬 포함)
  export async function getRecentNews(limitCount = 20, sortBy: 'latest' | 'likes' = 'latest') {
    try {
      const newsCollection = collection(db, "news");
      let q;

      if (sortBy === 'likes') {
        q = query(newsCollection, orderBy("likes", "desc"), limit(limitCount));
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

  // 🌟 [신규] 내가 즐겨찾기한 뉴스만 가져오기
  export async function getBookmarkedNews(userId: string) {
    try {
      const q = query(
        collection(db, "news"),
        where("bookmarkedBy", "array-contains", userId), // 내 ID가 배열에 있는 것만
        orderBy("publishedAt", "desc"), // 최신순 정렬
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsArticle[];
    } catch (error) {
      console.error("Error fetching bookmarks: ", error);
      // ⚠️ 주의: Firestore 인덱스 에러가 콘솔에 뜨면 링크 클릭해서 인덱스 생성해줘야 함
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

  // 좋아요 토글
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

  // 🌟 [신규] 즐겨찾기(북마크) 토글 함수
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