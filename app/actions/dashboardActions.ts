'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// 🌟 리포트의 [표시 이름]과 [연결 링크]를 대시보드 전용으로 저장하는 함수
export async function updateReportMapping(reportId: string, serviceName: string, serviceUrl: string) {
  try {
    const reportRef = doc(db, 'reports', reportId);
    
    // analysis_result 내부에 이름과 URL을 모두 저장
    await updateDoc(reportRef, {
      "analysis_result.mapped_service_name": serviceName,
      "analysis_result.mapped_service_url": serviceUrl
    });
    
    return { success: true };
  } catch (error) {
    console.error("Update Mapping Error:", error);
    return { success: false, error: "수정 실패" };
  }
}