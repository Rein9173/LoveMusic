# LoveMusic

GitHub Pages에서 실행되는 브라우저 기반 음악 비주얼라이저

- 이미지와 음악은 브라우저 안에서 처리
- 미리보기 재생 / 탐색 바 / 볼륨 조절
- 앨범 이미지와 LP 애니메이션
- 파형 애니메이션
- WebM 영상 추출 및 다운로드
- MP4 변환용 FFmpeg는 사용하지 않음

## 중요

영상 추출은 브라우저의 MediaRecorder를 사용해 WebM으로 바로 저장해.
WebM의 재생 시간 메타데이터가 브라우저에 따라 제대로 기록되지 않는 경우를 보완하기 위해 `fix-webm-duration`을 사용해.

GitHub Pages에 `index.html`, `style.css`, `app.js`를 올리면 실행할 수 있어.
