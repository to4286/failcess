# Vercel 배포 설정 체크리스트

## ⚠️ 중요: Vite 프로젝트는 `VITE_` 접두사 사용 (Next.js의 `NEXT_PUBLIC_` 아님)

이 프로젝트는 **Vite + React**입니다. Next.js가 아니므로 `NEXT_PUBLIC_*` 변수는 **인식되지 않습니다**.

| ❌ 잘못됨 (Next.js용) | ✅ 올바름 (Vite용) |
|----------------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `VITE_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |

---

## 1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

다음 환경 변수를 **Production** 환경에 설정하세요:

| 변수명 | 값 | 필수 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://zdehclxdcblkoqhsopbt.supabase.co` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | (Supabase Dashboard → Settings → API에서 anon public 키) | ✅ |
| `VITE_SITE_URL` | `https://www.failcess.com` 또는 `https://failcess.com` | ⚠️ 권장 |

### VITE_SITE_URL 설정 시 주의
- 실제 접속 도메인과 **정확히** 일치해야 함
- `www` 사용 시: `https://www.failcess.com`
- `www` 미사용 시: `https://failcess.com`
- 끝에 `/` 붙이지 않음

---

## 2. Vercel 대시보드 → 프로젝트 → Settings → General

### Build & Development Settings
- **Framework Preset**: Vite (자동 감지됨)
- **Build Command**: `npm run build` (기본값)
- **Output Directory**: `dist` (Vite 기본값)
- **Install Command**: `npm install` (기본값)

### Root Directory
- 프로젝트 루트가 맞는지 확인 (보통 비워둠)

---

## 3. Supabase 대시보드 → Authentication → URL Configuration

### Site URL
- 프로덕션: `https://www.failcess.com` 또는 `https://failcess.com` (실제 도메인과 동일하게)

### Redirect URLs
다음 URL을 **모두** 추가하세요 (실제 사용 도메인 기준):

```
https://www.failcess.com
https://www.failcess.com/
https://www.failcess.com/*
https://failcess.com
https://failcess.com/
https://failcess.com/*
http://localhost:5173
http://localhost:5173/
```

> `www`와 비-www 둘 다 사용한다면 둘 다 추가

---

## 4. Vercel 도메인 설정

### Domains
- **failcess.com** 또는 **www.failcess.com** 추가
- Primary 도메인으로 설정

---

## 5. 코드에서 확인된 사항

### ✅ 이미 적용됨
- `vercel.json` — SPA 라우팅 rewrite (`/(.*)` → `/index.html`)
- `getAuthRedirectUrl()` — `VITE_SITE_URL` 우선 사용
- Supabase client — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 사용

### ⚠️ VITE_SITE_URL 미설정 시
- `window.location.origin` 사용 (현재 접속 URL 기준)
- Vercel 프리뷰 URL(`*.vercel.app`)에서 로그인 시 해당 URL로 리다이렉트됨
- 프로덕션 도메인으로 고정하려면 `VITE_SITE_URL` 설정 권장

---

## 6. /mypage 404 (X-Vercel-Error: NOT_FOUND) 해결

**원인**: Vercel이 `/mypage`를 실제 파일로 찾다가 없어서 404 반환. SPA는 모든 경로를 `index.html`로 보내야 함.

**확인 순서**:
1. **vercel.json이 배포에 포함되었는지** → GitHub에 push했는지 확인
2. **Vercel 대시보드 → Settings → General → Root Directory** → 비어 있거나 `.`인지 (다른 경로면 vercel.json 위치 확인)
3. **Vercel 대시보드 → Settings → General → Output Directory** → `dist`로 설정
4. **환경 변수 수정 후** → 반드시 **Redeploy** (Deployments → ⋮ → Redeploy)

---

## 7. 문제 발생 시 확인 순서

1. **404 on /mypage 등** → 위 6번 확인, `vercel.json` rewrite 확인, 재배포
2. **로그인 후 잘못된 URL로 리다이렉트** → Supabase Redirect URLs + `VITE_SITE_URL` 확인
3. **Supabase 연결 실패** → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 확인
4. **환경 변수 변경 후** → Vercel에서 **Redeploy** 필요 (캐시 무효화)
