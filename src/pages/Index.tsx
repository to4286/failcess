import Header from '@/components/Header';
import StoryCard from '@/components/StoryCard';
import { mockPosts } from '@/data/mockData';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
              Learn from those who've been there
            </h1>
            <p className="text-muted-foreground text-lg">
              Real stories from founders about the failures that shaped their journey
            </p>
          </div>

          {/* Stories Feed */}
          <div className="space-y-6">
            {mockPosts.map((post) => (
              <StoryCard key={post.id} post={post} />
            ))}
          </div>

          {/* Load More */}
          <div className="flex justify-center mt-10">
            <button className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              Load more stories...
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 Pivot. A community for founders to learn from failure.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
