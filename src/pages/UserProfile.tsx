import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Coffee, Users } from 'lucide-react';
import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { mockUsers, mockPosts, followedUserIds, currentUser } from '@/data/mockData';

const UserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const user = mockUsers.find((u) => u.id === id);
  const userPosts = mockPosts.filter((p) => p.author_id === id);
  const [isFollowing, setIsFollowing] = useState(followedUserIds.includes(id || ''));
  const [showCoffeeChatModal, setShowCoffeeChatModal] = useState(false);
  const [coffeeChatMessage, setCoffeeChatMessage] = useState('');
  const [chatSent, setChatSent] = useState(false);

  // Mock stats
  const followerCount = Math.floor(Math.random() * 500) + 100;
  const followingCount = Math.floor(Math.random() * 200) + 50;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
            User not found
          </h1>
          <Link to="/" className="text-accent hover:underline">
            Back to Feed
          </Link>
        </main>
      </div>
    );
  }

  const isCurrentUser = user.id === currentUser.id;

  const handleCoffeeChatSubmit = () => {
    // Mock submission
    setChatSent(true);
    setTimeout(() => {
      setShowCoffeeChatModal(false);
      setChatSent(false);
      setCoffeeChatMessage('');
    }, 2000);
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

          {/* Profile Card */}
          <div className="bg-card rounded-xl border border-border p-8 mb-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar_url} alt={user.nickname} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl">
                  {user.nickname.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                  {user.nickname}
                </h1>
                <p className="text-muted-foreground mb-4">{user.bio}</p>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{followerCount}</span>
                    <span className="text-muted-foreground">Followers</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{followingCount}</span>
                    <span className="text-muted-foreground ml-1">Following</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isCurrentUser && (
              <div className="flex gap-3 mt-6 pt-6 border-t border-border">
                <Button
                  variant={isFollowing ? 'secondary' : 'default'}
                  onClick={() => setIsFollowing(!isFollowing)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowCoffeeChatModal(true)}
                >
                  <Coffee className="h-4 w-4" />
                  Request Coffee Chat
                </Button>
              </div>
            )}
          </div>

          {/* User's Posts */}
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground mb-6">
              Stories by {user.nickname} ({userPosts.length})
            </h2>

            {userPosts.length > 0 ? (
              <div className="space-y-6">
                {userPosts.map((post) => (
                  <StoryCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">No stories yet</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Coffee Chat Modal */}
      <Dialog open={showCoffeeChatModal} onOpenChange={setShowCoffeeChatModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Request Coffee Chat</DialogTitle>
            <DialogDescription>
              Send a message to {user.nickname} to request a virtual coffee chat.
            </DialogDescription>
          </DialogHeader>

          {chatSent ? (
            <div className="py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Coffee className="h-6 w-6 text-accent" />
              </div>
              <p className="text-foreground font-medium">Request sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {user.nickname} will be notified.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <Textarea
                  placeholder="Hi! I loved your story about... I'd love to chat about..."
                  value={coffeeChatMessage}
                  onChange={(e) => setCoffeeChatMessage(e.target.value)}
                  className="min-h-[120px] resize-none"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCoffeeChatModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCoffeeChatSubmit}
                  disabled={!coffeeChatMessage.trim()}
                >
                  Send Request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfile;
