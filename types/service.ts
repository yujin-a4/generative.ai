// AI 서비스 카테고리
export const SERVICE_CATEGORIES = {
  LLM: "LLM",
  IMAGE: "이미지 생성/편집",
  VIDEO: "영상 생성/편집",
  TTS: "오디오/TTS",
  STT: "회의기록/STT",
  CODING: "코딩/개발",
  UIUX: "UI/UX 디자인",
  PRESENTATION: "PPT/시각화",
  RESEARCH: "리서치/논문",
  WORKSPACE: "워크스페이스/생산성",
  AGENT: "AI 에이전트",
  OTHER: "기타",
} as const;

export type ServiceCategory = keyof typeof SERVICE_CATEGORIES;

export interface AIService {
  id?: string;
  name: string;
  category: ServiceCategory;
  description: string;
  longDescription?: string;
  url: string;
  ogImage?: string;
  
  // 🛠️ [중요] 객체가 아닌 문자열 유니온 타입으로 확정
  pricing: "FREE" | "PAID" | "FREEMIUM"; 

  recommendedFor?: string[]; 
  features?: string[]; 
  rating?: number; 
  isPopular?: boolean;
  supportsKorean?: boolean; 
  isTrending?: boolean; 
  
  likes?: number;
  likedBy?: string[];
  bookmarkedBy?: string[];

  // 🌟 [추가] 작성자 식별을 위한 ID 필드
  authorId?: string;

  // 날짜는 문자열이나 객체 모두 허용 (유연성 확보)
  createdAt?: any; 
  updatedAt?: any;
  
  isPublished?: boolean;
  
  tags?: string[];
  pros?: string[];
  cons?: string[];
  targetUser?: string[];
  thumbnailUrl?: string;
}