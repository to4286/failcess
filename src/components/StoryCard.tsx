import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Bookmark, Eye, MoreVertical } from 'lucide-react';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Post } from '@/types';
import { cn, getRelativeTime, addPostToHistory, isValidImageUrl, getFilteredPreviewText } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FolderSelectModal from '@/components/FolderSelectModal';
import { useAuthModal } from '@/hooks/useAuthModal';
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
import { Button } from '@/components/ui/button';

interface StoryCardProps {
  post: Post;
  hideSaveButton?: boolean;
  shouldSaveToHistory?: boolean; // 최근 검색어에 저장할지 여부 (기본값: true)
  searchKeyword?: string; // 검색 결과 페이지에서 온 경우의 검색 키워드
  /** 폴더 상세 등에서 저장 취소/이동 시 리스트에서 해당 게시물을 즉시 제거하기 위한 콜백. movedToFolderId 있으면 이동, 없으면 저장 취소 */
  onSaveRemoved?: (postId: string, movedToFolderId?: string) => void;
  /** 폴더 이동 완료 시 이동 대상 폴더 ID 전달 (카운트 +1용) */
  onSaveMoved?: (postId: string, toFolderId: string) => void;
  /** 게시물 삭제 완료 시 리스트에서 제거하기 위한 콜백 */
  onPostDeleted?: (postId: string) => void;
}

const TEST_USER_ID = '55b95afa-aa07-45e7-8630-0d608b705bca';

