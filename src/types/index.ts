export type Category = 'Finance' | 'Marketing' | 'HR' | 'MVP' | 'Other';

export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string;
  bio: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  category: Category;
  author_id: string;
  author: User;
  save_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  content: string;
  post_id: string;
  author_id: string;
  author: User;
  created_at: string;
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
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
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}
