export const NEWS_CATEGORIES = {
    EDUTECH_AI: {
      id: 'EDUTECH_AI',
      name: '에듀테크 × AI',
      icon: '🎓',
      color: 'bg-green-100 text-green-800 border-green-200',
      description: '교육 분야 AI 활용 사례, 에듀테크 스타트업 소식'
    },
    AI_TECH: {
      id: 'AI_TECH',
      name: 'AI 기술',
      icon: '🤖',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'LLM, 멀티모달, 음성인식 등 핵심 AI 기술 발전'
    },
    AI_TOOLS: {
      id: 'AI_TOOLS',
      name: 'AI 서비스/플랫폼',
      icon: '🛠️',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'AI 기반 서비스, API, 플랫폼'
    },
    INDUSTRY_TREND: {
      id: 'INDUSTRY_TREND',
      name: '업계 동향',
      icon: '📊',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      description: '시장 분석, 트렌드 리포트, 산업 전망'
    },
    COMPANY_NEWS: {
      id: 'COMPANY_NEWS',
      name: '기업/투자',
      icon: '💼',
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      description: '주요 기업 소식, 투자, 인수합병, IPO'
    },
    POLICY_ETHICS: {
      id: 'POLICY_ETHICS',
      name: '정책/규제',
      icon: '⚖️',
      color: 'bg-red-100 text-red-800 border-red-200',
      description: 'AI 관련 법률, 규제, 윤리적 이슈, 저작권'
    },
    RESEARCH: {
      id: 'RESEARCH',
      name: '연구/논문',
      icon: '🔬',
      color: 'bg-teal-100 text-teal-800 border-teal-200',
      description: '최신 AI 연구, 논문, 학회 발표'
    },
    PRODUCT_RELEASE: {
      id: 'PRODUCT_RELEASE',
      name: '신제품 출시',
      icon: '🚀',
      color: 'bg-pink-100 text-pink-800 border-pink-200',
      description: '새로운 AI 제품, 기능, 베타 출시'
    }
  } as const;
  
  export type NewsCategoryKey = keyof typeof NEWS_CATEGORIES;
  
  export function getCategoryInfo(key: string) {
    return NEWS_CATEGORIES[key as NewsCategoryKey] || NEWS_CATEGORIES.AI_TECH;
  }