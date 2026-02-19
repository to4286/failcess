# OAuth 리다이렉트 URL 설정

구글 로그인 후 `localhost`로 리다이렉트되는 문제를 해결하려면 Supabase 대시보드 설정을 확인하세요.

## 1. Supabase 대시보드 설정

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **URL Configuration**
3. 다음 항목을 확인/수정:

### Site URL
- **프로덕션**: `https://failcess.com` (localhost가 아닌 실제 도메인)
- **개발**: `http://localhost:5173` (또는 사용 중인 포트)

### Redirect URLs
다음 URL을 **정확히** 추가하세요 (와일드카드 사용 시 `https://failcess.com/*` 형태):

- `https://failcess.com/`
- `https://failcess.com`
- `http://localhost:5173/` (로컬 개발용)
- `http://localhost:5173` (로컬 개발용)

> ⚠️ `redirectTo`로 전달하는 URL이 이 목록에 **정확히** 포함되어야 합니다. 없으면 Supabase가 Site URL로 리다이렉트합니다.

## 2. 환경 변수 (선택)

프로덕션 빌드 시 리다이렉트 URL을 고정하려면 `.env` 또는 `.env.production`에 추가:

```
VITE_SITE_URL=https://failcess.com
```

설정하지 않으면 `window.location.origin`이 사용됩니다 (현재 접속 도메인 기준).

## 3. 코드 동작

- `getAuthRedirectUrl()`: `VITE_SITE_URL`이 있으면 해당 값, 없으면 `window.location.origin` 사용
- failcess.com에서 로그인 시 → `https://failcess.com/`으로 복귀
- localhost에서 로그인 시 → `http://localhost:5173/`으로 복귀
