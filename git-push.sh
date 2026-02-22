#!/bin/bash
# 방금 수정한 줄바꿈 방식 변경사항을 Git에 올리는 스크립트

git add src/lib/constants.ts src/pages/WritePage.tsx package.json package-lock.json
git status
git commit -m "feat: 단순 줄바꿈(<br>) 방식으로 통일 + Enter 시 HardBreak 적용

- 에디터: Enter 키로 새 문단 대신 <br> 삽입 (HardBreak 확장)
- PROSE_CONTENT_CLASS: p margin 0, line-height 1.6, whitespace-pre-wrap
- 글쓰기 화면과 상세 페이지 스타일 통일"
git push
