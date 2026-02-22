import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getRelativeTime, isValidImageUrl } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Bell, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface NotificationItem {
  id: string;
  user_id: string;
  sender_id: string;
  post_id?: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string | null;
  type?: string | null;
  sender?: { nickname: string; avatar_url: string | null };
}

const PAGE_SIZE = 10;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** **nickname** 형식의 메시지를 파싱하여 닉네임을 볼드로 렌더링 */
const renderNotificationContent = (content: string) => {
  const parts = content.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

/** 알림 아이템 UI (메인/모달 공통) */
const NotificationItemRow = ({
  n,
  onClick,
  isWide = false,
}: {
  n: NotificationItem;
  onClick: () => void;
  isWide?: boolean;
}) => {
  const isLike = n.type === 'like';
  const isCoffee = n.type === 'coffee_request' || n.type === 'coffee_accept';
  const displayTime = n.updated_at ?? n.created_at;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors cursor-pointer select-none group flex gap-2.5 items-start ${
        n.is_read ? 'hover:bg-gray-50' : 'bg-primary/5 hover:bg-primary/10'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar className="h-7 w-7 rounded-full">
          {isValidImageUrl(n.sender?.avatar_url) ? (
            <AvatarImage src={n.sender!.avatar_url!} alt={n.sender.nickname} className="object-cover" />
          ) : null}
          <AvatarPlaceholder />
        </Avatar>
        {isLike && (
          <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">🙌</span>
        )}
        {isCoffee && (
          <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
            ☕
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2"
        >
          {renderNotificationContent(n.content)}
        </p>
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
        {getRelativeTime(displayTime)}
      </span>
    </button>
  );
};

const NotificationsSection = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tableAvailable, setTableAvailable] = useState<boolean | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>([]);
  const [allPage, setAllPage] = useState(0);
  const [hasMoreAll, setHasMoreAll] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const fetchNotifications = async (uid: string) => {
    if (!uid || typeof uid !== 'string' || uid.trim() === '') {
      setNotifications([]);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, sender_id, post_id, content, is_read, created_at, updated_at, type')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(6);

      if (error) {
        setTableAvailable(false);
        if (!['PGRST116', '42P01', '22P02'].includes(error.code || '')) {
          console.error('Error fetching notifications:', error);
        }
        setNotifications([]);
        return;
      }

      setTableAvailable(true);
      const rawItems = data || [];
      const items = [...rawItems].sort((a: any, b: any) => {
        const timeA = new Date(a.updated_at ?? a.created_at).getTime();
        const timeB = new Date(b.updated_at ?? b.created_at).getTime();
        return timeB - timeA;
      });
      const senderIds = [...new Set(items.map((i: any) => i.sender_id).filter(Boolean))];
      let profilesMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url')
          .in('id', senderIds);
        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map((p: any) => [
              p.id,
              { nickname: p.nickname || '익명', avatar_url: p.avatar_url || null },
            ])
          );
        }
      }

      const mapped = items.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        sender_id: item.sender_id,
        post_id: item.post_id,
        content: item.content,
        is_read: item.is_read,
        created_at: item.created_at,
        updated_at: item.updated_at ?? item.created_at,
        type: item.type ?? null,
        sender: profilesMap[item.sender_id] || { nickname: '익명', avatar_url: null },
      })) as NotificationItem[];
      setNotifications(mapped);
    } catch (err: unknown) {
      setTableAvailable(false);
      const e = err as { code?: string };
      if (!['PGRST116', '42P01', '22P02'].includes(e?.code || '')) {
        console.error('Error in fetchNotifications:', err);
      }
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllNotifications = useCallback(
    async (uid: string, page: number, append: boolean) => {
      if (!uid || typeof uid !== 'string' || uid.trim() === '') return;
      const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
      try {
        setLoadingMore(true);
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, sender_id, post_id, content, is_read, created_at, updated_at, type')
          .eq('user_id', uid)
          .gte('updated_at', thirtyDaysAgo)
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (error) {
          if (page === 0) setAllNotifications([]);
          setHasMoreAll(false);
          return;
        }

        const rawItems = data || [];
        const items = [...rawItems].sort((a: any, b: any) => {
          const timeA = new Date(a.updated_at ?? a.created_at).getTime();
          const timeB = new Date(b.updated_at ?? b.created_at).getTime();
          return timeB - timeA;
        });

        setHasMoreAll(items.length === PAGE_SIZE);

        const senderIds = [...new Set(items.map((i: any) => i.sender_id).filter(Boolean))];
        let profilesMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
        if (senderIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nickname, avatar_url')
            .in('id', senderIds);
          if (profiles) {
            profilesMap = Object.fromEntries(
              profiles.map((p: any) => [
                p.id,
                { nickname: p.nickname || '익명', avatar_url: p.avatar_url || null },
              ])
            );
          }
        }

        const mapped = items.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          sender_id: item.sender_id,
          post_id: item.post_id,
          content: item.content,
          is_read: item.is_read,
          created_at: item.created_at,
          updated_at: item.updated_at ?? item.created_at,
          type: item.type ?? null,
          sender: profilesMap[item.sender_id] || { nickname: '익명', avatar_url: null },
        })) as NotificationItem[];

        setAllNotifications((prev) => (append ? [...prev, ...mapped] : mapped));
      } catch (err) {
        if (page === 0) setAllNotifications([]);
        setHasMoreAll(false);
      } finally {
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        await fetchNotifications(session.user.id);
      } else {
        setUserId(null);
        setNotifications([]);
        setTableAvailable(null);
        setIsLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchNotifications(session.user.id);
      } else {
        setUserId(null);
        setNotifications([]);
        setTableAvailable(null);
        setIsLoading(false);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userIdRef.current) {
        fetchNotifications(userIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Realtime 구독: notifications 테이블 변경 시 리스트 업데이트 (테이블 사용 가능할 때만)
  useEffect(() => {
    if (!userId || typeof userId !== 'string' || userId.trim() === '' || tableAvailable !== true) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications(userId);
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' && err) {
          // Realtime 구독 실패 시 조용히 처리 (테이블 미생성 등)
          return;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, tableAvailable]);

  useEffect(() => {
    if (showAllModal && userId) {
      setAllPage(0);
      setHasMoreAll(true);
      fetchAllNotifications(userId, 0, false);
    }
  }, [showAllModal, userId, fetchAllNotifications]);

  const loadMoreAll = useCallback(() => {
    if (!userId || loadingMore || !hasMoreAll) return;
    const nextPage = allPage + 1;
    setAllPage(nextPage);
    fetchAllNotifications(userId, nextPage, true);
  }, [userId, allPage, loadingMore, hasMoreAll, fetchAllNotifications]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAllModal || !hasMoreAll || loadingMore) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 80) {
        loadMoreAll();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [showAllModal, hasMoreAll, loadingMore, loadMoreAll]);

  const [emailModalUser, setEmailModalUser] = useState<{
    partnerId: string;
    nickname: string;
    email: string | null;
    avatar_url: string | null;
    loading?: boolean;
  } | null>(null);

  const handleNotificationClick = async (n: NotificationItem, closeModal?: boolean) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', n.id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
    if (closeModal) setShowAllModal(false);

    if (n.type === 'follow') {
      if (n.sender_id) navigate(`/user/${n.sender_id}`);
      return;
    }
    if (n.type === 'coffee_request') {
      navigate('/mypage/coffee-chat');
      return;
    }
    if (n.type === 'coffee_accept') {
      if (n.sender_id) {
        setEmailModalUser({ partnerId: n.sender_id, nickname: '상대방', email: null, avatar_url: null, loading: true });
        try {
          const { data, error } = await supabase.rpc('get_coffee_chat_partner_profile', {
            p_partner_id: n.sender_id,
          });
          const row = Array.isArray(data) && data[0] ? data[0] : null;
          setEmailModalUser({
            partnerId: n.sender_id,
            nickname: row?.nickname ?? '상대방',
            email: error ? null : (row?.email ?? null),
            avatar_url: row?.avatar_url ?? null,
            loading: false,
          });
        } catch {
          setEmailModalUser({ partnerId: n.sender_id, nickname: '상대방', email: null, avatar_url: null, loading: false });
        }
      }
      return;
    }
    if (n.post_id) {
      navigate(`/post/${n.post_id}`);
    }
  };

  if (!userId) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm min-h-[280px] flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">알림</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowAllModal(true)}
          className="text-gray-400 hover:text-foreground text-xs transition-colors"
        >
          전체 보기
        </button>
      </div>

      <div className="flex-1 min-h-[200px]">
      {isLoading && (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-2.5 py-1.5">
              <div className="h-7 w-7 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-full mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="text-sm text-muted-foreground py-4 flex items-center justify-center min-h-[200px]">
          알림이 없습니다.
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <div className="space-y-1">
          {notifications.map((n) => (
            <NotificationItemRow
              key={n.id}
              n={n}
              onClick={() => handleNotificationClick(n)}
              isWide={false}
            />
          ))}
        </div>
      )}
      </div>

      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent
          hideClose
          className="max-w-[420px] w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden"
        >
          <DialogTitle className="sr-only">알림 전체 보기</DialogTitle>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-base font-bold text-foreground">알림 전체</h3>
            <button
              type="button"
              onClick={() => setShowAllModal(false)}
              className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto max-h-[320px] min-h-[280px] px-2 py-2"
          >
            {allNotifications.length === 0 && !loadingMore ? (
              <div className="text-sm text-muted-foreground py-8 flex justify-center">
                최근 30일 내 알림이 없습니다.
              </div>
            ) : (
              <div className="space-y-1">
                {allNotifications.map((n) => (
                  <NotificationItemRow
                    key={n.id}
                    n={n}
                    onClick={() => handleNotificationClick(n, true)}
                    isWide
                  />
                ))}
              </div>
            )}
            {loadingMore && (
              <div className="py-3 text-center text-xs text-muted-foreground">
                불러오는 중...
              </div>
            )}
            {hasMoreAll && allNotifications.length > 0 && !loadingMore && (
              <div className="h-4" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 커피챗 수락 - 이메일 공개 모달 */}
      <Dialog open={!!emailModalUser} onOpenChange={(open) => !open && setEmailModalUser(null)}>
        <DialogContent className="max-w-md" hideClose>
          <button
            type="button"
            onClick={() => setEmailModalUser(null)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground opacity-70 hover:opacity-70 hover:bg-transparent focus:outline-none focus:ring-0"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogTitle className="sr-only">
            커피챗 수락 - 이메일 확인
          </DialogTitle>
          <div className="space-y-3 pt-2">
            <div className="space-y-0.5">
              <h3 className="text-lg font-bold text-foreground">
                {emailModalUser?.nickname}님이 커피챗 요청을 수락했습니다
              </h3>
              <p className="text-sm text-muted-foreground">
                이메일을 복사해서 인사를 건네보세요.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Link
                to={emailModalUser?.partnerId ? `/user/${emailModalUser.partnerId}` : '#'}
                className="cursor-pointer rounded-full focus:outline-none focus:ring-0"
                onClick={() => setEmailModalUser(null)}
              >
                <Avatar className="h-16 w-16">
                  {isValidImageUrl(emailModalUser?.avatar_url) ? (
                    <AvatarImage src={emailModalUser!.avatar_url!} alt={emailModalUser?.nickname ?? ''} className="object-cover" />
                  ) : null}
                  <AvatarPlaceholder />
                </Avatar>
              </Link>
              <span className="font-medium text-foreground">{emailModalUser?.nickname}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {emailModalUser?.loading
                  ? '불러오는 중...'
                  : (emailModalUser?.email ?? '(이메일 없음)')}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!emailModalUser?.email) return;
                  try {
                    await navigator.clipboard.writeText(emailModalUser.email!);
                    toast.success('복사되었습니다', { duration: 2000 });
                  } catch {
                    toast.error('복사에 실패했습니다.');
                  }
                }}
                disabled={emailModalUser?.loading || !emailModalUser?.email}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                복사하기
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationsSection;
