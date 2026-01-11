import Parser from 'rss-parser';

// RSS 파서 인스턴스 생성
export const rssParser = new Parser({
  customFields: {
    item: [['source', 'source']], // 출처 정보를 가져오기 위한 설정
  }
});