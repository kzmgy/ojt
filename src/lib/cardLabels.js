// Shared short names + timestamps used by both NodeScene and Sphere mode.

export const NAMES = {
  interstellar: [
    'Docking', 'Wormhole', 'Cooper', 'Murph', 'TARS', 'Case', 'Endurance',
    'Lazarus', 'Gargantua', 'Mann', 'Plan B', 'Amelia', 'Saturn',
    'Singularity', 'Reunion', 'Crops', 'Storm', 'Fields', 'Radio', 'NASA',
  ],
  baseball: [
    'Homerun', 'Strikeout', 'Steal', 'Double', 'Hit', 'Walk', 'Run',
    '9th Inn', 'Comeback', 'Crowd', 'Cheer', 'Bullpen', 'Curveball',
    'Slider', 'Bunt', 'Pitch', 'Catcher', 'Foul', 'Triple', 'Slide',
  ],
  hongkong: [
    'Skyline', 'Tram', 'Dim Sum', 'Central', 'Kowloon', 'Neon', 'Symphony',
    'Victoria', 'TST', 'Star Ferry', 'Mongkok', 'Lantau', 'MTR', 'Markets',
    'Junk', 'Causeway', 'Peak', 'Avenue', 'Soho', 'Lan Kwai',
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
