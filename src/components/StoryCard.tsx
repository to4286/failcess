import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Bookmark } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import CategoryBadge from '@/components/CategoryBadge';
import { Post } from '@/types';
import { followedUserIds } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface StoryCardProps {
  post: Post;
}

const StoryCard = ({ post }: StoryCardProps) => {
  const [isFollowing, setIsFollowing] = useState(
    followedUserIds.includes(post.author_id)
  );
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(post.save_count);

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFollowing(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    setSaveCount(prev => isSaved ? prev - 1 : prev + 1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <article className="group bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-card-hover transition-all duration-300 animate-fade-in">
      {/* Header: Avatar, Nickname, Follow */}
      <div className="flex items-center justify-between mb-4">
        <Link 
          to={`/user/${post.author_id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar_url} alt={post.author.nickname} />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {post.author.nickname.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-foreground text-sm">
              {post.author.nickname}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(post.created_at)}
            </span>
          </div>
        </Link>
        
        {!isFollowing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFollow}
            className="text-accent hover:text-accent hover:bg-accent/10 font-medium text-sm"
          >
            Follow
          </Button>
        )}
      </div>

      {/* Body: Title, Category, Content Preview */}
      <Link to={`/post/${post.id}`} className="block">
        <h2 className="font-heading text-xl font-semibold text-foreground mb-2 group-hover:text-navy-light transition-colors">
          {post.title}
        </h2>
        
        <div className="mb-3">
          <CategoryBadge category={post.category} />
        </div>
        
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
          {post.content}
        </p>
      </Link>

      {/* Footer: Comments, Saves */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
        <Link 
          to={`/post/${post.id}`}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{post.comment_count}</span>
        </Link>
        
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-1.5 transition-colors",
            isSaved 
              ? "text-accent" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          <span className="text-sm">{saveCount}</span>
        </button>
      </div>
    </article>
  );
};

export default StoryCard;
