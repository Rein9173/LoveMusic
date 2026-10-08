# Music Visualizer

이미지와 음악을 브라우저에서 합성해 회전하는 LP 음악 영상을 만드는 개인용 웹앱입니다.

## 기능

- 앨범 이미지 업로드
- 음악 파일 업로드
- 이미지에서 대표 색상 자동 추출
- 제목 / 아티스트 / 설명 입력
- 폰트 선택
- LP 시계방향 회전
- 음악 파형 표시
- 60FPS Canvas 미리보기
- 1920×1080 / 1280×720 / 1080×1080
- WebM 영상으로 브라우저에서 직접 추출 및 다운로드
- 이미지와 음악을 서버에 저장하지 않음

## GitHub Pages에 올리기

1. GitHub에서 새 public repository를 만듭니다.
2. `index.html`, `style.css`, `app.js`를 저장소에 업로드합니다.
3. Settings → Pages → Deploy from a branch → `main` / `/ (root)`를 선택합니다.
4. 잠시 후 GitHub Pages 주소로 접속합니다.

## 참고

현재 영상 출력은 브라우저에서 안정적으로 동작하는 WebM을 사용합니다.
MP4가 꼭 필요하다면 다음 단계에서 FFmpeg WebAssembly 변환 기능을 추가할 수 있습니다.

파일은 브라우저에서만 처리되며 이 프로젝트에는 업로드 서버가 없습니다.
