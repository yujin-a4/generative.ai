'use server';

import { db } from '@/lib/firebase';
import {
  collection, addDoc, serverTimestamp,
  query, orderBy, getDocs, updateDoc, doc,
} from 'firebase/firestore';

export type FeedbackType = '오류 제보' | '기능 건의' | '기타';

export interface FeedbackInput {
  type: FeedbackType;
  title: string;
  content: string;
  contact?: string;
}

export async function submitFeedback(input: FeedbackInput) {
  try {
    await addDoc(collection(db, 'feedbacks'), {
      ...input,
      status: 'pending',           // pending | resolved
      created_at: serverTimestamp(),
    });
    return { success: true };
  } catch (e) {
    console.error('[feedback] submitFeedback error:', e);
    return { success: false, error: '제출에 실패했습니다.' };
  }
}

export async function getAllFeedbacks() {
  try {
    const q        = query(collection(db, 'feedbacks'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      created_at: d.data().created_at?.toDate
        ? d.data().created_at.toDate().toISOString()
        : new Date().toISOString(),
    }));
  } catch (e) {
    return [];
  }
}

export async function markFeedbackResolved(id: string) {
  try {
    await updateDoc(doc(db, 'feedbacks', id), { status: 'resolved' });
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
