@echo off
chcp 65001 >nul
REM 폴더/저장 관련 작업 Git 커밋
REM 실행: git-push-folder-save.bat

echo 폴더/저장 관련 파일 스테이징 중...
git add src/components/FolderSelectModal.tsx
git add src/components/StoryCard.tsx
git add src/pages/MyPage.tsx
git add src/pages/UserProfile.tsx
git add supabase/migrations/20250221110000_profile_folder_content_rpc.sql

git commit -m "feat: 폴더/저장 관리 개선 및 타 유저 프로필 폴더 UI" -m "- 마이페이지 저장한 게시물: saves 개수만 표시 (posts 제외)" -m "- 폴더 이동 시 기존/이동 폴더 카운트 실시간 업데이트" -m "- 최근 게시물 섹션도 저장 취소/이동 시 즉시 반영" -m "- FolderSelectModal: 현재 폴더 제외, 빈 리스트 시 UI 정리" -m "- 타 유저 프로필: 저장한 게시물 노출, 폴더 UI 마이페이지와 동일" -m "- RPC: get_profile_user_saved_posts, get_profile_folder_total_counts"

echo.
set /p confirm="푸시할까요? (y/n): "
if /i "%confirm%"=="y" (
  git push
  echo 푸시 완료.
) else (
  echo 커밋만 완료됨. 푸시는 나중에 git push 로 하세요.
)
