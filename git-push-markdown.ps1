# 마크다운 문법 관련 변경사항만 Git에 커밋
# PowerShell에서 실행: .\git-push-markdown.ps1

git add src/index.css src/lib/constants.ts src/pages/PostDetail.tsx src/pages/WritePage.tsx

git commit -m "fix: 마크다운 에디터 개선" -m "- 문단 간격 통일 (PROSE_CONTENT_CLASS)" -m "- Enter 시 기본 문단/리스트 동작 (HardBreak 제거)" -m "- 빈 리스트 Enter 두 번 시 탈출" -m "- # ## ### 제목 크기 구분 (Heading getAttributes 수정)" -m "- prose h1/h2/h3 직접 스타일 적용 (index.css)"

Write-Host "`n푸시할까요? (y/n): " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host
if ($confirm -eq "y" -or $confirm -eq "Y") {
    git push
    Write-Host "푸시 완료." -ForegroundColor Green
} else {
    Write-Host "커밋만 완료됨. 푸시는 나중에 git push 로 하세요." -ForegroundColor Yellow
}
