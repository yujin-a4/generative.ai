/**
 * GA4 이벤트 트래킹 헬퍼
 * Google Analytics 4 (G-5T4N6QXR59) 전용
 */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/** GA4 커스텀 이벤트 전송 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

/** 페이지뷰 수동 전송 (SPA 탭 전환 시 사용) */
export function trackPageView(pagePath: string, pageTitle: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
}

// ─── 공통 이벤트 헬퍼 ─────────────────────────────────────────────────────

/** 메뉴(탭) 전환 추적 */
export function trackMenuChange(menu: string) {
  trackEvent("menu_click", { menu_name: menu });
  trackPageView(`/#${menu}`, `AI Trend Lab | ${menu}`);
}

/** 랜딩 화면 → 메인 앱 진입 */
export function trackLandingEnter() {
  trackEvent("landing_enter");
}

/** 뉴스 카드 클릭 */
export function trackNewsClick(newsId: string, newsTitle: string) {
  trackEvent("news_click", { news_id: newsId, news_title: newsTitle });
}

/** 뉴스 상세 모달 열기 */
export function trackNewsDetailOpen(newsTitle: string) {
  trackEvent("news_detail_open", { news_title: newsTitle });
}

/** 뉴스 외부 링크 클릭 */
export function trackNewsExternalLink(url: string, newsTitle: string) {
  trackEvent("news_external_link_click", {
    link_url: url,
    news_title: newsTitle,
  });
}

/** AI 서비스 카드 클릭 */
export function trackServiceClick(serviceName: string) {
  trackEvent("service_click", { service_name: serviceName });
}

/** AI 서비스 외부 링크 이동 */
export function trackServiceExternalLink(serviceName: string, url: string) {
  trackEvent("service_external_link_click", {
    service_name: serviceName,
    link_url: url,
  });
}

/** 벤치마크/순위 탭 전환 */
export function trackReportTabChange(tabName: string) {
  trackEvent("report_tab_click", { tab_name: tabName });
}

/** 뉴스 검색 */
export function trackNewsSearch(query: string) {
  trackEvent("news_search", { search_term: query });
}

/** 뉴스 카테고리 필터 */
export function trackNewsCategoryFilter(category: string) {
  trackEvent("news_category_filter", { category });
}

/** 뉴스 요약 모달 열기 */
export function trackSummaryModalOpen(period: string) {
  trackEvent("summary_modal_open", { period });
}

/** 피드백(의견 보내기) 버튼 클릭 */
export function trackFeedbackOpen() {
  trackEvent("feedback_open");
}

/** 뉴스 제보 모달 열기 */
export function trackNewsSubmitModalOpen() {
  trackEvent("news_submit_modal_open");
}

/** 테마 전환 */
export function trackThemeToggle(theme: "dark" | "light") {
  trackEvent("theme_toggle", { theme });
}

/** 북마크 추가/제거 */
export function trackBookmark(action: "add" | "remove", newsId: string) {
  trackEvent("bookmark_action", { action, news_id: newsId });
}
