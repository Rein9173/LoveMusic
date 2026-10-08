# Music Visualizer

브라우저에서 이미지와 음악을 합쳐 WebM 영상을 저장하는 정적 페이지입니다.

## 저장 방식

Chrome/Edge에서는 파일 저장 대화상자를 통해 녹화 조각을 디스크에 순차적으로 기록합니다. 녹화 전체를 RAM에 모으지 않기 때문에 긴 영상에서 발생하던 OOM 위험을 크게 줄입니다.

출력은 WebM(VP9/VP8 + Opus)입니다. WebM의 탐색 가능 여부는 브라우저의 MediaRecorder/WebM muxer 구현에 따라 달라질 수 있습니다.
