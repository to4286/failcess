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
