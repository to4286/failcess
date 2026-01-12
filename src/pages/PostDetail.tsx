import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Bookmark, Pencil, Trash2, Check, X } from 'lucide-react';
import Header from '@/components/Header';
import CategoryBadge from '@/components/CategoryBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { mockPosts, mockUsers, currentUser } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Comment } from '@/types';

// Mock comments
const mockComments: Comment[] = [
  {
    id: '1',
    content: 'This resonates so much with my own experience. We also burned through funding too quickly trying to scale before finding PMF. Thank you for sharing this.',
    post_id: '1',
    author_id: '2',
    author: mockUsers[1],
    created_at: '2024-01-16T09:00:00Z',
  },
  {
    id: '2',
    content: 'The part about slowing down really hit home. Sometimes velocity feels like progress, but it\'s just motion without direction.',
    post_id: '1',
    author_id: '3',
    author: mockUsers[2],
    created_at: '2024-01-16T14:30:00Z',
  },
  {
    id: '3',
    content: 'Would love to hear more about how you approached the conversation with your investors when things started going south.',
    post_id: '1',
    author_id: '4',
    author: mockUsers[3],
    created_at: '2024-01-17T10:15:00Z',
  },
];

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const post = mockPosts.find((p) => p.id === id);
  const [isSaved, setIsSaved] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState(mockComments);
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
            Story not found
          </h1>
          <Link to="/" className="text-accent hover:underline">
            Back to Feed
          </Link>
        </main>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: String(Date.now()),
      content: newComment,
      post_id: post.id,
      author_id: 'current',
      author: {
        id: 'current',
        email: 'me@example.com',
        nickname: 'Alex Thompson',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
        bio: '',
      },
      created_at: new Date().toISOString(),
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  const toggleCommentExpand = (commentId: string) => {
    setExpandedComments((prev) =>
      prev.includes(commentId)
        ? prev.filter((id) => id !== commentId)
        : [...prev, commentId]
    );
  };

  const isCommentLong = (content: string) => content.length > 200;

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editingContent.trim()) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, content: editingContent } : c
      )
    );
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const isCommentAuthor = (comment: Comment) => {
    return comment.author_id === currentUser.id || comment.author_id === 'current';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Feed
          </Link>

          {/* Article */}
          <article className="animate-fade-in">
            {/* Author Info */}
            <div className="flex items-center gap-4 mb-6">
              <Link to={`/user/${post.author_id}`}>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={post.author.avatar_url} alt={post.author.nickname} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    {post.author.nickname.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link
                  to={`/user/${post.author_id}`}
                  className="font-medium text-foreground hover:text-navy-light transition-colors"
                >
                  {post.author.nickname}
                </Link>
                <p className="text-sm text-muted-foreground">{formatDate(post.created_at)}</p>
              </div>
            </div>

            {/* Title */}
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              {post.title}
            </h1>

            {/* Category */}
            <div className="mb-6">
              <CategoryBadge category={post.category} />
            </div>

            {/* Content */}
            <div className="prose prose-slate max-w-none">
              <p className="text-foreground leading-relaxed text-lg whitespace-pre-wrap">
                {post.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageCircle className="h-5 w-5" />
                <span>{comments.length}</span>
              </div>
              <button
                onClick={() => setIsSaved(!isSaved)}
                className={cn(
                  'flex items-center gap-1.5 transition-colors',
                  isSaved ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Bookmark className={cn('h-5 w-5', isSaved && 'fill-current')} />
                <span>{post.save_count + (isSaved ? 1 : 0)}</span>
              </button>
            </div>
          </article>

          {/* Comments Section */}
          <section className="mt-12">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-6">
              Comments ({comments.length})
            </h2>

            {/* Comments List */}
            <div className="space-y-6 mb-8">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-card rounded-lg border border-border p-4 animate-fade-in"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Link to={`/user/${comment.author_id}`}>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.author.avatar_url} alt={comment.author.nickname} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                            {comment.author.nickname.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div>
                        <Link
                          to={`/user/${comment.author_id}`}
                          className="text-sm font-medium text-foreground hover:text-navy-light transition-colors"
                        >
                          {comment.author.nickname}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Edit/Delete buttons - only for comment author */}
                    {isCommentAuthor(comment) && editingCommentId !== comment.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditComment(comment)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                          title="Edit comment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="Delete comment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editing mode */}
                  {editingCommentId === comment.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-[80px] resize-none text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={!editingContent.trim()}
                          className="gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground leading-relaxed">
                        {isCommentLong(comment.content) && !expandedComments.includes(comment.id)
                          ? `${comment.content.slice(0, 200)}...`
                          : comment.content}
                      </p>
                      {isCommentLong(comment.content) && (
                        <button
                          onClick={() => toggleCommentExpand(comment.id)}
                          className="text-accent text-sm mt-2 hover:underline"
                        >
                          {expandedComments.includes(comment.id) ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} className="space-y-4">
              <Textarea
                placeholder="Share your thoughts..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[100px] resize-none bg-card"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!newComment.trim()}>
                  Post Comment
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PostDetail;
