# LoveMusic

GitHub Pages에서 실행되는 브라우저 기반 음악 비주얼라이저

- 이미지와 음악은 브라우저 안에서 처리
- 미리보기 재생 / 탐색 바 / 볼륨 조절
- 앨범 이미지와 LP 애니메이션
- 파형 애니메이션
- MP4 추출: WebM(VP8 + Opus)을 중간 영상으로 만든 뒤 H.264 + AAC MP4로 변환
- 최종 MP4는 `faststart` 옵션을 사용해 다운로드 후 재생 바를 자유롭게 이동할 수 있음
- MP4 변환은 GitHub Pages의 Worker 제한을 피하기 위해 CDN Worker를 같은 출처 Blob Worker로 감싸서 실행

## 중요

MP4 변환 엔진은 처음 MP4 추출할 때 CDN에서 불러오므로 인터넷 연결이 필요해.
긴 영상에서 브라우저 메모리가 부족해지는 것을 줄이기 위해 중간 녹화 비트레이트는 6 Mbps로 설정되어 있어.

GitHub Pages에 `index.html`, `style.css`, `app.js`를 올리면 실행할 수 있어.
