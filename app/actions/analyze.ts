'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase'; // ✅ db를 직접 import (getDb 제거)
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'; // 🌟 deleteDoc 추가

export interface ReportInput { siteName: string; content: string; }
export interface AnalysisResult { success: boolean; data?: { analysisResult: any }; error?: string; }

async function analyzeWithGemini(combinedText: string, reportType: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요.');

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp', // 모델명 수정 (flash-exp 권장)
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 40000, 
    }
  });

  // 🌟 현재 날짜로 제목 생성
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const reportTitle = `${year}년 ${month}월 LLM 순위 리포트`;

  let prompt = "";
  
  if (reportType === "LLM") {
    prompt = `
      너는 'AI 벤치마크 데이터 파서'이다. 
      입력된 텍스트의 구조(컬럼 순서)를 정확히 파악하여 데이터를 추출하라.

      [🚨 절대 규칙 1: LMSYS (Vote) 추출]
      - **데이터 구조:** [Rank] 순서대로 정렬되어 있다.
      - **행동:** Rank 열의 1위부터 10위까지 Model, Score, Organization을 추출하라. (순차 추출)
      - **Score 파싱:** Score 열에 있는 **숫자(1000 이상)**를 그대로 가져와라.

      [🚨 절대 규칙 2: LiveBench (Test) 추출]
      - **데이터 구조:** [Model] [Org] [Global] [Reasoning] [Coding] [Agentic] [Math] [Data] ...
      - **행동:** 전체 텍스트를 스캔하여 각 항목별로 **점수가 높은 순서대로 재정렬(Re-sort)**하여 Top 10을 뽑아라.
      
      **[재정렬 기준 컬럼]**
      1. **Total Ranking:** [Global Average] (1번째 숫자) 기준 Top 10
      2. **Reasoning:** [Reasoning] (3번째 숫자) 기준 Top 10
      3. **Coding:** [Coding] (4번째 숫자) 기준 Top 10
      4. **Math:** [Mathematics] (6번째 숫자) 기준 Top 10
      5. **Data Analysis:** [Data Analysis] (7번째 숫자) 기준 Top 10
      *(Test 점수는 0~100 사이 숫자만 유효)*

      [🚨 절대 규칙 3: 공통 출력 형식]
      - **Top 10 필수:** 모든 리스트는 10개 아이템으로 채울 것.
      - **제조사(org) 식별:** 모델명을 보고 제조사(OpenAI, Anthropic, Google, xAI, Meta 등)를 반드시 기입.
      - **한줄평(comment):** 각 카테고리별로 데이터 분포를 보고 **한글로 짧은 분석 코멘트**를 작성하라.

      [🚨 절대 규칙 4: 총평 (summary_insights) 작성]
      - 데이터를 종합 분석하여 **정확히 5문장**의 총평을 작성하라.
      - 각 문장은 구체적인 모델명, 제조사명, 순위, 점수 등을 포함해야 한다.
      - 단순 나열이 아닌 **인사이트와 시사점**을 담아라.
      - 예시:
        1. "이번 평가에서 Anthropic의 Claude 4.5 Opus가 Test와 Vote 양쪽에서 1위를 차지하며 종합 최강자로 등극했다."
        2. "OpenAI의 GPT-4o는 코딩과 수학에서 강세를 보였으나, 한국어 성능은 5위에 그쳤다."
        3. "Google Gemini는 멀티턴 대화에서 두각을 나타냈지만, 창의적 글쓰기는 상대적 약점으로 드러났다."
        4. "xAI의 Grok은 Hard Prompts에서 의외의 선전을 했으나, 전반적 안정성은 아직 검증이 필요하다."
        5. "전체적으로 Anthropic과 OpenAI의 양강 구도가 굳어지는 가운데, Google이 추격하는 양상이다."

      [출력 JSON 포맷 (Strict)]
      {
        "report_type": "LLM",
        "report_title": "${reportTitle}",
        "raw_data": {
          "test_benchmarks": {
             "total_ranking": [
                {"rank":1, "model":"...", "score":0, "org":"..."},
                ... (Top 10)
             ], 
             "sub_categories": {
               "reasoning": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "coding": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "math": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "data_analysis": { "items": [ ...Top 10 items... ], "comment": "분석..." }
             }
          },
          "vote_rankings": {
             "overall": [ 
                {"rank":1, "model":"...", "elo":1350, "org":"OpenAI"},
                ... (Top 10)
             ], 
             "sub_categories": {
               "korean": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "coding": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "hard_prompts": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "creative_writing": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "multi_turn": { "items": [ ...Top 10 items... ], "comment": "분석..." },
               "instruction_following": { "items": [ ...Top 10 items... ], "comment": "분석..." }
             }
          }
        },
        "summary_insights": [
           "총평 1문장 (구체적 모델명/점수 포함)...",
           "총평 2문장...",
           "총평 3문장...",
           "총평 4문장...",
           "총평 5문장..."
        ]
      }
      [입력 데이터]
      ${combinedText}
    `;
  } else {
    prompt = `
      너는 'AI 트렌드 분석가'야. '${reportType}' 분야 리포트 작성.
      [JSON 포맷]
      {
        "report_type": "${reportType}",
        "report_title": "${reportType} 트렌드 리포트",
        "overview_summary": ["요약1", "요약2"],
        "text_to_image": [], "image_editing": [], "deep_analysis": [], "benchmark_integration": [] 
      }
      ${combinedText}
    `;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { raw: "", parsed: false };
  }
}

