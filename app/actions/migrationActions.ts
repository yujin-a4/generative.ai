'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── 분류 기준 (프롬프트) ──────────────────────────────────────
const CATEGORY_GUIDE = `
[카테고리 분류 기준 — 반드시 아래 5개 중 하나만 사용]
- AI_TECH     : AI 모델 출시(GPT·Claude·Gemini 등), 연구/논문, 오픈소스, AI 에이전트, 이미지·영상·음성 AI 기술 자체
- AI_SERVICE  : 사용자가 직접 쓸 수 있는 AI 앱·SaaS·플랫폼(Notion AI, Copilot, Cursor 등), B2B 솔루션·API
- EDUTECH_AI  : AI가 교육 현장·방법론에 적용된 구체적 사례 (AI 튜터, 자동채점, 개인화학습 효과 연구)
- EDU_INDUSTRY: 에듀테크·출판 기업 동향, 교육 정책, 교재 시장 변화, 해외 에듀테크, 교육업계 투자·M&A
- POLICY      : AI 관련 법률·규제·저작권·윤리·개인정보·고용 정책 (교육 정책은 → EDU_INDUSTRY)

[구버전 카테고리 → 신버전 매핑 참고]
RESEARCH → AI_TECH / AI_MODEL → AI_TECH / AI_TOOLS → AI_SERVICE
NEW_PRODUCT → AI_SERVICE / PRODUCT_RELEASE → AI_SERVICE
TREND → 주제에 따라 판단 / INVESTMENT → EDU_INDUSTRY
COMPANY_NEWS → EDU_INDUSTRY / INDUSTRY_TREND → EDU_INDUSTRY
POLICY_ETHICS → POLICY

[subTags — 카테고리에 맞는 것 1~2개 반드시 선택]
AI_TECH    : #LLM/챗봇, #멀티모달, #AI에이전트, #이미지생성, #영상/음성AI
AI_SERVICE : #업무생산성, #콘텐츠제작, #코딩/개발, #B2B솔루션, #검색/정보
EDUTECH_AI : #AI튜터/코치, #디지털교재, #평가/채점AI, #교육현장사례, #맞춤학습
EDU_INDUSTRY: #에듀테크기업, #출판/교재시장, #해외에듀테크
POLICY     : #AI규제, #저작권/지재권, #AI윤리, #고용/노동, #개인정보
`.trim();

// ── Gemini 배치 처리 ──────────────────────────────────────────
async function classifyBatch(
  articles: Array<{ id: string; title: string; shortSummary: string; currentCategory: string }>
): Promise<Array<{ id: string; category: string; subTags: string[] }>> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const articleList = articles
    .map((a, i) =>
      `${i + 1}. [현재:${a.currentCategory}] ${a.title}\n   ${a.shortSummary || '(요약 없음)'}`
    )
    .join('\n\n');

  const prompt = `너는 AI/교육 뉴스 분류 전문가야. 이 뉴스 사이트는 교육 출판사 직원들이 사용하는 사내 AI 트렌드 모니터링 플랫폼이야.

${CATEGORY_GUIDE}

아래 뉴스 기사들을 각각 분류하고, 해당 카테고리의 subTags 목록에서 가장 적합한 태그 1~2개를 반드시 선택해줘.
구버전 카테고리("현재:" 표시)인 경우 위 매핑 참고표를 기준으로 신버전으로 변환해줘.

[뉴스 목록]
${articleList}

[응답 형식 — categories 배열의 순서가 위 목록 번호와 정확히 일치해야 함]
{
  "categories": [
    { "category": "AI_TECH", "subTags": ["#LLM/챗봇"] },
    { "category": "EDU_INDUSTRY", "subTags": ["#에듀테크기업"] }
  ]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response
    .text()
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const parsed = JSON.parse(text);
  return articles.map((article, i) => ({
    id: article.id,
    category: parsed.categories[i]?.category || article.currentCategory,
    subTags: parsed.categories[i]?.subTags || [],
  }));
}

// ── 메인 재분류 액션 ─────────────────────────────────────────
export interface ReCategorizeStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  distribution: Record<string, number>;
  errorIds: string[];
}

export async function reCategorizeAllNews(): Promise<{
  success: boolean;
  stats: ReCategorizeStats;
  error?: string;
}> {
  const stats: ReCategorizeStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    distribution: {},
    errorIds: [],
  };

  try {
    const snapshot = await getDocs(collection(db, 'news'));
    const allArticles = snapshot.docs.map((d) => ({
      id: d.id,
      title: (d.data().title || '') as string,
      shortSummary: (d.data().shortSummary || '') as string,
      currentCategory: (d.data().category || '') as string,
      existingTags: (d.data().tags || []) as string[],
    }));

    stats.total = allArticles.length;

    const VALID_CATEGORIES = ['AI_TECH', 'AI_SERVICE', 'EDUTECH_AI', 'EDU_INDUSTRY', 'POLICY'];

    // 모든 기사를 Gemini 배치로 처리 (카테고리 + subTags 동시 처리)
    const BATCH_SIZE = 8;
    for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
      const batch = allArticles.slice(i, i + BATCH_SIZE);

      try {
        const results = await classifyBatch(batch);

        for (const result of results) {
          if (!VALID_CATEGORIES.includes(result.category)) {
            stats.skipped++;
            continue;
          }

          const article = batch.find((a) => a.id === result.id)!;

          // 기존 일반 태그(#없는 것) 보존 + 새 subTags 추가
          // 기존 구버전 subTags는 제거하고 새 것으로 교체
          const OLD_SUBTAGS = [
            '#LLM/챗봇', '#멀티모달', '#AI에이전트', '#오픈소스', '#연구/논문',
            '#이미지생성', '#영상/음성AI', '#업무생산성', '#콘텐츠제작', '#코딩/개발',
            '#B2B솔루션', '#검색/정보', '#AI튜터/코치', '#디지털교재', '#평가/채점AI',
            '#교육현장사례', '#맞춤학습', '#에듀테크기업', '#출판/교재시장', '#교육정책',
            '#해외에듀테크', '#M&A/투자', '#AI규제', '#저작권/지재권', '#AI윤리',
            '#고용/노동', '#개인정보',
          ];

          const preservedTags = article.existingTags.filter(
            (t) => !OLD_SUBTAGS.includes(t)
          );
          const newTags = Array.from(new Set([...result.subTags, ...preservedTags]));

          try {
            await updateDoc(doc(db, 'news', article.id), {
              category: result.category,
              tags: newTags,
            });
            stats.updated++;
            stats.distribution[result.category] =
              (stats.distribution[result.category] || 0) + 1;
          } catch {
            stats.errors++;
            stats.errorIds.push(article.id);
          }
        }

        // Rate limit 방지 (배치 사이 800ms 대기)
        if (i + BATCH_SIZE < allArticles.length) {
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch {
        batch.forEach((a) => stats.errorIds.push(a.id));
        stats.errors += batch.length;
      }
    }

    return { success: true, stats };
  } catch (e: any) {
    return { success: false, stats, error: e.message };
  }
}

// ── 카테고리 현황 조회 ───────────────────────────────────────
export async function getNewsCategoryStats(): Promise<{
  success: boolean;
  stats: Record<string, number>;
  total: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, 'news'));
    const stats: Record<string, number> = {};
    snapshot.docs.forEach((d) => {
      const cat = (d.data().category as string) || 'UNKNOWN';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return { success: true, stats, total: snapshot.size };
  } catch {
    return { success: false, stats: {}, total: 0 };
  }
}
