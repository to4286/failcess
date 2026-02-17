import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PASSWORD_MIN_LENGTH = 8;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const CONFIRM_MISMATCH_MSG = '비밀번호가 일치하지 않습니다.';
const SAME_AS_OLD_MSG = '기존에 사용하던 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.';

function passwordLengthOk(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH;
}

function passwordSpecialOk(value: string): boolean {
  return SPECIAL_CHAR_REGEX.test(value);
}

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ResetPasswordModal({ open, onClose }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sameAsOldPasswordError, setSameAsOldPasswordError] = useState(false);

  const passLenOk = passwordLengthOk(password);
  const passSpecialOk = passwordSpecialOk(password);
  const passwordTouched = password.length > 0;
  const passwordBorderError =
    sameAsOldPasswordError || (passwordTouched && (!passLenOk || !passSpecialOk));
  const confirmMatch = passwordConfirm === password;
  const confirmTouched = passwordConfirm.length > 0;
  const confirmError = confirmTouched && !confirmMatch;
  const canSubmit =
    passLenOk &&
    passSpecialOk &&
    confirmMatch &&
    !!password.trim() &&
    !!passwordConfirm.trim();

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (sameAsOldPasswordError) setSameAsOldPasswordError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setSameAsOldPasswordError(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) throw error;
      toast.success('변경이 완료되었습니다.', { position: 'top-center', duration: 2000 });
      setPassword('');
      setPasswordConfirm('');
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('New password should be different from the old password.')) {
        setSameAsOldPasswordError(true);
      } else {
        toast.error(msg || '비밀번호 변경에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[400px]"
        hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">비밀번호 재등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="reset-password">새 비밀번호</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="새 비밀번호"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className={cn(
                'w-full',
                passwordBorderError &&
                  'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
              )}
              autoComplete="new-password"
            />
            {sameAsOldPasswordError && (
              <p className="text-xs text-red-500">{SAME_AS_OLD_MSG}</p>
            )}
            <div className="space-y-0.5 text-xs">
              <p
                className={
                  password.length === 0
                    ? 'text-muted-foreground'
                    : passLenOk
                      ? 'text-green-500'
                      : 'text-red-500'
                }
              >
                8자 이상
              </p>
              <p
                className={
                  password.length === 0
                    ? 'text-muted-foreground'
                    : passSpecialOk
                      ? 'text-green-500'
                      : 'text-red-500'
                }
              >
                특수기호 1자 이상
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">새 비밀번호 확인</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              placeholder="새 비밀번호 확인"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={cn(
                'w-full',
                confirmError &&
                  'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
              )}
              autoComplete="new-password"
            />
            {confirmError && (
              <p className="text-xs text-red-500">{CONFIRM_MISMATCH_MSG}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#2E4166] hover:bg-[#253552] text-white"
            disabled={!canSubmit || loading}
          >
            {loading ? '변경 중...' : '변경하기'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
