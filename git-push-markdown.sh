#!/bin/bash
# 마크다운 문법 관련 변경사항만 Git에 커밋
# 실행: ./git-push-markdown.sh

FILES=(
  "src/index.css"
  "src/lib/constants.ts"
  "src/pages/PostDetail.tsx"
  "src/pages/WritePage.tsx"
)

echo "마크다운 관련 파일 스테이징 중..."
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    git add "$f"
    echo "  + $f"
  fi
done

git commit -m "fix: 마크다운 에디터 개선

- 문단 간격 통일 (PROSE_CONTENT_CLASS)
- Enter 시 기본 문단/리스트 동작 (HardBreak 제거)
- 빈 리스트 Enter 두 번 시 탈출
- # ## ### 제목 크기 구분 (Heading getAttributes 수정)
- prose h1/h2/h3 직접 스타일 적용 (index.css)"

echo ""
read -p "푸시할까요? (y/n): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
  git push
  echo "푸시 완료."
else
  echo "푸시 취소. 커밋만 완료됨."
fi
