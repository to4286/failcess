# 프로필 사진 업로드 404 수정사항 Git 푸시

git add src/components/ChangeAvatarModal.tsx, src/components/Header.tsx, src/components/auth/ProfileSetupModal.tsx

git commit -m "fix: 프로필 사진 업로드 후 404 에러 방지

- ChangeAvatarModal/ProfileSetupModal: CDN 전파 대기(2초) 후 reload
- 아바타 URL 캐시버스팅(?t=timestamp) 적용
- Header 아바타 진단 fetch 제거"

git push origin main
