import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * 특정 유저(targetUserId)에 대한 현재 로그인 유저의 팔로우 여부를 관리.
 * 마운트/ targetUserId 변경 시 DB에서 최신 상태를 조회하여 PostDetail / UserProfile 간 동기화 보장.
 */
export function useFollowStatus(targetUserId: string | null) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 현재 로그인 유저 조회
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // DB에서 팔로우 여부 조회 (마운트 및 targetUserId/currentUserId 변경 시)
  const checkFollowStatus = useCallback(async () => {
    if (!targetUserId) {
      setIsFollowing(false);
      return;
    }
    if (!currentUserId) {
      setIsFollowing(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (!error && data) {
        setIsFollowing(true);
      } else {
        setIsFollowing(false);
      }
    } catch (_) {
      setIsFollowing(false);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, currentUserId]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  /** 팔로우 실행 (낙관적 업데이트). 로그인 필요 시 false 반환. */
  const follow = useCallback(async (): Promise<boolean> => {
    if (!currentUserId || !targetUserId) return false;
    const prev = isFollowing;
    setIsFollowing(true);
    try {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: targetUserId });
      if (error) {
        setIsFollowing(prev);
        toast.error('팔로우에 실패했습니다.');
        return false;
      }
      const { error: rpcError } = await supabase.rpc('create_follow_notification', {
        p_receiver_id: targetUserId,
        p_sender_id: currentUserId,
      });
      if (rpcError) console.warn('팔로우 알림 생성 실패 (RPC 미적용 가능):', rpcError);
      return true;
    } catch (_) {
      setIsFollowing(prev);
      toast.error('팔로우에 실패했습니다.');
      return false;
    }
  }, [currentUserId, targetUserId, isFollowing]);

  /** 언팔로우 실행 (낙관적 업데이트). */
  const unfollow = useCallback(async (): Promise<boolean> => {
    if (!currentUserId || !targetUserId) return false;
    const prev = isFollowing;
    setIsFollowing(false);
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      if (error) {
        setIsFollowing(prev);
        toast.error('팔로우 취소에 실패했습니다.');
        return false;
      }
      return true;
    } catch (_) {
      setIsFollowing(prev);
      toast.error('팔로우 취소에 실패했습니다.');
      return false;
    }
  }, [currentUserId, targetUserId, isFollowing]);

  return {
    isFollowing,
    isLoading,
    currentUserId,
    checkFollowStatus,
    follow,
    unfollow,
  };
}
