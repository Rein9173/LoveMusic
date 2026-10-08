# LoveMusic

GitHub Pages에서 실행되는 브라우저 기반 음악 비주얼라이저

- 이미지와 음악은 브라우저 안에서 처리
- 미리보기 재생 / 탐색 바 / 볼륨 조절
- 앨범 이미지와 LP 애니메이션
- 파형 애니메이션
- MP4 추출: WebM(VP8 + Opus)을 중간 영상으로 만든 뒤 H.264 + AAC MP4로 변환
- 최종 MP4는 `faststart` 옵션과 메타데이터 검사를 거쳐 다운로드

## 중요

MP4 변환용 ffmpeg.js MP4 빌드는 VP8 입력을 사용하도록 구성되어 있어, 브라우저가 VP9 WebM을 선택하지 않도록 했어. 처음 MP4 추출할 때 변환 엔진을 CDN에서 불러오므로 인터넷 연결이 필요해.

GitHub Pages에 `index.html`, `style.css`, `app.js`를 올리면 실행할 수 있어.
