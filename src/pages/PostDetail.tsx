import { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Bookmark, MoreVertical } from 'lucide-react';
import DOMPurify from 'dompurify';
import Header from '@/components/Header';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';
import CommentSection from '@/components/CommentSection';
import { getRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFollowStatus } from '@/hooks/useFollowStatus';
import { addPostToHistory, removeKeywordFromHistory } from '@/lib/utils';
import { useAuthModal } from '@/hooks/useAuthModal';
import CoffeeChatModal from '@/components/CoffeeChatModal';

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { openAuthModal } = useAuthModal();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showCoffeeChatModal, setShowCoffeeChatModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { isFollowing, follow: followAuthor } = useFollowStatus(post?.author_id ?? null);

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };
    getCurrentUser();

    // 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) {
        setError('글 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching post with id:', id);

        const { data, error: fetchError } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:author_id(nickname, job_title, avatar_url, bio),
            comments:comments(count),
            likes:likes(count)
          `)
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('Supabase fetch error:', fetchError);
          console.error('Error code:', fetchError.code);
          console.error('Error message:', fetchError.message);
          console.error('Error details:', fetchError.details);
          throw fetchError;
        }

        if (!data) {
          console.error('No data returned for post id:', id);
          setError('글을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        console.log('Post data received:', data);

        // 게시물 로드 시 최근 검색어에 자동 저장
        // 단, 메인 화면(/)에서 온 경우와 인기 게시물에서 온 경우는 저장하지 않음
        // 검색 결과, 내 게시물 목록 등 다른 경로에서 클릭한 게시물만 저장
        // 주의: 검색어는 저장하지 않음 (오직 handleSearchSubmit에서만 저장)
        const isFromMainPage = location.state?.fromMainPage === true;
        const isFromPopularPosts = location.state?.fromPopularPosts === true;
        const searchKeyword = location.state?.searchKeyword as string | undefined;
        
        // 검색 결과 페이지에서 온 경우: 키워드를 제거하고 게시물만 저장
        if (searchKeyword && data.id && data.title) {
          try {
            // 키워드 제거
            removeKeywordFromHistory(searchKeyword);
            console.log('[PostDetail] 검색 키워드 제거 완료:', searchKeyword);
            
            // 게시물 저장
            addPostToHistory(data.id, data.title);
            console.log('[PostDetail] 게시물 저장 완료:', { id: data.id, title: data.title });
          } catch (historyError) {
            console.error('[PostDetail] 최근 검색어 저장 실패:', historyError);
            // 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
          }
        }
        // 메인 화면이나 인기 게시물에서 온 경우가 아니면 게시물만 저장
        else if (data.id && data.title && !isFromMainPage && !isFromPopularPosts) {
          try {
            addPostToHistory(data.id, data.title);
            console.log('[PostDetail] 게시물 저장 완료:', { id: data.id, title: data.title });
          } catch (historyError) {
            console.error('[PostDetail] 최근 검색어 저장 실패:', historyError);
            // 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
          }
        } else if (isFromMainPage) {
          console.log('[PostDetail] 메인 화면에서 온 게시물이므로 최근 검색어에 저장하지 않음');
        } else if (isFromPopularPosts) {
          console.log('[PostDetail] 인기 게시물에서 온 게시물이므로 최근 검색어에 저장하지 않음');
        }

        // DB 데이터를 Post 타입에 맞게 변환
        // profiles는 foreign key join 결과로 배열 또는 단일 객체일 수 있음
        let profile = null;
        if (data.profiles) {
          profile = Array.isArray(data.profiles)
            ? data.profiles[0]
            : data.profiles;
        }

        // comments count 처리
        let commentCount = 0;
        if (data.comments) {
          if (Array.isArray(data.comments)) {
            if (data.comments.length > 0 && typeof data.comments[0] === 'object' && 'count' in data.comments[0]) {
              commentCount = data.comments[0].count || 0;
            } else {
              commentCount = data.comments.length;
            }
          } else if (typeof data.comments === 'object' && 'count' in data.comments) {
            commentCount = data.comments.count || 0;
          }
        }

        // likes count 처리
        let likeCount = 0;
        if (data.likes) {
          if (Array.isArray(data.likes)) {
            if (data.likes.length > 0 && typeof data.likes[0] === 'object' && 'count' in data.likes[0]) {
              likeCount = data.likes[0].count || 0;
            } else {
              likeCount = data.likes.length;
            }
          } else if (typeof data.likes === 'object' && 'count' in data.likes) {
            likeCount = data.likes.count || 0;
          }
        }

        // profile이 없어도 기본값으로 처리
        const rawCategories = data.categories;
        const categoriesArray = Array.isArray(rawCategories)
          ? rawCategories
          : typeof rawCategories === 'string'
            ? (() => {
                try {
                  const p = JSON.parse(rawCategories);
                  return Array.isArray(p) ? p : null;
                } catch {
                  return null;
                }
              })()
            : null;

        const mappedPost: Post = {
          id: data.id,
          title: data.title,
          content: data.content,
          author_id: data.author_id,
      author: {
            id: profile?.id || data.author_id,
            email: profile?.email || '',
            nickname: profile?.nickname || 'Unknown',
            avatar_url: profile?.avatar_url || '',
            bio: profile?.bio || '',
            job_title: profile?.job_title || '',
          },
          save_count: data.save_count || 0,
          comment_count: commentCount,
          like_count: likeCount,
          view_count: data.view_count || 0,
          created_at: data.created_at,
          categories: categoriesArray?.length ? categoriesArray : null,
        };

        setPost(mappedPost);
        setLikeCount(likeCount);
      } catch (err) {
        console.error('Error fetching post:', err);
        const errorMessage = err instanceof Error ? err.message : '글을 불러오는 중 오류가 발생했습니다.';
        console.error('Full error details:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, location]);

  // 조회수 증가 로직 (24시간 제한)
  useEffect(() => {
    if (!id || !post) return;

    const incrementViewCount = async () => {
      try {
        // localStorage에서 마지막 조회 시간 확인
        const storageKey = `last_viewed_${id}`;
        const lastViewed = localStorage.getItem(storageKey);
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24시간을 밀리초로 변환

        // 조회수 증가 조건: 값이 없거나 24시간이 지난 경우
        const shouldIncrement = !lastViewed || (now - parseInt(lastViewed, 10)) > TWENTY_FOUR_HOURS;

        if (shouldIncrement) {
          // RPC 함수 호출
          const { error: rpcError } = await supabase.rpc('increment_view_count', { 
            post_id_input: id
          });

          if (rpcError) {
            console.error('Error incrementing view count:', rpcError);
            // 조회수 증가 실패는 치명적이지 않으므로 에러를 던지지 않음
          } else {
            // localStorage에 현재 시간 저장
            localStorage.setItem(storageKey, now.toString());
            console.log(`[조회수 증가] 게시물 ${id}의 조회수가 증가되었습니다.`);
          }
        } else {
          const lastViewedTime = new Date(parseInt(lastViewed, 10));
          const hoursSinceLastView = Math.floor((now - parseInt(lastViewed, 10)) / (60 * 60 * 1000));
          console.log(`[조회수 증가 스킵] 게시물 ${id}는 ${hoursSinceLastView}시간 전에 조회되었습니다. (24시간 제한)`);
        }
      } catch (err) {
        console.error('Unexpected error in incrementViewCount:', err);
        // 에러는 치명적이지 않으므로 무시
      }
    };

    incrementViewCount();
  }, [id, post]);

  // 초기 좋아요 및 저장 상태 확인
  useEffect(() => {
    if (!post || !user) return;

    const checkLikeStatus = async () => {
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setIsLiked(true);
      }
  };

    const checkSaveStatus = async () => {
      const { data, error } = await supabase
        .from('saves')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setIsSaved(true);
      }
    };

    checkLikeStatus();
    checkSaveStatus();
  }, [post]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }
    const ok = await followAuthor();
    if (ok && post) {
      toast(`${post.author.nickname}님을 팔로우합니다.`, {
        duration: 2000,
        position: 'top-center',
      });
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    if (!post) return;

    try {
      if (isLiked) {
        // 좋아요 취소
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (!error) {
          setIsLiked(false);
          setLikeCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // 좋아요 추가
        const { error } = await supabase
          .from('likes')
          .insert({
            post_id: post.id,
            user_id: user.id,
          });

        if (!error) {
          setIsLiked(true);
          setLikeCount((prev) => prev + 1);
          // 응원 알림: 본인 글이 아닐 때만 RPC 호출
          if (post.author_id !== user.id) {
            await supabase.rpc('create_like_notification', {
              p_post_id: post.id.toString(),
              p_sender_id: user.id,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      // 현재 주소창 URL 그대로 사용
      const url = window.location.href;
      
      // 클립보드 API 사용 시도
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback: 구식 방법 (HTTPS가 아닌 환경)
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      toast.success('링크가 복사되었습니다!', {
        position: 'top-center',
        duration: 2000,
      });
    } catch (err) {
      console.error('Error copying link:', err);
      toast.error('링크 복사에 실패했습니다.', {
        position: 'top-center',
        duration: 2000,
      });
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

    if (!post) return;

    try {
      if (isSaved) {
        // 저장 취소
        const { error } = await supabase
          .from('saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (!error) {
          setIsSaved(false);
        }
      } else {
        // 저장 추가
        const { error } = await supabase
          .from('saves')
          .insert({
            post_id: post.id,
            user_id: user.id,
          });

        if (!error) {
          setIsSaved(true);
        }
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto my-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading story...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto my-12">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
              {error || '글을 찾을 수 없습니다'}
            </h1>
            <Link to="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로 돌아가기
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleEdit = () => {
    if (!post?.id) return;
    navigate(`/write?edit=${post.id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!post?.id) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      setShowDeleteModal(false);
      toast.success('게시물이 삭제되었습니다.', { position: 'top-center', duration: 2000 });
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const isOwnPost = user?.id === post.author_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto my-12">
        {/* Article Card - WritePage와 동일한 스타일 */}
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
          {/* Header Section - Vertical Stack, Left Aligned */}
          <div className="flex flex-col items-start space-y-4">
            {/* Title */}
            <h1 className="w-full text-4xl font-bold text-gray-900">
              {post.title}
            </h1>

            {/* Categories (제목 바로 아래) */}
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 mb-6">
                {post.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Profile Row */}
            <div className="flex items-center gap-3 mt-4 w-full">
              {/* Left: Avatar, Nickname, Follow Button */}
              <div className="flex items-center gap-3">
              <Link
                to={`/user/${post.author_id}`}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {post.author.avatar_url ? (
                    <AvatarImage src={post.author.avatar_url} alt={post.author.nickname} />
                  ) : null}
                  <AvatarPlaceholder />
                </Avatar>
                <span className="text-sm font-semibold text-gray-900">
                  {post.author.nickname}
                </span>
              </Link>
                {!isOwnPost && !isFollowing && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleFollow}
                    className="bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium text-sm"
                  >
                    팔로우
                  </Button>
                )}
              </div>

              {/* Right: Time + More (본인 글일 때만) */}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-400">
                  {getRelativeTime(post.created_at)}
                </span>
                {isOwnPost && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        aria-label="더보기"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEdit}>
                        수정하기
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteModal(true)}
                        className="text-red-500 focus:text-red-500"
                      >
                        삭제하기
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Divider - 강조 */}
            <div className="w-full border-b border-gray-300 my-8"></div>
          </div>

          {/* Content - WritePage와 동일한 스타일 */}
          <div className="mt-8">
            <div 
              className="prose prose-lg max-w-none prose-headings:font-bold prose-img:rounded-lg prose-img:shadow-md prose-img:my-6 prose-p:text-lg prose-p:leading-relaxed prose-p:text-gray-900 prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-gray-700 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r break-all whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} 
            />
            </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            {/* Left: Social Actions */}
            <div className="flex items-center gap-4">
              {/* 응원해요 (Cheer) */}
              <button
                onClick={handleLike}
                className={cn(
                  "flex items-center gap-1.5 transition-all duration-200",
                  isLiked
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                )}
              >
                <span className={cn(
                  "text-lg transition-transform duration-200",
                  isLiked && "scale-110"
                )}>
                  🙌
                </span>
                <span className="text-sm text-gray-900">{likeCount}</span>
              </button>

              {/* 공유하기 (Share) */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShare();
                }}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            {/* Right: Personal Action (내 글일 때는 저장 버튼 미노출) */}
            {!isOwnPost && (
              <button
                onClick={handleSave}
                className={cn(
                  "flex items-center transition-colors cursor-pointer",
                  isSaved
                    ? "text-yellow-500"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
              </button>
            )}
            </div>
          </article>

        {/* Author Profile Card - 마이페이지 프로필 구조와 동일 */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-8 mt-12 animate-fade-in">
          <div className="flex items-start">
            <Link
              to={`/user/${post.author_id}`}
              className="flex items-start flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-24 w-24 shrink-0 rounded-full object-cover">
                {post.author.avatar_url ? (
                  <AvatarImage src={post.author.avatar_url} alt={post.author.nickname} className="object-cover" />
                ) : null}
                <AvatarPlaceholder />
              </Avatar>
              <div className="flex-1 flex flex-col justify-center ml-6 min-w-0">
                <div className="flex flex-row items-baseline gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{post.author.nickname}</h1>
                  {post.author.job_title ? (
                    <span className="text-base font-medium text-gray-500">{post.author.job_title}</span>
                  ) : null}
                </div>
                {post.author.bio ? (
                  <p className="mt-2 text-base text-gray-600 break-words whitespace-pre-wrap">{post.author.bio}</p>
                ) : null}
              </div>
            </Link>
          </div>

          <div className="flex justify-end items-center gap-3 mt-6 flex-wrap sm:flex-nowrap">
            {!isOwnPost && !isFollowing && (
              <Button
                onClick={handleFollow}
                variant="default"
                className="bg-amber-50 text-amber-700 hover:bg-amber-100 w-full sm:w-auto"
              >
                팔로우
              </Button>
            )}
            {!isOwnPost && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!user) {
                    openAuthModal();
                    return;
                  }
                  setShowCoffeeChatModal(true);
                }}
                className="w-full sm:w-auto"
              >
                ☕ 커피챗 요청하기
              </Button>
            )}
          </div>
        </div>

        {/* Comments */}
        <section id="comments">
          <CommentSection postId={id} postAuthorId={post?.author_id} />
        </section>
      </main>

      {user && post && (
        <CoffeeChatModal
          isOpen={showCoffeeChatModal}
          onClose={() => setShowCoffeeChatModal(false)}
          sender={{
            id: user.id,
            nickname: user.user_metadata?.nickname ?? user.email ?? '나',
          }}
          receiver={{
            id: post.author.id,
            nickname: post.author.nickname,
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">정말 삭제하시겠습니까?</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">게시물을 삭제하면 복구가 불가합니다.</p>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              닫기
            </Button>
            <Button
              variant="destructive"
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={handleDeleteConfirm}
            >
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostDetail;
