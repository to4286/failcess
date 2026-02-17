import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LoginModal from '@/components/LoginModal';
import ResetPasswordModal from '@/components/ResetPasswordModal';

const LOGIN_MISMATCH = '이메일 혹은 비밀번호가 일치하지 않습니다.';

type AuthModalContextValue = {
  openAuthModal: () => void;
  openAuthModalWithError: (error: string) => void;
  closeAuthModal: () => void;
  isOpen: boolean;
  initialLoginError: string | null;
  clearInitialLoginError: () => void;
};

const defaultValue: AuthModalContextValue = {
  openAuthModal: () => {},
  openAuthModalWithError: () => {},
  closeAuthModal: () => {},
  isOpen: false,
  initialLoginError: null,
  clearInitialLoginError: () => {},
};

const PENDING_PASSWORD_RESET_KEY = 'pendingPasswordReset';

export const AuthModalContext = createContext<AuthModalContextValue>(defaultValue);

export const AuthModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [initialLoginError, setInitialLoginError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const openAuthModal = useCallback(() => setIsOpen(true), []);
  const openAuthModalWithError = useCallback((error: string) => {
    setInitialLoginError(error);
    setIsOpen(true);
  }, []);
  const closeAuthModal = useCallback(() => {
    setIsOpen(false);
    setInitialLoginError(null);
  }, []);
  const clearInitialLoginError = useCallback(() => setInitialLoginError(null), []);

  const closeResetPasswordModal = useCallback(() => {
    localStorage.removeItem(PENDING_PASSWORD_RESET_KEY);
    setShowResetPasswordModal(false);
  }, []);

  useEffect(() => {
    const checkPendingReset = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const pending = localStorage.getItem(PENDING_PASSWORD_RESET_KEY) === 'true';
      if (session?.user && pending) {
        setShowResetPasswordModal(true);
      }
    };
    checkPendingReset();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        localStorage.setItem(PENDING_PASSWORD_RESET_KEY, 'true');
        setShowResetPasswordModal(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('loginError') === 'credentials') {
      navigate(location.pathname, { replace: true });
      openAuthModalWithError(LOGIN_MISMATCH);
    }
  }, [location.search, location.pathname, navigate, openAuthModalWithError]);

  return (
    <AuthModalContext.Provider
      value={{
        openAuthModal,
        openAuthModalWithError,
        closeAuthModal,
        isOpen,
        initialLoginError,
        clearInitialLoginError,
      }}
    >
      {children}
      <LoginModal
        open={isOpen}
        onClose={closeAuthModal}
        initialLoginError={initialLoginError}
        clearInitialLoginError={clearInitialLoginError}
      />
      <ResetPasswordModal
        open={showResetPasswordModal}
        onClose={closeResetPasswordModal}
      />
    </AuthModalContext.Provider>
  );
};