export async function analyzeReports(reports: ReportInput[], reportType: string): Promise<AnalysisResult> {
  if (reports.length === 0) return { success: false, error: '분석할 데이터가 없습니다.' };
  try {
    const combinedText = reports
      .map((report, index) => `=== Source ${index + 1}: ${report.siteName} ===\n\n${report.content}\n\n`)
      .join('\n');
    console.log(`🚀 [${reportType}] v17 분석 시작`);
    const analysisResult = await analyzeWithGemini(combinedText, reportType);
    return { success: true, data: { analysisResult } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
}

// 🌟 DB 함수들 수정: getDb() 삭제 및 db 바로 사용

export async function saveReportToDB(t: string, r: any) {
  try {
    // const db = getDb(); // ❌ 삭제
    const id = (await addDoc(collection(db, 'reports'), {
      report_title: t, analysis_result: r, created_at: serverTimestamp(), status: 'completed'
    })).id;
    return { success: true, reportId: id };
  } catch (e) { 
    console.error("Save Error:", e);
    return { success: false, error: '저장 실패' }; 
  }
}

export async function getAllReports() {
  // const db = getDb(); // ❌ 삭제
  try {
    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ 
      id: d.id, 
      ...d.data(), 
      created_at: d.data().created_at?.toDate ? d.data().created_at.toDate().toISOString() : new Date().toISOString() 
    }));
  } catch (error) {
    console.error("getAllReports Error:", error);
    return [];
  }
}

export async function getReportById(id: string) {
  // const db = getDb(); // ❌ 삭제
  try {
    const d = await getDoc(doc(db, 'reports', id));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  } catch (error) {
    console.error("getReportById Error:", error);
    return null;
  }
}

export async function getLatestReport() {
  // const db = getDb(); // ❌ 삭제
  try {
    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(1));
    const s = await getDocs(q);
    return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
  } catch (error) {
    console.error("getLatestReport Error:", error);
    return null;
  }
}

// 🌟 [추가] 리포트 삭제 함수
export async function deleteReport(id: string) {
  try {
    await deleteDoc(doc(db, 'reports', id));
    return { success: true };
  } catch (error) {
    console.error("Delete Report Error:", error);
    return { success: false, error: "삭제 실패" };
  }
}