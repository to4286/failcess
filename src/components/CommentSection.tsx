import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getRelativeTime, isValidImageUrl } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Bell, BellOff } from 'lucide-react';
import { useAuthModal } from '@/hooks/useAuthModal';
import { toast } from 'sonner';
import CommentNotificationModal from '@/components/CommentNotificationModal';
import { Switch } from '@/components/ui/switch';

interface CommentSectionProps {
  postId?: string;
  postAuthorId?: string;
}

interface CommentItem {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  user: {
    id: string;
    nickname: string;
    avatar_url: string;
  };
}

const MAX_PREVIEW_LENGTH = 150;

/** post_id를 DB 타입(bigint)에 맞게 변환 */
const toPostId = (id: string | undefined): string | number | undefined => {
  if (!id) return undefined;
  return /^\d+$/.test(String(id)) ? Number(id) : id;
};

// 개별 댓글 아이템 컴포넌트
const CommentItemComponent = ({ 
  comment, 
  currentUserId,
  onUpdate, 
  onDelete 
}: { 
  comment: CommentItem;
  currentUserId?: string;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const shouldTruncate = comment.content.length > MAX_PREVIEW_LENGTH;
  const truncatedContent = shouldTruncate && !isExpanded
    ? comment.content.slice(0, MAX_PREVIEW_LENGTH)
    : comment.content;

  const isMyComment = currentUserId ? comment.author_id === currentUserId : false;

  const handleEdit = () => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(comment.id, editContent.trim());
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating comment:', err);
      alert('댓글 수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(comment.id);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('댓글 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              to={`/user/${comment.user.id}`}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar className="h-9 w-9 shrink-0">
                {isValidImageUrl(comment.user.avatar_url) ? (
                  <AvatarImage src={comment.user.avatar_url} alt={comment.user.nickname} />
                ) : null}
                <AvatarPlaceholder />
              </Avatar>
              <span className="font-medium text-foreground text-sm">
                {comment.user.nickname || '익명'}
              </span>
            </Link>
            <span className="text-xs text-gray-500">
              {getRelativeTime(comment.created_at)}
            </span>
          </div>

          {/* 미트볼 메뉴 - 내 댓글일 때만 표시 */}
          {isMyComment && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-secondary rounded transition-colors">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  수정
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDeleteClick}
                  className="text-red-500 focus:text-red-500"
                >
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 수정 모드 */}
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] resize-none bg-background"
              disabled={isUpdating}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isUpdating || !editContent.trim()}
              >
                {isUpdating ? '수정 중...' : '수정'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {truncatedContent}
            {shouldTruncate && !isExpanded && '... '}
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-gray-900 underline hover:text-gray-700 transition-colors inline"
              >
                {isExpanded ? '접기' : '더보기'}
              </button>
            )}
          </p>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제된 댓글은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소하기</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? '삭제 중...' : '삭제하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const CommentSection = ({ postId, postAuthorId }: CommentSectionProps) => {
  const { openAuthModal } = useAuthModal();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationModalLoading, setNotificationModalLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

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

  const fetchComments = async () => {
    if (!postId) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('comments')
        .select('*, profiles(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase fetch comments error:', fetchError);
        throw fetchError;
      }

      if (data) {
        const mapped = data.map((item: any) => {
          const profile = Array.isArray(item.profiles)
            ? item.profiles[0]
            : item.profiles;

          return {
            id: item.id,
            content: item.content,
            created_at: item.created_at,
            author_id: item.author_id,
            user: {
              id: profile?.id || 'anonymous',
              nickname: profile?.nickname || '익명',
              avatar_url: profile?.avatar_url || '',
            },
          } as CommentItem;
        });

        setComments(mapped);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err instanceof Error ? err.message : '댓글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  // 알림 구독 상태 조회
  const fetchSubscriptionStatus = async () => {
    if (!postId || !user) {
      setIsSubscribed(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('post_notification_settings')
        .select('is_subscribed')
        .eq('user_id', user.id)
        .eq('post_id', toPostId(postId) ?? postId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setIsSubscribed(postAuthorId === user.id);
        return;
      }
      if (data) {
        setIsSubscribed(data.is_subscribed);
      } else {
        setIsSubscribed(postAuthorId === user.id);
      }
    } catch (err) {
      console.error('Error in fetchSubscriptionStatus:', err);
      setIsSubscribed(postAuthorId === user.id);
    }
  };

  useEffect(() => {
    if (user && postId) {
      fetchSubscriptionStatus();
    } else {
      setIsSubscribed(null);
    }
  }, [postId, user?.id, postAuthorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      openAuthModal();
      return;
    }

    if (!postId || !newComment.trim()) return;

    const isFirstCommentOnOthersPost =
      postAuthorId &&
      postAuthorId !== user.id &&
      comments.filter((c) => c.author_id === user.id).length === 0;

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        content: newComment.trim(),
        post_id: postId,
        author_id: user.id,
      };

      const { data, error: insertError } = await supabase
        .from('comments')
        .insert([payload])
        .select('*, profiles(*)');

      if (insertError) {
        console.error('Supabase insert comment error:', insertError);
        throw insertError;
      }

      if (data && data.length > 0) {
        const commentContent = newComment.trim();
        await fetchComments();
        setNewComment('');
        if (isFirstCommentOnOthersPost) {
          setShowNotificationModal(true);
        }
        // 댓글 알림 생성: RPC 호출만 사용 (notifications 직접 INSERT 금지)
        if (postId) {
          const { error: rpcError } = await supabase.rpc('create_comment_notification', {
            p_post_id: postId.toString(),
            p_comment_content: commentContent,
            p_commenter_id: user.id,
          });
          if (rpcError) {
            console.error('[알림] RPC 실패:', rpcError);
          }
        }
      } else {
        throw new Error('댓글이 등록되었지만 데이터를 가져오지 못했습니다.');
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      const errorMessage = err instanceof Error ? err.message : '댓글을 등록하는 중 오류가 발생했습니다.';
      setError(errorMessage);
      alert(`댓글 등록 실패: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotificationModalConfirm = async (): Promise<boolean> => {
    if (!postId || !user) return false;
    try {
      setNotificationModalLoading(true);
      const { error } = await supabase
        .from('post_notification_settings')
        .upsert(
          { user_id: user.id, post_id: toPostId(postId), is_subscribed: true },
          { onConflict: 'user_id,post_id' }
        );
      if (error) throw error;
      setIsSubscribed(true);
      toast.success('해당 게시물의 댓글 알림을 받습니다.', { position: 'top-center', duration: 2000 });
      return true;
    } catch (err) {
      console.error('Error saving notification setting:', err);
      toast.error('알림 설정 저장에 실패했습니다.');
      return false;
    } finally {
      setNotificationModalLoading(false);
    }
  };

  const handleToggleSubscription = async (checked: boolean) => {
    if (!postId || !user || toggleLoading) return;
    try {
      setToggleLoading(true);
      if (checked) {
        const { error } = await supabase
          .from('post_notification_settings')
          .upsert(
            { user_id: user.id, post_id: toPostId(postId), is_subscribed: true },
            { onConflict: 'user_id,post_id' }
          );
        if (error) throw error;
        setIsSubscribed(true);
        toast.success('해당 게시물의 댓글 알림을 받습니다.', { position: 'top-center', duration: 2000 });
      } else {
        const { error } = await supabase
          .from('post_notification_settings')
          .upsert(
            { user_id: user.id, post_id: toPostId(postId), is_subscribed: false },
            { onConflict: 'user_id,post_id' }
          );
        if (error) throw error;
        setIsSubscribed(false);
        toast.info('해당 게시물의 댓글 알림을 받지 않습니다.', { position: 'top-center', duration: 2000 });
      }
    } catch (err) {
      console.error('Error toggling subscription:', err);
      toast.error('알림 설정 변경에 실패했습니다.');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <section className="mt-10">
      <CommentNotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onConfirm={handleNotificationModalConfirm}
        isLoading={notificationModalLoading}
      />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          댓글 ({comments.length})
        </h2>
        {user && (
          <div className="flex items-center gap-2">
            <Switch
              checked={isSubscribed ?? false}
              onCheckedChange={handleToggleSubscription}
              disabled={toggleLoading || isSubscribed === null}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
            />
            <span
              className={`flex items-center gap-1.5 text-sm select-none pointer-events-none ${
                isSubscribed
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {isSubscribed ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span>{isSubscribed ? '알림 켜짐' : '알림 꺼짐'}</span>
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <Textarea
          placeholder="댓글을 입력하세요"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[100px] resize-none bg-card"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !newComment.trim()}>
            {submitting ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>

      {loading && (
        <p className="text-muted-foreground text-sm">댓글을 불러오는 중...</p>
      )}

      {error && (
        <p className="text-destructive text-sm">오류: {error}</p>
      )}


      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItemComponent 
            key={comment.id} 
            comment={comment}
            currentUserId={user?.id}
            onUpdate={async (id, content) => {
              try {
                const { error } = await supabase
                  .from('comments')
                  .update({ content })
                  .eq('id', id);

                if (error) throw error;

                // DB에서 최신 목록 다시 불러오기 (확실한 동기화)
                await fetchComments();
              } catch (err) {
                console.error('Error updating comment:', err);
                throw err;
              }
            }}
            onDelete={async (id) => {
              try {
                const { error } = await supabase
                  .from('comments')
                  .delete()
                  .eq('id', id);

                if (error) throw error;

                // DB에서 최신 목록 다시 불러오기 (확실한 동기화)
                await fetchComments();
              } catch (err) {
                console.error('Error deleting comment:', err);
                throw err;
              }
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default CommentSection;
