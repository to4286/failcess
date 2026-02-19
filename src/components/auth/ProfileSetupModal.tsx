import { useState, useRef } from 'react';
import { Camera, X, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { INTEREST_TAGS } from '@/lib/constants';

const AVATAR_ACCEPT = '.jpg,.jpeg,.png';
const AVATARS_BUCKET = 'avatars';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const HINT_TEXT = '5MB 이하 JPEG, JPG, PNG 파일만 업로드 가능합니다.';
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;

function getSafeExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_EXTENSIONS.includes(ext as any) ? ext : 'jpg';
}

function buildAvatarPath(userId: string, ext: string): string {
  const safeId = String(userId).replace(/[/\\]/g, '');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${safeId}/${unique}.${ext}`;
}

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

interface ProfileSetupModalProps {
  open: boolean;
  onSuccess: () => void;
}

export default function ProfileSetupModal({ open, onSuccess }: ProfileSetupModalProps) {
  const [nickname, setNickname] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isAvatarError, setIsAvatarError] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value);
    if (nicknameError) setNicknameError(null);
  };
  const handleNicknameBlur = () => {
    setNicknameError(validateNickname(nickname));
  };

  const handleJobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setJobTitle(next);
    setJobError(validateJob(next));
  };
  const handleJobBlur = () => {
    setJobError(validateJob(jobTitle));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const lower = selectedFile.name.toLowerCase();
    const validExt =
      lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
    if (!validExt) {
      setIsAvatarError(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setIsAvatarError(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setIsAvatarError(false);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(selectedFile);
    setAvatarPreview(URL.createObjectURL(selectedFile));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarRemove = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setIsAvatarError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const trimmedNickname = nickname.trim();
    const trimmedJob = jobTitle.trim();
    if (!trimmedNickname || !trimmedJob) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError('로그인 세션이 만료되었습니다.');
        return;
      }

      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = getSafeExtension(avatarFile.name);
        const userId = String(user?.id || '').trim();
        if (!userId) {
          setSubmitError('사용자 정보를 확인할 수 없습니다.');
          return;
        }
        const filePath = buildAvatarPath(userId, ext);
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        const { error: uploadError } = await supabase.storage
          .from(AVATARS_BUCKET)
          .upload(filePath, avatarFile, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          });

        if (uploadError) {
          setSubmitError(uploadError.message || '프로필 사진 업로드에 실패했습니다.');
          return;
        }
        const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            nickname: trimmedNickname,
            job_title: trimmedJob || null,
            bio: bio.trim() || null,
            avatar_url: avatarUrl,
            interests: selectedInterests.length > 0 ? selectedInterests : [],
          },
          { onConflict: 'id' },
        );

      if (upsertError) {
        setSubmitError(upsertError.message || '프로필 저장에 실패했습니다.');
        return;
      }
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      onSuccess();
      window.location.reload();
    } catch (err: any) {
      setSubmitError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const trimmedNickname = nickname.trim();
  const trimmedJob = jobTitle.trim();
  const canSubmit =
    trimmedNickname.length > 0 &&
    !nicknameError &&
    trimmedJob.length > 0 &&
    !jobError &&
    selectedInterests.length >= 1 &&
    !isAvatarError;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl text-center">프로필을 완성해주세요.</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* 프로필 사진 (ChangeAvatarModal과 동일 로직) */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {avatarPreview ? (
                  <Avatar className="h-24 w-24 border-2 border-border object-cover">
                    <AvatarImage src={avatarPreview} alt="미리보기" className="object-cover" />
                    <AvatarPlaceholder />
                  </Avatar>
                ) : (
                  <span
                    className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-border bg-gray-200"
                    aria-hidden
                  >
                    <User className="h-12 w-12 text-white" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="사진 선택"
              >
                <Camera className="h-4 w-4" />
              </button>
              {avatarPreview ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvatarRemove();
                  }}
                  className="absolute -top-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-slate-800 text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label="사진 삭제"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={handleAvatarChange}
            />
            <p
              className={cn(
                'text-xs text-center',
                isAvatarError ? 'text-red-500' : 'text-gray-500',
              )}
            >
              {HINT_TEXT}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-nickname">닉네임</Label>
            <Input
              id="profile-nickname"
              value={nickname}
              onChange={handleNicknameChange}
              onBlur={handleNicknameBlur}
              placeholder="닉네임"
              className={cn(
                'w-full',
                nicknameError &&
                  'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
              )}
            />
            {nicknameError && (
              <p className="text-xs text-red-500">{nicknameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-job">직업</Label>
            <Input
              id="profile-job"
              value={jobTitle}
              onChange={handleJobChange}
              onBlur={handleJobBlur}
              placeholder="직업"
              className={cn(
                'w-full',
                jobError &&
                  'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
              )}
            />
            {jobError && <p className="text-xs text-red-500">{jobError}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label>관심사</Label>
              <span className="text-xs text-gray-500">(5개까지 선택 가능)</span>
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-bio">한 줄 소개 (선택)</Label>
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="한 줄 소개"
              className="min-h-[80px] w-full resize-none"
              rows={3}
            />
          </div>

          {submitError && (
            <p className={cn('text-sm text-red-500 text-center')}>{submitError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit || loading}
          >
            {loading ? '저장 중...' : '작성완료'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
