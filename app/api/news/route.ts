import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['source', 'source']], 
  }
});

export async function GET() {
  try {
    const query = encodeURIComponent('AI 인공지능 LLM');
    const FEED_URL = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;

    // 서버 사이드에서 실행되므로 CORS 문제 없음
    const feed = await parser.parseURL(FEED_URL);

    const newsItems = feed.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      source: (item as any).source?.['_'] || 'Google News',
    }));

    return NextResponse.json(newsItems);
  } catch (error) {
    console.error('뉴스 크롤링 실패:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}