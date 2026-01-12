import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Bookmark, Clock, Check, X } from 'lucide-react';
import Header from '@/components/Header';
import CategoryBadge from '@/components/CategoryBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { mockPosts, mockUsers, currentUser } from '@/data/mockData';
import { CoffeeChat } from '@/types';

// Mock saved posts (using some of the existing posts)
const savedPosts = [mockPosts[0], mockPosts[2]];

// Mock my posts (pretend current user wrote some posts)
const myPosts = mockPosts.slice(0, 2).map((post) => ({
  ...post,
  author_id: 'current',
  author: currentUser,
}));

// Mock coffee chat requests
const coffeeChatRequests: (CoffeeChat & { requester: typeof mockUsers[0] })[] = [
  {
    id: '1',
    requester_id: '2',
    receiver_id: 'current',
    message: "Hi! I really resonated with your post about pivoting. I'm currently facing a similar situation with my startup and would love to get your perspective.",
    status: 'pending',
    created_at: '2024-01-18T10:00:00Z',
    requester: mockUsers[1],
  },
  {
    id: '2',
    requester_id: '3',
    receiver_id: 'current',
    message: "Your experience with investors was eye-opening. I'm about to start fundraising and would appreciate any advice you could share.",
    status: 'pending',
    created_at: '2024-01-17T14:30:00Z',
    requester: mockUsers[2],
  },
];

const MyPage = () => {
  const [requests, setRequests] = useState(coffeeChatRequests);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleAcceptRequest = (id: string) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: 'accepted' as const } : req))
    );
  };

  const handleDeclineRequest = (id: string) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: 'declined' as const } : req))
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Header */}
          <div className="bg-card rounded-xl border border-border p-8 mb-8 animate-fade-in">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={currentUser.avatar_url} alt={currentUser.nickname} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xl">
                  {currentUser.nickname.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="font-heading text-2xl font-bold text-foreground mb-1">
                  {currentUser.nickname}
                </h1>
                <p className="text-muted-foreground">{currentUser.bio}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="my-posts" className="animate-fade-in">
            <TabsList className="w-full grid grid-cols-3 mb-8">
              <TabsTrigger value="my-posts">My Posts</TabsTrigger>
              <TabsTrigger value="saved">Saved Posts</TabsTrigger>
              <TabsTrigger value="coffee-chat">
                Coffee Chats
                {requests.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="ml-2 h-5 w-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                    {requests.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* My Posts Tab */}
            <TabsContent value="my-posts" className="space-y-4">
              {myPosts.length > 0 ? (
                myPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="block bg-card rounded-lg border border-border p-5 hover:shadow-card-hover transition-all"
                  >
                    <h3 className="font-medium text-foreground mb-2">{post.title}</h3>
                    <CategoryBadge category={post.category} className="mb-3" />
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        <span>{post.view_count}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Heart className="h-4 w-4" />
                        <span>{post.comment_count}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bookmark className="h-4 w-4" />
                        <span>{post.save_count}</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <p className="text-muted-foreground">You haven't written any stories yet</p>
                  <Button className="mt-4">Write Your First Story</Button>
                </div>
              )}
            </TabsContent>

            {/* Saved Posts Tab */}
            <TabsContent value="saved" className="space-y-4">
              {savedPosts.length > 0 ? (
                savedPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="block bg-card rounded-lg border border-border p-5 hover:shadow-card-hover transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.author.avatar_url} alt={post.author.nickname} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {post.author.nickname.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">
                          {post.author.nickname}
                        </p>
                        <h3 className="font-medium text-foreground mb-2">{post.title}</h3>
                        <CategoryBadge category={post.category} />
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <p className="text-muted-foreground">No saved posts yet</p>
                </div>
              )}
            </TabsContent>

            {/* Coffee Chat Tab */}
            <TabsContent value="coffee-chat" className="space-y-4">
              {requests.length > 0 ? (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-card rounded-lg border border-border p-5"
                  >
                    <div className="flex items-start gap-4">
                      <Link to={`/user/${request.requester_id}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={request.requester.avatar_url}
                            alt={request.requester.nickname}
                          />
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            {request.requester.nickname.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Link
                            to={`/user/${request.requester_id}`}
                            className="font-medium text-foreground hover:text-navy-light transition-colors"
                          >
                            {request.requester.nickname}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(request.created_at)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {request.message}
                        </p>

                        {request.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptRequest(request.id)}
                              className="gap-1.5"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineRequest(request.id)}
                              className="gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <span
                            className={`text-sm font-medium ${
                              request.status === 'accepted'
                                ? 'text-emerald-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {request.status === 'accepted' ? 'Accepted' : 'Declined'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <p className="text-muted-foreground">No coffee chat requests yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default MyPage;
