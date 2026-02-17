import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Flame } from 'lucide-react';

interface PopularPost {
  id: string | number | bigint;
  title: string;
  view_count: number;
}

const PopularPosts = () => {
  const [posts, setPosts] = useState<PopularPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPopularPosts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase
          .rpc('get_popular_posts');

        if (rpcError) {
          console.error('Error fetching popular posts:', rpcError);
          // RPC 함수가 없거나 에러가 발생해도 화면은 정상적으로 표시
          setError(null); // 에러 메시지를 표시하지 않고 빈 상태로 처리
          setPosts([]);
          return;
        }

        if (data && Array.isArray(data)) {
          setPosts(data.slice(0, 5)); // 상위 5개만 표시
        } else {
          setPosts([]);
        }
      } catch (err) {
        console.error('Error in fetchPopularPosts:', err);
        // 에러 발생 시에도 화면은 정상적으로 표시
        setError(null);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularPosts();
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="text-base font-bold text-foreground">인기 게시물</h2>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-muted-foreground py-4">
          {error}
        </div>
      )}

      {!isLoading && !error && posts.length === 0 && (
        <div className="text-sm text-muted-foreground py-4">
          인기 게시물이 없습니다.
        </div>
      )}

      {!isLoading && !error && posts.length > 0 && (
        <div className="space-y-2">
          {posts.map((post, index) => (
            <Link
              key={post.id}
              to={`/post/${post.id}`}
              state={{ fromPopularPosts: true }}
              className="block p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer select-none group"
            >
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                    {post.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PopularPosts;
