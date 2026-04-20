// ─────────────────────────────────────────────────────────
// 뉴스 카테고리 정의 (최종 v3 — 5대 분류)
// 교육 출판사 직원 타겟 기준으로 설계
// ─────────────────────────────────────────────────────────

export const NEWS_CATEGORIES = {
  AI_TECH: {
    id: 'AI_TECH',
    name: 'AI 기술 & 모델',
    icon: '🤖',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'GPT·Claude·Gemini 등 AI 모델 출시·업데이트·성능 비교, 연구/논문, 오픈소스, AI 에이전트',
    subTags: ['#LLM/챗봇', '#멀티모달', '#AI에이전트', '#이미지생성', '#영상/음성AI'],
  },
  AI_SERVICE: {
    id: 'AI_SERVICE',
    name: 'AI 서비스 & 도구',
    icon: '🛠️',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: '사용자가 직접 쓸 수 있는 AI 앱·SaaS·플랫폼 (Notion AI, Copilot, Cursor 등), B2B 솔루션',
    subTags: ['#업무생산성', '#콘텐츠제작', '#코딩/개발', '#B2B솔루션', '#검색/정보'],
  },
  EDUTECH_AI: {
    id: 'EDUTECH_AI',
    name: '교육 × AI 적용',
    icon: '🎓',
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'AI가 교육 현장·방법론에 적용된 구체적 사례 (AI 튜터, 자동 채점, 개인화 학습, 효과 연구)',
    subTags: ['#AI튜터/코치', '#디지털교재', '#평가/채점AI', '#교육현장사례', '#맞춤학습'],
  },
  EDU_INDUSTRY: {
    id: 'EDU_INDUSTRY',
    name: '교육·출판 업계',
    icon: '📚',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    description: '에듀테크·출판 기업 동향, 교육 정책, 교재 시장 변화, 해외 에듀테크, 업계 투자·M&A',
    subTags: ['#에듀테크기업', '#출판/교재시장', '#해외에듀테크'],
  },
  POLICY: {
    id: 'POLICY',
    name: '정책 & 사회',
    icon: '⚖️',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'AI 규제·법률·저작권·윤리·개인정보·고용 관련 정책 이슈',
    subTags: ['#AI규제', '#저작권/지재권', '#AI윤리', '#고용/노동', '#개인정보'],
  },
} as const;

export type NewsCategoryKey = keyof typeof NEWS_CATEGORIES;

export function getCategoryInfo(key: string) {
  // 구버전 키 → 신버전 키 폴백
  if (key === 'RESEARCH')        return NEWS_CATEGORIES.AI_TECH;
  if (key === 'AI_MODEL')        return NEWS_CATEGORIES.AI_TECH;
  if (key === 'AI_TOOLS')        return NEWS_CATEGORIES.AI_SERVICE;
  if (key === 'NEW_PRODUCT')     return NEWS_CATEGORIES.AI_SERVICE;
  if (key === 'PRODUCT_RELEASE') return NEWS_CATEGORIES.AI_SERVICE;
  if (key === 'INDUSTRY_TREND')  return NEWS_CATEGORIES.EDU_INDUSTRY;
  if (key === 'COMPANY_NEWS')    return NEWS_CATEGORIES.EDU_INDUSTRY;
  if (key === 'INVESTMENT')      return NEWS_CATEGORIES.EDU_INDUSTRY;
  if (key === 'TREND')           return NEWS_CATEGORIES.EDU_INDUSTRY;
  if (key === 'POLICY_ETHICS')   return NEWS_CATEGORIES.POLICY;

  return NEWS_CATEGORIES[key as NewsCategoryKey] || NEWS_CATEGORIES.AI_TECH;
}