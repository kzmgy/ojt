import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scene as SphereScene } from './components/Scene';
import { GroupScene } from './components/GroupScene';
import { NodeScene } from './components/NodeScene';
import { SpaceScene } from './components/SpaceScene';
import { CursorOrb } from './components/CursorOrb';
import { IMAGES } from './data/images';
import { titleFor, descriptionFor } from './lib/cardLabels';
import { ThemeContext, colors } from './lib/theme';

function buildGridState(card) {
  const rel = card.relatedIds.slice();
  const half = Math.floor(rel.length / 2);
  const rowIds = [...rel.slice(0, half), card.id, ...rel.slice(half)];
  return { rowIds, focusedId: card.id, anchorIdx: half };
}

// Sets the WebGL clear color to match the current theme.
function ThemedBg({ theme }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(colors(theme).bg);
  }, [gl, theme]);
  return null;
}

export default function App() {
  const [viewMode, setViewMode] = useState('sphere');
  const [gridState, setGridState] = useState(null);
  const [gridReturnView, setGridReturnView] = useState('sphere');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  const focused = gridState
    ? IMAGES.find((i) => i.id === gridState.focusedId)
    : null;

  const switchView = (mode) => {
    if (mode === viewMode) return;
    setGridState(null);
    setViewMode(mode);
  };

  const openCardGrid = (card) => {
    setGridReturnView(viewMode);
    setGridState(buildGridState(card));
    setViewMode('sphere');
  };

  const closeGrid = () => {
    setGridState(null);
    setViewMode(gridReturnView);
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div className="app">
        <CursorOrb />
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <ThemedBg theme={theme} />
          <ambientLight intensity={1.2} />
          {viewMode === 'sphere' && (
            <SphereScene gridState={gridState} setGridState={setGridState} />
          )}
          {viewMode === 'group' && <GroupScene onCardClick={openCardGrid} />}
          {viewMode === 'node' && <NodeScene onCardClick={openCardGrid} />}
          {viewMode === 'space' && <SpaceScene onCardClick={openCardGrid} />}
        </Canvas>

        <AnimatePresence mode="wait">
          {viewMode === 'sphere' && gridState && (
            <motion.button
              key="back"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="back-btn"
              onClick={closeGrid}
            >
              ← 뒤로
            </motion.button>
          )}
        </AnimatePresence>

        {/* Carousel detail overlay — only shown for the central focused card. */}
        <AnimatePresence mode="wait">
          {viewMode === 'sphere' && focused && (
            <motion.div
              key={`carousel-info-${focused.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="carousel-info"
            >
              <div className="carousel-info__title-row">
                <span className="carousel-info__bullet" aria-hidden />
                <h2 className="carousel-info__title">{titleFor(focused)}</h2>
              </div>
              <p className="carousel-info__desc">{descriptionFor(focused)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!(viewMode === 'sphere' && gridState) && (
          <div className="view-switcher">
            <button
              className={viewMode === 'sphere' ? 'active' : ''}
              onClick={() => switchView('sphere')}
            >
              Sphere
            </button>
            <button
              className={viewMode === 'group' ? 'active' : ''}
              onClick={() => switchView('group')}
            >
              Group
            </button>
            <button
              className={viewMode === 'node' ? 'active' : ''}
              onClick={() => switchView('node')}
            >
              Node
            </button>
            <button
              className={viewMode === 'space' ? 'active' : ''}
              onClick={() => switchView('space')}
            >
              Space
            </button>
          </div>
        )}

        <button
          className="theme-toggle"
          onClick={() =>
            setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
          }
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </div>
    </ThemeContext.Provider>
  );
}
