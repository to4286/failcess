import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSearchTerm } from '@/lib/utils';
import { Post } from '@/types';

interface SearchUser {
  id: string;
  nickname: string;
  job_title: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setPosts([]);
        setUsers([]);
        setPostCount(0);
        setUserCount(0);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 현재 로그인한 사용자 (본인 글은 scope 무관, 타인의 글은 public만 노출하기 위함)
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id ?? null;

        // 1. 게시물 검색 (RPC: 제목/본문/카테고리에 키워드 포함 시만. 특수문자 %, _ 등은 리터럴로 매칭)
        const sanitized = sanitizeSearchTerm(query);
        const { data: postsRpcData, error: postsRpcError } = await supabase
          .rpc('search_posts_ranked', { keyword: sanitized });

        if (postsRpcError) {
          console.error('Posts 조회 에러:', postsRpcError);
          // 에러가 나도 빈 배열로 처리해서 계속 진행
        }

        // RPC 결과에서 기본 데이터만 사용 + is_public 기반 필터 (타인 글은 공개만)
        const rawPostsData = postsRpcData || [];
        const postsData = rawPostsData.filter((post: any) => {
          if (!post) return false;
          const authorId = post.author_id;
          if (currentUserId && authorId === currentUserId) return true;
          return post.is_public === true;
        });

        // 작성자 정보가 필요하면 별도로 안전하게 조회 시도
        const postIds = (postsData || []).map((post: any) => post.id).filter(Boolean);
        let authorMap: Record<string, any> = {};

        if (postIds.length > 0) {
          try {
            // profiles 정보를 별도로 조회 시도 (에러가 나도 무시)
            const { data: postsWithAuthor, error: authorError } = await supabase
              .from('posts')
              .select('id, author_id, profiles:author_id(id, nickname, job_title, avatar_url, bio)')
              .in('id', postIds);

            if (authorError) {
              console.error('Author 조회 에러 (non-fatal):', authorError);
              // 에러가 나도 계속 진행 (작성자 정보 없이도 게시물은 표시)
            } else if (postsWithAuthor) {
              // author_id별로 profiles 정보 매핑
              postsWithAuthor.forEach((post: any) => {
                if (post.author_id && post.profiles) {
                  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
                  authorMap[post.author_id] = profile;
                }
              });
            }
          } catch (authorFetchError) {
            console.error('Author fetch exception (non-fatal):', authorFetchError);
            // 에러가 나도 계속 진행
          }
        }

