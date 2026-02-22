import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Clock, Check, X, Folder, Plus, ArrowLeft, MoreVertical, Camera } from 'lucide-react';
import Header from '@/components/Header';
import ChangeAvatarModal from '@/components/ChangeAvatarModal';
import StoryCard from '@/components/StoryCard';
import UserListModal from '@/components/UserListModal';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mockPosts } from '@/data/mockData';
import { Post, Folder as FolderType, CoffeeChatRequestReceived } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getRelativeTime, isValidImageUrl } from '@/lib/utils';

const TEST_USER_ID = '55b95afa-aa07-45e7-8630-0d608b705bca';

// Mock saved posts (using some of the existing posts)
const savedPosts = [mockPosts[0], mockPosts[2]];

const MyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { folderId } = useParams<{ folderId?: string }>();
  const isCoffeeChatPath = location.pathname === '/mypage/coffee-chat';
  const [requests, setRequests] = useState<CoffeeChatRequestReceived[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myPostsWithFolderId, setMyPostsWithFolderId] = useState<Array<Post & { folder_id?: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeModalType, setActiveModalType] = useState<'followers' | 'following' | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number }>({
    followers: 0,
    following: 0,
  });
  const [profile, setProfile] = useState<{
    avatar_url: string | null;
    nickname: string | null;
    job_title: string | null;
    bio: string | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [changeAvatarOpen, setChangeAvatarOpen] = useState(false);

  // 폴더 관련 상태
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [folderPosts, setFolderPosts] = useState<Post[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingFolderPosts, setIsLoadingFolderPosts] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // 폴더 관리 상태
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<FolderType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 필터 모드 상태
  const [viewMode, setViewMode] = useState<'all' | 'saved'>('all');
  
  // 폴더별 saves 개수 (필터링용)
  const [folderSavesCount, setFolderSavesCount] = useState<Record<string, number>>({});
  
  // 시스템 폴더용 데이터 (DB 요청 없이 사용)
  const [posts, setPosts] = useState<Post[]>([]); // 내 글 + 저장한 글 (전체)
  const [savedPosts, setSavedPosts] = useState<Post[]>([]); // 저장한 글만

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
        nickname: profile?.nickname || 'Unknown',
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
    };
  };

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          return;
        }
        if (session?.user) {
          console.log('User session loaded:', session.user.id);
          setUser(session.user);
        } else {
          console.warn('No user session found');
          setUser(null);
        }
      } catch (err) {
        console.error('Unexpected error getting session:', err);
        setUser(null);
      }
    };
    getCurrentUser();
    
    // 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
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

  // 프로필(profiles) 조회 — 마이페이지 상단 카드용
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, nickname, job_title, bio')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfileLoading(false);
      if (error) {
        setProfile(null);
        return;
      }
      setProfile({
        avatar_url: data?.avatar_url ?? null,
        nickname: data?.nickname ?? null,
        job_title: data?.job_title ?? null,
        bio: data?.bio ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // 프로필 저장 후(ProfileSetupModal 등) 즉시 재조회
  useEffect(() => {
    const onProfileUpdated = () => {
      if (user?.id) {
        supabase
          .from('profiles')
          .select('avatar_url, nickname, job_title, bio')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data)
              setProfile({
                avatar_url: data.avatar_url ?? null,
                nickname: data.nickname ?? null,
                job_title: data.job_title ?? null,
                bio: data.bio ?? null,
              });
          });
      }
    };
    window.addEventListener('profileUpdated', onProfileUpdated);
    return () => window.removeEventListener('profileUpdated', onProfileUpdated);
  }, [user?.id]);

  // 받은 커피챗 요청 (pending만) 조회 — requester 프로필(닉네임, 아바타, 이메일) 조인
  useEffect(() => {
    if (!user?.id) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    setRequestsLoading(true);
    (async () => {
      const { data: rows, error } = await supabase
        .from('coffee_chat_requests')
        .select('id, sender_id, receiver_id, message, status, created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setRequests([]);
        setRequestsLoading(false);
        return;
      }
      const list = rows ?? [];
      if (list.length === 0) {
        setRequests([]);
        setRequestsLoading(false);
        return;
      }
      const senderIds = [...new Set(list.map((r: any) => r.sender_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, email, job_title')
        .in('id', senderIds);
      if (cancelled) return;
      const profileMap = new Map(
        (profilesData ?? []).map((p: any) => [
          p.id,
          { nickname: p.nickname ?? null, avatar_url: p.avatar_url ?? null, email: p.email ?? null, job_title: p.job_title ?? null },
        ])
      );
      const merged: CoffeeChatRequestReceived[] = list.map((r: any) => ({
        ...r,
        requester_id: r.sender_id,
        requester: profileMap.get(r.sender_id) ?? { nickname: null, avatar_url: null, email: null, job_title: null },
      }));
      setRequests(merged);
      setRequestsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // 데이터 로드 (내 글 + 저장한 글)
  useEffect(() => {
    if (!user) {
      console.log('loadData: User not available, skipping data load');
      setIsLoading(false);
      return; // user가 없으면 실행하지 않음
    }
    
    const loadData = async () => {
      try {
        console.log('loadData: Starting data load for user:', user.id);
        setIsLoading(true);
        
        // 1. 내가 쓴 글 가져오기
        const { data: myPostsData, error: myPostsError } = await supabase
          .from('posts')
          .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false });

        if (myPostsError) {
          console.error('Error fetching my posts:', myPostsError);
        }

        const mappedMyPosts: Post[] = myPostsData ? myPostsData.map(mapPostData) : [];
        // folder_id 정보를 포함한 버전도 저장
        const mappedMyPostsWithFolderId = myPostsData ? myPostsData.map((item: any) => ({
          ...mapPostData(item),
          folder_id: item.folder_id,
        })) : [];
        console.log('loadData: My posts count:', mappedMyPosts.length);
        setMyPosts(mappedMyPosts);
        setMyPostsWithFolderId(mappedMyPostsWithFolderId);

        // 2. 저장한 글 가져오기 (모든 폴더에서)
        const { data: savesData, error: savesError } = await supabase
          .from('saves')
          .select(`
            *,
            posts:post_id(
              *,
              profiles:author_id(nickname, job_title, avatar_url, bio),
              comments(count),
              likes(count),
              saves(count)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (savesError) {
          console.error('Error fetching saved posts:', savesError);
        }

        // 저장한 글 데이터 정제 (최신 저장순: saves.created_at DESC)
        const savedPostsData: Post[] = savesData
          ? savesData
              .sort((a: any, b: any) => {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeB - timeA;
              })
              .map((save: any) => save.posts)
              .filter((post: any) => post !== null)
              .map((item: any) => mapPostData(item))
          : [];

        console.log('loadData: Saved posts count:', savedPostsData.length);
        setSavedPosts(savedPostsData);

        // 3. 전체 데이터 = 내 글 + 저장한 글 (중복 제거 후 최신순 정렬)
        // ID를 키로 사용하여 중복을 원천 차단
        const uniquePostsMap = new Map<string | number, Post>();
        [...mappedMyPosts, ...savedPostsData].forEach(post => {
          uniquePostsMap.set(post.id, post); // 같은 ID가 오면 덮어씌움 (하나만 남음)
        });
        const allPosts = Array.from(uniquePostsMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        console.log('loadData: All posts (merged) count:', allPosts.length);
        setPosts(allPosts); // ID -1 (최근 게시물) 클릭 시 사용
        
        // '최근 게시물' 폴더가 선택되어 있다면 즉시 업데이트
        if (selectedFolder && (selectedFolder.id === 'recent' || selectedFolder.id === -1)) {
          setFolderPosts(allPosts);
        }
        
        // 폴더 목록도 함께 불러오기
        await fetchFolders();
      } catch (err) {
        console.error('Unexpected error in loadData:', err);
        toast.error('데이터를 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // 팔로워/팔로잉 수 가져오기 (실제 follows 테이블 기준, 모달 리스트와 연동)
  useEffect(() => {
    if (!user) return;

    const fetchFollowCounts = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
        ]);
        setCounts({
          followers: followersRes.count ?? 0,
          following: followingRes.count ?? 0,
        });
      } catch (err) {
        console.error('Error fetching follow counts:', err);
      }
    };

    fetchFollowCounts();
  }, [user]);

  // 폴더 목록 가져오기 함수
  const fetchFolders = async () => {
    try {
      setIsLoadingFolders(true);
      
      // 이미 가져온 user 객체 사용
      if (!user) {
        console.error('User not authenticated');
        return;
      }
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching folders:', error);
        toast.error('폴더를 불러오는데 실패했습니다');
        return;
      }

      setFolders(data || []);

      // 각 폴더별 saves 개수 가져오기 (posts 테이블 개수는 제외 - 에러 방지)
      if (data && data.length > 0) {
        const savesCountMap: Record<string, number> = {};
        
        for (const folder of data) {
          // saves 테이블에서 folder_id가 일치하는 개수만 가져오기
          const { count, error: countError } = await supabase
            .from('saves')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id)
            .eq('user_id', user.id);

          if (!countError && count !== null) {
            savesCountMap[folder.id] = count;
          } else {
            savesCountMap[folder.id] = 0;
          }
        }

        setFolderSavesCount(savesCountMap);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
      toast.error('폴더를 불러오는데 실패했습니다');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // 폴더 상세 진입 (URL 파라미터로 폴더 ID가 있을 때)
  useEffect(() => {
    // location.state에서 viewMode 가져오기
    const stateViewMode = (location.state as any)?.viewMode;
    if (stateViewMode && (stateViewMode === 'all' || stateViewMode === 'saved')) {
      setViewMode(stateViewMode);
    }

    // folderId가 없으면 즉시 상태 초기화 (폴더 목록 모드)
    if (!folderId) {
      setSelectedFolder(null);
      setFolderPosts([]);
      setIsLoadingFolderPosts(false);
      return; // 조기 반환으로 데이터 페칭 방지
    }
    
    // folderId가 있는데 selectedFolder가 없으면 초기화 (안전장치)
    if (folderId && !selectedFolder) {
      setFolderPosts([]);
      setIsLoadingFolderPosts(false);
    }

    // folderId가 있을 때만 데이터 페칭
    const currentMode = stateViewMode || viewMode;
    
    // 시스템 폴더 처리 (DB 요청 없이 state 사용)
    if (folderId === 'recent' || folderId === '-1') {
      // 최근 게시물: DB 요청 없이 state의 posts 사용
      setSelectedFolder({
        id: 'recent',
        user_id: user?.id || '',
        name: '최근 게시물',
        created_at: new Date().toISOString(),
      } as FolderType);
      
      // 안전장치: posts가 비어있으면 다시 로드 시도
      if (posts.length === 0 && user) {
        console.log('Recent posts is empty, reloading data...');
        setIsLoadingFolderPosts(true);
        // loadData를 다시 호출하기 위해 user 의존성 useEffect가 실행되도록 함
        // 또는 직접 데이터를 다시 가져오기
        const reloadData = async () => {
          try {
            const { data: myPostsData } = await supabase
              .from('posts')
              .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
              .eq('author_id', user.id)
              .order('created_at', { ascending: false });

            const { data: savesData } = await supabase
              .from('saves')
              .select(`
                *,
                posts:post_id(
                  *,
                  profiles:author_id(nickname, job_title, avatar_url, bio),
                  comments(count),
                  likes(count),
                  saves(count)
                )
              `)
              .eq('user_id', user.id);

            const mappedMyPosts: Post[] = myPostsData ? myPostsData.map(mapPostData) : [];
            const savedPostsData: Post[] = savesData
              ? savesData
                  .map((save: any) => save.posts)
                  .filter((post: any) => post !== null)
                  .map((item: any) => mapPostData(item))
              : [];

            const uniquePostsMap = new Map<string | number, Post>();
            [...mappedMyPosts, ...savedPostsData].forEach(post => {
              uniquePostsMap.set(post.id, post);
            });
            const allPosts = Array.from(uniquePostsMap.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setPosts(allPosts);
            setFolderPosts(currentMode === 'saved' ? savedPostsData : allPosts);
          } catch (err) {
            console.error('Error reloading data:', err);
          } finally {
            setIsLoadingFolderPosts(false);
          }
        };
        reloadData();
      } else {
        // viewMode에 따라 필터링
        if (currentMode === 'saved') {
          setFolderPosts(savedPosts);
        } else {
          setFolderPosts(posts);
        }
        setIsLoadingFolderPosts(false);
      }
      return;
    }
    
    if (folderId === '-2') {
      // 저장한 게시물: DB 요청 없이 state의 savedPosts 사용
      setSelectedFolder({
        id: '-2',
        user_id: user?.id || '',
        name: '저장한 게시물',
        created_at: new Date().toISOString(),
      } as FolderType);
      setFolderPosts(savedPosts);
      setIsLoadingFolderPosts(false);
      return;
    }
    
    // 커스텀 폴더: DB에서 데이터 가져오기
    fetchFolderDetails(folderId, currentMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, location.state]);

  // fetchRecentPosts 함수는 더 이상 사용하지 않음 (useEffect에서 직접 처리)

  const fetchFolderDetails = async (id: string, currentViewMode: 'all' | 'saved' = viewMode) => {
    try {
      setIsLoadingFolderPosts(true);
      // 먼저 folderPosts를 비우고 시작
      setFolderPosts([]);
      
      // 1. 폴더 정보 가져오기
      if (!user) {
        console.error('User not authenticated');
        return;
      }
      
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folderData) {
        console.error('Error fetching folder:', folderError);
        toast.error('폴더를 찾을 수 없습니다');
        navigate('/mypage');
        return;
      }

      setSelectedFolder(folderData);

      // 2. 병렬로 두 쿼리 실행: 내가 쓴 글 + 저장한 글
      // posts 테이블과 saves 테이블에서 folder_id로 직접 조회
      const queries: Promise<any>[] = [];

      // (A) 내가 쓴 글 가져오기
      if (currentViewMode === 'all') {
        queries.push(
          supabase
            .from('posts')
            .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
            .eq('folder_id', id)
            .order('created_at', { ascending: false })
        );
      } else {
        queries.push(Promise.resolve({ data: null, error: null }));
      }

      // (B) 저장한 글 가져오기
      queries.push(
        supabase
          .from('saves')
          .select(`
            *,
            posts:post_id(
              *,
              profiles:author_id(nickname, job_title, avatar_url, bio),
              comments(count),
              likes(count),
              saves(count)
            )
          `)
          .eq('folder_id', id)
          .eq('user_id', user.id)
      );

      // 병렬 실행
      const [postsResult, savesResult] = await Promise.all(queries);

      // (A) 내가 쓴 글 데이터 정제
      let myFolderPosts: Post[] = [];
      if (postsResult.data && !postsResult.error) {
        myFolderPosts = postsResult.data.map(mapPostData);
      } else if (postsResult.error) {
        console.error('Error fetching folder posts:', postsResult.error);
      }

      // (B) 저장한 글 데이터 정제
      let refinedSaved: Post[] = [];
      if (savesResult.data && !savesResult.error) {
        refinedSaved = savesResult.data
          .map((save: any) => save.posts)
          .filter((post: any) => post !== null)
          .map((item: any) => mapPostData(item));
      } else if (savesResult.error) {
        console.error('Error fetching saved folder posts:', savesResult.error);
      }

      // 3. 병합 및 중복 제거 후 최신순 정렬
      // ID를 키로 사용하여 중복을 원천 차단
      const uniquePostsMap = new Map<string | number, Post>();
      [...myFolderPosts, ...refinedSaved].forEach(post => {
        uniquePostsMap.set(post.id, post); // 같은 ID가 오면 덮어씌움 (하나만 남음)
      });
      const combined = Array.from(uniquePostsMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFolderPosts(combined);
    } catch (err) {
      console.error('Error fetching folder details:', err);
      toast.error('폴더 내용을 불러오는데 실패했습니다');
    } finally {
      setIsLoadingFolderPosts(false);
    }
  };

  // 새 폴더 생성
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFolderName.trim()) {
      toast.error('폴더 이름을 입력해주세요');
      return;
    }

    // 1. 이미 있는 user 객체 사용 (새로 fetch 금지)
    if (!user) {
      // 세션 재확인 시도
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Session error:', sessionError);
          alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
          navigate('/login');
          return;
        }
        if (session?.user) {
          setUser(session.user);
          // user가 설정되었으므로 계속 진행하지 않고, 사용자에게 다시 시도하도록 안내
          toast.error('로그인 세션이 만료되었습니다. 다시 시도해주세요.');
          return;
        } else {
          alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
          navigate('/login');
          return;
        }
      } catch (err) {
        console.error('Error checking session:', err);
        alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        navigate('/login');
        return;
      }
    }

    try {
      setIsCreatingFolder(true);
      
      // 2. 바로 insert 실행
      const { data, error } = await supabase
        .from('folders')
        .insert({
          name: newFolderName.trim(),
          user_id: user.id, // 기존 user 객체의 ID 사용
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString() // 정렬용
        })
        .select(); // 생성된 데이터 반환 확인

      if (error) {
        console.error('Error creating folder:', error);
        if (error.code === '42501') {
          alert('DB 권한 설정 오류입니다. 관리자에게 문의하세요.');
        } else {
          alert('폴더 생성 실패');
        }
        return;
      }

      // 3. 성공 시 데이터 새로고침
      if (data && data.length > 0) {
        setFolders([data[0], ...folders]);
        setNewFolderName('');
        setShowCreateForm(false);
        toast.success('폴더가 생성되었습니다');
        // 폴더 목록 새로고침
        fetchFolders();
      }
    } catch (err: any) {
      console.error('Error creating folder:', err);
      if (err.code === '42501') {
        alert('폴더 생성 권한이 없습니다. (RLS 정책 오류)');
      } else {
        alert('폴더 생성 실패');
      }
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 폴더 이름 변경
  const handleRenameFolder = async () => {
    if (!editingFolder || !renameFolderName.trim()) {
      toast.error('폴더 이름을 입력해주세요');
      return;
    }

    try {
      setIsRenaming(true);
      const { error } = await supabase
        .from('folders')
        .update({ 
          name: renameFolderName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFolder.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error renaming folder:', error);
        toast.error('폴더 이름 변경에 실패했습니다');
        return;
      }

      toast.success('폴더 이름이 변경되었습니다');
      setEditingFolder(null);
      setRenameFolderName('');
      // 폴더 목록 새로고침
      await fetchFolders();
    } catch (err) {
      console.error('Error renaming folder:', err);
      toast.error('폴더 이름 변경 중 오류가 발생했습니다');
    } finally {
      setIsRenaming(false);
    }
  };

  // 폴더 삭제
  const handleDeleteFolder = async () => {
    if (!deletingFolder || !user) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', deletingFolder.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting folder:', error);
        toast.error('폴더 삭제에 실패했습니다');
        return;
      }

      toast.success('폴더가 삭제되었습니다');
      setDeletingFolder(null);
      
      // 삭제된 폴더가 현재 선택된 폴더라면 목록으로 돌아가기
      if (selectedFolder?.id === deletingFolder.id) {
        setSelectedFolder(null);
        setFolderPosts([]);
        navigate('/mypage', { replace: true, state: { viewMode } });
      }
      
      // 폴더 목록 새로고침
      await fetchFolders();
      // 전체 데이터 새로고침
      if (user) {
        const loadData = async () => {
          // loadData 로직 재실행
          const { data: myPostsData } = await supabase
            .from('posts')
            .select('*, profiles:author_id(nickname, job_title, avatar_url, bio), comments(count), likes(count), saves(count)')
            .eq('author_id', user.id)
            .order('created_at', { ascending: false });

          const { data: savesData } = await supabase
            .from('saves')
            .select(`
              *,
              posts:post_id(
                *,
                profiles:author_id(nickname, job_title, avatar_url, bio),
                comments(count),
                likes(count),
                saves(count)
              )
            `)
            .eq('user_id', user.id);

          const mappedMyPosts: Post[] = myPostsData ? myPostsData.map(mapPostData) : [];
          const savedPostsData: Post[] = savesData
            ? savesData
                .map((save: any) => save.posts)
                .filter((post: any) => post !== null)
                .map((item: any) => mapPostData(item))
            : [];

          const uniquePostsMap = new Map<string | number, Post>();
          [...mappedMyPosts, ...savedPostsData].forEach(post => {
            uniquePostsMap.set(post.id, post);
          });
          const allPosts = Array.from(uniquePostsMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          setPosts(allPosts);
          setSavedPosts(savedPostsData);
        };
        loadData();
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
      toast.error('폴더 삭제 중 오류가 발생했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleAcceptRequest = async (id: string) => {
    if (!user?.id) return;
    const req = requests.find((r) => r.id === id);
    const { error } = await supabase
      .from('coffee_chat_requests')
      .update({ status: 'accepted' })
      .eq('id', id)
      .eq('receiver_id', user.id);
    if (error) {
      toast.error('수락 처리에 실패했습니다.');
      return;
    }
    if (req?.sender_id) {
      const { error: rpcError } = await supabase.rpc('create_coffee_chat_notification', {
        p_receiver_id: req.sender_id,
        p_sender_id: user.id,
        p_type: 'coffee_accept',
      });
      if (rpcError) console.warn('커피챗 알림 생성 실패 (RPC 미적용 가능):', rpcError);
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success('커피챗을 수락했습니다.', { position: 'top-center', duration: 2000 });
  };

  const handleDeclineRequest = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('coffee_chat_requests')
      .update({ status: 'declined' })
      .eq('id', id)
      .eq('receiver_id', user.id);
    if (error) {
      toast.error('거절 처리에 실패했습니다.');
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success('커피챗을 거절했습니다.', { position: 'top-center', duration: 2000 });
  };

  // user가 없고 로딩 중일 때 로딩 스피너 표시
  if (!user && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-20">
              <p className="text-muted-foreground">로그인 정보를 불러오는 중...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Header — 카드 스타일 (Alex Thompson 레퍼런스) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 animate-fade-in">
            {profileLoading ? (
              <div className="flex items-center gap-6">
                <div className="h-24 w-24 rounded-full bg-gray-200 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col justify-center ml-6 space-y-2">
                  <div className="flex items-baseline gap-3">
                    <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
                    <div className="h-5 w-24 rounded bg-gray-100 animate-pulse" />
                  </div>
                  <div className="h-5 w-full max-w-md rounded bg-gray-100 animate-pulse" />
                  <div className="flex items-center gap-x-4 text-sm pt-1">
                    <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
                    <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-row items-center">
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={() => setChangeAvatarOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setChangeAvatarOpen(true)}
                  aria-label="프로필 사진 변경"
                >
                  <Avatar className="h-24 w-24 rounded-full object-cover">
                    {isValidImageUrl(profile?.avatar_url) ? (
                      <AvatarImage
                        src={profile!.avatar_url as string}
                        alt={profile?.nickname ?? user?.user_metadata?.nickname ?? '프로필'}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarPlaceholder />
                  </Avatar>
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white">
                    <Camera className="h-4 w-4" />
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-center ml-6 min-w-0">
                  <div className="flex flex-row items-baseline gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile?.nickname?.trim() || user?.user_metadata?.nickname || '닉네임 없음'}
                    </h1>
                    {(profile?.job_title?.trim() || user?.user_metadata?.job_title) && (
                      <span className="text-base font-medium text-gray-500">
                        {profile?.job_title?.trim() || user?.user_metadata?.job_title}
                      </span>
                    )}
                  </div>
                  {(profile?.bio?.trim() || user?.user_metadata?.bio) && (
                    <p className="mt-2 text-base text-gray-600 break-words">
                      {profile?.bio?.trim() || user?.user_metadata?.bio}
                    </p>
                  )}
                  <div className="flex items-center gap-x-4 text-sm mt-2">
                    <button
                      onClick={() => setActiveModalType('followers')}
                      className="hover:opacity-70 transition-opacity cursor-pointer select-none"
                    >
                      <span className="font-semibold text-gray-900">{counts.followers}</span>
                      <span className="text-gray-500 ml-1">팔로워</span>
                    </button>
                    <button
                      onClick={() => setActiveModalType('following')}
                      className="hover:opacity-70 transition-opacity cursor-pointer select-none"
                    >
                      <span className="font-semibold text-gray-900">{counts.following}</span>
                      <span className="text-gray-500 ml-1">팔로잉</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            value={isCoffeeChatPath ? 'coffee-chat' : 'assets'}
            onValueChange={(v) => {
              if (v === 'coffee-chat') navigate('/mypage/coffee-chat');
              else navigate('/mypage');
            }}
            className="animate-fade-in"
          >
            <TabsList className="w-full grid grid-cols-2 mb-8">
              <TabsTrigger value="assets">내 자산</TabsTrigger>
              <TabsTrigger value="coffee-chat">
                커피챗
                {requests.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="ml-2 h-5 w-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                    {requests.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* 내 자산 Tab */}
            <TabsContent value="assets" className="space-y-4">
              {/* 배타적 렌더링: selectedFolder가 있으면 폴더 상세, 없으면 폴더 리스트만 */}
              {selectedFolder && folderId ? (
                // [화면 A: 폴더 상세 보기] - 폴더를 클릭했을 때만 게시물 리스트 표시
                <div>
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        setSelectedFolder(null);
                        setFolderPosts([]);
                        setIsLoadingFolderPosts(false);
                        navigate('/mypage', { replace: true, state: { viewMode } });
                      }}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit select-none cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>목록으로</span>
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold mb-2">{selectedFolder.name}</h2>
                      {selectedFolder.description && (
                        <p className="text-muted-foreground">{selectedFolder.description}</p>
                      )}
                    </div>
                  </div>

                  {isLoadingFolderPosts ? (
                    <div className="text-center py-20">
                      <p className="text-muted-foreground">불러오는 중...</p>
                    </div>
                  ) : folderPosts.length > 0 ? (
                    <div className="space-y-6">
                      {folderPosts.map((post) => (
                        <StoryCard
                          key={`folder-${selectedFolder.id}-post-${post.id}`}
                          post={post}
                          hideSaveButton={false}
                          onSaveRemoved={(postId, movedToFolderId) => {
                            const fid = selectedFolder?.id;
                            const isCustomFolder = fid && fid !== 'recent' && fid !== '-1' && fid !== '-2';
                            if (!movedToFolderId) {
                              setFolderPosts((prev) => prev.filter((p) => p.id !== postId));
                              setPosts((prev) => prev.filter((p) => p.id !== postId));
                              setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
                            } else {
                              if (isCustomFolder) {
                                setFolderPosts((prev) => prev.filter((p) => p.id !== postId));
                              }
                            }
                            if (isCustomFolder) {
                              const fidStr = String(fid);
                              setFolderSavesCount((prev) => ({
                                ...prev,
                                [fidStr]: Math.max(0, (prev[fidStr] ?? 0) - 1),
                              }));
                            }
                          }}
                          onSaveMoved={(postId, toFolderId) => {
                            setFolderSavesCount((prev) => ({
                              ...prev,
                              [toFolderId]: (prev[toFolderId] ?? 0) + 1,
                            }));
                          }}
                          onPostDeleted={(postId) => {
                            setFolderPosts((prev) => prev.filter((p) => p.id !== postId));
                            setPosts((prev) => prev.filter((p) => p.id !== postId));
                            setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-muted-foreground">
                        {selectedFolder?.id === '-2'
                          ? '아직 저장한 게시물이 없습니다.'
                          : '이 폴더에 게시물이 없습니다.'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // 폴더 리스트
                <div>
                  {/* 필터 및 새 폴더 만들기 */}
                  <div className="mb-6 flex items-center justify-between gap-4">
                    {/* 왼쪽: 필터 토글 */}
                    <div className="flex gap-2">
                      <Button
                        variant={viewMode === 'all' ? 'default' : 'outline'}
                        onClick={() => setViewMode('all')}
                        className="select-none"
                      >
                        전체 목록
                      </Button>
                      <Button
                        variant={viewMode === 'saved' ? 'default' : 'outline'}
                        onClick={() => setViewMode('saved')}
                        className="select-none"
                      >
                        저장한 게시물
                      </Button>
                    </div>

                    {/* 오른쪽: 새 폴더 만들기 */}
                    {!showCreateForm ? (
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        새 폴더 만들기
                      </Button>
                    ) : (
                      <form onSubmit={handleCreateFolder} className="flex gap-2">
                        <Input
                          placeholder="폴더 이름"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          autoFocus
                          className="w-48"
                        />
                        <Button
                          type="submit"
                          disabled={isCreatingFolder || !newFolderName.trim()}
                        >
                          {isCreatingFolder ? '생성 중...' : '생성'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewFolderName('');
                          }}
                        >
                          취소
                        </Button>
                      </form>
                    )}
                  </div>

                  {isLoadingFolders ? (
                    <div className="text-center py-20">
                      <p className="text-muted-foreground">불러오는 중...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* 저장한 게시물: '저장한 게시물' 탭에서 맨 앞에 디폴트 폴더 표시 */}
                      {viewMode === 'saved' && (
                        <Link
                          to={`/mypage/folder/-2`}
                          state={{ viewMode }}
                          className="block bg-card rounded-lg border border-border p-6 hover:shadow-card-hover transition-all overflow-hidden"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Folder className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-medium text-foreground truncate flex-1 min-w-0">
                                  저장한 게시물
                                </h3>
                                {savedPosts.length > 0 ? (
                                  <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                                    {savedPosts.length}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}

                      {/* 최근 게시물: '전체 목록' 모드에서만 표시 (저장한 게시물 탭에서는 제거) */}
                      {viewMode === 'all' && (
                        <Link
                          to={`/mypage/folder/recent`}
                          state={{ viewMode }}
                          className="block bg-card rounded-lg border border-border p-6 hover:shadow-card-hover transition-all overflow-hidden"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Folder className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-medium text-foreground truncate flex-1 min-w-0">
                                  최근 게시물
                                </h3>
                                {posts.length > 0 ? (
                                  <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                                    {posts.length}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}

                      {/* 유저 커스텀 폴더 리스트 */}
                      {folders
                        .filter((folder) => {
                          // 저장한 게시물 모드: saves가 하나라도 있는 폴더만 표시
                          if (viewMode === 'saved') {
                            return (folderSavesCount[folder.id] || 0) > 0;
                          }
                          // 전체 목록 모드: 모든 폴더 표시
                          return true;
                        })
                        .map((folder) => (
                          <div
                            key={folder.id}
                            className="bg-card rounded-lg border border-border p-6 hover:shadow-card-hover transition-all overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-4 min-w-0">
                              {/* 좌측 영역: 아이콘 + 이름 + 숫자 */}
                              <Link
                                to={`/mypage/folder/${folder.id}`}
                                state={{ viewMode }}
                                className="flex items-center gap-4 flex-1 min-w-0"
                              >
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Folder className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="font-medium text-foreground truncate flex-1 min-w-0">
                                      {folder.name}
                                    </h3>
                                    {(() => {
                                      const savesCount = folderSavesCount[folder.id] || 0;
                                      // 저장한 게시물 탭: saves 개수만 표시 (posts 무시)
                                      // 전체 목록 탭: 작성글 + 저장글 합산
                                      const displayCount =
                                        viewMode === 'saved'
                                          ? savesCount
                                          : myPostsWithFolderId.filter((p) => p.folder_id === folder.id).length + savesCount;
                                      return displayCount > 0 ? (
                                        <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                                          {displayCount}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                  {folder.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                      {folder.description}
                                    </p>
                                  )}
                                </div>
                              </Link>
                              {/* 우측 영역: 더보기 버튼 */}
                              <div className="flex-shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setEditingFolder(folder);
                                        setRenameFolderName(folder.name);
                                      }}
                                    >
                                      이름 변경
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeletingFolder(folder);
                                      }}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      폴더 삭제
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Coffee Chat Tab */}
            <TabsContent value="coffee-chat" className="space-y-4">
              {requestsLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">불러오는 중...</p>
                </div>
              ) : requests.length > 0 ? (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-card rounded-lg border border-border p-5"
                  >
                    <div className="flex items-start gap-4">
                      <Link to={`/user/${request.requester_id}`}>
                        <Avatar className="h-10 w-10">
                          {isValidImageUrl(request.requester?.avatar_url) ? (
                            <AvatarImage
                              src={request.requester!.avatar_url!}
                              alt={request.requester.nickname ?? ''}
                            />
                          ) : null}
                          <AvatarPlaceholder />
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center min-w-0 flex-1">
                            <Link
                              to={`/user/${request.requester_id}`}
                              className="font-medium text-foreground hover:text-navy-light transition-colors shrink-0"
                            >
                              {request.requester?.nickname ?? '알 수 없음'}
                            </Link>
                            {request.requester?.job_title && (
                              <span className="ml-2 text-sm text-gray-500 font-normal truncate max-w-[200px]">
                                {request.requester.job_title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            {getRelativeTime(request.created_at)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 break-all whitespace-pre-wrap">
                          {request.message || '(메시지 없음)'}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRequest(request.id)}
                            className="gap-1.5 bg-[#2E4166] hover:bg-[#253552]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            수락
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineRequest(request.id)}
                            className="gap-1.5"
                          >
                            <X className="h-3.5 w-3.5" />
                            거절
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <p className="text-muted-foreground">아직 받은 요청이 없습니다.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* User List Modal */}
      {activeModalType && (
        <UserListModal
          title={activeModalType === 'followers' ? '팔로워' : '팔로잉'}
          userId={user?.id ?? ''}
          currentUserId={user?.id ?? ''}
          onClose={() => setActiveModalType(null)}
        />
      )}

      <ChangeAvatarModal
        open={changeAvatarOpen}
        onClose={() => setChangeAvatarOpen(false)}
        currentAvatarUrl={profile?.avatar_url ?? null}
        onSuccess={() => setChangeAvatarOpen(false)}
      />

      {/* 폴더 삭제 확인 모달 */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 폴더 안의 게시물이 전부 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>닫기</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? '삭제 중...' : '삭제하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 폴더 이름 변경 모달 */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>폴더 이름 변경</DialogTitle>
            <DialogDescription>
              새로운 폴더 이름을 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder="폴더 이름"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRenaming && renameFolderName.trim()) {
                  handleRenameFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingFolder(null);
                setRenameFolderName('');
              }}
              disabled={isRenaming}
            >
              닫기
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={isRenaming || !renameFolderName.trim()}
            >
              {isRenaming ? '변경 중...' : '변경하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyPage;
