import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import PopularPosts from '@/components/PopularPosts';
import NotificationsSection from '@/components/NotificationsSection';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';

const PAGE_SIZE = 50;
const FEED_VIEWED_KEY = 'feed_viewed';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPost, setTempPost] = useState<Post | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  // 작성 완료 후 전달된 방금 쓴 글을 최상단에 표시 (Optimistic UI)
  useEffect(() => {
    const state = location.state as { tempPost?: Post } | undefined;
    if (state?.tempPost) {
      setTempPost(state.tempPost);
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // 데이터 매핑 헬퍼 함수
  const mapPostData = (item: any): Post => {
    const profile = Array.isArray(item.profiles) 
      ? item.profiles[0] 
      : item.profiles;

    // comments count 처리
    let commentCount = 0;
    if (item.comments) {
      if (Array.isArray(item.comments)) {
        if (item.comments.length > 0 && typeof item.comments[0] === 'object' && 'count' in item.comments[0]) {
          commentCount = item.comments[0].count || 0;
        } else {
          commentCount = item.comments.length;
        }
      } else if (typeof item.comments === 'object' && 'count' in item.comments) {
        commentCount = item.comments.count || 0;
      }
    }

    // likes count 처리
    let likeCount = 0;
    if (item.likes) {
      if (Array.isArray(item.likes)) {
        if (item.likes.length > 0 && typeof item.likes[0] === 'object' && 'count' in item.likes[0]) {
          likeCount = item.likes[0].count || 0;
        } else {
          likeCount = item.likes.length;
        }
      } else if (typeof item.likes === 'object' && 'count' in item.likes) {
        likeCount = item.likes.count || 0;
      }
    }

    // saves count 처리
    let saveCount = 0;
    if (item.saves) {
      if (Array.isArray(item.saves)) {
        if (item.saves.length > 0 && typeof item.saves[0] === 'object' && 'count' in item.saves[0]) {
          saveCount = item.saves[0].count || 0;
        } else {
          saveCount = item.saves.length;
        }
      } else if (typeof item.saves === 'object' && 'count' in item.saves) {
        saveCount = item.saves.count || 0;
      }
    }

    return {
      id: item.id,
      title: item.title,
      content: item.content,
      author_id: item.author_id,
      author: {
        id: profile?.id || item.author_id,
        email: profile?.email || '',
        nickname: profile?.nickname || '알 수 없음',
        avatar_url: profile?.avatar_url || '',
        bio: profile?.bio || '',
        job_title: profile?.job_title || '',
      },
      save_count: saveCount || item.save_count || 0,
      comment_count: commentCount || item.comment_count || 0,
      like_count: likeCount || 0,
      view_count: item.view_count || 0,
      created_at: item.created_at,
      is_public: item.is_public ?? true, // 기본값 true
      feedBadge: undefined,
    };
  };

  /** Fisher–Yates 셔플: 새로고침마다 순서가 바뀌도록 무작위 정렬 */
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  /** 팔로잉·반응·관심사 데이터 수집 + 배지 부착 (공통) */
  const enrichBatchWithFollowAndReaction = async (
    batch: Post[],
    currentUserId: string
  ): Promise<{
    posts: Post[];
    followingIds: Set<string>;
    postIdsWithFriendLike: Set<string>;
    myInterests: string[];
  }> => {
    if (batch.length === 0) {
      return { posts: [], followingIds: new Set(), postIdsWithFriendLike: new Set(), myInterests: [] };
    }
    const postIds = batch.map((p) => p.id);

    const [followingRes, profileRes] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
      supabase.from('profiles').select('interests').eq('id', currentUserId).maybeSingle(),
    ]);
    const followingIds = new Set(
      (followingRes.data ?? []).map((r: { following_id: string }) => r.following_id)
    );

    let postIdsWithFriendLike = new Set<string>();
    const postIdToReactingUserIds: Record<string, string[]> = {};
    if (followingIds.size > 0) {
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id, user_id')
        .in('post_id', postIds)
        .in('user_id', [...followingIds]);
      (likesData ?? []).forEach((r: { post_id: string; user_id: string }) => {
        postIdsWithFriendLike.add(r.post_id);
        if (!postIdToReactingUserIds[r.post_id]) postIdToReactingUserIds[r.post_id] = [];
        postIdToReactingUserIds[r.post_id].push(r.user_id);
      });
    }

    const reactingUserIds = [...new Set(Object.values(postIdToReactingUserIds).flat())];
    const userIdToNickname: Record<string, string> = {};
    if (reactingUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', reactingUserIds);
      (profilesData ?? []).forEach((p: { id: string; nickname: string | null }) => {
        userIdToNickname[p.id] = p.nickname ?? 'Unknown';
      });
    }

    const rawInterests = profileRes.data?.interests;
    const myInterests: string[] = Array.isArray(rawInterests)
      ? rawInterests
      : typeof rawInterests === 'string'
        ? (() => {
            try {
              const p = JSON.parse(rawInterests);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [];

    const posts = batch.map((post): Post => {
      const reactingUserIdsForPost = postIdToReactingUserIds[post.id] ?? [];
      const reactingFollowings = reactingUserIdsForPost.map((uid) => ({
        user_id: uid,
        nickname: userIdToNickname[uid] ?? 'Unknown',
      }));
      const feedBadge: 'friend_like' | undefined = postIdsWithFriendLike.has(post.id) ? 'friend_like' : undefined;
      return {
        ...post,
        feedBadge,
        reactingFollowings:
          feedBadge === 'friend_like' && reactingFollowings.length > 0 ? reactingFollowings : undefined,
      };
    });

    return { posts, followingIds, postIdsWithFriendLike, myInterests };
  };

  /** Mode A: 중요도 순 (Tier 1 → 2 → 3). 첫 진입 시 사용. */
  const sortPostsByPriority = (
    posts: Post[],
    followingIds: Set<string>,
    postIdsWithFriendLike: Set<string>,
    myInterests: string[]
  ): Post[] => {
    const now = Date.now();
    const isWithin24h = (createdAt: string) => now - new Date(createdAt).getTime() < TWENTY_FOUR_HOURS_MS;
    const byNewest = (a: Post, b: Post) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    const hasInterestMatch = (post: Post) => {
      if (myInterests.length === 0) return false;
      const text = `${post.title ?? ''} ${post.content ?? ''}`.toLowerCase();
      return myInterests.some((tag) => tag && text.includes(String(tag).toLowerCase()));
    };

    const tier1 = posts
      .filter((p) => followingIds.has(p.author_id) && isWithin24h(p.created_at))
      .sort(byNewest);
    const tier2 = posts
      .filter(
        (p) =>
          !(followingIds.has(p.author_id) && isWithin24h(p.created_at)) &&
          (postIdsWithFriendLike.has(p.id) || hasInterestMatch(p))
      )
      .sort(byNewest);
    const tier3 = posts.filter(
      (p) =>
        !(followingIds.has(p.author_id) && isWithin24h(p.created_at)) &&
        !postIdsWithFriendLike.has(p.id) &&
        !hasInterestMatch(p)
    );
    tier3.sort(byNewest);

    return [...tier1, ...tier2, ...tier3];
  };

  /** Mode B: 전체 랜덤 셔플. 새로고침 후 사용. */
  const shufflePosts = (posts: Post[]): Post[] => shuffleArray(posts);

  // 데이터 가져오기 함수
  const fetchPosts = async (pageIndex: number) => {
    if (!hasMore && pageIndex > 0) return;
    
    // 로딩 상태 설정
    if (pageIndex === 0) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }

    try {
      setError(null);
      
      // 1. 범위 계산 (한 페이지당 PAGE_SIZE개)
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: { session } } = await supabase.auth.getSession();
      let query = supabase
        .from('posts')
        .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (session?.user?.id) {
        query = query.neq('author_id', session.user.id);
      }
      const { data, error: fetchError } = await query.range(from, to);

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        setHasMore(false);
        return;
      }

      // 2. 데이터 매핑
      let mappedPosts: Post[] = data.map(mapPostData);

      // 3. 로그인 유저: 세션 기반 정렬 (첫 진입 = 중요도 순, 새로고침 = 전체 셔플)
      if (session?.user?.id && mappedPosts.length > 0) {
        const { posts: enriched, followingIds, postIdsWithFriendLike, myInterests } =
          await enrichBatchWithFollowAndReaction(mappedPosts, session.user.id);

        if (pageIndex === 0) {
          const alreadyViewed = sessionStorage.getItem(FEED_VIEWED_KEY);
          if (!alreadyViewed) {
            mappedPosts = sortPostsByPriority(enriched, followingIds, postIdsWithFriendLike, myInterests);
            sessionStorage.setItem(FEED_VIEWED_KEY, 'true');
          } else {
            mappedPosts = shufflePosts(enriched);
          }
        } else {
          mappedPosts = enriched;
        }
      }

      // 4. 더 불러올 데이터가 있는지 확인
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }

      // 5. 상태 업데이트 (덮어쓰기 vs 붙이기)
      if (pageIndex === 0) {
        setPosts(mappedPosts);
      } else {
        setPosts((prev) => [...prev, ...mappedPosts]);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      setHasMore(false);
      } finally {
      setIsLoading(false);
      setIsFetching(false);
      }
    };

  // 페이지 변경 시 실행
  useEffect(() => {
    fetchPosts(page);
  }, [page]);

  // Observer 설정 (하단 감지 시 page + 1)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching && !isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [hasMore, isFetching, isLoading]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mt-4 py-8">
        <div className="container flex lg:justify-end">
          <div className="flex flex-col lg:flex-row lg:items-start gap-[40px] flex-shrink-0">
          {/* 메인 게시물 리스트 - 고정 너비 (모바일: full, 데스크톱: 700px) */}
          <div className="w-full lg:w-[700px] flex-shrink-0">
            {/* 초기 로딩 상태 */}
            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <p className="text-muted-foreground">Loading stories...</p>
              </div>
            )}

            {/* 에러 상태 */}
            {error && (
              <div className="flex justify-center items-center py-20">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            {/* 빈 상태 */}
            {!isLoading && !error && !tempPost && posts.length === 0 && (
              <div className="flex justify-center items-center py-20">
                <p className="text-muted-foreground">아직 글이 없습니다.</p>
              </div>
            )}

            {/* 게시물 리스트 (tempPost 있으면 맨 위에 방금 쓴 글 미리보기) */}
            {!isLoading && !error && (tempPost || posts.length > 0) && (
              <>
              <div className="space-y-6">
                {tempPost && (
                  <div className="ring-2 ring-blue-400/60 rounded-xl bg-white/50">
                    <StoryCard
                      key={tempPost.id}
                      post={tempPost}
                      shouldSaveToHistory={false}
                      onPostDeleted={(postId) => {
                        setTempPost((prev) => (prev?.id === postId ? null : prev));
                        setPosts((prev) => prev.filter((p) => p.id !== postId));
                      }}
                    />
                  </div>
                )}
                {posts.map((post) => (
                  <StoryCard
                    key={post.id}
                    post={post}
                    shouldSaveToHistory={false}
                    onPostDeleted={(postId) => {
                      setTempPost((prev) => (prev?.id === postId ? null : prev));
                      setPosts((prev) => prev.filter((p) => p.id !== postId));
                    }}
                  />
                ))}
                      </div>
                      
              {/* 추가 로딩 인디케이터 (하단) */}
              {isFetching && (
                <div className="w-full flex justify-center items-center py-6 gap-2 text-gray-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>불러오는 중...</span>
                </div>
              )}

              {/* Intersection Observer Target (감지용 투명 div) */}
              {hasMore && (
                <div ref={observerRef} className="h-px w-full" />
              )}
            </>
          )}
        </div>

        {/* 인기 게시물 사이드바 - 고정 너비 */}
        <aside className="hidden lg:block flex-shrink-0 w-[300px]">
          <div className="sticky top-16 flex flex-col gap-6">
            <PopularPosts />
            <NotificationsSection />
          </div>
        </aside>
        </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 Failcess. A community for founders to learn from failure.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
