# 프로필 사진(avatars) Storage 설정

프로필 사진 변경 후 저장 시 **404 NOT_FOUND** 에러가 발생하면, Supabase Storage의 `avatars` 버킷이 없거나 **비공개(Private)** 상태일 가능성이 높습니다.

## 왜 로컬에서는 되고 메인(프로덕션)에서는 안 되나요?

- **로컬**: `supabase start`로 띄운 로컬 Supabase에는 마이그레이션이 적용되어 `avatars` 버킷이 Public으로 생성됨
- **프로덕션(failcess.com 등)**: 배포 환경에서 사용하는 Supabase 프로젝트에는 **별도로 마이그레이션을 적용해야 함**
- 같은 코드, 같은 DB를 쓰더라도 **Storage 버킷 설정은 프로젝트별로 적용**됩니다

→ **프로덕션 Supabase 프로젝트**에 아래 설정을 반드시 적용하세요.

## 원인

- `getPublicUrl()`로 생성한 URL은 **버킷이 Public일 때만** 정상 동작합니다.
- 버킷이 없거나 Private이면 이미지 요청 시 404가 반환됩니다.

## 해결 방법

### 1. 마이그레이션 적용 (권장)

**프로덕션 Supabase 프로젝트**에 연결한 뒤:

```bash
# 프로덕션 프로젝트 연결 (이미 되어 있다면 생략)
supabase link --project-ref <프로젝트_REF>

# 마이그레이션 적용
supabase db push
```

`20250220100000_create_avatars_bucket.sql` 마이그레이션이 `avatars` 버킷을 생성하고 Public으로 설정합니다.

### 2. Supabase Dashboard에서 수동 설정

마이그레이션이 실패하면 Dashboard에서 직접 설정하세요.

1. [Supabase Dashboard](https://supabase.com/dashboard) → **프로덕션 프로젝트** 선택
2. **Storage** 메뉴 이동
3. **New bucket** 클릭
4. 설정:
   - **Name**: `avatars`
   - **Public bucket**: **체크** (필수)
5. 생성 후 **Policies** 탭에서:
   - **INSERT**: `authenticated` 사용자만, 자신의 폴더(`auth.uid()`와 일치하는 경로)에 업로드 가능
   - **SELECT**: `public` (모든 사용자 읽기 가능)

### 3. 기존 버킷이 Private인 경우

1. Storage → `avatars` 버킷 선택
2. 버킷 옆 **⋮** 메뉴 → **Make public** 선택

## 확인

1. Supabase Dashboard → Storage → `avatars` 버킷이 있고 **Public** 표시가 있는지 확인
2. 프로필 사진을 다시 변경·저장
3. 메인 페이지(헤더)에서 아바타가 정상 표시되는지 확인
