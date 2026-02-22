import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarPlaceholder } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isValidImageUrl } from '@/lib/utils';
import type { CoffeeChatRequestAccepted } from '@/types';

interface CoffeeChatSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CoffeeChatRequestAccepted | null;
  onConfirmed: () => void;
}

const STORAGE_KEY = 'coffee_chat_checked_ids';

function markAsViewed(requestId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const idStr = String(requestId);
    if (!ids.includes(idStr)) ids.push(idStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

const CoffeeChatSuccessModal = ({ isOpen, onClose, request, onConfirmed }: CoffeeChatSuccessModalProps) => {
  // 모달 노출 직후 즉시 '확인 완료'로 저장 → 새로고침/재접속 시 중복 노출 방지
  useEffect(() => {
    if (isOpen && request?.id) markAsViewed(request.id);
  }, [isOpen, request?.id]);

  const handleClose = () => {
    if (request?.id) {
      markAsViewed(request.id);
      supabase
        .from('coffee_chat_requests')
        .update({ is_sender_checked: true })
        .eq('id', request.id)
        .then(({ error }) => {
          if (error) console.error('Failed to mark coffee chat as checked:', error);
        });
    }
    onClose();
    onConfirmed();
  };

  const handleCopyEmail = async () => {
    const email = request?.receiver?.email;
    if (!email) {
      toast.error('이메일 정보가 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
      toast.success('복사되었습니다', { duration: 2000 });
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = email;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('복사되었습니다', { duration: 2000 });
      } catch {
        toast.error('복사에 실패했습니다.');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleConfirm = async () => {
    if (!request?.id) {
      handleClose();
      return;
    }
    markAsViewed(request.id);
    handleClose();
    const { error } = await supabase
      .from('coffee_chat_requests')
      .update({ is_sender_checked: true })
      .eq('id', request.id);
    if (error) {
      console.error('Failed to mark coffee chat as checked:', error);
      toast.error('확인 상태 저장에 실패했습니다.');
    }
  };

  if (!isOpen || !request) return null;

  const receiver = request.receiver;
  const nickname = receiver?.nickname ?? '상대방';
  const email = receiver?.email ?? '';
  const partnerId = request.receiver_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground opacity-70 hover:opacity-70 hover:bg-transparent focus:outline-none focus:ring-0"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-3 pt-2">
          <div className="space-y-0.5 text-center">
            <h2 className="text-lg font-bold text-gray-900">
              {nickname}님이 커피챗 요청을 수락했습니다.
            </h2>
            <p className="text-sm text-muted-foreground">
              이메일을 복사해서 인사를 건네보세요.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Link
              to={partnerId ? `/user/${partnerId}` : '#'}
              className="cursor-pointer rounded-full focus:outline-none focus:ring-0"
              onClick={handleClose}
            >
              <Avatar className="h-16 w-16">
                {isValidImageUrl(receiver?.avatar_url) ? (
                  <AvatarImage src={receiver!.avatar_url!} alt={nickname} className="object-cover" />
                ) : null}
                <AvatarPlaceholder />
              </Avatar>
            </Link>
            <span className="font-medium text-gray-900">{nickname}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-3">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{email || '(이메일 없음)'}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyEmail}
              disabled={!email}
              className="shrink-0"
            >
              복사하기
            </Button>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleConfirm}
          className="w-full rounded-xl bg-[#2E4166] py-3 font-bold text-white hover:bg-[#253552]"
        >
          확인
        </Button>
      </div>
    </div>
  );
};

export default CoffeeChatSuccessModal;
