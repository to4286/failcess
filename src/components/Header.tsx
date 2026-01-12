import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser } from '@/data/mockData';
import { Link, useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-lg">P</span>
            </div>
            <span className="font-heading text-xl font-bold text-foreground">Pivot</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Button variant="default" size="sm" className="gap-2" onClick={() => navigate('/write')}>
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Write Story</span>
          </Button>

          <Link to="/mypage">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-accent transition-all">
              <AvatarImage src={currentUser.avatar_url} alt={currentUser.nickname} />
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {currentUser.nickname.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
