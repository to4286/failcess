@echo off
chcp 65001 >nul
REM 마크다운 문법 관련 변경사항만 Git에 커밋
REM 실행: git-push-markdown.bat

echo 마크다운 관련 파일 스테이징 중...
git add src/index.css
git add src/lib/constants.ts
git add src/pages/PostDetail.tsx
git add src/pages/WritePage.tsx

git commit -m "fix: 마크다운 에디터 개선" -m "- 문단 간격 통일 (PROSE_CONTENT_CLASS)" -m "- Enter 시 기본 문단/리스트 동작 (HardBreak 제거)" -m "- 빈 리스트 Enter 두 번 시 탈출" -m "- # ## ### 제목 크기 구분 (Heading getAttributes 수정)" -m "- prose h1/h2/h3 직접 스타일 적용 (index.css)"

echo.
set /p confirm="푸시할까요? (y/n): "
if /i "%confirm%"=="y" (
  git push
  echo 푸시 완료.
) else (
  echo 푸시 취소. 커밋만 완료됨.
)
