import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Folder, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import CoffeeChatModal from '@/components/CoffeeChatModal';
import { useAuthModal } from '@/hooks/useAuthModal';
import { useFollowStatus } from '@/hooks/useFollowStatus';
import { toast } from 'sonner';
import { Post, Folder as FolderType } from '@/types';
import UserListModal from '@/components/UserListModal';

type PostWithFolderId = Post & { folder_id?: string | null };
type SelectedFolderForView = FolderType | { id: 'all'; name: string };

const UserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openAuthModal } = useAuthModal();

  const [profile, setProfile] = useState<{
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    bio: string | null;
    job_title: string | null;
  } | null>(null);
  const [userPosts, setUserPosts] = useState<PostWithFolderId[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolderForView | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [realtimeFollowerCount, setRealtimeFollowerCount] = useState(0);
  const [realtimeFollowingCount, setRealtimeFollowingCount] = useState(0);
  const [showUnfollowModal, setShowUnfollowModal] = useState(false);
  const [activeFollowModal, setActiveFollowModal] = useState<'followers' | 'following' | null>(null);

  const { isFollowing, follow: followUser, unfollow: unfollowUser } = useFollowStatus(profile?.id ?? null);
  const [showCoffeeChatModal, setShowCoffeeChatModal] = useState(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      } else {
        setCurrentUser(null);
      }
    };
    getCurrentUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 본인 프로필이면 마이페이지로 이동
  useEffect(() => {
    if (!id || !currentUser) return;
    if (id === currentUser.id) {
      navigate('/mypage', { replace: true });
    }
  }, [id, currentUser, navigate]);

  // 프로필 유저가 바뀌면 폴더 상세 뷰 초기화
  useEffect(() => {
    setSelectedFolder(null);
  }, [id]);

  // 프로필 + 해당 유저 게시물 로드
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const mapPostData = (item: any): Post => {
      const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      let commentCount = 0;
      if (item.comments) {
        if (Array.isArray(item.comments) && item.comments.length > 0 && typeof item.comments[0] === 'object' && 'count' in item.comments[0]) {
          commentCount = item.comments[0].count || 0;
        } else if (typeof item.comments === 'object' && 'count' in item.comments) {
          commentCount = item.comments.count || 0;
        }
      }
      let likeCount = 0;
      if (item.likes) {
        if (Array.isArray(item.likes) && item.likes.length > 0 && typeof item.likes[0] === 'object' && 'count' in item.likes[0]) {
          likeCount = item.likes[0].count || 0;
        } else if (typeof item.likes === 'object' && 'count' in item.likes) {
          likeCount = item.likes.count || 0;
        }
      }
      let saveCount = 0;
      if (item.saves) {
        if (Array.isArray(item.saves) && item.saves.length > 0 && typeof item.saves[0] === 'object' && 'count' in item.saves[0]) {
          saveCount = item.saves[0].count || 0;
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
          id: profileData?.id || item.author_id,
          email: '',
          nickname: profileData?.nickname || 'Unknown',
          avatar_url: profileData?.avatar_url || '',
          bio: profileData?.bio || '',
          job_title: profileData?.job_title || '',
        },
        save_count: saveCount || item.save_count || 0,
        comment_count: commentCount || item.comment_count || 0,
        like_count: likeCount || 0,
        view_count: item.view_count || 0,
        created_at: item.created_at,
        is_public: item.is_public ?? true,
        folder_id: item.folder_id ?? null,
      };
    };

    const load = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, bio, job_title')
          .eq('id', id)
          .maybeSingle();

        if (cancelled) return;
        if (profileError || !profileData) {
          setProfile(null);
          setUserPosts([]);
          setFolders([]);
          setLoading(false);
          return;
        }

        setProfile({
          id: profileData.id,
          nickname: profileData.nickname ?? null,
          avatar_url: profileData.avatar_url ?? null,
          bio: profileData.bio ?? null,
          job_title: profileData.job_title ?? null,
        });

        // 게시물 조회: 본인 프로필이면 전부, 남의 프로필/비로그인이면 is_public=true만
        let postsQuery = supabase
          .from('posts')
          .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
          .eq('author_id', id)
          .order('created_at', { ascending: false });

        if (!currentUser || currentUser.id !== id) {
          postsQuery = postsQuery.eq('is_public', true);
        }

        const { data: postsData, error: postsError } = await postsQuery;

        if (cancelled) return;
        if (!postsError && postsData) {
          setUserPosts(postsData.map(mapPostData));
        } else {
          setUserPosts([]);
        }

        // 해당 유저가 생성한 폴더 목록 조회: RPC 우선, 실패 시 테이블 직접 조회 fallback
        let folderList: FolderType[] = [];
        const { data: foldersData, error: foldersError } = await supabase
          .rpc('get_folders_by_user', { p_user_id: id });

        if (!cancelled && !foldersError && foldersData != null) {
          folderList = Array.isArray(foldersData) ? foldersData : [foldersData];
        } else if (!cancelled && foldersError) {
          console.warn('Profile folders RPC:', foldersError.message, foldersError.code);
          const { data: directData } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', id)
            .order('name');
          if (!cancelled && directData) folderList = directData;
        }
        if (!cancelled) setFolders(folderList);
      } catch (_) {
        if (!cancelled) {
          setProfile(null);
          setUserPosts([]);
          setFolders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id, currentUser]);

  // 팔로워/팔로잉 수: 모달과 동일한 쿼리로 id 목록 조회 후 length 사용 (RLS/정합성 보장)
  useEffect(() => {
    if (!profile?.id) return;
    const fetchCounts = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', profile.id),
          supabase.from('follows').select('following_id').eq('follower_id', profile.id),
        ]);
        if (followersRes.error || followingRes.error) {
          setRealtimeFollowerCount(0);
          setRealtimeFollowingCount(0);
          return;
        }
        const followerIds = (followersRes.data || []).map((r: { follower_id: string }) => r.follower_id);
        const followingIds = (followingRes.data || []).map((r: { following_id: string }) => r.following_id);
        setRealtimeFollowerCount(followerIds.filter((id) => id !== profile.id).length);
        setRealtimeFollowingCount(followingIds.filter((id) => id !== profile.id).length);
      } catch (_) {
        setRealtimeFollowerCount(0);
        setRealtimeFollowingCount(0);
      }
    };
    fetchCounts();
  }, [profile?.id]);

  const handleFollow = async () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (isFollowing) {
      setShowUnfollowModal(true);
      return;
    }
    const ok = await followUser();
    if (ok) {
      setRealtimeFollowerCount((c) => c + 1);
      toast(`${profile?.nickname ?? '유저'}님을 팔로우합니다.`, {
        position: 'top-center',
        duration: 2000,
      });
    }
  };

  const handleUnfollowConfirm = async () => {
    const ok = await unfollowUser();
    setShowUnfollowModal(false);
    if (ok) {
      setRealtimeFollowerCount((c) => Math.max(0, c - 1));
      toast('팔로우가 취소되었습니다', { position: 'top-center', duration: 2000 });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <p className="text-muted-foreground">로딩 중...</p>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
            사용자를 찾을 수 없습니다
          </h1>
          <Link to="/" className="text-accent hover:underline">
            홈으로
          </Link>
        </main>
      </div>
    );
  }

  const user = {
    id: profile.id,
    nickname: profile.nickname ?? 'Unknown',
    avatar_url: profile.avatar_url ?? '',
    bio: profile.bio ?? '',
    job_title: profile.job_title ?? '',
  };
  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 animate-fade-in">
            <div className="flex flex-row items-start gap-6">
              <Avatar className="h-24 w-24 rounded-full object-cover shrink-0">
                {user.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.nickname} className="object-cover" />
                ) : null}
                <AvatarPlaceholder />
              </Avatar>

              <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="flex flex-row items-baseline gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user.nickname}
                  </h1>
                  {user.job_title && (
                    <span className="text-base font-medium text-gray-500">
                      {user.job_title}
                    </span>
                  )}
                </div>
                {user.bio && (
                  <p className="mt-2 text-base text-gray-600 break-words">
                    {user.bio}
                  </p>
                )}
                <div className="flex items-center gap-x-4 text-sm mt-2">
                  <button
                    type="button"
                    onClick={() => setActiveFollowModal('followers')}
                    className="inline-flex items-center hover:opacity-70 transition-opacity cursor-pointer select-none"
                  >
                    <span className="font-semibold text-gray-900">{realtimeFollowerCount}</span>
                    <span className="text-gray-500 ml-1">팔로워</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFollowModal('following')}
                    className="inline-flex items-center hover:opacity-70 transition-opacity cursor-pointer select-none"
                  >
                    <span className="font-semibold text-gray-900">{realtimeFollowingCount}</span>
                    <span className="text-gray-500 ml-1">팔로잉</span>
                  </button>
                </div>

                {!isOwnProfile && currentUser && (
                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      onClick={handleFollow}
                      className={
                        isFollowing
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-0'
                      }
                    >
                      {isFollowing ? '팔로잉' : '팔로우'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border border-gray-200 text-gray-800"
                      onClick={() => setShowCoffeeChatModal(true)}
                    >
                      ☕ 커피챗 요청하기
                    </Button>
                  </div>
                )}
                {!isOwnProfile && !currentUser && (
                  <div className="flex justify-end gap-3 mt-4">
                    <Button
                      onClick={openAuthModal}
                      className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-0"
                    >
                      팔로우
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border border-gray-200 text-gray-800"
                      onClick={openAuthModal}
                    >
                      ☕ 커피챗 요청하기
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-6">
              {user.nickname}의 스토리
              {selectedFolder
                ? ` · ${selectedFolder.id === 'all' ? '전체 게시물' : selectedFolder.name}`
                : ` (${userPosts.length})`}
            </h2>

            {/* Case A: 게시물이 없음 */}
            {userPosts.length === 0 && (
              <p className="text-gray-500 text-lg text-center mt-20">
                게시물이 없습니다.
              </p>
            )}

            {/* Case B: 게시물은 있는데, 폴더가 없거나 모든 폴더가 비어 있음 → 일자형 리스트 */}
            {userPosts.length > 0 &&
              (folders.length === 0 ||
                !folders.some((f) => userPosts.some((p) => p.folder_id === f.id))) && (
              <div className="space-y-6">
                {userPosts.map((post) => (
                  <StoryCard
                    key={post.id}
                    post={post}
                    onPostDeleted={(postId) => {
                      setUserPosts((prev) => prev.filter((p) => p.id !== postId));
                    }}
                  />
                ))}
              </div>
            )}

            {/* Case C: 게시물 + 폴더 있고, 최소 한 폴더에 글이 있음 → 폴더 그리드 또는 폴더 상세 */}
            {userPosts.length > 0 &&
              folders.length > 0 &&
              folders.some((f) => userPosts.some((p) => p.folder_id === f.id)) && (
              <>
                {selectedFolder ? (
                  <div className="space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedFolder(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      폴더 목록으로
                    </Button>
                    <div className="space-y-6">
                      {(selectedFolder.id === 'all'
                        ? userPosts
                        : userPosts.filter((p) => p.folder_id === selectedFolder.id)
                      ).map((post) => (
                        <StoryCard
                          key={post.id}
                          post={post}
                          onPostDeleted={(postId) => {
                            setUserPosts((prev) => prev.filter((p) => p.id !== postId));
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {/* 전체 게시물 카드 (마이페이지 '최근 게시물'과 동일 스타일) */}
                    <button
                      type="button"
                      onClick={() => setSelectedFolder({ id: 'all', name: '전체 게시물' })}
                      className="block w-full text-left bg-card rounded-lg border border-border p-6 hover:shadow-card-hover transition-all overflow-hidden"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Folder className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-medium text-foreground truncate flex-1 min-w-0">
                              전체 게시물
                            </h3>
                            <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                              {userPosts.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    {/* 유저 폴더 카드: 게시물이 1개 이상인 폴더만 표시 */}
                    {folders
                      .filter((folder) => userPosts.some((p) => p.folder_id === folder.id))
                      .map((folder) => {
                      const count = userPosts.filter((p) => p.folder_id === folder.id).length;
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => setSelectedFolder(folder)}
                          className="block w-full text-left bg-card rounded-lg border border-border p-6 hover:shadow-card-hover transition-all overflow-hidden"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Folder className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-medium text-foreground truncate flex-1 min-w-0">
                                  {folder.name}
                                </h3>
                                <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                                  {count}
                                </span>
                              </div>
                              {folder.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {folder.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <AlertDialog open={showUnfollowModal} onOpenChange={setShowUnfollowModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>팔로우를 취소하시겠습니까?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-gray-700">닫기</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnfollowConfirm();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              팔로우 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {currentUser && profile && (
        <CoffeeChatModal
          isOpen={showCoffeeChatModal}
          onClose={() => setShowCoffeeChatModal(false)}
          sender={{
            id: currentUser.id,
            nickname: (currentUser as any).user_metadata?.nickname ?? (currentUser as any).email ?? '나',
          }}
          receiver={{
            id: profile.id,
            nickname: profile.nickname ?? '유저',
          }}
        />
      )}

      {activeFollowModal && profile && (
        <UserListModal
          title={activeFollowModal === 'followers' ? '팔로워' : '팔로잉'}
          userId={profile.id}
          currentUserId={currentUser?.id ?? ''}
          onClose={() => setActiveFollowModal(null)}
        />
      )}
    </div>
  );
};

export default UserProfile;
