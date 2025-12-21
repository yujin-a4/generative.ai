export const NEWS_CATEGORIES = {
  EDUTECH_AI: {
    id: 'EDUTECH_AI',
    name: '에듀테크 × AI',
    icon: '🎓',
    color: 'bg-green-100 text-green-800 border-green-200',
    description: '교육 분야 AI 활용 사례, 에듀테크 소식'
  },
  AI_TECH: {
    id: 'AI_TECH',
    name: 'AI 기술',
    icon: '🤖',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'LLM 기술, 연구/논문, 학회 발표 및 핵심 기술 발전' // 연구/논문 통합
  },
  AI_SERVICE: {
    id: 'AI_SERVICE',
    name: 'AI 서비스/플랫폼',
    icon: '🛠️',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'AI 기반 서비스, API, 플랫폼 업데이트'
  },
  NEW_PRODUCT: {
    id: 'NEW_PRODUCT',
    name: '신제품 출시',
    icon: '🚀',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    description: '새로운 AI 제품, 기능, 베타 버전 최초 공개'
  },
  TREND: {
    id: 'TREND',
    name: '업계 동향',
    icon: '📊',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: '시장 분석, 트렌드 리포트, 산업 전망'
  },
  INVESTMENT: {
    id: 'INVESTMENT',
    name: '기업/투자',
    icon: '💼',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: '주요 기업 소식, 투자 유치, 인수합병(M&A)'
  },
  POLICY: {
    id: 'POLICY',
    name: '정책/규제',
    icon: '⚖️',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'AI 관련 법률, 규제, 가이드라인, 윤리 이슈'
  }
} as const;

export type NewsCategoryKey = keyof typeof NEWS_CATEGORIES;

export function getCategoryInfo(key: string) {
// 구버전 키(RESEARCH 등) 대응을 위한 폴백 로직
if (key === 'RESEARCH') return NEWS_CATEGORIES.AI_TECH;
if (key === 'AI_TOOLS') return NEWS_CATEGORIES.AI_SERVICE;
if (key === 'INDUSTRY_TREND') return NEWS_CATEGORIES.TREND;
if (key === 'COMPANY_NEWS') return NEWS_CATEGORIES.INVESTMENT;
if (key === 'POLICY_ETHICS') return NEWS_CATEGORIES.POLICY;
if (key === 'PRODUCT_RELEASE') return NEWS_CATEGORIES.NEW_PRODUCT;

return NEWS_CATEGORIES[key as NewsCategoryKey] || NEWS_CATEGORIES.AI_TECH;
}