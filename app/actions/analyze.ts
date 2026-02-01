'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';

export interface ReportInput { siteName: string; content: string; }
export interface AnalysisResult { success: boolean; data?: { analysisResult: any }; error?: string; }

// 🛠️ [Fix] 강력한 JSON 파싱 함수 (오류 방지)
function cleanAndParseJSON(text: string) {
  try {
    // 1. 마크다운 코드 블록 제거
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. JSON 객체 범위 추출
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    // 3. 흔한 문법 오류(Trailing Comma) 제거
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');

    try {
      return JSON.parse(cleanText);
    } catch (e) {
      // 4. 유연한 파싱 시도
      console.warn("Standard JSON parse failed, retrying with loose parser...");
      return new Function("return " + cleanText)();
    }
  } catch (error) {
    console.error("JSON Parse Error. Raw Text:", text.substring(0, 500));
    throw new Error("AI 응답을 JSON으로 변환하는 데 실패했습니다.");
  }
}

async function analyzeWithGemini(combinedText: string, reportType: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // ⚡ gemini-2.5-flash (속도/성능 최적화)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 40000 } 
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const reportTitle = `${year}년 ${month}월 ${reportType} 순위 리포트`;

  let prompt = "";
  
  // 🔴 [LLM] 기존 로직 유지
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


      [출력 JSON 포맷]
      {
        "report_type": "LLM",
        "report_title": "${reportTitle}",
        "raw_data": {
          "test_benchmarks": {
             "total_ranking": [ {"rank":1, "model":"...", "score":0, "org":"..."}, ... ], 
             "sub_categories": {
               "reasoning": { "items": [], "comment": "" },
               "coding": { "items": [], "comment": "" },
               "math": { "items": [], "comment": "" },
               "data_analysis": { "items": [], "comment": "" }
             }
          },
          "vote_rankings": {
             "overall": [ {"rank":1, "model":"...", "elo":1350, "org":"..."}, ... ], 
             "sub_categories": {
               "korean": { "items": [], "comment": "" },
               "coding": { "items": [], "comment": "" },
               "hard_prompts": { "items": [], "comment": "" },
               "creative_writing": { "items": [], "comment": "" },
               "multi_turn": { "items": [], "comment": "" },
               "instruction_following": { "items": [], "comment": "" }
             }
          }
        },
        "summary_insights": [ "...", "...", "...", "...", "..." ]
      }
      [입력 데이터]
      ${combinedText}
    `;
  } else {
    const isImage = reportType.toUpperCase() === "IMAGE";
    const isVideo = reportType.toUpperCase() === "VIDEO";

    if (isImage) {
        // 🔵 [Image] 기존 로직 유지
        prompt = `
            너는 '이미지 생성 AI 벤치마크 분석가'이다.
            입력된 텍스트에서 Text-to-Image와 Image Edit 순위를 추출하라.
            
            [출력 JSON 포맷]
            {
              "report_type": "IMAGE",
              "report_title": "${reportTitle}",
              "raw_data": {
                "test_benchmarks": { "total_ranking": [], "sub_categories": {} },
                "vote_rankings": { 
                   "overall": [ {"rank":1, "model":"...", "elo":1200, "org":"..."} ... ],
                   "sub_categories": {
                     "text_to_image": { "items": [], "comment": "" },
                     "image_edit": { "items": [], "comment": "" }
                   }
                }
              },
              "summary_insights": ["...", "...", "...", "...", "..."]
            }
            [입력 데이터]
            ${combinedText}
        `;
    } else if (isVideo) {
        // 🟣 [Video] Prompt 수정: VBench 컬럼 매핑 정밀도 강화
        prompt = `
            너는 '영상 생성 AI 분석가'이다. 
            제공된 텍스트는 3개의 소스(Source)로 구분되어 있다.
            
            [🚨 절대 규칙 1: VBench (Source 1) 정밀 파싱]
            - 입력 텍스트는 표(Table) 데이터이다. **헤더(Header)의 순서를 먼저 파악하라.**
            - 일반적인 VBench 헤더 순서 예시: [Model, ..., Total Score, Human Anatomy, Human Clothes, ..., Complex Landscape, ..., Instance Preservation]
            - 각 헤더별로 높은 점수 순서로 정렬하여 Top 10을 추출하라. (데이터는 총점 기준으로 높은 순서대로 정렬되어 있다. 카테고리별 분석을 할 때는 카테고리별 점수 기준으로 정렬하라.)
            - **주의:** 'Complex Landscape' 점수는 보통 낮게 나온다 (7%~25% 사이). 만약 80% 이상이라면 다른 컬럼(Human Anatomy 등)을 잘못 읽은 것이다. **헤더 이름을 정확히 매칭하라.**
            
            **[추출할 8대 핵심 항목]**
            1. **human_anatomy** ("Human Anatomy")
            2. **motion_rationality** ("Motion Rationality" or "Motion Smoothness")
            3. **instance_preservation** ("Instance Preservation")
            4. **human_identity** ("Human Identity")
            5. **dynamic_attribute** ("Dynamic Attribute")
            6. **complex_plot** ("Complex Plot")
            7. **camera_motion** ("Camera Motion")
            8. **complex_landscape** ("Complex Landscape") - **값 확인 필수! (보통 5~30점대)**

            - **[필수] Org (제조사) 매핑:** Model 이름을 보고 반드시 제조사를 추론해서 채워라.
              - StepVideo -> "StepFun"
              - Veo / Imagen -> "Google"
              - Sora -> "OpenAI"
              - Wan / Qwen -> "Alibaba"
              - Kling -> "Kuaishou"
              - Vidu -> "ShengShu"
              - Hunyuan -> "Tencent"
              - CogVideo -> "Zhipu AI"
              - ToMoviee -> "Wondershare"
              - Hailuo -> "Hailuo AI"
              
            - **[필수] Score 포맷:** "85.20%" -> 85.2 (숫자).

            [🚨 절대 규칙 2: LMSYS (Source 2, 3) 파싱]
            - Source 2(Text-to-Video) -> **vote_rankings.sub_categories.text_to_video**
            - Source 3(Image-to-Video) -> **vote_rankings.sub_categories.image_to_video**
            - **반드시 Score(Elo)가 높은 순서대로 Top 10을 뽑아라.**

            [🚨 절대 규칙 3: 제조사 종합 순위 (Overall) 계산]
            - 개별 모델이 아니라 **제조사(Org)별 종합 순위**를 계산하라.
            - **VBench(Test)**와 **LMSYS(Vote)** 순위를 평균 내어라.
            - **[중요] Score(평균 순위)가 "낮은" 순서대로(1위, 2위...) 오름차순 정렬하라.**
            - **Top 5 제조사만 남겨라.**
            - **소수점 1자리까지만 남겨라 (예: 2.6).**
            - 출력 포맷: rank(1~5), org(제조사명), test_rank(평균 순위), vote_rank(평균 순위), score(종합 평균).

            [출력 JSON 포맷]
            {
              "report_type": "VIDEO",
              "report_title": "${reportTitle}",
              "raw_data": {
                "test_benchmarks": { 
                  "total_ranking": [ {"rank":1, "model":"...", "score": 85.2, "org":"..."}, ... ],
                  "sub_categories": {
                    "human_anatomy": { "items": [ {"model":"...", "score":90.2, "org":"..."}, ... ], "comment": "" },
                    "motion_rationality": { "items": [], "comment": "" },
                    "instance_preservation": { "items": [], "comment": "" },
                    "human_identity": { "items": [], "comment": "" },
                    "dynamic_attribute": { "items": [], "comment": "" },
                    "complex_plot": { "items": [], "comment": "" },
                    "camera_motion": { "items": [], "comment": "" },
                    "complex_landscape": { "items": [], "comment": "" }
                  }
                },
                "vote_rankings": { 
                   "overall": [ {"rank":1, "org":"Google", "test_rank": 5.0, "vote_rank": 2.6, "score": 3.8} ... ],
                   "sub_categories": {
                     "text_to_video": { "items": [], "comment": "" },
                     "image_to_video": { "items": [], "comment": "" }
                   }
                }
              },
              "summary_insights": ["...", "...", "...", "...", "..."]
            }
            [입력 데이터]
            ${combinedText}
        `;
    } else {
        // 기타
        prompt = `
          너는 '${reportType}' 분야 분석가이다. 
          [출력 JSON 포맷]
          {
            "report_type": "${reportType}",
            "report_title": "${reportTitle}",
            "raw_data": {
              "test_benchmarks": { "total_ranking": [], "sub_categories": {} },
              "vote_rankings": { "overall": [], "sub_categories": {} }
            },
            "summary_insights": ["...", "...", "...", "...", "..."]
          }
          [입력 데이터]
          ${combinedText}
        `;
    }
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // 🛠️ 강화된 파싱 함수 사용
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error; 
  }
}

export async function analyzeReports(reports: ReportInput[], reportType: string): Promise<AnalysisResult> {
  if (reports.length === 0) return { success: false, error: '데이터 없음' };
  try {
    const combinedText = reports.map((r, i) => `=== Source ${i + 1}: ${r.siteName} ===\n${r.content}`).join('\n\n');
    console.log(`🚀 [${reportType}] 분석 시작`);
    const analysisResult = await analyzeWithGemini(combinedText, reportType);
    return { success: true, data: { analysisResult } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '오류 발생' };
  }
}

// ... (DB 함수들 기존 유지)
export async function saveReportToDB(t: string, r: any) {
  try {
    const id = (await addDoc(collection(db, 'reports'), {
      report_title: t, analysis_result: r, created_at: serverTimestamp(), status: 'completed'
    })).id;
    return { success: true, reportId: id };
  } catch (e) { return { success: false, error: '저장 실패' }; }
}

export async function getAllReports() {
  try {
    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), created_at: d.data().created_at?.toDate ? d.data().created_at.toDate().toISOString() : new Date().toISOString() }));
  } catch (error) { return []; }
}

export async function getReportById(id: string) {
  try {
    const d = await getDoc(doc(db, 'reports', id));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  } catch (error) { return null; }
}

export async function getLatestReport() {
  try {
    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(1));
    const s = await getDocs(q);
    return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
  } catch (error) { return null; }
}

export async function deleteReport(id: string) {
  try {
    await deleteDoc(doc(db, 'reports', id));
    return { success: true };
  } catch (error) { return { success: false, error: "삭제 실패" }; }
}