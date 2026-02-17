# 회원탈퇴 401 Unauthorized 원인 및 해결

## 원인

Supabase Edge Function **게이트웨이**에서 JWT 검증이 실패하면서, **함수 코드가 실행되기 전에** 401을 반환하고 있었습니다.

- Supabase Auth가 Legacy HS256에서 **ES256(비대칭 키)** 로 전환됨
- 게이트웨이의 기본 `verify_jwt`가 ES256 JWT를 제대로 검증하지 못하는 경우가 있음
- 이 경우 클라이언트가 보낸 JWT가 유효해도 게이트웨이에서 401 반환

## 해결

`supabase/config.toml`에 `verify_jwt = false`를 설정해 **게이트웨이 JWT 검증을 건너뜁니다**.

- 게이트웨이 검증을 끄더라도, `index.ts` 내부에서 `getUser(jwt)`로 직접 검증하므로 보안은 유지됩니다.
- 인증되지 않은 요청은 여전히 401로 거부됩니다.

## 배포

```bash
supabase link
npx supabase functions deploy delete-user-account
```

config.toml이 있으면 `verify_jwt = false`가 자동으로 적용됩니다.
