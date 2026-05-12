// Korean short names for each card (≈ 5–8 syllables, comparable in
// visual length to the previous English single-word labels). Used by
// Sphere, Node and Space views.

export const NAMES = {
  interstellar: [
    '라자루스 도킹',
    '갈란튜아 진입',
    '웜홀 통과 항해',
    '5차원 도서관',
    '만 박사의 행성',
    '인듀어런스호',
    '쿠퍼와 머피',
    '에지 행성 표면',
    '새턴 정거장',
    '미러 행성 표면',
    '블랙홀의 끝',
    '상대성 시간차',
    '타르스의 항법',
    '광속의 시계',
    '쿠퍼 스테이션',
    '눈물의 메시지',
    '중력의 비밀',
    '얼음 구름 행성',
    '아멜리아의 결단',
    '인류의 도약',
  ],
  baseball: [
    '끝내기 안타 한방',
    '9회말 역전 홈런',
    '마운드의 명승부',
    '솔로 홈런포',
    '광속의 강속구',
    '1루 도루 성공',
    '호수비 다이빙',
    '만루 그랜드슬램',
    '클러치 적시타',
    '선두타자 출루',
    '병살 더블 플레이',
    '1루심 세이프 콜',
    '끝내기 만루홈런',
    '8번 타자 한방',
    '노히트 노런 행진',
    '훔친 1루 도루',
    '안타성 우중간',
    '구원 마무리 등판',
    '셋업맨의 호투',
    '연속 삼진 행진',
  ],
};

export function shortName(img) {
  const arr = NAMES[img.subgroup] || ['—'];
  return arr[(img.id - 1) % arr.length];
}

export function timestampFor(img) {
  const t = (img.id * 137) % 5400; // up to 90:00
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Korean-aware OTFs served from /public/fonts. drei's <Text> component
// accepts a font URL and renders it via troika-three-text. We default to
// Bold across the entire site since the design now uses semi-transparent
// white labels that need extra weight to stay legible.
export const KOREAN_FONT = '/fonts/Pretendard-Bold.otf';
export const KOREAN_FONT_BOLD = '/fonts/Pretendard-Bold.otf';