const StoryCard = ({ post, hideSaveButton = false, shouldSaveToHistory = true, searchKeyword, onSaveRemoved, onSaveMoved, onPostDeleted }: StoryCardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openAuthModal } = useAuthModal();
  const reactingLabel = useMemo(() => {
    const list = post.reactingFollowings;
    if (!list?.length) return '팔로잉이 반응한 글';
    const one = list[Math.floor(Math.random() * list.length)];
    return one ? `${one.nickname}님이 반응한 글` : '팔로잉이 반응한 글';
  }, [post.id]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [user, setUser] = useState<any>(null);

  const isOwnPost = user?.id === post.author_id;
  const shouldHideSaveButton = hideSaveButton || isOwnPost;

  // 메인 페이지에서 온 경우 확인
  const isFromMainPage = location.pathname === '/';

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

  // 초기 좋아요 상태 확인
  useEffect(() => {
    if (!user) return; // user가 없으면 체크하지 않음

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
  }, [post.id, user]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openAuthModal();
      return;
    }

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
          if (!isOwnPost) {
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

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // 현재 도메인 + 게시물 경로 조합
      const url = `${window.location.origin}/post/${post.id}`;
      
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

    // 폴더 선택 모달 표시
    setShowFolderModal(true);
  };

  // 폴더 선택 완료 시 호출
  const handleFolderSelect = async (folderId: string | null) => {
    if (!user) {
      openAuthModal();
      return;
    }

    try {
      if (isSaved) {
        // 저장 취소 (folderId가 null인 경우)
        if (folderId === null) {
          const { error } = await supabase
            .from('saves')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', user.id);

          if (!error) {
            setIsSaved(false);
            onSaveRemoved?.(post.id);
            toast.success('저장이 취소되었습니다', {
              position: 'top-center',
              duration: 2000,
            });
          } else {
            toast.error('저장 취소에 실패했습니다', {
              position: 'top-center',
              duration: 2000,
            });
          }
        } else {
          // 다른 폴더로 이동
          const { error: deleteError } = await supabase
            .from('saves')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', user.id);

          if (deleteError) {
            toast.error('폴더 이동에 실패했습니다', {
              position: 'top-center',
              duration: 2000,
            });
            return;
          }

          const { error: insertError } = await supabase
            .from('saves')
            .insert({
              post_id: post.id,
              user_id: user.id,
              folder_id: folderId,
            });

          if (!insertError) {
            // 폴더의 updated_at 갱신
            if (folderId) {
              await supabase
                .from('folders')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', folderId);
            }
            onSaveRemoved?.(post.id, folderId);
            onSaveMoved?.(post.id, folderId);
            toast.success('폴더로 이동되었습니다', {
              position: 'top-center',
              duration: 2000,
            });
          } else {
            toast.error('폴더 이동에 실패했습니다', {
              position: 'top-center',
              duration: 2000,
            });
          }
        }
      } else {
        // 저장 추가
        const { error } = await supabase
          .from('saves')
          .insert({
            post_id: post.id,
            user_id: user.id,
            folder_id: folderId,
          });

        if (!error) {
          // 폴더의 updated_at 갱신
          if (folderId) {
            await supabase
              .from('folders')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', folderId);
          }
          
          setIsSaved(true);
          toast.success('저장되었습니다', {
            position: 'top-center',
            duration: 2000,
          });
        } else {
          toast.error('저장에 실패했습니다', {
            position: 'top-center',
            duration: 2000,
          });
        }
      }
    } catch (err) {
      console.error('Error saving post:', err);
      toast.error('저장 중 오류가 발생했습니다', {
        position: 'top-center',
        duration: 2000,
      });
    }
  };


  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/write?edit=${post.id}`);
  };

  const handleDeleteConfirm = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!user) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('author_id', user.id);
      if (error) throw error;
      setShowDeleteModal(false);
      toast.success('게시물이 삭제되었습니다.', { position: 'top-center', duration: 2000 });
      onPostDeleted?.(post.id);
      if (!onPostDeleted) navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 사용자 프로필 링크나 버튼 클릭 시는 히스토리에 저장하지 않음
    if (target.closest('a[href*="/user/"]') || target.closest('button')) {
      return;
    }
    
    // 게시물 카드 클릭 시 히스토리에 저장 (shouldSaveToHistory가 true인 경우만)
    // (검색 결과 페이지에서 게시물 클릭 시: 키워드 위에 게시물이 최신 기록으로 추가됨)
    if (shouldSaveToHistory) {
      try {
        addPostToHistory(post.id, post.title);
        console.log('[StoryCard] ✅ 게시물 히스토리 저장 완료:', { id: post.id, title: post.title });
        console.log('[StoryCard] 📋 저장 흐름: 키워드 -> 게시물 (게시물이 최상단으로 이동)');
      } catch (error) {
        console.error('[StoryCard] 🔴 게시물 히스토리 저장 실패:', error);
        // 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
      }
    }
  };

  // 첫 번째 이미지 URL 추출
  const extractFirstImage = (html: string): string | null => {
    const match = html.match(/<img[^>]+src="([^">]+)"/);
    const url = match ? match[1] : null;
    // URL 유효성 검사
    return url && isValidImageUrl(url) ? url : null;
  };

  const firstImageUrl = extractFirstImage(post.content);
  const contentText = getFilteredPreviewText(post.content);

  return (
    <article className="group bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in flex flex-col h-full">
      {post.feedBadge === 'friend_like' && (
        <div className="mb-2 text-xs font-medium text-amber-600 flex items-center gap-1">
          <span>🔥</span>
          <span>{reactingLabel}</span>
        </div>
      )}
      {/* 1. 작성자 정보 */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <Link 
            to={`/user/${post.author_id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer select-none min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="h-8 w-8 select-none flex-shrink-0">
              {isValidImageUrl(post.author.avatar_url) ? (
                <AvatarImage src={post.author.avatar_url!} alt={post.author.nickname} />
              ) : null}
              <AvatarPlaceholder />
            </Avatar>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-foreground text-sm select-none truncate">
                {post.author.nickname}
              </span>
              <span className="text-sm text-gray-500 select-none flex-shrink-0">
                {getRelativeTime(post.created_at)}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1 flex-shrink-0">
            {post.is_public === false && (
              <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>나만 보기</span>
              </span>
            )}
            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none"
                    aria-label="더보기"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleEdit}>
                    수정하기
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteModal(true);
                    }}
                    className="text-red-500 focus:text-red-500"
                  >
                    삭제하기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* 2. 본문 영역 Wrapper (제목, 내용, 사진) - gap-6으로 텍스트와 썸네일 간격 유지 */}
      <div className="flex flex-row justify-between items-start flex-1 gap-6">
        {/* 왼쪽: 텍스트 영역 */}
        <div className="flex-1 min-w-0 flex flex-col pt-2">
          {/* 제목 */}
          <Link 
            to={`/post/${post.id}`}
            state={{ fromMainPage: isFromMainPage, searchKeyword: searchKeyword }}
            className="block mb-1 cursor-pointer select-none"
            onClick={handleCardClick}
          >
            <h2 className="text-2xl font-bold text-gray-900 line-clamp-2 group-hover:text-navy-light transition-colors select-none">
              {post.title}
            </h2>
          </Link>

          {/* 본문 요약 (텍스트만) */}
          <Link 
            to={`/post/${post.id}`}
            state={{ fromMainPage: isFromMainPage, searchKeyword: searchKeyword }}
            className="block cursor-pointer select-none"
            onClick={handleCardClick}
          >
            <p className="text-gray-500 line-clamp-2 text-sm select-none">
              {contentText}
            </p>
          </Link>
        </div>

        {/* 오른쪽: 사진 영역 (flex-shrink-0으로 텍스트에 눌리지 않음) */}
        {firstImageUrl && isValidImageUrl(firstImageUrl) && (
          <Link 
            to={`/post/${post.id}`}
            state={{ fromMainPage: isFromMainPage, searchKeyword: searchKeyword }}
            className="flex-shrink-0 sm:block hidden cursor-pointer select-none w-48 h-48 overflow-hidden rounded-xl border border-gray-100"
            onClick={handleCardClick}
          >
            <img
              src={firstImageUrl}
              alt={post.title}
              className="w-full h-full object-cover select-none"
              onError={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.display = 'none';
                console.debug('[StoryCard] 이미지 로드 실패 (의도적으로 무시됨):', firstImageUrl);
              }}
              onLoad={(e) => {
                e.currentTarget.style.display = '';
              }}
            />
          </Link>
        )}
      </div>

      {/* 3. 하단 액션바 (Footer - Wrapper 밖으로 분리) */}
      <footer className="flex items-center justify-between w-full mt-4">
        {/* 왼쪽: 응원해요, 댓글 */}
        <div className="flex items-center gap-4">
          {/* 응원해요 (Cheer) */}
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 transition-all duration-200 cursor-pointer select-none",
              isLiked
                ? "opacity-100"
                : "opacity-60 grayscale hover:opacity-80 hover:grayscale-0"
            )}
          >
            <span className={cn(
              "text-lg transition-transform duration-200 select-none",
              isLiked && "scale-110"
            )}>
              🙌
            </span>
            <span className="text-sm text-foreground select-none">{likeCount}</span>
          </button>

          {/* 댓글 (Comment) */}
          <Link 
            to={`/post/${post.id}`}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4 select-none" />
            <span className="text-sm select-none">{post.comment_count || 0}</span>
          </Link>
        </div>

        {/* 오른쪽 끝: 내 글은 비움, 그 외에는 저장 버튼 또는( hideSaveButton 시 ) 조회수 */}
        {isOwnPost ? null : shouldHideSaveButton ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-4 w-4 select-none" />
            <span className="text-sm select-none">{post.view_count || 0}</span>
          </div>
        ) : (
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center transition-colors cursor-pointer select-none",
              isSaved
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark className={cn("h-4 w-4 select-none", isSaved && "fill-current")} />
          </button>
        )}
      </footer>

      {/* 폴더 선택 모달 */}
      <FolderSelectModal
        open={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onSelect={handleFolderSelect}
        postId={isSaved ? post.id : undefined}
      />

      {/* 삭제 확인 모달 */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
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
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
};

export default StoryCard;
