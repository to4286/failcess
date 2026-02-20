import { useState, useEffect, useRef } from 'react';
import { PenLine, Search, User, FileText, X, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthModal } from '@/hooks/useAuthModal';
import { addToHistory, addKeywordToHistory, addPostToHistory, getRecentSearches, sanitizeSearchTerm, type HistoryItem, isValidImageUrl } from '@/lib/utils';

interface SearchResult {
  posts: Array<{
    id: string | number | bigint;
    title: string;
    searchKeyword?: string; // 검색어를 각 게시물에 바인딩
  }>;
  users: Array<{
    id: string | number | bigint;
    nickname: string;
    job_title: string | null;
    avatar_url: string | null;
  }>;
  hasMorePosts: boolean;
  hasMoreUsers: boolean;
}

// HistoryItem 타입과 저장 함수는 utils.ts로 이동됨
// export는 utils.ts에서 관리

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthModal } = useAuthModal();
  const isWritePage = location.pathname === '/write';
  const [user, setUser] = useState<any>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ 
    posts: [], 
    users: [], 
    hasMorePosts: false,
    hasMoreUsers: false 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<HistoryItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // 검색 입력창 ref 추가

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

  // profiles 테이블의 avatar_url 조회 (커스텀 사진만 사용, 없으면 플레이스홀더)
  const fetchProfileAvatar = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    setProfileAvatarUrl(data?.avatar_url ?? null);
  };

  useEffect(() => {
    if (!user?.id) {
      setProfileAvatarUrl(null);
      return;
    }
    fetchProfileAvatar(user.id);
  }, [user?.id]);

  // 프로필 저장 후 헤더 아바타 즉시 갱신 (ProfileSetupModal onSuccess 시)
  useEffect(() => {
    const onProfileUpdated = () => {
      if (user?.id) fetchProfileAvatar(user.id);
    };
    window.addEventListener('profileUpdated', onProfileUpdated);
    return () => window.removeEventListener('profileUpdated', onProfileUpdated);
  }, [user?.id]);

  const headerAvatarUrl = profileAvatarUrl ?? null;

  // LocalStorage에서 최근 검색어 불러오기
  useEffect(() => {
    const loadRecentSearches = () => {
      const searches = getRecentSearches();
      setRecentSearches(searches);
    };
    loadRecentSearches();
    
    // localStorage 변경 감지 (다른 컴포넌트에서 저장했을 때)
    const handleStorageChange = () => {
      loadRecentSearches();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // 커스텀 이벤트로 같은 탭에서의 변경도 감지
    window.addEventListener('recentSearchesUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('recentSearchesUpdated', handleStorageChange);
    };
  }, []);

  // 최근 검색어 저장 함수 (utils에서 import한 함수 사용)
  // utils.addToHistory를 호출한 후 state를 업데이트
  const handleAddToHistory = (item: HistoryItem) => {
    addToHistory(item);
    // localStorage 변경 후 state 업데이트
    const updatedSearches = getRecentSearches();
    setRecentSearches(updatedSearches);
  };

  // 특정 항목 삭제
  const removeHistory = (timestamp: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentSearches = getRecentSearches();
    const filtered = currentSearches.filter((item) => item.timestamp !== timestamp);
    
    // localStorage에 저장
    try {
      const jsonString = JSON.stringify(filtered, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      });
      localStorage.setItem('recent_searches', jsonString);
      setRecentSearches(filtered);
      window.dispatchEvent(new Event('recentSearchesUpdated'));
    } catch (err) {
      console.error('Error saving recent searches:', err);
    }
  };

  // 전체 삭제
  const clearHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recent_searches');
      window.dispatchEvent(new Event('recentSearchesUpdated'));
    } catch (err) {
      console.error('Error clearing recent searches:', err);
    }
  };

  // Debounce 검색 로직
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ 
        posts: [], 
        users: [], 
        hasMorePosts: false,
        hasMoreUsers: false 
      });
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[검색] 🔍 검색 시작:', searchQuery);
        
        // 게시물 검색 (RPC: 제목/본문/카테고리 포함 시만, 특수문자 리터럴 매칭)
        const sanitized = sanitizeSearchTerm(searchQuery);
        const { data: postsData, error: postsError } = await supabase
          .rpc('search_posts_ranked', { keyword: sanitized });

        if (postsError) {
          console.error('[검색] 🔴 Posts search error:', postsError);
          console.error('[검색] 🔴 Error code:', postsError.code);
          console.error('[검색] 🔴 Error message:', postsError.message);
          console.error('[검색] 🔴 Error details:', postsError.details);
          console.error('[검색] 🔴 Error hint:', postsError.hint);
        } else {
          console.log('[검색] ✅ Posts search success:', postsData?.length || 0, 'results');
          if (postsData && postsData.length > 0) {
            console.log('[검색] 📋 First post sample:', postsData[0]);
          }
        }

        // 유저 검색: 테이블 쿼리 후 클라이언트에서 검색어가 실제로 포함된 경우만 유지 (* 등 리터럴 매칭, 404 없음)
        const userKeyword = searchQuery.replace(/"/g, '');
        type UserRow = { id: string; nickname: string; job_title: string | null; avatar_url: string | null };
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname, job_title, avatar_url')
          .or(`nickname.ilike."%${sanitized}%",job_title.ilike."%${sanitized}%"`)
          .limit(50);
        const fromDb = Array.isArray(profilesData) ? profilesData : [];
        const kw = userKeyword.toLowerCase();
        const rawUsersData = fromDb
          .filter(
            (u: UserRow) =>
              (u.nickname && u.nickname.toLowerCase().includes(kw)) ||
              (u.job_title != null && String(u.job_title).toLowerCase().includes(kw))
          )
          .slice(0, 7);

        // 클라이언트 사이드에서 limit 처리
        const allPosts = postsData || [];
        const rawUsers = rawUsersData || [];
        // 로그인한 상태에서는 검색 결과에서 본인 프로필 제외
        const allUsers = user?.id
          ? rawUsers.filter((u: { id: string }) => u.id !== user.id)
          : rawUsers;

        console.log('[검색] 📊 최종 결과:', {
          postsCount: allPosts.length,
          usersCount: allUsers.length,
          hasPostsError: !!postsError
        });
        
        // 디버깅: RPC에서 반환되는 데이터 구조 및 랭킹 확인
        if (allPosts.length > 0) {
          console.log('[검색 랭킹] 📊 RPC posts data sample:', allPosts[0]);
          console.log('[검색 랭킹] 📊 All posts count:', allPosts.length);
          // 모든 게시물의 랭킹 정보 확인 (제목, 조회수, 순서)
          console.log('[검색 랭킹] 📊 검색 결과 순서 (가중치 시스템 확인):');
          allPosts.forEach((p, idx) => {
            const title = p.title || '';
            const viewCount = p.view_count || 0;
            const hasTitleMatch = title.toLowerCase().includes(searchQuery.toLowerCase());
            const hasContentMatch = (p.content || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            // 가중치 계산 (예상)
            let expectedScore = 0;
            if (hasTitleMatch) expectedScore += 100;
            if (hasContentMatch) expectedScore += 10;
            
            console.log(`[검색 랭킹] 📊 [${idx + 1}위] "${title.substring(0, 30)}..." | 조회수: ${viewCount} | 예상 점수: ${expectedScore}점`);
          });
        }
        
        const hasMorePosts = allPosts.length > 5;
        const hasMoreUsers = allUsers.length > 7;

        // 각 게시물에 검색어를 바인딩하여 저장 (검색어가 사라져도 유지되도록)
        const currentKeyword = searchQuery.trim();
        const postsWithKeyword = allPosts.slice(0, 5).map(post => ({
          ...post,
          searchKeyword: currentKeyword // 현재 검색어를 각 게시물에 바인딩
        }));
        console.log('[검색] 🔵 게시물에 검색어 바인딩:', currentKeyword, '| 게시물 수:', postsWithKeyword.length);

        setSearchResults({
          posts: postsWithKeyword,
          users: allUsers.slice(0, 7),
          hasMorePosts,
          hasMoreUsers,
        });
        
        if (postsError) {
          setSearchError(postsError.message || '검색 중 오류가 발생했습니다.');
          console.error('[검색] 🔴 검색 에러 발생:', postsError.message);
        } else {
          setSearchError(null);
        }
      } catch (err) {
        console.error('[검색] 🔴 Search error:', err);
        const errorMessage = err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.';
        setSearchError(errorMessage);
        setSearchResults({ posts: [], users: [], hasMorePosts: false, hasMoreUsers: false });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // UI 분기 조건
  const showDropdown = isFocused;
  const showSearchResults = isFocused && searchQuery.length > 0; // Case A: 검색어 입력 중
  const showRecentSearches = isFocused && searchQuery.length === 0; // Case B: 최근 검색어 모드
  const hasResults = searchResults.posts.length > 0 || searchResults.users.length > 0;
  const hasMoreResults = searchResults.hasMorePosts || searchResults.hasMoreUsers;

  // ========== 히스토리 저장 및 이동 로직 ==========
  
  /**
   * Keyword 저장 및 이동 (엔터/전체보기 클릭 시)
   * - 저장: type: 'keyword', value: 검색어 필수 저장
   * - 이동: /search?q=...
   */
  const handleSearchSubmit = () => {
    const trimmedQuery = searchQuery.trim();
    console.log('[검색어 저장] 🔵 handleSearchSubmit 호출됨 - searchQuery:', searchQuery, '| trimmed:', trimmedQuery);
    
    // 글자 수 제한 없음: 빈 문자열만 아니면 한 글자('a', 'ㄱ', '1')도 저장 및 검색
    if (trimmedQuery !== '') {
      const keyword = trimmedQuery;
      console.log('[검색어 저장] 🔵 키워드 저장 시작 (길이 제한 없음):', keyword, '| 길이:', keyword.length);
      
      // 히스토리 저장 (반드시 먼저 실행)
      try {
        addKeywordToHistory(keyword);
        // state 업데이트
        const updatedSearches = getRecentSearches();
        setRecentSearches(updatedSearches);
        console.log('[검색어 저장] ✅ 키워드 저장 완료:', keyword);
      } catch (historyError) {
        console.error('[검색어 저장] 🔴 키워드 저장 실패:', historyError);
      }
      
      // 이동 및 UI 상태 초기화
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
      setSearchQuery('');
      setIsFocused(false);
    } else {
      console.warn('[검색어 저장] ⚠️ 검색어가 비어있어서 저장하지 않음');
    }
  };

  /**
   * Post 클릭 시 저장 및 이동
   * - 저장: type: 'post', id, title (게시물 제목) 필수 저장
   * - 이동: /post/:id
   * - 주의: 게시물 클릭 시에는 검색어를 저장하지 않음 (오직 handleSearchSubmit에서만 키워드 저장)
   */
  const handlePostClick = (post: { id: string | number | bigint; title: string }) => {
    console.log('[최근 검색어] 🎯 handlePostClick 진입 - raw post data:', post);
    console.log('[최근 검색어] 🎯 Post ID type:', typeof post.id, 'value:', post.id);
    console.log('[최근 검색어] 🎯 Post title:', post.title);
    console.log('[최근 검색어] 🎯 Post title type:', typeof post.title);
    console.log('[최근 검색어] 🎯 Post title length:', post.title?.length);
    console.log('[최근 검색어] 🎯 Post title truthy check:', !!post.title);
    console.log('[최근 검색어] 🎯 Post 전체 객체 키:', Object.keys(post));
    console.log('[최근 검색어] 🎯 현재 searchQuery:', searchQuery);
    console.log('[최근 검색어] 🎯 searchQuery.trim():', searchQuery.trim());
    console.log('[최근 검색어] 🎯 searchQuery.trim() 길이:', searchQuery.trim().length);
    
    try {
      
      // ID 유효성 검사 - 0도 유효한 ID일 수 있으므로 명시적으로 null/undefined만 체크
      if (post.id === null || post.id === undefined) {
        console.error('🔴 Exiting early: Post ID is null or undefined:', post);
        return;
      }
      
      // title 유효성 검사 - null, undefined, 빈 문자열 체크
      // RPC에서 반환되는 데이터 구조가 다를 수 있으므로 안전하게 처리
      let titleValue: string = '';
      
      // title이 다양한 형태로 올 수 있음: string, null, undefined, 또는 다른 필드명
      if (typeof post.title === 'string') {
        titleValue = post.title;
      } else if (post.title === null || post.title === undefined) {
        // title이 없으면 빈 문자열로 처리하되, 나중에 기본값 사용
        titleValue = '';
      } else {
        // 기타 타입은 String으로 변환 시도
        titleValue = String(post.title);
      }
      
      const trimmedTitle = titleValue.trim();
      
      // title이 없거나 빈 문자열인 경우 기본값 사용 (저장은 진행)
      if (!trimmedTitle) {
        console.warn('[최근 검색어] ⚠️ Post title is missing or empty, using default:', { 
          post, 
          titleValue, 
          trimmedTitle,
          titleType: typeof post.title,
          titleIsNull: post.title === null,
          titleIsUndefined: post.title === undefined,
          postKeys: Object.keys(post)
        });
        // title이 없어도 저장은 진행 (기본값 사용)
        // return하지 않고 계속 진행
      }

      // BigInt를 명시적으로 문자열로 변환 (모든 게시물에 동일하게 적용)
      let postId: string;
      if (typeof post.id === 'bigint') {
        postId = post.id.toString();
        console.log('🔵 BigInt detected, converted to string:', postId);
      } else if (typeof post.id === 'number') {
        // Number도 명시적으로 변환 (NaN 체크 포함)
        if (isNaN(post.id)) {
          console.error('🔴 Exiting early: Post ID is NaN:', post);
          return;
        }
        postId = String(post.id);
        console.log('🔵 Number detected, converted to string:', postId);
      } else if (typeof post.id === 'string') {
        // String인 경우 그대로 사용하되 빈 문자열 체크
        if (post.id.trim() === '') {
          console.error('🔴 Exiting early: Post ID is empty string:', post);
          return;
        }
        postId = post.id;
        console.log('🔵 String detected, using as-is:', postId);
      } else {
        // 기타 타입은 String으로 변환 시도
        postId = String(post.id);
        console.log('🔵 Other type detected, converted to string:', postId);
      }
      
      // 최종 검증: postId가 유효한지 확인
      if (!postId || postId.trim() === '' || postId === 'null' || postId === 'undefined') {
        console.error('[최근 검색어] 🔴 Exiting early: Invalid postId after conversion:', { 
          post, 
          postId, 
          originalId: post.id,
          originalIdType: typeof post.id
        });
        return;
      }
      
      // title이 없으면 기본값 사용 (저장은 반드시 진행)
      const postTitle = trimmedTitle || `게시물 ${postId}`;
      
      console.log('[최근 검색어] 🔵 Post ID converted:', { 
        original: post.id, 
        originalType: typeof post.id, 
        converted: postId, 
        convertedType: typeof postId 
      });
      console.log('[최근 검색어] 🔵 Final values:', { id: postId, title: postTitle, originalTitle: post.title });
      console.log('[최근 검색어] 🔵 About to call addToHistory with:', { 
        type: 'post', 
        id: postId, 
        title: postTitle 
      });
      
      // 히스토리 저장 (반드시 먼저 실행) - 이미 문자열로 변환된 ID 전달
      // title이 없어도 저장은 진행 (기본값 사용)
      try {
        // 1. 게시물 저장
        const historyItem = {
          type: 'post' as const,
          id: postId, // 이미 문자열로 변환됨
          title: postTitle, // 기본값 포함
          timestamp: Date.now(),
        };
        
        console.log('[최근 검색어] 🔵 addToHistory 호출 직전 - 최종 아이템:', historyItem);
        addPostToHistory(postId, postTitle);
        // state 업데이트
        const updatedSearches = getRecentSearches();
        setRecentSearches(updatedSearches);
        console.log('[최근 검색어] 🔵 게시물 저장 완료');
        
        // 주의: 게시물 클릭 시에는 검색어를 저장하지 않음
        // 검색어는 오직 handleSearchSubmit (Enter/전체보기)에서만 저장됨
      } catch (addToHistoryError) {
        console.error('[최근 검색어] 🔴 addToHistory 호출 중 에러:', addToHistoryError);
        if (addToHistoryError instanceof Error) {
          console.error('[최근 검색어] 🔴 Error details:', {
            message: addToHistoryError.message,
            stack: addToHistoryError.stack,
            name: addToHistoryError.name
          });
        }
        throw addToHistoryError; // 에러를 다시 throw하여 상위 catch에서 처리
      }
      
      // 이동 및 UI 상태 초기화
      // 주의: 게시물 클릭 시에는 검색어를 state로 전달하지 않음
      // 검색어 저장은 오직 handleSearchSubmit (Enter/전체보기)에서만 수행됨
      navigate(`/post/${postId}`);
      setSearchQuery('');
      setIsFocused(false);
    } catch (error) {
      console.error('[최근 검색어] 🔴 Error in handlePostClick:', error, post);
      // 에러 상세 정보
      if (error instanceof Error) {
        console.error('[최근 검색어] 🔴 Error message:', error.message);
        console.error('[최근 검색어] 🔴 Error stack:', error.stack);
      }
    }
  };

  /**
   * User 클릭 시 저장 및 이동
   * - 저장: type: 'user', id, nickname, job, avatar 필수 저장
   * - 이동: /profile/:id
   */
  const handleUserClick = (user: { id: string | number | bigint; nickname: string; job_title: string | null; avatar_url: string | null }) => {
    // BigInt를 문자열로 변환하여 안전하게 처리
    const userId = String(user.id);
    
    // 히스토리 저장 (반드시 먼저 실행)
    addToHistory({
      type: 'user',
      id: userId,
      nickname: user.nickname,
      job: user.job_title || '',
      avatar: user.avatar_url,
      timestamp: Date.now(),
    });
    // state 업데이트
    const updatedSearches = getRecentSearches();
    setRecentSearches(updatedSearches);
    // 이동 및 UI 상태 초기화
    navigate(`/profile/${userId}`);
    setSearchQuery('');
    setIsFocused(false);
  };

  /**
   * 히스토리 아이템 클릭 시 재방문 처리 및 이동
   * - 재방문: 타임스탬프를 갱신하여 최상단으로 이동
   * - Keyword: /search?q=... (검색 실행)
   * - Post: /post/:id
   * - User: /profile/:id
   */
  const handleHistoryItemClick = (item: HistoryItem) => {
    // 재방문: 타임스탬프를 갱신하여 최상단으로 이동
    // addToHistory 함수가 이미 중복 제거 로직을 가지고 있으므로,
    // 타임스탬프만 갱신된 새 아이템을 전달하면 자동으로 최상단으로 이동됨
    const updatedItem: HistoryItem = {
      ...item,
      timestamp: Date.now(), // 타임스탬프 갱신
    };
    console.log('[최근 검색어] 🔵 히스토리 아이템 재방문 - 타임스탬프 갱신:', updatedItem);
    addToHistory(updatedItem);
    // state 업데이트
    const updatedSearches = getRecentSearches();
    setRecentSearches(updatedSearches);
    
    // UI 상태 초기화 (addToHistory 호출 후에 실행)
    setSearchQuery('');
    setIsFocused(false);
    
    // 이동
    if (item.type === 'keyword') {
      navigate(`/search?q=${encodeURIComponent(item.value)}`);
    } else if (item.type === 'post') {
      navigate(`/post/${item.id}`);
    } else if (item.type === 'user') {
      navigate(`/profile/${item.id}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between gap-4">
        {isWritePage ? (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("request-navigate-from-write", { detail: { path: "/" } }))
            }
            className="flex items-center shrink-0 cursor-pointer select-none bg-transparent border-0 p-0 text-left"
          >
            <span className="text-2xl font-extrabold text-primary tracking-tight select-none">
              Failcess
            </span>
          </button>
        ) : (
          <Link to="/" className="flex items-center shrink-0 cursor-pointer select-none">
            <span className="text-2xl font-extrabold text-primary tracking-tight select-none">
              Failcess
            </span>
          </Link>
        )}

        {/* 검색창 */}
        {!isWritePage && (
          <div ref={searchRef} className="relative flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="실패 사례를 검색해보세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // 1. 영어/숫자 입력 시 새로고침 되는 것을 막기 위해 필수
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 2. Enter 키일 때는 IME 조합 중이어도 강제 실행
                    // (한글 자모 'ㄱ' 하나만 입력해도 저장 및 검색되도록)
                    // 한 글자('a', 'ㄱ', '1')도 예외 없이 저장 및 검색
                    
                    // 3. 검색어 저장 및 이동 실행 (빈 문자열만 아니면 무조건 실행)
                    handleSearchSubmit();
                  }
                }}
                className="pl-10 pr-4 h-10 text-sm"
              />
            </div>

            {/* 드롭다운 */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                {/* ========== Case A: 검색어 입력 중 (query.length > 0) ========== */}
                {showSearchResults && (
                  <>
                    {isLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        검색 중...
                      </div>
                    ) : searchError ? (
                      <div className="p-4 text-center text-sm text-red-600">
                        <div className="font-medium mb-1">검색 오류</div>
                        <div className="text-xs text-red-500">{searchError}</div>
                        <div className="text-xs text-gray-500 mt-2">콘솔을 확인해주세요.</div>
                      </div>
                    ) : hasResults ? (
                      <div className="relative">
                        {/* 전체보기 버튼 (관련 게시물이나 유저가 존재하면 항상 표시) */}
                        {hasResults && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-6 px-2 text-xs text-muted-foreground hover:text-foreground z-10 select-none"
                            onClick={(e) => {
                              // 이벤트 버블링 방지
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // '전체 보기' 버튼 클릭 시: 키워드 저장 후 검색 결과 페이지로 이동
                              // (엔터 키와 동일한 흐름: handleSearchSubmit이 키워드를 저장함)
                              // ref를 사용하여 최신 입력값 확인 (상태 업데이트 지연 대비)
                              const currentValue = searchInputRef.current?.value || searchQuery;
                              console.log('[검색어 저장] 🔵 전체 보기 버튼 클릭');
                              console.log('[검색어 저장] 🔵 현재 searchQuery 상태:', searchQuery);
                              console.log('[검색어 저장] 🔵 현재 입력창 값 (ref):', currentValue);
                              
                              // 입력창에서 직접 값을 가져와서 임시로 설정 (상태 동기화 보장)
                              if (currentValue && currentValue !== searchQuery) {
                                console.log('[검색어 저장] 🔵 입력창 값과 상태 불일치 감지, 상태 업데이트:', currentValue);
                                setSearchQuery(currentValue);
                                // 상태 업데이트 후 handleSearchSubmit 호출 (약간의 지연)
                                setTimeout(() => {
                                  handleSearchSubmit();
                                }, 0);
                              } else {
                                handleSearchSubmit();
                              }
                            }}
                          >
                            전체 보기
                          </Button>
                        )}

                        {/* 상단: 게시물 섹션 */}
                        {searchResults.posts.length > 0 && (
                          <>
                            <div className="text-xs text-gray-500 font-semibold px-4 py-2">
                              게시물
                            </div>
                            <div>
                              {searchResults.posts.map((post, index) => {
                                // key를 안전하게 처리 (BigInt도 문자열로 변환)
                                const safeKey = post.id != null ? String(post.id) : `post-${Math.random()}`;
                                
                                // ID를 문자열로 변환하여 로깅
                                const postIdStr = post.id != null ? String(post.id) : 'null';
                                
                                // 게시물 데이터 상세 로깅 (렌더링 시점)
                                console.log(`[최근 검색어] 📋 렌더링된 게시물[${index}]:`, {
                                  id: post.id,
                                  idType: typeof post.id,
                                  idString: postIdStr,
                                  title: post.title,
                                  titleType: typeof post.title,
                                  hasTitle: !!post.title,
                                  titleLength: post.title?.length || 0
                                });
                                
                                return (
                                  <div
                                    key={safeKey}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('[최근 검색어] 🖱️ 클릭 이벤트 발생 - 게시물 ID:', postIdStr, '| 타입:', typeof post.id);
                                      console.log('[최근 검색어] 🖱️ 클릭된 게시물 전체 데이터:', post);
                                      // 게시물만 저장 (검색어는 저장하지 않음 - 오직 handleSearchSubmit에서만 키워드 저장)
                                      handlePostClick(post);
                                    }}
                                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors select-none"
                                  >
                                    <div className="text-sm font-medium text-gray-900 truncate select-none">{post.title || '제목 없음'}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* 중간: 구분선 (둘 중 하나라도 데이터가 있을 때 표시) */}
                        {(searchResults.posts.length > 0 || searchResults.users.length > 0) && 
                         searchResults.posts.length > 0 && 
                         searchResults.users.length > 0 && (
                          <hr className="border-gray-100 my-1" />
                        )}

                        {/* 하단: 유저 섹션 */}
                        {searchResults.users.length > 0 && (
                          <>
                            <div className="text-xs text-gray-500 font-semibold px-4 py-2">
                              유저
                            </div>
                            <div>
                              {searchResults.users.map((user) => (
                                <div
                                  key={user.id}
                                  onClick={() => handleUserClick(user)}
                                  className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors select-none"
                                >
                                  <Avatar className="w-8 h-8 rounded-full mr-2 shrink-0 select-none">
                                    {isValidImageUrl(user.avatar_url) ? (
                                      <AvatarImage src={user.avatar_url!} alt={user.nickname} />
                                    ) : null}
                                    <AvatarPlaceholder />
                                  </Avatar>
                                    <div className="flex items-center flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900 truncate select-none">{user.nickname}</span>
                                    {user.job_title && (
                                      <span className="text-xs text-gray-400 ml-2 truncate select-none">{user.job_title}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        검색 결과가 없습니다
                      </div>
                    )}
                  </>
                )}

                {/* ========== Case B: 최근 검색어 모드 (query === '' && isFocused) ========== */}
                {showRecentSearches && (
                  <div>
                    {/* 헤더 영역 */}
                    <div className="flex justify-between items-center px-4 py-2 text-sm text-gray-500">
                      <span className="font-bold">최근 검색어</span>
                      {recentSearches.length > 0 && (
                        <button
                          onClick={clearHistory}
                          className="text-xs hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                          전체 삭제
                        </button>
                      )}
                    </div>

                    {/* 리스트 영역 (게시물, 유저, 키워드가 섞여서 최신순 렌더링) */}
                    {recentSearches.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        최근 검색 내용이 없습니다
                      </div>
                    ) : (
                      <div>
                        {recentSearches.map((item, idx) => {
                          // 고유한 key 생성: type + timestamp + 고유 식별자 조합
                          let uniqueKey: string;
                          if (item.type === 'keyword') {
                            uniqueKey = `keyword-${item.timestamp}-${item.value}`;
                          } else if (item.type === 'post') {
                            uniqueKey = `post-${item.timestamp}-${item.id}`;
                          } else {
                            uniqueKey = `user-${item.timestamp}-${item.id}`;
                          }
                          // 추가 안전장치: 같은 key가 있으면 index 추가
                          uniqueKey = `${uniqueKey}-${idx}`;
                          
                          return (
                          <div
                            key={uniqueKey}
                            onClick={() => handleHistoryItemClick(item)}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors select-none"
                          >
                            {/* 왼쪽 콘텐츠 (타입별 분기) */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Keyword: [돋보기 아이콘] + [검색어 텍스트] */}
                              {item.type === 'keyword' && (
                                <>
                                  <Search className="h-4 w-4 text-muted-foreground shrink-0 select-none" />
                                  <span className="text-sm truncate select-none">{item.value}</span>
                                </>
                              )}
                              {/* Post: [문서 아이콘] + [게시물 제목] */}
                              {item.type === 'post' && (
                                <>
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 select-none" />
                                  <span className="text-sm truncate select-none">{item.title}</span>
                                </>
                              )}
                              {/* User: [아바타] + [닉네임(Bold)] + [직업(회색)] */}
                              {item.type === 'user' && (
                                <>
                                  <Avatar className="w-6 h-6 rounded-full shrink-0 select-none">
                                    {isValidImageUrl(item.avatar) ? (
                                      <AvatarImage src={item.avatar!} alt={item.nickname} />
                                    ) : null}
                                    <AvatarPlaceholder />
                                  </Avatar>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium truncate select-none">{item.nickname}</span>
                                    {item.job && (
                                      <span className="text-xs text-gray-500 truncate select-none">{item.job}</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* 오른쪽 삭제 버튼 */}
                            <button
                              onClick={(e) => removeHistory(item.timestamp, e)}
                              className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors shrink-0 cursor-pointer select-none"
                            >
                              <X className="h-4 w-4 text-muted-foreground select-none" />
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 shrink-0">
          {isWritePage ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('request-cancel-write'));
                }}
                className="select-none"
              >
                취소
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                type="submit"
                form="write-form"
                className="bg-gray-900 hover:bg-gray-800 text-white select-none"
              >
                발행하기
              </Button>
            </>
          ) : user ? (
            <>
              <Button 
                variant="default" 
                size="sm" 
                className="gap-2 select-none" 
                onClick={() => navigate('/write')}
              >
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">글쓰기</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none">
                    <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-accent transition-all">
                      {isValidImageUrl(headerAvatarUrl) ? (
                        <AvatarImage src={headerAvatarUrl!} alt={user.user_metadata?.nickname || user.email} />
                      ) : null}
                      <AvatarPlaceholder />
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max min-w-[150px] [&>*]:whitespace-nowrap">
                  <DropdownMenuItem asChild>
                    <Link to="/mypage" className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0" />
                      마이페이지
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4 shrink-0" />
                      설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = '/';
                    }}
                    className="text-muted-foreground flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              className="select-none" 
              onClick={openAuthModal}
            >
              로그인
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
