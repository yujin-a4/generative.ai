'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';

export interface ReportInput { siteName: string; content: string; }
export interface AnalysisResult { success: boolean; data?: { analysisResult: any }; error?: string; }

// ─────────────────────────────────────────────
// AA API: TTS ELO 자동 수집
// ─────────────────────────────────────────────
export async function fetchTTSEloFromAPI(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) return { success: false, error: 'ARTIFICIAL_ANALYSIS_API_KEY가 설정되지 않았습니다.' };

  try {
    const res = await fetch('https://artificialanalysis.ai/api/v2/data/media/text-to-speech', {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) return { success: false, error: `AA API 오류: ${res.status} ${res.statusText}` };
    const json = await res.json();
    return { success: true, data: json.data || [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    return { success: false, error: `AA API 호출 실패: ${msg}` };
  }
}

// ─────────────────────────────────────────────
// [Fix 7] 안전한 JSON 파서 (new Function() 완전 제거)
// ─────────────────────────────────────────────
function cleanAndParseJSON(text: string): any {
  let cleanText = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // JSON 객체 범위 추출
  const firstBrace = cleanText.indexOf('{');
  const lastBrace  = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  // 흔한 JSON 문법 오류 정리
  cleanText = cleanText
    .replace(/,(\s*[}\]])/g,  '$1')       // trailing comma
    .replace(/:\s*undefined/g, ': null')  // JS undefined
    .replace(/:\s*NaN/g,       ': null')  // JS NaN
    .replace(/:\s*Infinity/g,  ': null')  // JS Infinity
    .replace(/:\s*-Infinity/g, ': null'); // JS -Infinity

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error('[analyze] JSON 파싱 실패. Raw (앞 500자):', text.substring(0, 500));
    throw new Error('AI 응답을 JSON으로 변환하는 데 실패했습니다. 다시 시도해주세요.');
  }
}

