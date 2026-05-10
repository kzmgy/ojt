# raw_videos/

원본 MP4를 카테고리 폴더에 넣고 `npm run videos` 실행하면
- `public/<category>/<name>.jpg` 썸네일 (영상 중간 프레임)
- `public/<category>/<name>.mp4` 10초 web-optimized 클립
이 자동 생성됩니다.

## 폴더
- `interstellar/` → `public/int/` 로 출력
- `baseball/`     → `public/baseball/` 로 출력
- `hongkong/`     → `public/hongkong/` 로 출력

## 파일명 규칙
원본 MP4 파일명이 곧 출력 파일명. 예) `01.mp4` → `01.jpg` + `01.mp4`.
기존 `images.js` 의 파일 목록과 매칭되도록 두 자리 숫자 권장.

## gitignore
이 폴더 자체는 커밋하지 않습니다 (.gitignore 됨). 변환 결과물(`public/.../*.mp4`)만 커밋.
