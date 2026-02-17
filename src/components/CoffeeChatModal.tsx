import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CoffeeChatPerson = { id: string; nickname: string };

interface CoffeeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sender: CoffeeChatPerson;
  receiver: CoffeeChatPerson;
}

const CoffeeChatModal = ({ isOpen, onClose, sender, receiver }: CoffeeChatModalProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('coffee_chat_requests').insert({
        sender_id: sender.id,
        receiver_id: receiver.id,
        message: message.trim() || null,
        status: 'pending',
      });

      if (error) throw error;
      const { error: rpcError } = await supabase.rpc('create_coffee_chat_notification', {
        p_receiver_id: receiver.id,
        p_sender_id: sender.id,
        p_type: 'coffee_request',
      });
      if (rpcError) console.warn('커피챗 알림 생성 실패 (RPC 미적용 가능):', rpcError);
      onClose();
      setMessage('');
      toast.success(`${receiver.nickname}님에게 커피챗을 요청했습니다.`, {
        position: 'top-center',
        duration: 2000,
      });
    } catch (err) {
      console.error('Coffee chat request error:', err);
      toast.error('요청 전송에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-center text-lg font-bold text-gray-900">
          {receiver.nickname}님에게 커피챗 요청
        </h2>

        <textarea
          className="h-40 w-full resize-none rounded-xl bg-gray-100 p-4 focus:outline-none focus:ring-2 focus:ring-[#2E4166]"
          placeholder="안녕하세요, 커피챗 나누고 싶어요:)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-4 w-full rounded-xl bg-[#2E4166] py-3 font-bold text-white hover:bg-[#253552] disabled:opacity-70"
        >
          {isSubmitting ? '전송 중...' : '요청 보내기'}
        </button>
      </div>
    </div>
  );
};

export default CoffeeChatModal;
