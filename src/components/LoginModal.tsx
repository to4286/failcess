import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, getAuthRedirectUrl } from '@/lib/utils';

type View = 'initial' | 'emailSignIn' | 'emailSignUp' | 'forgotPassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_FORMAT_ERROR = '올바른 이메일 양식을 입력해주세요.';
const EMAIL_REQUIRED = '이메일을 입력해주세요.';
const PASSWORD_REQUIRED = '비밀번호를 입력해주세요.';
const LOGIN_MISMATCH = '이메일 혹은 비밀번호가 일치하지 않습니다.';

// Signup
const PASSWORD_MIN_LENGTH = 8;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const EMAIL_DUPLICATE_MSG = '이미 가입한 이메일입니다.';
const EMAIL_AVAILABLE_MSG = '사용 가능한 이메일입니다.';
const CONFIRM_MISMATCH_MSG = '비밀번호가 일치하지 않습니다.';

function validateEmailFormat(value: string): boolean {
  if (!value.trim()) return true;
  return EMAIL_REGEX.test(value.trim());
}

function passwordLengthOk(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH;
}

function passwordSpecialOk(value: string): boolean {
  return SPECIAL_CHAR_REGEX.test(value);
}

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  initialLoginError?: string | null;
  clearInitialLoginError?: () => void;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function LoginModal({ open, onClose, initialLoginError, clearInitialLoginError }: LoginModalProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('initial');
  const [loginEmail, setLoginEmail] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState<string | null>(null);
  const [signupEmailError, setSignupEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  // Signup
  const [emailCheckStatus, setEmailCheckStatus] = useState<'duplicate' | 'available' | null>(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialLoginError) {
      setView('emailSignIn');
      setLoginError(initialLoginError);
      clearInitialLoginError?.();
    }
  }, [open, initialLoginError, clearInitialLoginError]);

  const resetForm = () => {
    setLoginEmail('');
    setSignupEmail('');
    setLoginPassword('');
    setSignupPassword('');
    setSignupPasswordConfirm('');
    setLoginEmailError(null);
    setSignupEmailError(null);
    setPasswordError(null);
    setLoginError(null);
    setEmailCheckStatus(null);
    setSignupError(null);
    setView('initial');
  };

  const resetOnViewChange = (nextView: View) => {
    if (nextView === 'emailSignUp') {
      setSignupEmail('');
      setSignupEmailError(null);
      setEmailCheckStatus(null);
      setSignupPassword('');
      setSignupPasswordConfirm('');
    } else if (nextView === 'emailSignIn') {
      setLoginEmail('');
      setLoginEmailError(null);
      setLoginError(null);
      setLoginPassword('');
    }
    setView(nextView);
  };

  const handleLoginEmailBlur = () => {
    const v = loginEmail.trim();
    if (!v) {
      setLoginEmailError(null);
      return;
    }
    if (!validateEmailFormat(loginEmail)) {
      setLoginEmailError(EMAIL_FORMAT_ERROR);
    } else {
      setLoginEmailError(null);
    }
  };

  const handleLoginEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLoginEmail(next);
    if (next.trim()) setLoginEmailError(null);
    setLoginError(null);
    if (loginEmailError) {
      if (!next.trim()) {
        setLoginEmailError(null);
        return;
      }
      if (validateEmailFormat(next)) {
        setLoginEmailError(null);
      }
    }
  };

  const handleSignupEmailBlur = () => {
    const v = signupEmail.trim();
    if (!v) {
      setSignupEmailError(null);
      return;
    }
    if (!validateEmailFormat(signupEmail)) {
      setSignupEmailError(EMAIL_FORMAT_ERROR);
    } else {
      setSignupEmailError(null);
    }
  };

  const handleSignupEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSignupEmail(next);
    if (next.trim()) setSignupEmailError(null);
    setSignupError(null);
    setEmailCheckStatus(null);
    if (signupEmailError) {
      if (!next.trim()) {
        setSignupEmailError(null);
        return;
      }
      if (validateEmailFormat(next)) {
        setSignupEmailError(null);
      }
    }
  };

  const checkEmailDuplicate = async () => {
    const trimmed = signupEmail.trim();
    if (!trimmed || !validateEmailFormat(signupEmail)) {
      setSignupEmailError(EMAIL_FORMAT_ERROR);
      return;
    }
    setSignupEmailError(null);
    setEmailCheckLoading(true);
    setSignupError(null);
    try {
      const { data, error } = await supabase.rpc('check_email_exists', { check_email: trimmed });
      if (error) {
        setEmailCheckStatus('duplicate');
        setSignupEmailError(error.message || EMAIL_DUPLICATE_MSG);
        return;
      }
      if (data === true) {
        setEmailCheckStatus('duplicate');
        setSignupEmailError(EMAIL_DUPLICATE_MSG);
      } else {
        setEmailCheckStatus('available');
        setSignupEmailError(null);
      }
    } catch {
      setEmailCheckStatus(null);
      setSignupEmailError('중복 확인에 실패했습니다.');
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message || 'Google 로그인에 실패했습니다.');
        return;
      }
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || 'Google 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const hasEmail = !!loginEmail.trim();
    const hasPassword = !!loginPassword;
    if (!hasEmail) setLoginEmailError(EMAIL_REQUIRED);
    else setLoginEmailError(null);
    if (!hasPassword) setPasswordError(PASSWORD_REQUIRED);
    else setPasswordError(null);
    if (!hasEmail || !hasPassword) return;

    if (!validateEmailFormat(loginEmail)) {
      setLoginEmailError(EMAIL_FORMAT_ERROR);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
      if (error) {
        setLoginError(LOGIN_MISMATCH);
        return;
      }
      if (data?.user) {
        handleClose();
        navigate('/', { replace: true });
      }
    } catch {
      setLoginError(LOGIN_MISMATCH);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    const trimmedEmail = signupEmail.trim();
    if (!trimmedEmail || !signupPassword || !signupPasswordConfirm) return;
    if (!validateEmailFormat(signupEmail)) {
      setSignupEmailError(EMAIL_FORMAT_ERROR);
      return;
    }
    if (emailCheckStatus !== 'available') return;
    if (!passwordLengthOk(signupPassword) || !passwordSpecialOk(signupPassword)) return;
    if (signupPassword !== signupPasswordConfirm) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password: signupPassword });
      if (error) {
        if (error.message?.toLowerCase().includes('already') || error.message?.toLowerCase().includes('registered')) {
          setEmailCheckStatus('duplicate');
          setSignupEmailError(EMAIL_DUPLICATE_MSG);
        }
        setSignupError(error.message || '회원가입에 실패했습니다.');
        return;
      }
      if (data?.user) {
        handleClose();
        // 가입 즉시 세션 생성 → ProfileSetupGuard의 onAuthStateChange가 감지해
        // nickname 미설정 시 ProfileSetupModal 자동 오픈 (리로드 없이)
      }
    } catch (err: any) {
      setSignupError(err?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setLoginEmailError(EMAIL_REQUIRED);
      return;
    }
    if (!validateEmailFormat(loginEmail)) {
      setLoginEmailError(EMAIL_FORMAT_ERROR);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: getAuthRedirectUrl(),
      });
      if (error) {
        toast.error(error.message || '메일 전송에 실패했습니다.');
        return;
      }
      toast.success('가입된 이메일이라면 비밀번호 재설정 메일이 발송됩니다. 메일함을 확인해주세요.');
      setView('emailSignIn');
      setLoginEmail('');
    } catch (err: any) {
      toast.error(err?.message || '메일 전송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-[400px] gap-0 p-0 overflow-hidden',
          /* 기본 닫기 버튼 숨김 → 아래 커스텀 닫기만 사용 (호버 영역 36x36만 반응) */
          '[&>button]:!hidden',
        )}
      >
        <div className="relative min-h-0 w-full">
          {/* 커스텀 닫기: 클릭/호버 영역을 36x36으로만 제한 */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-6 top-6 flex h-9 w-9 shrink-0 items-center justify-center rounded opacity-70 transition-opacity hover:opacity-100 hover:bg-muted outline-none focus:outline-none disabled:pointer-events-none"
            aria-label="닫기"
          >
            <X className="h-5 w-5 shrink-0" />
          </button>
          {/* View 1: 초기 선택 */}
          {view === 'initial' && (
          <>
            <DialogHeader className="p-6 pb-4 flex flex-col items-center space-y-1 text-center">
              <DialogTitle className="text-2xl font-bold text-foreground text-center">
                Failcess
              </DialogTitle>
              <p className="text-sm text-muted-foreground text-center">
                실패는 성공으로 가는 과정
              </p>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border border-border bg-background hover:bg-muted/50 gap-2"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <GoogleIcon />
                Google로 시작하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 bg-muted/30 hover:bg-muted/50 gap-2 text-foreground border-border"
                onClick={() => resetOnViewChange('emailSignIn')}
              >
                <Mail className="h-5 w-5" />
                이메일로 시작하기
              </Button>
            </div>
          </>
        )}

        {/* View 2: 이메일 로그인 */}
        {view === 'emailSignIn' && (
          <>
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView('initial')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded p-0 hover:bg-muted"
                  aria-label="뒤로가기"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <DialogTitle className="text-lg font-semibold">이메일 로그인</DialogTitle>
              </div>
            </DialogHeader>
            <form onSubmit={handleEmailSignIn} className="px-6 pb-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email">이메일</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="example@email.com"
                  value={loginEmail}
                  onChange={handleLoginEmailChange}
                  onBlur={handleLoginEmailBlur}
                  className={cn(
                    'w-full',
                    loginEmailError &&
                      'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                  )}
                  autoComplete="email"
                />
                {loginEmailError && (
                  <p className="text-xs text-red-500">{loginEmailError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="비밀번호"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setPasswordError(null);
                    setLoginError(null);
                  }}
                  className={cn(
                    'w-full',
                    passwordError &&
                      'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                  )}
                  autoComplete="current-password"
                />
                {passwordError && (
                  <p className="text-xs text-red-500">{passwordError}</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                  <Checkbox
                    checked={keepSignedIn}
                    onCheckedChange={(v) => setKeepSignedIn(!!v)}
                  />
                  로그인 상태 유지
                </label>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => {
                    setView('forgotPassword');
                    setLoginPassword('');
                  }}
                >
                  비밀번호 찾기
                </button>
              </div>
              {loginError && (
                <p className="text-sm text-red-500 text-center mb-2">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                아직 계정이 없으신가요?{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => resetOnViewChange('emailSignUp')}
                >
                  회원가입
                </button>
              </p>
            </form>
          </>
        )}

        {/* View 3: 회원가입 */}
        {view === 'emailSignUp' && (() => {
          const passLenOk = passwordLengthOk(signupPassword);
          const passSpecialOk = passwordSpecialOk(signupPassword);
          const passwordTouched = signupPassword.length > 0;
          const passwordBorderError = passwordTouched && (!passLenOk || !passSpecialOk);
          const confirmMatch = signupPasswordConfirm === signupPassword;
          const confirmTouched = signupPasswordConfirm.length > 0;
          const confirmError = confirmTouched && !confirmMatch;
          const canSubmit =
            emailCheckStatus === 'available' &&
            passLenOk &&
            passSpecialOk &&
            confirmMatch &&
            !!signupPassword.trim() &&
            !!signupPasswordConfirm.trim() &&
            !!signupEmail.trim();

          return (
            <>
              <DialogHeader className="p-6 pb-4">
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => resetOnViewChange('emailSignIn')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded p-0 hover:bg-muted"
                  aria-label="뒤로가기"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <DialogTitle className="text-lg font-semibold">회원가입</DialogTitle>
                </div>
              </DialogHeader>
              <form onSubmit={handleEmailSignUp} className="px-6 pb-6 space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <div className="flex gap-2">
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="example@email.com"
                      value={signupEmail}
                      onChange={handleSignupEmailChange}
                      onBlur={handleSignupEmailBlur}
                      className={cn(
                        'flex-1 min-w-0',
                        (signupEmailError || emailCheckStatus === 'duplicate') &&
                          'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                        emailCheckStatus === 'available' &&
                          'border-green-500 hover:border-green-500 focus:border-green-500 focus-visible:border-green-500',
                      )}
                      autoComplete="email"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={checkEmailDuplicate}
                      disabled={!signupEmail.trim() || !validateEmailFormat(signupEmail) || emailCheckLoading}
                      className={cn(
                        'shrink-0 cursor-pointer',
                        'bg-[#1A1A1A] hover:bg-slate-700 text-white',
                        'disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:hover:bg-gray-300 disabled:cursor-not-allowed disabled:pointer-events-auto',
                      )}
                    >
                      {emailCheckLoading ? '확인 중...' : '중복 확인'}
                    </Button>
                  </div>
                  {signupEmailError && (
                    <p className="text-xs text-red-500">{signupEmailError}</p>
                  )}
                  {emailCheckStatus === 'available' && !signupEmailError && (
                    <p className="text-xs text-green-600">{EMAIL_AVAILABLE_MSG}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="비밀번호"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className={cn(
                      'w-full',
                      passwordBorderError &&
                        'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                    )}
                    autoComplete="new-password"
                  />
                  <div className="space-y-0.5 text-xs">
                    <p
                      className={
                        signupPassword.length === 0
                          ? 'text-muted-foreground'
                          : passLenOk
                            ? 'text-green-600'
                            : 'text-red-500'
                      }
                    >
                      8자 이상
                    </p>
                    <p
                      className={
                        signupPassword.length === 0
                          ? 'text-muted-foreground'
                          : passSpecialOk
                            ? 'text-green-600'
                            : 'text-red-500'
                      }
                    >
                      특수기호 1자 이상
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password-confirm">비밀번호 확인</Label>
                  <Input
                    id="signup-password-confirm"
                    type="password"
                    placeholder="비밀번호 확인"
                    value={signupPasswordConfirm}
                    onChange={(e) => setSignupPasswordConfirm(e.target.value)}
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

                {signupError && (
                  <p className="text-sm text-red-500 text-center">{signupError}</p>
                )}

                <Button
                  type="submit"
                  className={cn(
                    'w-full cursor-pointer',
                    'bg-[#1A1A1A] hover:bg-slate-700 text-white',
                    'disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:hover:bg-gray-300 disabled:cursor-not-allowed',
                  )}
                  disabled={!canSubmit || loading}
                >
                  {loading ? '가입 중...' : '회원가입'}
                </Button>
              </form>
            </>
          );
        })()}

        {/* View 4: 비밀번호 찾기 */}
        {view === 'forgotPassword' && (
          <>
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView('emailSignIn')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded p-0 hover:bg-muted"
                  aria-label="뒤로가기"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </button>
                <DialogTitle className="text-lg font-semibold">비밀번호 찾기</DialogTitle>
              </div>
            </DialogHeader>
            <form onSubmit={handleForgotPassword} className="px-6 pb-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">이메일</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="가입한 이메일을 입력하세요"
                  value={loginEmail}
                  onChange={handleLoginEmailChange}
                  onBlur={handleLoginEmailBlur}
                  className={cn(
                    'w-full',
                    loginEmailError &&
                      'border-red-500 hover:border-red-500 focus:border-red-500 focus-visible:border-red-500',
                  )}
                  autoComplete="email"
                />
                {loginEmailError && (
                  <p className="text-xs text-red-500">{loginEmailError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '전송 중...' : '비밀번호 재설정 메일 보내기'}
              </Button>
            </form>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
