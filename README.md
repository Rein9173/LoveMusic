# LoveMusic

GitHub Pages에서 실행되는 브라우저 기반 음악 비주얼라이저입니다.

- 이미지와 음악은 브라우저에서만 처리됩니다.
- 미리보기의 재생 바와 볼륨은 화면 미리보기에만 적용됩니다.
- 영상 추출은 항상 최대 볼륨으로 렌더링합니다.
- 추출 과정에서는 WebM을 임시로 만든 뒤 MP4(H.264/AAC)로 변환합니다.
- 최종 MP4에는 빠른 탐색을 위해 `faststart` 메타데이터를 적용하고, 다운로드 전에 브라우저에서 재생 시간과 seekable 구간을 검사합니다.
- MP4 변환 엔진은 ffmpeg.js 4.2.9003의 MP4 Worker를 사용하며, GitHub Pages의 교차 출처 Worker 문제를 피하기 위해 Worker 코드를 Blob Worker로 실행합니다.
