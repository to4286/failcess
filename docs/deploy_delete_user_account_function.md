# 회원 탈퇴 Edge Function 배포

탈퇴 시 Supabase Auth에서 계정을 완전히 삭제하려면 Edge Function을 배포해야 합니다.

## 배포 방법

```bash
supabase functions deploy delete-user-account
```

## 필요한 환경 변수

Edge Function은 Supabase에서 자동으로 다음 환경 변수를 제공합니다:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

로컬 테스트 시:
```bash
supabase functions serve delete-user-account
```

## 동작 흐름

1. 클라이언트: `supabase.functions.invoke('delete-user-account')` 호출 (현재 세션 JWT 자동 전달)
2. Edge Function: JWT 검증 → `delete_user_account` RPC 호출 (profiles, posts 등 삭제)
3. Edge Function: `auth.admin.deleteUser(userId)` 호출 (auth.users에서 계정 삭제)
4. 클라이언트: signOut → localStorage.clear → 메인 페이지 이동
