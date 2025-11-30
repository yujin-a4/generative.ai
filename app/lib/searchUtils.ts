export const SYNONYM_MAP: Record<string, string[]> = {
    // 영어 -> 한글/관련어
    "claude": ["클로드", "anthropic", "앤스로픽"],
    "gpt": ["지피티", "openai", "오픈ai", "챗gpt"],
    "chatgpt": ["gpt", "지피티", "챗지피티"],
    "gemini": ["제미나이", "구글", "google", "bard", "바드"],
    "llama": ["라마", "meta", "메타", "facebook"],
    "sora": ["소라", "video", "영상"],
    "midjourney": ["미드저니", "그림"],
    "stable diffusion": ["스테이블", "디퓨전"],
    
    // 한글 -> 영어
    "클로드": ["claude", "anthropic"],
    "지피티": ["gpt", "openai"],
    "제미나이": ["gemini", "google"],
    "라마": ["llama", "meta"],
    "미드저니": ["midjourney"],
  };
  
  /**
   * 검색어를 입력받아 동의어까지 포함된 검색어 배열을 반환하는 함수
   * 예: "claude" 입력 -> ["claude", "클로드", "anthropic", "앤스로픽"] 반환
   */
  export function getExtendedSearchTerms(keyword: string): string[] {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (!lowerKeyword) return [];
  
    // 기본 검색어 포함
    let terms = [lowerKeyword];
  
    // 동의어 맵에서 찾아서 추가
    Object.keys(SYNONYM_MAP).forEach(key => {
      // 키워드가 key를 포함하거나, key가 키워드를 포함하면 연관어로 간주
      if (lowerKeyword.includes(key) || key.includes(lowerKeyword)) {
        terms = [...terms, ...SYNONYM_MAP[key]];
      }
    });
  
    // 중복 제거 후 반환
    return Array.from(new Set(terms));
  }