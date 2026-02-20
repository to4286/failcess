# 게시물 이미지(post-images) Storage 설정

글쓰기 화면에서 이미지 업로드 시 **"new row violates row-level security policy"** 에러가 발생하면, Supabase Storage의 `post-images` 버킷이 없거나 **RLS 정책**이 없을 가능성이 높습니다.

## 원인

- `post-images` 버킷이 생성되지 않았거나
- Storage RLS 정책이 없어 인증된 사용자의 업로드가 차단됨

## 해결 방법

### 1. 마이그레이션 적용 (권장)

**프로덕션 Supabase 프로젝트**에 연결한 뒤:

```bash
# 프로덕션 프로젝트 연결 (이미 되어 있다면 생략)
supabase link --project-ref <프로젝트_REF>

# 마이그레이션 적용
supabase db push
```

`20250220110000_create_post_images_bucket.sql` 마이그레이션이 `post-images` 버킷을 생성하고 RLS 정책을 설정합니다.

### 2. Supabase Dashboard에서 수동 설정

마이그레이션이 실패하면 Dashboard에서 직접 설정하세요.

1. [Supabase Dashboard](https://supabase.com/dashboard) → **프로덕션 프로젝트** 선택
2. **Storage** 메뉴 이동
3. **New bucket** 클릭
4. 설정:
   - **Name**: `post-images`
   - **Public bucket**: **체크** (필수)
5. 생성 후 **Policies** 탭에서 새 정책 추가:
   - **INSERT**: `authenticated` 사용자만, `post-images` 버킷에 업로드 가능
   - **SELECT**: `public` (모든 사용자 읽기 가능)

### 3. 기존 버킷이 Private인 경우

1. Storage → `post-images` 버킷 선택
2. 버킷 옆 **⋮** 메뉴 → **Make public** 선택

## 확인

1. Supabase Dashboard → Storage → `post-images` 버킷이 있고 **Public** 표시가 있는지 확인
2. 글쓰기 화면에서 이미지 업로드(드래그앤드롭 또는 붙여넣기) 테스트
3. 에러 없이 이미지가 삽입되는지 확인
