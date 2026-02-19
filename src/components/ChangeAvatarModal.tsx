import { useState, useRef, useEffect } from 'react';
import { X, Camera, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const AVATAR_ACCEPT = '.jpg,.jpeg,.png';
const AVATARS_BUCKET = 'avatars';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;

/** 확장자 화이트리스트 적용, 경로에 사용할 안전한 확장자 반환 */
function getSafeExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_EXTENSIONS.includes(ext as any) ? ext : 'jpg';
}

/** RLS 정책과 일치하는 업로드 경로 생성 (userId/고유파일명.확장자) */
function buildAvatarPath(userId: string, ext: string): string {
  const safeId = String(userId).replace(/[/\\]/g, '');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${safeId}/${unique}.${ext}`;
}

const HINT_TEXT = '5MB 이하 JPEG, JPG, PNG 파일만 업로드 가능합니다.';

interface ChangeAvatarModalProps {
  open: boolean;
  onClose: () => void;
  currentAvatarUrl: string | null;
  onSuccess: () => void;
}

export default function ChangeAvatarModal({
  open,
  onClose,
  currentAvatarUrl,
  onSuccess,
}: ChangeAvatarModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayImage = removed ? null : (preview ?? currentAvatarUrl);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFile(null);
      setRemoved(false);
      setIsError(false);
      setSubmitError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const lower = selectedFile.name.toLowerCase();
    const validExt =
      lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
    if (!validExt) {
      setIsError(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setIsError(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsError(false);
    setRemoved(false);
    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setRemoved(true);
    setIsError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    const hasChanges = file !== null || removed;
    if (!hasChanges) {
      onClose();
      return;
    }

    setSubmitError(null);
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError('로그인 세션이 만료되었습니다.');
        return;
      }

      let avatarUrl: string | null = null;
      if (file) {
        const ext = getSafeExtension(file.name);
        const userId = String(user?.id || '').trim();
        if (!userId) {
          setSubmitError('사용자 정보를 확인할 수 없습니다.');
          return;
        }
        const filePath = buildAvatarPath(userId, ext);
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        const { error: uploadError } = await supabase.storage
          .from(AVATARS_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          });

        if (uploadError) {
          const msg = uploadError.message || '프로필 사진 업로드에 실패했습니다.';
          const hint = uploadError.message?.toLowerCase().includes('bucket') || uploadError.message?.toLowerCase().includes('not found')
            ? ' Supabase Storage에 avatars 버킷이 Public으로 설정되어 있는지 확인해주세요.'
            : '';
          setSubmitError(msg + hint);
          return;
        }
        const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (upsertError) {
        setSubmitError(upsertError.message || '프로필 사진 저장에 실패했습니다.');
        return;
      }

      window.dispatchEvent(new CustomEvent('profileUpdated'));
      onSuccess();
      onClose();
      window.location.reload();
    } catch (err: any) {
      setSubmitError(err?.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = file !== null || removed;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <div className="relative">
          <DialogHeader className="text-center pr-8">
            <DialogTitle className="text-xl text-center">프로필 사진 등록</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 flex h-9 w-9 shrink-0 items-center justify-center rounded p-0 opacity-70 transition-opacity hover:opacity-100 hover:bg-muted outline-none focus:outline-none disabled:pointer-events-none"
            aria-label="닫기"
          >
            <X className="h-5 w-5 shrink-0" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {displayImage ? (
                <Avatar className="h-32 w-32 border-2 border-border object-cover">
                  <AvatarImage src={displayImage} alt="미리보기" className="object-cover" />
                  <AvatarPlaceholder />
                </Avatar>
              ) : (
                <span
                  className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-2 border-border bg-gray-200"
                  aria-hidden
                >
                  <User className="h-16 w-16 text-white" />
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
            {displayImage ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="absolute -top-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-slate-800 text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="사진 삭제"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <p
            className={cn(
              'text-xs text-center',
              isError ? 'text-red-500' : 'text-gray-500',
            )}
          >
            {HINT_TEXT}
          </p>

          {submitError && (
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={handleSave}
            disabled={loading || isError}
          >
            {loading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
