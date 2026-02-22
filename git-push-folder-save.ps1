# 폴더/저장 관련 작업 Git 커밋
# 실행: .\git-push-folder-save.ps1

$files = @(
    "src/components/FolderSelectModal.tsx",
    "src/components/StoryCard.tsx",
    "src/pages/MyPage.tsx",
    "src/pages/UserProfile.tsx",
    "supabase/migrations/20250221110000_profile_folder_content_rpc.sql"
)

Write-Host "폴더/저장 관련 파일 스테이징 중..." -ForegroundColor Cyan
foreach ($f in $files) {
    if (Test-Path $f) {
        git add $f
        Write-Host "  + $f" -ForegroundColor Green
    }
}

Write-Host "`n커밋 중..." -ForegroundColor Cyan
git commit -m "feat: 폴더/저장 관리 개선 및 타 유저 프로필 폴더 UI" `
  -m "- 마이페이지 저장한 게시물: saves 개수만 표시 (posts 제외)" `
  -m "- 폴더 이동 시 기존/이동 폴더 카운트 실시간 업데이트" `
  -m "- 최근 게시물 섹션도 저장 취소/이동 시 즉시 반영" `
  -m "- FolderSelectModal: 현재 폴더 제외, 빈 리스트 시 UI 정리" `
  -m "- 타 유저 프로필: 저장한 게시물 노출, 폴더 UI 마이페이지와 동일" `
  -m "- RPC: get_profile_user_saved_posts, get_profile_folder_total_counts"

Write-Host "`n푸시할까요? (y/n): " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host
if ($confirm -eq "y" -or $confirm -eq "Y") {
    git push
    Write-Host "푸시 완료." -ForegroundColor Green
} else {
    Write-Host "커밋만 완료됨. 푸시는 나중에 git push 로 하세요." -ForegroundColor Yellow
}
