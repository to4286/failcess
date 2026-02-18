import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { INTEREST_TAGS } from '@/lib/constants';

const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_ONLY = /^[가-힣a-zA-Z0-9]+$/;
const JOB_ONLY = /^[가-힣a-zA-Z]+$/;

function validateNickname(value: string): string | null {
  const t = value.trim();
  if (!t) return '닉네임을 입력해주세요';
  if (t.length < NICKNAME_MIN_LENGTH) return '3자 이상 입력해주세요';
  if (!NICKNAME_ONLY.test(t)) return '영어, 한글, 숫자만 입력해주세요';
  return null;
}

function validateJob(value: string): string | null {
  const t = value.trim();
  if (!t) return '직업을 입력해주세요';
  if (!JOB_ONLY.test(t)) return '한글, 영어만 입력해주세요';
  return null;
}

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{
    nickname: string | null;
    job_title: string | null;
    bio: string | null;
    interests: string[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const [updatingField, setUpdatingField] = useState<'nickname' | 'job' | 'bio' | 'interests' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/');
        return;
      }
      setUser(session.user);
      setEmail(session.user.email ?? '');
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nickname, job_title, bio, interests')
        .eq('id', session.user.id)
        .maybeSingle();
      const raw = profileData?.interests;
      const interestsArray = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? (() => {
              try {
                const p = JSON.parse(raw);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })()
          : [];
      setProfile(
        profileData
          ? {
              nickname: profileData.nickname ?? null,
              job_title: profileData.job_title ?? null,
              bio: profileData.bio ?? null,
              interests: interestsArray,
            }
          : null,
      );
      setNickname(profileData?.nickname?.trim() ?? '');
      setJobTitle(profileData?.job_title?.trim() ?? '');
      setBio(profileData?.bio?.trim() ?? '');
      setSelectedInterests(interestsArray);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleNicknameBlur = () => setNicknameError(validateNickname(nickname));
  const handleJobBlur = () => setJobError(validateJob(jobTitle));

  const initialNickname = profile?.nickname?.trim() ?? '';
  const initialJob = profile?.job_title?.trim() ?? '';
  const initialBio = profile?.bio?.trim() ?? '';
  const initialInterests = profile?.interests ?? [];

  const interestsChanged =
    JSON.stringify([...selectedInterests].sort()) !==
    JSON.stringify([...initialInterests].sort());
  const interestsValid =
    selectedInterests.length >= 1 && selectedInterests.length <= 5;
  const canSubmitInterests = interestsChanged && interestsValid;

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) {
        toast.warning('관심사는 5개까지 선택 가능합니다.');
        return prev;
      }
      return [...prev, tag];
    });
  };

  const canSubmitNickname =
    nickname.trim() !== initialNickname && !validateNickname(nickname);
  const canSubmitJob =
    jobTitle.trim() !== initialJob && !validateJob(jobTitle);
  const canSubmitBio = bio.trim() !== initialBio;

  const updateNickname = async () => {
    if (!user?.id || !canSubmitNickname) return;
    setUpdatingField('nickname');
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: nickname.trim() })
      .eq('id', user.id);
    setUpdatingField(null);
    if (error) return;
    setProfile((p) => (p ? { ...p, nickname: nickname.trim() } : null));
    toast.success('변경되었습니다.', { position: 'top-center', duration: 2000 });
  };

  const updateJob = async () => {
    if (!user?.id || !canSubmitJob) return;
    setUpdatingField('job');
    const { error } = await supabase
      .from('profiles')
      .update({ job_title: jobTitle.trim() })
      .eq('id', user.id);
    setUpdatingField(null);
    if (error) return;
    setProfile((p) => (p ? { ...p, job_title: jobTitle.trim() } : null));
    toast.success('변경되었습니다.', { position: 'top-center', duration: 2000 });
  };

  const updateBio = async () => {
    if (!user?.id || !canSubmitBio) return;
    setUpdatingField('bio');
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio.trim() })
      .eq('id', user.id);
    setUpdatingField(null);
    if (error) return;
    setProfile((p) => (p ? { ...p, bio: bio.trim() } : null));
    toast.success('변경되었습니다.', { position: 'top-center', duration: 2000 });
  };

  const updateInterests = async () => {
    if (!user?.id || !canSubmitInterests) return;
    setUpdatingField('interests');
    const { error } = await supabase
      .from('profiles')
      .update({ interests: selectedInterests })
      .eq('id', user.id);
    setUpdatingField(null);
    if (error) return;
    setProfile((p) => (p ? { ...p, interests: [...selectedInterests] } : null));
    toast.success('변경되었습니다.', { position: 'top-center', duration: 2000 });
  };

  const handleDeleteAccountClick = () => setShowDeleteConfirm(true);

  const handleDeleteAccountConfirm = async () => {
    if (!user?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('세션이 만료되었습니다. 다시 로그인해 주세요.');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let errMsg: string = error.message ?? '회원 탈퇴에 실패했습니다.';
        if (error instanceof FunctionsHttpError && error.context) {
          try {
            const body = await (error.context as Response).json();
            const raw = body?.error;
            if (typeof raw === 'string') errMsg = raw;
            else if (raw && typeof raw === 'object' && typeof raw.message === 'string') errMsg = raw.message;
            else if (raw != null) errMsg = String(raw);
          } catch {
            /* ignore parse error */
          }
        }
        throw new Error(errMsg);
      }
      if (data?.error) {
        const raw = data.error;
        const msg = typeof raw === 'string' ? raw : (raw?.message ?? String(raw ?? ''));
        throw new Error(msg || '회원 탈퇴에 실패했습니다.');
      }

      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (err: any) {
      console.error('회원 탈퇴 실패:', err);
      const msg = typeof err?.message === 'string' ? err.message : '회원 탈퇴에 실패했습니다.';
      toast.error(msg);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-md mx-auto text-center text-muted-foreground">
            로딩 중...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-xl font-semibold text-foreground">설정</h1>

          {/* A. 이메일 (읽기 전용) */}
          <div className="space-y-2">
            <Label htmlFor="settings-email">이메일</Label>
            <Input
              id="settings-email"
              type="email"
              value={email}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* B. 닉네임 */}
          <div className="space-y-2">
            <Label htmlFor="settings-nickname">닉네임</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <Input
                id="settings-nickname"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (nicknameError) setNicknameError(null);
                }}
                onBlur={handleNicknameBlur}
                placeholder="닉네임"
                className={cn(
                  'flex-1',
                  nicknameError &&
                    'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                )}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="sm:shrink-0"
                disabled={!canSubmitNickname || updatingField === 'nickname'}
                onClick={updateNickname}
              >
                {updatingField === 'nickname' ? '변경 중...' : '변경하기'}
              </Button>
            </div>
            {nicknameError && (
              <p className="text-xs text-red-500">{nicknameError}</p>
            )}
          </div>

          {/* C. 직업 */}
          <div className="space-y-2">
            <Label htmlFor="settings-job">직업</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <Input
                id="settings-job"
                value={jobTitle}
                onChange={(e) => {
                  const next = e.target.value;
                  setJobTitle(next);
                  setJobError(validateJob(next));
                }}
                onBlur={handleJobBlur}
                placeholder="직업"
                className={cn(
                  'flex-1',
                  jobError &&
                    'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                )}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="sm:shrink-0"
                disabled={!canSubmitJob || updatingField === 'job'}
                onClick={updateJob}
              >
                {updatingField === 'job' ? '변경 중...' : '변경하기'}
              </Button>
            </div>
            {jobError && <p className="text-xs text-red-500">{jobError}</p>}
          </div>

          {/* 관심사 */}
          <div className="space-y-2">
            <Label>관심사</Label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer select-none',
                    selectedInterests.includes(tag)
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canSubmitInterests || updatingField === 'interests'}
                onClick={updateInterests}
              >
                {updatingField === 'interests' ? '변경 중...' : '변경하기'}
              </Button>
            </div>
          </div>

          {/* D. 한 줄 소개 */}
          <div className="space-y-2">
            <Label htmlFor="settings-bio">한 줄 소개</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <Textarea
                id="settings-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="한 줄 소개"
                className="flex-1 min-h-[80px] resize-none"
                rows={3}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="sm:shrink-0"
                disabled={!canSubmitBio || updatingField === 'bio'}
                onClick={updateBio}
              >
                {updatingField === 'bio' ? '변경 중...' : '변경하기'}
              </Button>
            </div>
          </div>

          {/* E. 회원 탈퇴 */}
          <div className="pt-6 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDeleteAccountClick}
              disabled={isDeleting}
            >
              회원 탈퇴
            </Button>
          </div>
        </div>
      </main>

      {/* 회원 탈퇴 확인 모달 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말로 탈퇴하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              작성하신 모든 게시물과 활동 내역이 삭제되며 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccountConfirm();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? '처리 중...' : '탈퇴하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
