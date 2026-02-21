/** 게시물 본문 prose 스타일 (글쓰기 에디터 + 상세 페이지 공통, Single Source of Truth)
 * - 단순 줄바꿈(<br>) 방식: p margin 0, line-height 1.6, white-space: pre-wrap */
export const PROSE_CONTENT_CLASS =
  "prose prose-lg max-w-none prose-headings:font-bold prose-img:rounded-lg prose-img:shadow-md prose-img:my-6 prose-p:text-lg prose-p:leading-[1.6] prose-p:mt-0 prose-p:mb-0 prose-p:text-gray-900 prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-gray-700 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r break-all whitespace-pre-wrap";

/** 관심사 태그 목록 (프로필 작성 모달, 설정 페이지 공통) */
export const INTEREST_TAGS = [
  '취업/이직',
  '창업/사업',
  '업무/커리어',
  '번아웃/슬럼프',
  '인간관계',
  '경제/재테크',
  '학업/자격증',
  '사이드프로젝트',
  '연애/결혼',
  '건강/라이프',
] as const;

export type InterestTag = (typeof INTEREST_TAGS)[number];
