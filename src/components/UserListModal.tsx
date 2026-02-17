import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { isValidImageUrl } from '@/lib/utils';

interface Profile {
  id: string;
  nickname: string;
  avatar_url: string;
  bio?: string;
  job_title?: string;
  is_following: boolean;
}

interface UserListModalProps {
  title: '팔로워' | '팔로잉';
  userId: string;
  currentUserId: string;
  onClose: () => void;
}

const UserListModal = ({ title, userId, currentUserId, onClose }: UserListModalProps) => {
  const [modalList, setModalList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchList = async () => {
      if (!userId) {
        setModalList([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        if (title === '팔로워') {
          // 팔로워: following_id = 현재 프로필 유저 → follower_id에 해당하는 profiles
          const { data: followsData, error: followsError } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', userId);

          if (followsError) {
            setError('목록을 불러오는 중 오류가 발생했습니다.');
            return;
          }

          if (!followsData?.length) {
            setModalList([]);
            return;
          }

          const followerIds = followsData.map((r: { follower_id: string }) => r.follower_id);
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nickname, avatar_url, bio, job_title')
            .in('id', followerIds);

          if (profilesError) {
            setError('목록을 불러오는 중 오류가 발생했습니다.');
            return;
          }

          const { data: myFollowsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUserId)
            .in('following_id', followerIds);
          const followingSet = new Set((myFollowsData || []).map((r: { following_id: string }) => r.following_id));

          const list: Profile[] = (profilesData || [])
            .filter((p: any) => p.id !== userId)
            .map((p: any) => ({
              id: p.id,
              nickname: p.nickname || 'Unknown',
              avatar_url: p.avatar_url || '',
              bio: p.bio || '',
              job_title: p.job_title || '',
              is_following: followingSet.has(p.id),
            }));
          const shuffled = [...list].sort(() => Math.random() - 0.5);
          setModalList(shuffled);
        } else {
          // 팔로잉: follower_id = 현재 프로필 유저 → following_id에 해당하는 profiles
          const { data: followsData, error: followsError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

          if (followsError) {
            setError('목록을 불러오는 중 오류가 발생했습니다.');
            return;
          }

          if (!followsData?.length) {
            setModalList([]);
            return;
          }

          const followingIds = followsData.map((r: { following_id: string }) => r.following_id);
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nickname, avatar_url, bio, job_title')
            .in('id', followingIds);

          if (profilesError) {
            setError('목록을 불러오는 중 오류가 발생했습니다.');
            return;
          }

          const myFollowingIds = new Set<string>();
          if (currentUserId) {
            const { data: myFollows } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', currentUserId);
            (myFollows || []).forEach((r: { following_id: string }) => myFollowingIds.add(r.following_id));
          }

          const list: Profile[] = (profilesData || [])
            .filter((p: any) => p.id !== userId)
            .map((p: any) => ({
              id: p.id,
              nickname: p.nickname || 'Unknown',
              avatar_url: p.avatar_url || '',
              bio: p.bio || '',
              job_title: p.job_title || '',
              is_following: myFollowingIds.has(p.id),
            }));

          list.sort((a, b) => {
            const aMine = myFollowingIds.has(a.id) ? 1 : 0;
            const bMine = myFollowingIds.has(b.id) ? 1 : 0;
            if (bMine !== aMine) return bMine - aMine;
            return (a.nickname || '').localeCompare(b.nickname || '', 'ko');
          });
          setModalList(list);
        }
      } catch (_) {
        setError('목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [title, userId, currentUserId]);

  const handleFollow = async (
    targetUserId: string,
    isCurrentlyFollowing: boolean,
    targetNickname?: string
  ) => {
    try {
      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        if (!error) {
          setModalList((prev) =>
            prev.map((u) => (u.id === targetUserId ? { ...u, is_following: false } : u))
          );
        }
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: targetUserId });
        if (!error) {
          const { error: rpcError } = await supabase.rpc('create_follow_notification', {
            p_receiver_id: targetUserId,
            p_sender_id: currentUserId,
          });
          if (rpcError) console.warn('팔로우 알림 생성 실패 (RPC 미적용 가능):', rpcError);
          setModalList((prev) =>
            prev.map((u) => (u.id === targetUserId ? { ...u, is_following: true } : u))
          );
          toast(`${targetNickname ?? '유저'}님을 팔로우합니다.`, {
            position: 'top-center',
            duration: 2000,
          });
        }
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleUserClick = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer select-none"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-destructive">{error}</p>
            </div>
          ) : modalList.length === 0 ? (
            <div className="flex items-center justify-center py-12 px-4">
              <p className="text-muted-foreground text-center">
                {title === '팔로워' ? '아직 팔로워가 없습니다.' : '아직 팔로잉이 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {modalList.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <Link
                    to={`/user/${profile.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={handleUserClick}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {isValidImageUrl(profile.avatar_url) ? (
                        <AvatarImage src={profile.avatar_url} alt={profile.nickname} />
                      ) : null}
                      <AvatarPlaceholder />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{profile.nickname}</p>
                      {profile.job_title && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {profile.job_title}
                        </p>
                      )}
                    </div>
                  </Link>
                  {profile.id !== currentUserId && !profile.is_following && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFollow(profile.id, profile.is_following, profile.nickname);
                      }}
                      className="ml-4 flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer select-none"
                    >
                      팔로우
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserListModal;
