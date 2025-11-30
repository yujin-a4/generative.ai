/**
 * 주차 계산 유틸리티
 * - 2일 이하인 주는 앞/뒤 주와 병합
 * - 병합 후 주차 번호를 1부터 순차적으로 재조정
 * - NewsTimeline, generateWeeklySummary 등에서 공통 사용
 */

export interface WeekInfo {
    weekLabel: string;        // "4째주"
    weekDbLabel: string;      // "11월 4주차"
    weekNumber: number;       // 4
    startDate: Date;          // 실제 시작일
    endDate: Date;            // 실제 종료일
  }
  
  /**
   * 해당 월의 모든 주차 정보 계산 (2일 이하 주 병합 + 주차 번호 재조정)
   */
  export function getMonthWeeks(year: number, month: number): WeekInfo[] {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    // 1단계: 원본 주차 계산
    const rawWeeks: { originalWeekNumber: number; dates: Date[] }[] = [];
    
    for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
      const currentDate = new Date(date);
      const weekNumber = getWeekNumberInMonth(currentDate);
      
      let week = rawWeeks.find(w => w.originalWeekNumber === weekNumber);
      if (!week) {
        week = { originalWeekNumber: weekNumber, dates: [] };
        rawWeeks.push(week);
      }
      week.dates.push(new Date(currentDate));
    }
    
    // 2단계: 2일 이하 주 병합
    const mergedWeeks: { dates: Date[] }[] = [];
    
    for (let i = 0; i < rawWeeks.length; i++) {
      const week = rawWeeks[i];
      
      // 2일 이하인 경우
      if (week.dates.length <= 2) {
        if (i === 0 && rawWeeks.length > 1) {
          // 첫 주 → 다음 주에 병합
          rawWeeks[i + 1].dates = [...week.dates, ...rawWeeks[i + 1].dates].sort((a, b) => a.getTime() - b.getTime());
          continue; // 현재 주는 건너뜀
        } else if (i === rawWeeks.length - 1 && mergedWeeks.length > 0) {
          // 마지막 주 → 이전 주에 병합
          mergedWeeks[mergedWeeks.length - 1].dates = [
            ...mergedWeeks[mergedWeeks.length - 1].dates,
            ...week.dates
          ].sort((a, b) => a.getTime() - b.getTime());
          continue; // 현재 주는 건너뜀
        }
      }
      
      // 정상 주 추가
      mergedWeeks.push({ dates: week.dates });
    }
    
    // 3단계: 주차 번호 재조정 (1부터 순차적으로)
    const finalWeeks: WeekInfo[] = mergedWeeks.map((week, index) => {
      const weekNumber = index + 1; // 1부터 시작
      
      // ✅ [핵심 수정] startDate는 00:00:00, endDate는 23:59:59로 설정
      const startDate = new Date(week.dates[0]);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(week.dates[week.dates.length - 1]);
      endDate.setHours(23, 59, 59, 999);
      
      return {
        weekLabel: `${weekNumber}째주`,
        weekDbLabel: `${month}월 ${weekNumber}주차`,
        weekNumber,
        startDate,
        endDate,
      };
    });
    
    return finalWeeks;
  }
  
  /**
   * 특정 날짜가 속한 주의 정보 가져오기 (2일 이하 병합 고려)
   */
  export function getWeekInfo(date: Date): WeekInfo {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthWeeks = getMonthWeeks(year, month);
    
    // 해당 날짜가 속한 주 찾기
    const weekInfo = monthWeeks.find(week => 
      date >= week.startDate && date <= week.endDate
    );
    
    if (!weekInfo) {
      // fallback: 기본 계산
      const weekNumber = getWeekNumberInMonth(date);
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      return {
        weekLabel: `${weekNumber}째주`,
        weekDbLabel: `${month}월 ${weekNumber}주차`,
        weekNumber,
        startDate,
        endDate,
      };
    }
    
    return weekInfo;
  }
  
  /**
   * 날짜가 속한 월 내 주 번호 계산 (기본 로직)
   */
  function getWeekNumberInMonth(date: Date): number {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayWeekday = firstDayOfMonth.getDay();
    return Math.ceil((date.getDate() + firstDayWeekday) / 7);
  }
  
  /**
   * 특정 주차 라벨(예: "11월 4주차")의 실제 날짜 범위 계산
   */
  export function getWeekDateRange(weekDbLabel: string): { startDate: Date; endDate: Date } | null {
    // "11월 4주차" → [11, 4] 추출
    const match = weekDbLabel.match(/(\d+)월 (\d+)주차/);
    if (!match) return null;
    
    const month = parseInt(match[1]);
    const weekNumber = parseInt(match[2]);
    
    // 현재 연도 기준 (필요시 연도도 파라미터로 받을 수 있음)
    const year = new Date().getFullYear();
    
    const monthWeeks = getMonthWeeks(year, month);
    const weekInfo = monthWeeks.find(w => w.weekNumber === weekNumber);
    
    if (!weekInfo) return null;
    
    return {
      startDate: weekInfo.startDate,
      endDate: weekInfo.endDate,
    };
  }
  
  /**
   * "2025년 11월" 형식
   */
  export function getMonthLabel(date: Date): string {
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  }
  
  /**
   * 정렬용 키
   */
  export function getMonthSortKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }