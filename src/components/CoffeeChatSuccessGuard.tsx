import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import CoffeeChatSuccessModal from '@/components/CoffeeChatSuccessModal';
import type { CoffeeChatRequestAccepted } from '@/types';

const STORAGE_KEY = 'coffee_chat_checked_ids';

function getCheckedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: unknown[] = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

/**
 * 전역: 내가 보낸 요청 중 status='accepted' && is_sender_checked=false 인 항목이 있으면
 * 수락 알림 모달(CoffeeChatSuccessModal)을 띄운다.
 * 확인 후 localStorage에 저장하여 새로고침/재로그인 시에도 한 번만 표시.
 */
const CoffeeChatSuccessGuard = () => {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [pendingList, setPendingList] = useState<CoffeeChatRequestAccepted[]>([]);
  const current = pendingList[0] ?? null;
  const confirmedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadSession = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s ? { user: { id: s.user.id } } : null);
    };
    loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? { user: { id: s.user.id } } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setPendingList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from('coffee_chat_requests')
        .select('id, sender_id, receiver_id, message, status, created_at, is_sender_checked')
        .eq('sender_id', session.user.id)
        .eq('status', 'accepted')
        .eq('is_sender_checked', false)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error || !rows?.length) {
        setPendingList([]);
        return;
      }
      const receiverIds = [...new Set(rows.map((r: any) => r.receiver_id))];
      const profileMap = new Map<string, { nickname: string | null; avatar_url: string | null; email: string | null }>();
      for (const rid of receiverIds) {
        const { data } = await supabase.rpc('get_coffee_chat_partner_profile', { p_partner_id: rid });
        const row = Array.isArray(data) && data[0] ? data[0] : null;
        profileMap.set(rid, {
          nickname: row?.nickname ?? null,
          avatar_url: row?.avatar_url ?? null,
          email: row?.email ?? null,
        });
      }
      const merged: CoffeeChatRequestAccepted[] = rows.map((r: any) => ({
        ...r,
        receiver: profileMap.get(r.receiver_id) ?? { nickname: null, avatar_url: null, email: null },
      }));
      const checkedIds = getCheckedIds();
      const filtered = merged.filter((r) => !checkedIds.has(String(r.id)) && !confirmedIdsRef.current.has(String(r.id)));
      setPendingList(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const handleConfirmed = useCallback(() => {
    const id = current?.id;
    if (id) confirmedIdsRef.current.add(String(id));
    setPendingList((prev) => prev.slice(1));
  }, [current?.id]);

  return (
    <CoffeeChatSuccessModal
      isOpen={!!current}
      onClose={handleConfirmed}
      request={current}
      onConfirmed={handleConfirmed}
    />
  );
};

export default CoffeeChatSuccessGuard;
