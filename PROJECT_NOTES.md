# Floating Gallery — 프로젝트 컨텍스트

React + Vite + R3F + drei + framer-motion 으로 만든 인터랙티브 3D 갤러리.

## 위치
- 로컬: `/Users/zaykim/Desktop/자영_바이브코딩/floating-gallery/`
- GitHub: `https://github.com/kzmgy/ojt`
- Dev 서버: `npm run dev` → `http://localhost:5173`
- 배포: Vercel (GitHub push에 자동 동기화)

## 데이터 (`src/data/images.js`)
- 200장 카드, 2 그룹 (1:1): `interstellar` (100) · `baseball` (100)
- 모두 비디오에서 추출된 썸네일/클립 — 원본 이미지 없음
  - `public/int/001..100.jpg` + `001..100.mp4` (인터스텔라 4개 영상에서 25씩)
  - `public/baseball/001..100.jpg` + `001..100.mp4` (KBO 하이라이트 1개 영상에서 100)
- 각 카드 = 썸네일 (모든 뷰) + 7초 클립 (캐러셀 detail에서만 재생)
- Fibonacci sphere(R=5) 위에 배치
  - Interstellar 100장 = (0, 0, R) 가장 가까운 100 슬롯 → 정면 반구
  - Baseball 100장 = 나머지 (azimuth 정렬)
- 파일 매니페스트: `src/data/videoManifest.json` + `src/data/fileList.json` (변환 스크립트가 자동 생성)

## 영상 변환 (`scripts/convert-videos.mjs`)
- ffmpeg + ffprobe 필요 (`brew install ffmpeg`)
- `npm run videos` → 카테고리별 소스 영상에서 N개 균등 캡처
  - 썸네일 JPG (영상 시점 t)
  - 7초 클립 MP4 (t부터 +7s, 720p H.264, 무음)
- CATEGORIES 배열 수정해서 새 영상/개수 추가 가능
- 원본 영상은 `/Users/zaykim/Downloads/영상모음/` (gitignored)

## 4가지 뷰

### Sphere (`src/components/Scene.jsx`)
- 외부 카메라(z=12)에서 보는 지구본
- 드래그 회전 + 휠 줌 (z=4~26 클램프, `cloudZoomRef`로 보존)
- 카드 클릭 → 그리드 캐러셀 모드 진입 (focused + 5 related row)
- 캐러셀: anchor-based 레이아웃, drag/wheel pan, momentum + snap
- 카드 라벨/타임스탬프 (`<Text>`), 정면 1.0 / 뒷면 0.1 opacity
- 같은 그룹 카드끼리 nearest neighbor 곡선 연결 (cubic bezier, 우측중앙 → 좌측중앙)

### Group (`src/components/GroupScene.jsx`)
- 2개 반구 (radius 3.05, 컬러: 청·녹) 카루셀 슬롯 배치
- 다층 dome 레이어로 블러 글로우 효과
- 클릭한 반구가 정면 슬롯, 다른 하나는 뒷-우측 슬롯
- 선택된 반구의 카드 클릭 → 그리드 진입

### Node (`src/components/NodeScene.jsx`)
- OrbitControls (LEFT=PAN, 회전 비활성, screen-space pan)
- 10-col grid 레이아웃: `COLUMN_COUNTS = [8,11,13,9,10,11,13,10,8,7]` (sum 100), 컬럼 Y jitter
- 그룹 2개: 인터스텔라 (cy=+6) / 야구 (cy=-6) — OrbitControls pan/zoom 으로 탐색
- 같은 그룹 내 다음 컬럼 nearest cubic bezier 연결
- 호버 시 1.4× 확대 + z 앞으로

### Space (`src/components/SpaceScene.jsx`)
- 카메라 원점에 위치 (planetarium 시점)
- 카드는 SPHERE 위치 × 1.85, lookAt(origin)으로 안쪽 향함
- yaw/pitch 드래그 + 휠로 FOV 줌 (8°~110°)
- 가만히 두면 yaw 자동 자전 (idle drift)
- 같은 그룹 nearest neighbor cubic bezier 연결 (좌/우 모서리 기반)

