'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

export interface ReportInput { siteName: string; content: string; }
export interface AnalysisResult { success: boolean; data?: { analysisResult: any }; error?: string; }
export interface SaveResult { success: boolean; reportId?: string; error?: string; }

async function analyzeWithGemini(combinedText: string, reportType: string): Promise<any> {
  console.log('GEMINI_API_KEY Loaded:', process.env.GEMINI_API_KEY ? 'YES' : 'NO');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let specificPrompt = "";

  // ======================================================================================
  // 🤖 LLM 모드: 사용자가 지정한 6대 카테고리 1:1 매핑
  // ======================================================================================
  if (reportType === "LLM") {
    specificPrompt = `
      **[분석 모드: LLM 정밀 분석]**
      사용자가 입력한 데이터 소스를 바탕으로, 아래 **6가지 카테고리**에 대한 분석 결과를 **무조건** 생성해라.

      **[데이터 매핑 규칙 (절대 준수)]**
      1. 💻 **코딩 & 개발 (Coding)**: 
         - 소스: **Artificial Analysis** (LiveCodeBench, HumanEval 점수)
      2. 🧮 **수학 & 논리 (Math)**: 
         - 소스: **Artificial Analysis** (MATH, AIME, GSM8K 점수)
      3. 🇰🇷 **한국어 능력 (Korean)**: 
         - 소스: LMSYS **'Korean'** 탭 데이터 (없으면 Overall 점수 참고하여 추정)
      4. 📝 **창의력 & 글쓰기 (Creative Writing)**: 
         - 소스: LMSYS **'Creative Writing'** 탭 데이터
      5. 🤖 **지시 이행 (Instruction Following)**: 
         - 소스: LMSYS **'Instruction Following'** 탭 데이터
      6. 🔬 **프롬프트 이해도 (Hard Prompts)**: 
         - 소스: LMSYS **'Hard Prompts'** 탭 데이터

      **[통합 랭킹 (Overall) 기준]**
      - LMSYS **'Overall'** 탭의 Elo 점수 순위를 그대로 따를 것.

      **[작성 가이드]**
      - 위 6개 카테고리는 **데이터가 조금이라도 있으면 무조건 결과에 포함**시켜라. (누락 금지)
      - 만약 특정 탭(예: Korean) 데이터가 아예 없으면, 'Overall' 순위를 참고하여 Top 5를 채우고 설명에 "종합 점수 기반 추정"이라고 적어라.
    `;
  } 
  // ... (Image, Video, Coding, Agent, Service 모드는 기존과 동일하게 유지)
  else if (reportType === "Image") {
    specificPrompt = `
      **[분석 모드: 이미지 생성 AI]**
      1. ✨ **text_to_image**: LMSYS Text-to-Image Elo 순위.
      2. 🖌️ **image_editing**: LMSYS Image Editing Elo 순위.
      (가격/속도 제외)
    `;
  }
  else if (reportType === "Video") { specificPrompt = `**[분석 모드: 영상 AI]** VBench 기준. 품질/움직임/일관성/시간.`; }
  else if (reportType === "Coding") { specificPrompt = `**[분석 모드: 코딩 툴]** Aider(편집) + LiveCodeBench(생성).`; }
  else if (reportType === "Agent") { specificPrompt = `**[분석 모드: 에이전트]** GAIA 기준 성공률.`; }
  else if (reportType === "Service") { specificPrompt = `**[분석 모드: 서비스 랭킹]** 인기/만족도 기준.`; }

  const prompt = `
    너는 'AI 데이터 분석가'야. 제공된 텍스트를 분석해.
    ${specificPrompt}

    [공통 작성 가이드]
    1. **Top 5 필수:** 모든 카테고리(LLM은 6개)에 대해 상위 5개 모델을 반드시 추출해라.
    2. **점수:** 숫자만 표기.
    3. **한글 작성:** 설명은 한국어로.

    [응답 포맷 (JSON Only)]
    {
      "report_type": "${reportType}",
      "report_title": "2025년 11월 ${reportType} 분석 리포트",
      "overview_summary": ["🔥 트렌드", "👑 1위", "💡 인사이트"],
      
      // [LLM 모드일 때 필수 포함해야 할 6개 항목]
      "best_for_purpose": [
        { "category": "코딩 & 개발", "icon": "💻", "model_name": "...", "reason": "...", "score_summary": "..." },
        { "category": "수학 & 논리", "icon": "🧮", "model_name": "...", "reason": "...", "score_summary": "..." },
        { "category": "한국어 능력", "icon": "🇰🇷", "model_name": "...", "reason": "...", "score_summary": "..." },
        { "category": "창의력 & 글쓰기", "icon": "📝", "model_name": "...", "reason": "...", "score_summary": "..." },
        { "category": "지시 이행", "icon": "🤖", "model_name": "...", "reason": "...", "score_summary": "..." },
        { "category": "프롬프트 이해도", "icon": "🔬", "model_name": "...", "reason": "...", "score_summary": "..." }
      ],
      "deep_analysis": [
        { "category": "코딩 & 개발", "analysis": "...", "top_models": [{ "rank": 1, "model": "...", "score": 95 }] },
        // ... 나머지 5개 카테고리도 동일하게 작성
      ],
      "benchmark_integration": [ { "rank": 1, "model": "...", "tier": "S-Tier", "description": "..." } ],

      // [이미지 전용]
      "text_to_image": [], "image_editing": []
    }

    [데이터 소스]
    ${combinedText.substring(0, 1000000)}
  `;

  try {
    console.log(`🚀 Gemini에게 분석 요청 시작 (모드: ${reportType})...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
    return { raw: "", parsed: false };
  }
}

// (하단 Firestore 함수들은 기존 그대로 유지)
async function saveToFirestore(t:string, r:any){const db=getDb();return(await addDoc(collection(db,'reports'),{report_title:t,analysis_result:r,created_at:serverTimestamp(),status:'completed'})).id;}
export async function analyzeReports(r:ReportInput[],t:string){if(!r.length)return{success:false,error:''};try{const c=r.map((i,x)=>`Src ${x}:${i.siteName}\n${i.content}`).join('\n');const res=await analyzeWithGemini(c,t);return{success:true,data:{analysisResult:res}};}catch(e){return{success:false,error:''}}}
export async function saveReportToDB(t:string,r:any){try{const id=await saveToFirestore(t||"리포트",r);return{success:true,reportId:id}}catch(e){return{success:false,error:''}}}
export async function getAllReports(){const db=getDb();const q=query(collection(db,'reports'),orderBy('created_at','desc'));return(await getDocs(q)).docs.map(d=>({id:d.id,...d.data(),created_at:d.data().created_at?.toDate().toISOString()||new Date().toISOString()}))}
export async function getReportById(id:string){const db=getDb();const d=await getDoc(doc(db,'reports',id));return d.exists()?{id:d.id,...d.data()}:null}
export async function getLatestReport(){const db=getDb();const q=query(collection(db,'reports'),orderBy('created_at','desc'),limit(1));const s=await getDocs(q);return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()}}