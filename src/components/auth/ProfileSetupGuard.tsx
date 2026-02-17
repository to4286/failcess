import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ProfileSetupModal from './ProfileSetupModal';

export default function ProfileSetupGuard({ children }: { children: React.ReactNode }) {
  const [showProfileSetup, setShowProfileSetup] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setShowProfileSetup(false);
        return;
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        setShowProfileSetup(false);
        return;
      }
      // profiles에 해당 유저가 없거나 nickname이 비어있으면 → 추가 정보 입력 모달 표시 (신규 가입자)
      // 탈퇴한 계정은 auth.users에서 삭제되므로 세션이 있을 수 없음
      if (profile === null) {
        setShowProfileSetup(true);
        return;
      }
      const nicknameEmpty = profile.nickname == null || String(profile.nickname).trim() === '';
      setShowProfileSetup(nicknameEmpty);
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (showProfileSetup === null) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {showProfileSetup && (
        <ProfileSetupModal
          open={true}
          onSuccess={() => setShowProfileSetup(false)}
        />
      )}
    </>
  );
}
