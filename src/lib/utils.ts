import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * ILIKE/LIKE 패턴에서 검색어를 그대로 쓰기 위해 와일드카드 이스케이프.
 * % → \%, _ → \_, \ → \\. (PostgreSQL 기본 escape는 \)
 * 검색 UI에서 쌍따옴표는 .or() 파싱 오류 방지를 위해 제거한 뒤 사용.
 */
export function escapeForIlike(term: string): string {
  return term
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/** 검색 필터용: 쌍따옴표 제거 후 ILIKE 이스케이프 적용 */
export function sanitizeSearchTerm(term: string): string {
  return escapeForIlike(term.replace(/"/g, ''));
}

/**
 * 상대적 시간 표기 (계단식 규칙)
 * - 방금: 1분 미만
 * - 분: 1시간 미만
 * - 시간: 24시간 미만
 * - 일: 7일 미만 (1~6일)
 * - 주: 28일 미만 (1~3주)
 * - 달: 12개월 미만 (28일 이상부터 1달 전)
 * - 년: 1년 이상 → YYYY.MM.DD
 */
export function getRelativeTime(dateString: string): string {
  const now = new Date();
  const target = new Date(dateString);
  const diff = (now.getTime() - target.getTime()) / 1000; // 초 단위

  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;

  const diffDays = Math.floor(diff / 86400);
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 28) return `${Math.floor(diffDays / 7)}주 전`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths === 0 ? 1 : diffMonths}달 전`;
  }

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// ========== 최근 검색어 히스토리 관리 ==========

export type HistoryItem = 
  | { type: 'keyword'; value: string; timestamp: number }
  | { type: 'post'; id: string; title: string; timestamp: number }
  | { type: 'user'; id: string; nickname: string; job: string; avatar: string | null; timestamp: number };

const STORAGE_KEY = 'recent_searches';
const MAX_HISTORY = 10;

// BigInt를 안전하게 직렬화하는 replacer 함수
const bigIntReplacer = (key: string, value: any): any => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * localStorage에서 최근 검색어 목록을 가져옵니다.
 */
export function getRecentSearches(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('[utils] Error loading recent searches:', err);
  }
  return [];
}

/**
 * 최근 검색어 히스토리에 항목을 추가합니다.
 * 중복 제거, 최상단 이동, 최대 개수 제한을 자동으로 처리합니다.
 */
export function addToHistory(item: HistoryItem): void {
  console.log('[utils.addToHistory] 받은 item:', item);
  
  try {
    // localStorage에서 기존 목록 가져오기
    const prev = getRecentSearches();
    
    // 항목 정규화
    let normalizedItem: HistoryItem;
    
    if (item.type === 'post') {
      // Post 타입: id를 무조건 String으로 변환
      const postId = item.id as string | number | bigint;
      let idStr: string;
      
      if (typeof postId === 'bigint') {
        idStr = postId.toString();
      } else if (typeof postId === 'number') {
        idStr = String(postId);
      } else {
        idStr = String(postId);
      }
      
      if (!idStr || idStr === 'null' || idStr === 'undefined' || idStr.trim() === '') {
        console.error('[utils.addToHistory] 🔴 Invalid post ID:', { item, idStr });
        return;
      }
      
      const titleStr = item.title || `게시물 ${idStr}`;
      normalizedItem = { 
        ...item, 
        id: idStr,
        title: titleStr
      };
    } else if (item.type === 'user') {
      // User 타입: id를 무조건 String으로 변환
      const userId = item.id as string | number | bigint;
      let idStr: string;
      
      if (typeof userId === 'bigint') {
        idStr = userId.toString();
      } else {
        idStr = String(userId);
      }
      
      if (!idStr || idStr === 'null' || idStr === 'undefined' || idStr.trim() === '') {
        console.error('[utils.addToHistory] 🔴 Invalid user ID:', { item, idStr });
        return;
      }
      
      normalizedItem = { ...item, id: idStr };
    } else {
      // Keyword 타입: 그대로 사용
      normalizedItem = item;
    }

    // 기존 항목 찾기
    let existingIndex = -1;
    
    if (normalizedItem.type === 'keyword') {
      existingIndex = prev.findIndex((existing) => 
        existing.type === 'keyword' && existing.value === normalizedItem.value
      );
    } else if (normalizedItem.type === 'post') {
      const normalizedIdStr = String(normalizedItem.id);
      existingIndex = prev.findIndex((existing) => {
        if (existing.type === 'post') {
          const existingIdStr = String(existing.id);
          return existingIdStr === normalizedIdStr;
        }
        return false;
      });
    } else if (normalizedItem.type === 'user') {
      const normalizedIdStr = String(normalizedItem.id);
      existingIndex = prev.findIndex((existing) => {
        if (existing.type === 'user') {
          const existingIdStr = String(existing.id);
          return existingIdStr === normalizedIdStr;
        }
        return false;
      });
    }

    // 중복 제거: 기존 항목이 있으면 제거
    let updatedHistory: HistoryItem[];
    if (existingIndex >= 0) {
      updatedHistory = prev.filter((_, index) => index !== existingIndex);
      console.log('[utils.addToHistory] 기존 항목 제거됨, 남은 항목 수:', updatedHistory.length);
    } else {
      updatedHistory = [...prev];
    }

    // 새 아이템을 맨 앞에 추가
    updatedHistory = [normalizedItem, ...updatedHistory];

    // 최대 10개로 제한
    updatedHistory = updatedHistory.slice(0, MAX_HISTORY);

    // localStorage에 저장
    try {
      const jsonString = JSON.stringify(updatedHistory, bigIntReplacer);
      localStorage.setItem(STORAGE_KEY, jsonString);
      console.log('[utils.addToHistory] ✅ 저장 완료 - 총', updatedHistory.length, '개 항목');
      
      // 같은 탭에서의 변경을 감지하기 위한 커스텀 이벤트 발생
      window.dispatchEvent(new Event('recentSearchesUpdated'));
    } catch (err) {
      console.error('[utils.addToHistory] 🔴 Error saving to localStorage:', err);
      if (err instanceof Error) {
        console.error('[utils.addToHistory] 🔴 Error message:', err.message);
      }
    }
  } catch (error) {
    console.error('[utils.addToHistory] 🔴 Error in addToHistory:', error, item);
  }
}

/**
 * 게시물을 히스토리에 추가하는 헬퍼 함수
 */
export function addPostToHistory(postId: string | number | bigint, postTitle: string): void {
  addToHistory({
    type: 'post',
    id: String(postId),
    title: postTitle,
    timestamp: Date.now(),
  });
}

/**
 * 키워드를 히스토리에 추가하는 헬퍼 함수
 */
export function addKeywordToHistory(keyword: string): void {
  if (keyword.trim() !== '') {
    addToHistory({
      type: 'keyword',
      value: keyword.trim(),
      timestamp: Date.now(),
    });
  }
}

/**
 * 키워드를 히스토리에서 제거하는 함수
 */
export function removeKeywordFromHistory(keyword: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const prev: HistoryItem[] = JSON.parse(stored, (key, value) => {
      // BigInt 역직렬화 (필요 시)
      if (typeof value === 'string' && /^\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });

    // 키워드 항목 제거
    const updated = prev.filter((item) => {
      if (item.type === 'keyword' && item.value === keyword.trim()) {
        return false;
      }
      return true;
    });

    // localStorage에 저장
    const jsonString = JSON.stringify(updated, bigIntReplacer);
    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log('[utils.removeKeywordFromHistory] ✅ 키워드 제거 완료:', keyword);

    // 같은 탭의 다른 컴포넌트들이 변경을 감지할 수 있도록 이벤트 발생
    window.dispatchEvent(new Event('recentSearchesUpdated'));
  } catch (error) {
    console.error('[utils.removeKeywordFromHistory] 🔴 키워드 제거 실패:', error);
  }
}

/**
 * 게시물 카드 미리보기용: HTML에서 텍스트 추출 시 템플릿 질문만 제거.
 * - 시스템 제공 질문(정확히 일치하는 줄)만 제거, 사용자 작성 헤더/내용은 보존.
 * - 제거 후 불필요한 빈 줄 정리.
 */
const PREVIEW_FILTER_LINES = new Set([
  "어떤 일이 있었나요?",
  "(최대한 사실적으로 적어주세요)",
  "왜 그런 일이 일어났다고 생각하시나요?",
  "(놓친 것은 무엇인지 생각해보세요)",
  "새롭게 깨달은 사실은 무엇인가요?",
  "같은 실수를 반복하지 않게 무엇을 다르게 할 건가요?",
  "이번에 맞이한 새로운 상황을 설명해주세요.",
  "유사한 과거 상황에서 겪었던 실패와 그 원인은 무엇이었나요?",
  "과거의 피드백을 바탕으로 이번에는 무엇을 다르게 실행했나요?",
  "(과거 실패에서 배운 점을 포함해주세요)",
  "그 결과, 어떤 성공적인 변화나 성과를 얻었나요?",
]);

export function getFilteredPreviewText(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  const lines: string[] = [];
  const blockTags = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "DIV", "BLOCKQUOTE"]);

  function collectBlocks(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (blockTags.has(el.tagName)) {
      const hasBlockChild = Array.from(el.children).some((c) =>
        blockTags.has((c as HTMLElement).tagName)
      );
      if (hasBlockChild) {
        for (const child of el.childNodes) collectBlocks(child);
        return;
      }
      const text = (el.textContent || "").trim();
      if (text && !PREVIEW_FILTER_LINES.has(text)) {
        lines.push(text);
      }
      return;
    }
    for (const child of el.childNodes) collectBlocks(child);
  }

  collectBlocks(tempDiv);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 이미지 URL 유효성 검사 함수
 * null, undefined, 빈 문자열, 또는 잘못된 형식의 URL을 체크
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  
  // 빈 문자열이나 공백만 있는 경우
  if (url.trim().length === 0) {
    return false;
  }
  
  // 'null', 'undefined' 문자열인 경우
  if (url.toLowerCase() === 'null' || url.toLowerCase() === 'undefined') {
    return false;
  }
  
  // 잘못된 Supabase Storage 경로 체크 (예: .../public/avatars/null)
  if (url.includes('/null') || url.includes('/undefined')) {
    return false;
  }
  
  // 기본적인 URL 형식 검증 (http:// 또는 https://로 시작하거나 /로 시작하는 상대 경로)
  try {
    // 절대 URL인 경우
    if (url.startsWith('http://') || url.startsWith('https://')) {
      new URL(url);
      return true;
    }
    // 상대 경로인 경우 (예: /avatars/user.jpg)
    if (url.startsWith('/')) {
      return true;
    }
    // data URL인 경우
    if (url.startsWith('data:')) {
      return true;
    }
    // 그 외는 유효하지 않음
    return false;
  } catch {
    return false;
  }
}