        // 2. 유저 검색: 테이블 쿼리 후 클라이언트에서 검색어가 실제로 포함된 경우만 유지 (* 등 특수문자 리터럴 매칭)
        const userKeyword = query.replace(/"/g, '');
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname, job_title, avatar_url, bio')
          .or(`nickname.ilike."%${sanitized}%",job_title.ilike."%${sanitized}%"`);
        const fromDb = Array.isArray(profilesData) ? profilesData : [];
        const kw = userKeyword.toLowerCase();
        const rawUsersList = fromDb.filter(
          (u: SearchUser) =>
            (u.nickname && u.nickname.toLowerCase().includes(kw)) ||
            (u.job_title != null && String(u.job_title).toLowerCase().includes(kw))
        );
        const filteredUsers = currentUserId
          ? rawUsersList.filter((u: { id: string }) => u.id !== currentUserId)
          : rawUsersList;

        // 3. 게시물별 likes, comments count를 별도로 안전하게 조회
        const postsWithCounts = await Promise.all(
          (postsData || []).map(async (post: any) => {
            let likesCount = 0;
            let commentsCount = 0;

            try {
              // likes count 조회
              const { count: likesCountResult, error: likesError } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);

              if (likesError) {
                console.error(`Post ${post.id} likes 카운트 조회 실패:`, likesError);
              } else {
                likesCount = likesCountResult || 0;
              }
            } catch (likesErr) {
              console.error(`Post ${post.id} likes 카운트 조회 예외:`, likesErr);
            }

            try {
              // comments count 조회
              const { count: commentsCountResult, error: commentsError } = await supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);

              if (commentsError) {
                console.error(`Post ${post.id} comments 카운트 조회 실패:`, commentsError);
              } else {
                commentsCount = commentsCountResult || 0;
              }
            } catch (commentsErr) {
              console.error(`Post ${post.id} comments 카운트 조회 예외:`, commentsErr);
            }

            return {
              ...post,
              likes_count: likesCount,
              comments_count: commentsCount,
            };
          })
        );

        // 카운트 계산
        const postsCount = postsWithCounts?.length || 0;
        const usersCount = filteredUsers.length;

        // 게시물 데이터 매핑 (안전한 기본값 처리)
        const mappedPosts: Post[] = postsWithCounts.map((item: any) => {
          // 작성자 정보 가져오기 (우선순위: authorMap > item.author > item.profiles)
          const authorId = item.author_id || item.author?.id || '';
          const profile = authorMap[authorId] || item.author || item.profiles || {};
          const finalProfile = Array.isArray(profile) ? profile[0] : profile;

          return {
            id: String(item.id || ''),
            title: item.title || '',
            content: item.content || '',
            author_id: authorId,
            author: {
              id: finalProfile?.id || authorId || '',
              email: finalProfile?.email || '',
              nickname: finalProfile?.nickname || 'Unknown',
              avatar_url: finalProfile?.avatar_url || '',
              bio: finalProfile?.bio || '',
              job_title: finalProfile?.job_title || '',
            },
            save_count: item.save_count || 0,
            comment_count: item.comments_count || 0,
            like_count: item.likes_count || 0,
            view_count: item.view_count || 0,
            created_at: item.created_at || new Date().toISOString(),
          };
        });

        setPosts(mappedPosts);
        setUsers(filteredUsers);
        setPostCount(postsCount);
        setUserCount(usersCount);
      } catch (err) {
        console.error('검색 중 전체 에러:', err);
        console.error('Error type:', typeof err);
        console.error('Error message:', err instanceof Error ? err.message : String(err));
        console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
        
        // Supabase 에러 상세 정보 출력
        if (err && typeof err === 'object' && 'code' in err) {
          console.error('Supabase error code:', (err as any).code);
          console.error('Supabase error details:', (err as any).details);
          console.error('Supabase error hint:', (err as any).hint);
        }
        
        // 에러가 나도 사용자에게는 빈 결과라도 보여주도록 처리
        setPosts([]);
        setUsers([]);
        setPostCount(0);
        setUserCount(0);
        setError('검색 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  if (!query.trim()) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <h1 className="text-3xl font-bold mb-8">검색</h1>
          <p className="text-muted-foreground">검색어를 입력해주세요.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* 타이틀과 내용을 모두 감싸는 단 하나의 중앙 정렬 박스 */}
        <div className="max-w-2xl mx-auto">
          {/* 타이틀 (이제 박스 내부로 이동됨) */}
          <h1 className="text-3xl font-bold mb-6">
            <span className="text-primary">&quot;{query}&quot;</span> 검색 결과
          </h1>

          {isLoading ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">검색 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            /* 탭 및 리스트 */
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="posts">
                  게시물 ({postCount})
                </TabsTrigger>
                <TabsTrigger value="users">
                  유저 ({userCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="mt-6">
                {posts.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {posts.map((post) => (
                      <StoryCard key={post.id} post={post} searchKeyword={query} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="users" className="mt-6">
                {users.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground">검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {users.map((user) => (
                      <Link
                        key={user.id}
                        to={`/user/${user.id}`}
                        className="flex items-start gap-5 p-6 border rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow"
                      >
                        <Avatar className="w-20 h-20 rounded-full flex-shrink-0">
                          {user.avatar_url ? (
                            <AvatarImage src={user.avatar_url} alt={user.nickname} className="object-cover" />
                          ) : null}
                          <AvatarPlaceholder />
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xl font-bold text-gray-900 truncate">{user.nickname}</span>
                            {user.job_title && (
                              <span className="text-base font-medium text-gray-500 truncate">{user.job_title}</span>
                            )}
                          </div>
                          {user.bio && (
                            <p className="text-base text-gray-700 mt-3 line-clamp-2">{user.bio}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
