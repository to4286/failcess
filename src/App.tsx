import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import ProfileSetupGuard from "@/components/auth/ProfileSetupGuard";
import CoffeeChatSuccessGuard from "@/components/CoffeeChatSuccessGuard";
import Index from "./pages/Index";
import PostDetail from "./pages/PostDetail";
import UserProfile from "./pages/UserProfile";
import MyPage from "./pages/MyPage";
import WritePage from "./pages/WritePage";
import SearchPage from "./pages/SearchPage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthModalProvider>
          <CoffeeChatSuccessGuard />
          <ProfileSetupGuard>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/profile/:id" element={<UserProfile />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/mypage/coffee-chat" element={<MyPage />} />
          <Route path="/mypage/folder/:folderId" element={<MyPage />} />
          <Route path="/write" element={<WritePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </ProfileSetupGuard>
        </AuthModalProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