// ─────────────────────────────────────────────
// [Fix 4] Video 제조사 종합 순위 — 코드에서 직접 계산 (AI 위임 제거)
// ─────────────────────────────────────────────
function calculateVideoManufacturerRanking(rawData: any): any[] {
  const vbenchTotal: any[] = rawData?.test_benchmarks?.total_ranking   || [];
  const t2vItems:    any[] = rawData?.vote_rankings?.sub_categories?.text_to_video?.items  || [];
  const i2vItems:    any[] = rawData?.vote_rankings?.sub_categories?.image_to_video?.items || [];

  const orgStats: Record<string, { testRanks: number[]; voteRanks: number[] }> = {};

  vbenchTotal.forEach((item: any, idx: number) => {
    const org = item.org || 'Others';
    if (org === 'Others') return;
    if (!orgStats[org]) orgStats[org] = { testRanks: [], voteRanks: [] };
    orgStats[org].testRanks.push(idx + 1);
  });

  [...t2vItems, ...i2vItems].forEach((item: any, idx: number) => {
    const org = item.org || 'Others';
    if (org === 'Others') return;
    if (!orgStats[org]) orgStats[org] = { testRanks: [], voteRanks: [] };
    orgStats[org].voteRanks.push(idx + 1);
  });

  return Object.entries(orgStats)
    .map(([org, stats]) => {
      const testAvg = stats.testRanks.length
        ? stats.testRanks.reduce((a, b) => a + b, 0) / stats.testRanks.length
        : 99;
      const voteAvg = stats.voteRanks.length
        ? stats.voteRanks.reduce((a, b) => a + b, 0) / stats.voteRanks.length
        : 99;
      const score = (testAvg + voteAvg) / 2;
      return {
        org,
        test_rank: parseFloat(testAvg.toFixed(1)),
        vote_rank: parseFloat(voteAvg.toFixed(1)),
        score:     parseFloat(score.toFixed(1)),
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((item, idx) => ({ rank: idx + 1, ...item }));
}

// ─────────────────────────────────────────────
// Gemini 분석 함수 (프롬프트 전면 개선)
// ─────────────────────────────────────────────
async function analyzeWithGemini(combinedText: string, reportType: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 40000 },
  });

  let prompt = '';
  const type = reportType.toUpperCase();

  // ══════════════════════════════════════════
  //  LLM 프롬프트
  //  Fix 2: 컬럼 번호 하드코딩 → 헤더 이름 매핑
  //  Fix 5: 소스별 출력 필드 명시
  //  Fix 6: org enum 목록 추가
  //  Fix 8: report_title 제거 (코드에서 생성)
  // ══════════════════════════════════════════
  if (type === 'LLM') {
    prompt = `
너는 'AI 벤치마크 데이터 파서'이다. 아래 규칙을 반드시 준수하라.

[소스 매핑 — 절대 규칙]
입력 데이터는 여러 Source로 구분되어 있다.
각 Source를 반드시 지정된 출력 필드로만 매핑하라:
- Source 1 (LiveBench)           → test_benchmarks 섹션 전체
- Source 2 (Overall)             → vote_rankings.overall
- Source 3 (Coding)              → vote_rankings.sub_categories.coding
- Source 4 (Hard Prompts)        → vote_rankings.sub_categories.hard_prompts
- Source 5 (Creative Writing)    → vote_rankings.sub_categories.creative_writing
- Source 6 (Multi-turn)          → vote_rankings.sub_categories.multi_turn
- Source 7 (Instruction)         → vote_rankings.sub_categories.instruction_following
- Source 8 (Korean)              → vote_rankings.sub_categories.korean

[규칙 1: LiveBench (Source 1) 파싱]
- 첫 행(헤더)의 컬럼명을 정확히 읽어라. 컬럼 번호(위치)에 절대 의존하지 말라.
- 헤더명 "Global Average" 컬럼 값 기준 내림차순 Top 10 → total_ranking
- 헤더명 "Reasoning"     컬럼 값 기준 내림차순 Top 10 → sub_categories.reasoning
- 헤더명 "Coding"        컬럼 값 기준 내림차순 Top 10 → sub_categories.coding
- 헤더명 "Mathematics" 또는 "Math" 컬럼 값 기준 내림차순 Top 10 → sub_categories.math
- 헤더명 "Data Analysis" 컬럼 값 기준 내림차순 Top 10 → sub_categories.data_analysis
- 해당 헤더명이 없으면 가장 유사한 이름의 컬럼을 사용하라.
- 점수는 반드시 0~100 사이 숫자여야 한다. 그 외 값이면 null 처리.

[규칙 2: LMSYS (Source 2~8) 파싱]
- 각 소스는 Rank 순서로 정렬된 표다. 위에서 아래로 순서대로 추출.
- 각 행에서 Model명, Elo 점수(보통 900~1500 사이 숫자), Organization을 추출.
- 각 소스별 Top 10 추출.
- Elo 점수가 없으면 Score 또는 Arena Score를 사용하라.

[규칙 3: org 필드 — 반드시 아래 목록에서 정확히 선택 (대소문자·띄어쓰기 주의)]
허용 값: "OpenAI" | "Anthropic" | "Google" | "xAI" | "Meta" | "Mistral" | "Cohere" | "Amazon" | "Microsoft" | "DeepSeek" | "Qwen" | "Others"
매핑 힌트:
- GPT, o1, o3, ChatGPT → "OpenAI"
- Claude, Haiku, Sonnet, Opus → "Anthropic"
- Gemini, Bard, PaLM → "Google"
- Grok → "xAI"
- Llama, LLaMA → "Meta"
- 모델명만 있고 제조사가 불분명하면 → "Others"

[규칙 4: comment]
각 sub_categories의 comment는 해당 카테고리 순위 데이터를 보고 한글 1문장 분석을 작성하라.

[규칙 5: summary_insights]
정확히 5문장의 총평. 구체적 모델명, 제조사, 순위, 점수를 반드시 포함하라.

[출력 JSON — 이 형식 외의 최상위 필드를 추가하지 말 것]
{
  "report_type": "LLM",
  "raw_data": {
    "test_benchmarks": {
      "total_ranking": [ {"rank":1, "model":"Claude 3.7 Sonnet", "score":75.3, "org":"Anthropic"}, ... ],
      "sub_categories": {
        "reasoning":     { "items": [ {"rank":1, "model":"...", "score":80.1, "org":"Anthropic"} ], "comment": "한글 코멘트" },
        "coding":        { "items": [], "comment": "" },
        "math":          { "items": [], "comment": "" },
        "data_analysis": { "items": [], "comment": "" }
      }
    },
    "vote_rankings": {
      "overall": [ {"rank":1, "model":"...", "elo":1350, "org":"Anthropic"}, ... ],
      "sub_categories": {
        "korean":                { "items": [ {"rank":1, "model":"...", "elo":1300, "org":"Anthropic"} ], "comment": "" },
        "coding":                { "items": [], "comment": "" },
        "hard_prompts":          { "items": [], "comment": "" },
        "creative_writing":      { "items": [], "comment": "" },
        "multi_turn":            { "items": [], "comment": "" },
        "instruction_following": { "items": [], "comment": "" }
      }
    }
  },
  "summary_insights": ["문장1", "문장2", "문장3", "문장4", "문장5"]
}

[입력 데이터]
${combinedText}
    `;

  // ══════════════════════════════════════════
  //  IMAGE 프롬프트
  // ══════════════════════════════════════════
  } else if (type === 'IMAGE') {
    prompt = `
너는 '이미지 생성 AI 벤치마크 파서'이다.
입력 데이터는 LMSYS Arena Text-to-Image 및 Image Edit 리더보드 표이다.

[소스 매핑]
- Source 1 (Text-to-Image) → vote_rankings.sub_categories.text_to_image
- Source 2 (Image Edit)    → vote_rankings.sub_categories.image_edit

[규칙 1: 파싱]
- 각 표에서 Model명, Elo Score(보통 900~1500 사이), Organization을 추출.
- Elo 기준 내림차순 Top 10 추출.
- vote_rankings.overall: 두 카테고리 전체에서 Elo 1위 모델 기준으로 Top 5를 구성.

[규칙 2: org 필드 — 반드시 아래 목록에서 선택]
허용 값: "OpenAI" | "Google" | "Midjourney" | "Adobe" | "Stability AI" | "Flux" | "ByteDance" | "Kling" | "Others"
매핑 힌트:
- DALL-E, GPT-image → "OpenAI"
- Imagen, Gemini-image → "Google"
- Firefly → "Adobe"
- FLUX, Black Forest Labs → "Flux"
- Seedream → "ByteDance"

[규칙 3: comment 및 summary_insights]
- comment: 각 카테고리 한글 1문장 분석.
- summary_insights: 정확히 5문장, 구체적 수치 포함.

[출력 JSON]
{
  "report_type": "IMAGE",
  "raw_data": {
    "test_benchmarks": { "total_ranking": [], "sub_categories": {} },
    "vote_rankings": {
      "overall": [ {"rank":1, "model":"...", "elo":1250, "org":"Midjourney"}, ... ],
      "sub_categories": {
        "text_to_image": { "items": [ {"rank":1, "model":"...", "elo":1250, "org":"Midjourney"} ], "comment": "" },
        "image_edit":    { "items": [], "comment": "" }
      }
    }
  },
  "summary_insights": ["...", "...", "...", "...", "..."]
}

[입력 데이터]
${combinedText}
    `;

  // ══════════════════════════════════════════
  //  VIDEO 프롬프트
  //  Fix 3: complex_landscape 검증 + 수정 행동 명시
  //  Fix 4: vote_rankings.overall 빈 배열 (코드에서 계산)
  //  Fix 6: org enum 목록 추가
  // ══════════════════════════════════════════
  } else if (type === 'VIDEO') {
    prompt = `
너는 '영상 생성 AI 벤치마크 파서'이다.
입력 데이터는 3개의 Source로 구분되어 있다.

[소스 매핑]
- Source 1 (VBench)            → test_benchmarks 섹션 전체
- Source 2 (Text-to-Video)     → vote_rankings.sub_categories.text_to_video
- Source 3 (Image-to-Video)    → vote_rankings.sub_categories.image_to_video

[규칙 1: VBench (Source 1) 정밀 파싱]
- 첫 행(헤더)의 컬럼명을 정확히 읽어라. 컬럼 번호(위치)에 절대 의존하지 말라.
- 헤더명 "Total Score" 컬럼 기준 내림차순 Top 10 → total_ranking
- 아래 8개 헤더명을 정확히 식별하여 각각 Top 10 추출:
  "Human Anatomy"        → sub_categories.human_anatomy
  "Motion Smoothness" 또는 "Motion Rationality" → sub_categories.motion_rationality
  "Instance Preservation" → sub_categories.instance_preservation
  "Human Identity"       → sub_categories.human_identity
  "Dynamic Attribute"    → sub_categories.dynamic_attribute
  "Complex Plot"         → sub_categories.complex_plot
  "Camera Motion"        → sub_categories.camera_motion
  "Complex Landscape"    → sub_categories.complex_landscape

[규칙 1-보조: Complex Landscape 반드시 검증]
- Complex Landscape 점수는 원래 5~30 사이가 정상이다.
- 추출한 값이 70 이상이면 → 잘못된 컬럼을 읽은 것이다.
- 이 경우 헤더를 다시 확인하고, "Complex Landscape" 텍스트가 있는 컬럼을 정확히 찾아 재추출하라.
- 재추출 후에도 값이 70 이상이면 null로 처리하라.

점수 포맷: "85.20%" → 85.2 (숫자로 변환), % 기호 제거.

[규칙 2: org 필드 — 반드시 아래 목록에서 정확히 선택]
허용 값: "Google" | "OpenAI" | "Alibaba" | "Kuaishou" | "Tencent" | "Zhipu AI" | "ShengShu" | "Runway" | "Luma" | "Hailuo AI" | "StepFun" | "Wondershare" | "Others"
매핑 힌트:
- Veo, Imagen (video) → "Google"
- Sora → "OpenAI"
- Wan, Qwen (video) → "Alibaba"
- Kling → "Kuaishou"
- Hunyuan → "Tencent"
- CogVideo, CogVideoX → "Zhipu AI"
- Vidu → "ShengShu"
- Gen-3, Gen-4 → "Runway"
- Hailuo → "Hailuo AI"
- StepVideo → "StepFun"
- ToMoviee → "Wondershare"

[규칙 3: LMSYS (Source 2, 3)]
- 각 표에서 Model명, Elo(보통 900~1500 사이), Organization 추출.
- Top 10씩 추출.

[규칙 4: vote_rankings.overall]
- 빈 배열 [] 로 두어라. (서버에서 자동으로 계산하여 채운다.)

[규칙 5: comment 및 summary_insights]
- comment: 각 카테고리 한글 1문장 분석.
- summary_insights: 정확히 5문장, 구체적 모델명과 수치 포함.

[출력 JSON]
{
  "report_type": "VIDEO",
  "raw_data": {
    "test_benchmarks": {
      "total_ranking": [ {"rank":1, "model":"Veo 3", "score":85.2, "org":"Google"}, ... ],
      "sub_categories": {
        "human_anatomy":         { "items": [ {"rank":1, "model":"...", "score":90.1, "org":"Google"} ], "comment": "" },
        "motion_rationality":    { "items": [], "comment": "" },
        "instance_preservation": { "items": [], "comment": "" },
        "human_identity":        { "items": [], "comment": "" },
        "dynamic_attribute":     { "items": [], "comment": "" },
        "complex_plot":          { "items": [], "comment": "" },
        "camera_motion":         { "items": [], "comment": "" },
        "complex_landscape":     { "items": [], "comment": "" }
      }
    },
    "vote_rankings": {
      "overall": [],
      "sub_categories": {
        "text_to_video":  { "items": [ {"rank":1, "model":"...", "elo":1200, "org":"Google"} ], "comment": "" },
        "image_to_video": { "items": [], "comment": "" }
      }
    }
  },
  "summary_insights": ["...", "...", "...", "...", "..."]
}

[입력 데이터]
${combinedText}
    `;

  // ══════════════════════════════════════════
  //  TTS 프롬프트 — 4축(품질/속도/가격/오픈소스) 전면 개선
  // ══════════════════════════════════════════
  } else if (type === 'TTS') {
    prompt = `
너는 'TTS(Text-to-Speech) AI 벤치마크 파서'이다.
입력 데이터는 최대 2개의 소스로 구성된다.

[소스 정의]
- Source 1 (AA API ELO JSON): Artificial Analysis API에서 가져온 TTS 모델 ELO 데이터 (JSON 형식).
- Source 2 (AA Models Page, 선택): AA Text-to-Speech Models 페이지의 Speed + Price 표 (없을 수 있음).

[소스 매핑]
- Source 1 → vote_rankings.overall + vote_rankings.sub_categories.open_weights
- Source 2 → vote_rankings.sub_categories.speed + vote_rankings.sub_categories.price

[규칙 1: Source 1 파싱 — ELO JSON]
입력이 JSON 형식이면 다음 필드를 추출하라:
  - name: 모델명
  - model_creator.name: 제조사명
  - elo: ELO 점수 (없으면 rank 기준)
  - rank: 순위 (낮을수록 상위)
- rank 기준 오름차순 Top 10 → vote_rankings.overall (elo 필드에 ELO 점수)
- is_open_weights가 true이거나 오픈소스로 알려진 모델(Fish Audio S2 Pro, Kokoro, StyleTTS 2, MetaVoice, XTTS, OpenVoice, Voxtral TTS, Chatterbox 등) 분리 → Top 5 → vote_rankings.sub_categories.open_weights.items (elo 필드)
- open_weights의 comment: 오픈소스 1위 모델과 ELO를 언급한 한글 1문장.

[규칙 2: Source 2 파싱 — Models Page (없으면 빈 배열 유지)]
- Speed(chars/sec 또는 characters/second) 컬럼: 내림차순 Top 10 → sub_categories.speed.items (score 필드)
- Price($/1M chars 또는 price per 1M characters) 컬럼: 오름차순(낮은 순) Top 10 → sub_categories.price.items (score 필드)
- 각 comment: 해당 지표 1위 모델과 수치를 언급한 한글 1문장.

[규칙 3: org 필드 — 반드시 아래 목록에서 정확히 선택]
허용 값: "ElevenLabs" | "OpenAI" | "Google" | "Microsoft" | "Amazon" | "Inworld" | "Cartesia" | "Hume AI" | "MiniMax" | "StepFun" | "Mistral" | "xAI" | "Others"
매핑 힌트:
- TTS-1, TTS-1 HD → "OpenAI"
- Neural2, WaveNet, Chirp → "Google"
- Azure HD → "Microsoft"
- Polly → "Amazon"
- Inworld TTS → "Inworld"
- Sonic → "Cartesia"
- Speech-02 → "MiniMax"
- Step Audio → "StepFun"
- Voxtral TTS → "Mistral"
- Fish Audio, Kokoro, StyleTTS, MetaVoice, XTTS, OpenVoice, Chatterbox → "Others"

[규칙 4: summary_insights — 정확히 5문장]
- 1문장: Elo 점수 기준 전체 1위 모델과 제조사 언급.
- 2문장: Top 3 모델과 Elo 점수 나열.
- 3문장: 속도 Best (있을 경우) 또는 오픈소스 Best 언급.
- 4문장: 가격 효율 Best (있을 경우) 또는 무료 대안 언급.
- 5문장: 전체 TTS 시장 트렌드 인사이트.

[출력 JSON]
{
  "report_type": "TTS",
  "raw_data": {
    "test_benchmarks": { "total_ranking": [], "sub_categories": {} },
    "vote_rankings": {
      "overall": [ {"rank":1, "model":"Inworld TTS 1.5 Max", "elo":1215, "org":"Inworld"}, ... ],
      "sub_categories": {
        "open_weights":  { "items": [ {"rank":1, "model":"Fish Audio S2 Pro", "elo":1165, "org":"Others"} ], "comment": "..." },
        "speed":         { "items": [ {"rank":1, "model":"...", "score":5000, "org":"..."} ], "comment": "..." },
        "price":         { "items": [ {"rank":1, "model":"Kokoro 82M v1.0", "score":0.65, "org":"Others"} ], "comment": "..." }
      }
    }
  },
  "summary_insights": ["...", "...", "...", "...", "..."]
}

[입력 데이터]
${combinedText}
    `;

  // ══════════════════════════════════════════
  //  STT 프롬프트 — 3축(정확도/속도/가격) 전면 개선
  // ══════════════════════════════════════════
  } else if (type === 'STT') {
    prompt = `
너는 'STT(Speech-to-Text) AI 벤치마크 파서'이다.
입력 데이터는 Artificial Analysis Speech-to-Text 비교 페이지이다.
이 페이지에는 AA-WER(정확도), Speed Factor(속도), Price(가격) 3가지 지표가 포함되어 있다.

[지표 정의]
- AA-WER(%): 낮을수록 좋음. 정상 범위 2~15%.
- Speed Factor(x): 높을수록 빠름. 실시간 처리 배율, 정상 범위 10x~600x.
- Price($/1000min): 낮을수록 저렴. 음성 1000분 변환 비용(USD).

[소스 매핑]
- Source 1 (AA STT): test_benchmarks 전체 (정확도 + 속도 + 가격)

[규칙 1: total_ranking — 정확도(AA-WER) 기준]
- AA-WER 오름차순(낮은 순) Top 10 추출.
- score 필드에 AA-WER 값(숫자)을 넣어라.
- AA-WER이 없을 경우 WER 컬럼명의 유사 항목을 사용.

[규칙 2: sub_categories.speed — 속도(Speed Factor) 기준]
- Speed Factor 내림차순(높은 순) Top 10 추출.
- score 필드에 Speed Factor 값(숫자)을 넣어라.
- comment: 속도 1위 모델과 수치를 언급한 한글 1문장.

[규칙 3: sub_categories.price — 가격(Price) 기준]
- Price/1000min 오름차순(낮은 순) Top 10 추출.
- score 필드에 Price 값(숫자)을 넣어라.
- comment: 가격 1위 모델과 수치를 언급한 한글 1문장.

[규칙 4: org 필드 — 반드시 아래 목록에서 정확히 선택]
허용 값: "OpenAI" | "Google" | "Microsoft" | "ElevenLabs" | "Deepgram" | "AssemblyAI" | "Mistral" | "Nvidia" | "Amazon" | "Meta" | "Gladia" | "Others"
매핑 힌트:
- Whisper, GPT-4o Transcribe → "OpenAI"
- Gemini, Chirp → "Google"
- MAI-Transcribe, Azure → "Microsoft"
- Scribe → "ElevenLabs"
- Nova, Base → "Deepgram"
- Universal → "AssemblyAI"
- Voxtral → "Mistral"
- Parakeet, Canary → "Nvidia"
- Amazon Transcribe, Nova (Amazon) → "Amazon"
- MMS, Wav2Vec, SeamlessM4T → "Meta"

[규칙 5: summary_insights — 정확히 5문장]
- 1문장: "WER(오류율)이 낮을수록 정확한 인식"임을 명시하며 1위 모델과 WER 수치 언급.
- 2문장: 속도 Top 3와 배율 수치 언급.
- 3문장: 가격 효율 Best 모델과 비용 언급.
- 4문장: 정확도와 속도 모두 우수한 모델 추천.
- 5문장: 전체 트렌드 및 시사점.

[출력 JSON]
{
  "report_type": "STT",
  "raw_data": {
    "test_benchmarks": {
      "total_ranking": [ {"rank":1, "model":"Scribe v2", "score":2.3, "org":"ElevenLabs"}, ... ],
      "sub_categories": {
        "speed": { "items": [ {"rank":1, "model":"Base", "score":531.5, "org":"Deepgram"} ], "comment": "속도 1위..." },
        "price": { "items": [ {"rank":1, "model":"Gemini 2.0 Flash Lite", "score":0.19, "org":"Google"} ], "comment": "가격 1위..." }
      }
    },
    "vote_rankings": { "overall": [], "sub_categories": {} }
  },
  "summary_insights": ["WER이 낮을수록 정확한 인식이며...", "...", "...", "...", "..."]
}

[입력 데이터]
${combinedText}
    `;

  // ══════════════════════════════════════════
  //  기타 보조 프롬프트 (기본 파서)
  // ══════════════════════════════════════════
  } else {
    prompt = `
너는 '${reportType}' 분야 AI 벤치마크 파서이다.
입력 데이터에서 순위 정보를 추출하여 아래 JSON 형식으로 출력하라.

[규칙]
- 표에서 Model명, Score, Organization을 추출하여 total_ranking에 넣어라.
- Score 기준 내림차순 Top 10.
- summary_insights: 정확히 5문장 한글 총평.

[출력 JSON]
{
  "report_type": "${reportType}",
  "raw_data": {
    "test_benchmarks": {
      "total_ranking": [ {"rank":1, "model":"...", "score":0, "org":"..."} ],
      "sub_categories": {}
    },
    "vote_rankings": { "overall": [], "sub_categories": {} }
  },
  "summary_insights": ["...", "...", "...", "...", "..."]
}

[입력 데이터]
${combinedText}
    `;
  }

  try {
    const result   = await model.generateContent(prompt);
    const response = await result.response;
    const text     = response.text();
    return cleanAndParseJSON(text);
  } catch (error) {
    console.error('[analyze] Gemini Error:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// 공개 액션: 분석 실행 + 후처리
// ─────────────────────────────────────────────
export async function analyzeReports(reports: ReportInput[], reportType: string): Promise<AnalysisResult> {
  if (reports.length === 0) return { success: false, error: '데이터 없음' };

  try {
    const combinedText = reports
      .map((r, i) => `=== Source ${i + 1}: ${r.siteName} ===\n${r.content}`)
      .join('\n\n');

    console.log(`🚀 [${reportType}] 분석 시작`);
    const analysisResult = await analyzeWithGemini(combinedText, reportType);

    // [Fix 8 & 9] report_type / report_title 을 코드에서 직접 생성
    const now  = new Date();
    const norm = reportType.toUpperCase();
    analysisResult.report_type  = norm;
    analysisResult.report_title =
      `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${norm} 순위 리포트`;

    // [Fix 4] Video: 제조사 종합 순위를 코드에서 직접 계산
    if (norm === 'VIDEO' && analysisResult.raw_data) {
      analysisResult.raw_data.vote_rankings =
        analysisResult.raw_data.vote_rankings || {};
      analysisResult.raw_data.vote_rankings.overall =
        calculateVideoManufacturerRanking(analysisResult.raw_data);
    }

    // STT/TTS는 전용 렌더러(ReportViewSTT, ReportViewTTS)가 처리 — 별도 후처리 불필요

    return { success: true, data: { analysisResult } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '오류 발생';
    console.error('[analyze] analyzeReports Error:', msg);
    return { success: false, error: msg };
  }
}

// ─────────────────────────────────────────────
// DB CRUD
// ─────────────────────────────────────────────
export async function saveReportToDB(t: string, r: any) {
  try {
    const id = (await addDoc(collection(db, 'reports'), {
      report_title: t, analysis_result: r, created_at: serverTimestamp(), status: 'completed',
    })).id;
    return { success: true, reportId: id };
  } catch (e) {
    return { success: false, error: '저장 실패' };
  }
}

export async function getAllReports() {
  try {
    const q        = query(collection(db, 'reports'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      created_at: d.data().created_at?.toDate
        ? d.data().created_at.toDate().toISOString()
        : new Date().toISOString(),
    }));
  } catch (error) {
    return [];
  }
}

export async function getReportById(id: string) {
  try {
    const d = await getDoc(doc(db, 'reports', id));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  } catch (error) {
    return null;
  }
}

export async function getLatestReport() {
  try {
    const q = query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(1));
    const s = await getDocs(q);
    return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
  } catch (error) {
    return null;
  }
}

export async function deleteReport(id: string) {
  try {
    await deleteDoc(doc(db, 'reports', id));
    return { success: true };
  } catch (error) {
    return { success: false, error: '삭제 실패' };
  }
}