## 공통 시스템

### 카메라 일관성 (`Scene.jsx` grid 진입 시)
- `prevInGridRef` 로 grid 진입 frame 감지
- 진입 즉시 `camera.position.set(0,0,gridZ)` + `fov=45` + `updateProjectionMatrix()`
- 어떤 뷰/줌 상태에서 클릭해도 캐러셀은 항상 동일 크기

각 씬 useEffect에서 자기 FOV 설정:
- Sphere/Group/Node: 45
- Space: 75

### 라운드 코너 (`src/lib/roundedMaterial.js`)
- `makeRoundedMaterial({color, opacity, halfW, halfH, side, radius})`
- `MeshBasicMaterial.onBeforeCompile` 로 SDF rounded-rect 셰이더 패치
- `CORNER_RADIUS = 0.03` (~8px on screen)
- 모든 씬의 카드가 사용 (cover-fit UV, 라운드 코너)

### 카드 라벨 (`src/lib/cardLabels.js`)
- `NAMES`: 그룹별 한글 이름 배열 (라자루스 도킹, 9회말 역전 홈런 등 5-9자)
- `shortName(img)` / `timestampFor(img)` — 결정적 매핑 (id % NAMES.length 으로 순환)
- `KOREAN_FONT` = `/fonts/Pretendard-Regular.otf` — 모든 drei `<Text>` 컴포넌트의 `font` prop 으로 사용

### 테마 (`src/lib/theme.js`)
- `ThemeContext` + `useTheme()` 훅
- `colors(theme)` → `{fg, dim, line, bg}`
- App.jsx에서 `localStorage` 영속화, body에 `dark-theme` 클래스
- Canvas 안 `<ThemedBg>` 가 `gl.setClearColor()` 동적 변경
- 우측 상단 토글 버튼

### 라인 스타일 (모든 뷰 통일)
- 색: `c.line` = 다크면 `#f0f0f0`, 라이트면 `#0a0a0a`
- 두께: `lineWidth={1}`
- 투명도: `0.1`
- Sphere만 추가로 facing-based opacity (뒷면 0)

### 커스텀 커서 (`src/components/CursorOrb.jsx`)
- 9×9 검정 솔리드 원, pressed 시 6×6
- 다크 테마에서 색 반전 (CSS)
- 터치 디바이스에서는 자동 비활성

### View 스위처 (App.jsx)
- 하단 가운데 pill 버튼 4개: Sphere · Group · Node · Space
- 그리드 모드에서는 자동 숨김
- 카드 클릭 → `openCardGrid(card)` → `viewMode='sphere'` + `gridState` set
- Back 시 `gridReturnView` 로 복귀

## 빌드/배포

```bash
npm run dev        # 개발
npm run build      # dist/ 생성
npm run preview    # dist 로컬 미리보기
npm run videos     # raw 영상 → public/<cat>/{NNN.jpg, NNN.mp4} 일괄 변환
```

GitHub remote: `https://github.com/kzmgy/ojt.git` (브랜치: `main`)

Push할 때 토큰 인증 필요 (zaykim1028 키체인 ≠ kzmgy):
```bash
git push https://kzmgy:<TOKEN>@github.com/kzmgy/ojt.git main:main
```
또는 Mac 키체인 github.com 항목 삭제 후 새로 인증.

Vercel은 GitHub에 연결돼있다면 push마다 자동 재배포.

## 주의사항
- `public/` 한글 폴더 경로(`자영_바이브코딩`) 부모에 있지만 git에는 영향 없음
- node_modules / dist / .DS_Store / *.log / .vite 는 gitignore됨
- 이전에 노출된 GitHub 토큰은 폐기 후 새로 발급해서 사용

## 자주 쓰는 컬러
- `#0a0a0a` — 거의 검정 (라이트 텍스트/라인)
- `#f0f0f0` — 다크 텍스트/라인
- `#888888` — dim 라이트
- `#9a9a9a` — dim 다크
- `#E2E2E2` — 매우 옅은 회색 (이전 라인 색, 지금은 안 씀)
