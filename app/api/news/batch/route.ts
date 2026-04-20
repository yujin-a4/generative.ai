import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { collection, getDocs, addDoc, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── RSS 소스 ────────────────────────────────────────────────
const RSS_SOURCES = [
  {
    name: 'AI/LLM',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent('AI 인공지능 LLM 챗GPT')}&hl=ko&gl=KR&ceid=KR:ko`,
    count: 8,
  },
  {
    name: '에듀테크',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent('에듀테크 AI 교육')}&hl=ko&gl=KR&ceid=KR:ko`,
    count: 5,
  },
  {
    name: 'AI 정책',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent('AI 정책 규제 저작권')}&hl=ko&gl=KR&ceid=KR:ko`,
    count: 4,
  },
  {
    name: '빅테크',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent('OpenAI Gemini Claude 출시')}&hl=ko&gl=KR&ceid=KR:ko`,
    count: 5,
  },
];

const parser = new Parser({
  customFields: { item: [['source', 'source']] },
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; AI-Trend-Lab/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// 제목 정규화 (공백·특수문자 제거해서 비교)
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^가-힣a-z0-9]/g, '').slice(0, 30);
}

export async function GET(req: NextRequest) {
  // ─── Cron Secret 검증 ────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // ─── 기존 기사 로드 (제목 기반 중복 체크) ───────────────
    const newsRef = collection(db, 'news');
    const existingTitles = new Set<string>();

    try {
      const existingSnap = await getDocs(
        query(newsRef, orderBy('createdAt', 'desc'), limit(500))
      );
      existingSnap.docs.forEach(d => {
        const title = d.data().title;
        if (title) existingTitles.add(normalizeTitle(title));
      });
      console.log(`[자동수집] 기존 기사 ${existingTitles.size}건 로드 (제목 기반 중복체크)`);
    } catch (e) {
      console.warn('[자동수집] 기존 기사 조회 실패 (중복체크 없이 진행):', e);
    }

    // ─── RSS 수집 (각 소스별 독립 배열) ──────────────────────
    const collected: Array<{
      title: string;
      url: string;
      source: string;
      pubDate: string;
      autoSource: string;
    }> = [];

    // 최근 14일 기준 (7일이면 너무 좁음)
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    const rssResults = await Promise.allSettled(
      RSS_SOURCES.map(async (feed) => {
        const parsed = await parser.parseURL(feed.url);
        let added = 0;

        for (const item of parsed.items) {
          if (added >= feed.count) break;

          const url = item.link || '';
          const title = item.title || '';
          if (!url || !title) continue;

          // 제목 기반 중복 체크
          const normTitle = normalizeTitle(title);
          if (existingTitles.has(normTitle)) continue;

          // 날짜 필터 (14일 이내, pubDate가 없으면 통과)
          if (item.pubDate) {
            const pub = new Date(item.pubDate).getTime();
            if (!isNaN(pub) && pub < cutoff) continue;
          }

          collected.push({
            title,
            url,
            source: (item as any).source?.['_'] || feed.name,
            pubDate: item.pubDate || new Date().toISOString(),
            autoSource: feed.name,
            rssSummary: (item as any).contentSnippet || (item as any).summary || (item as any).content || '',
          });
          existingTitles.add(normTitle); // 동일 실행 내 중복 방지
          added++;
        }

        console.log(`[자동수집] ${feed.name}: ${parsed.items.length}건 수신 → ${added}건 신규`);
      })
    );

    rssResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[자동수집] RSS 실패 [${RSS_SOURCES[i].name}]:`, r.reason);
      }
    });

    console.log(`[자동수집] 총 ${collected.length}건 신규 수집`);

    if (collected.length === 0) {
      return NextResponse.json({
        success: true,
        saved: 0,
        message: '새로운 기사가 없습니다 (모두 중복 또는 날짜 초과)',
        timestamp: new Date().toISOString(),
      });
    }

    // ─── Firestore 저장 (전체) ───────────────────────────────
    const toSave = collected;
    const saveResults = await Promise.allSettled(
      toSave.map(item =>
        addDoc(newsRef, {
          title: item.title,
          url: item.url,
          source: item.source,
          autoSource: item.autoSource,
          rssSummary: (item as any).rssSummary || '',
          shortSummary: '',
          detailedSummary: [],
          insight: '',
          category: 'AI_TECH',
          tags: [],
          views: 0,
          likes: 0,
          likedBy: [],
          bookmarkedBy: [],
          isVisible: true,
          isAuto: true,
          status: 'draft',
          author: '자동수집',
          authorId: 'auto',
          publishedAt: Timestamp.fromDate(
            item.pubDate ? new Date(item.pubDate) : new Date()
          ),
          createdAt: Timestamp.now(),
        })
      )
    );

    const saved = saveResults.filter(r => r.status === 'fulfilled').length;
    const failed = saveResults.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      saveResults
        .filter(r => r.status === 'rejected')
        .forEach((r: any) => console.error('[자동수집] 저장 실패:', r.reason?.message));
    }

    console.log(`[자동수집] ✅ ${saved}건 저장 완료 (실패 ${failed}건)`);
    return NextResponse.json({
      success: true,
      saved,
      failed,
      collected: collected.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[자동수집 오류]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
