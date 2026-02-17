export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string;
  bio: string;
  job_title?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author: User;
  save_count: number;
  comment_count: number;
  like_count?: number;
  view_count: number;
  created_at: string;
  is_public?: boolean;
  /** 메인 피드 알고리즘: 팔로잉이 반응한 글일 때 배지 표시용 */
  feedBadge?: 'friend_like' | null;
  /** 발행 시 선택한 주제(카테고리) 배열 */
  categories?: string[] | null;
  /** 좋아요 누른 유저 목록 (메인 피드에서 반응한 팔로잉 표시용) */
  likedBy?: Array<{ user_id: string; nickname: string }>;
  /** 이 중 팔로잉인 유저만 필터한 목록 (feedBadge friend_like일 때 배지 텍스트용) */
  reactingFollowings?: Array<{ user_id: string; nickname: string }>;
}

export interface Comment {
  id: string;
  content: string;
  post_id: string;
  author_id: string;
  author: User;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
  folder_id: string | null;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
}

export interface CoffeeChat {
  id: string;
  requester_id: string;
  receiver_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  is_sender_checked?: boolean;
}

/** 프로필 조인용 (닉네임, 아바타, 이메일, 직업) */
export interface CoffeeChatProfile {
  nickname: string | null;
  avatar_url: string | null;
  email: string | null;
  job_title?: string | null;
}

/** 받은 요청 리스트 아이템 (requester 프로필 조인) */
export interface CoffeeChatRequestReceived extends CoffeeChat {
  requester: CoffeeChatProfile & { id?: string };
}

/** 보낸 요청 중 수락됨 (receiver 프로필 조인, 알림 모달용) */
export interface CoffeeChatRequestAccepted extends CoffeeChat {
  receiver: CoffeeChatProfile & { id?: string };
}
