import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scene as SphereScene } from './components/Scene';
import { CursorOrb } from './components/CursorOrb';
import { IMAGES } from './data/images';
import { titleFor, descriptionFor } from './lib/cardLabels';
import { ThemeContext, colors } from './lib/theme';

// Sets the WebGL clear colour to match the (dark) theme.
function ThemedBg() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(colors('dark').bg);
  }, [gl]);
  return null;
}

export default function App() {
  const [gridState, setGridState] = useState(null);

  // The whole UI is dark-only now. The body class is kept so the rest of
  // the CSS keeps matching the dark palette without further edits.
  useEffect(() => {
    document.body.classList.add('dark-theme');
  }, []);

  const focused = gridState
    ? IMAGES.find((i) => i.id === gridState.focusedId)
    : null;

  // Keyboard shortcut: pressing "a" (or "ㅁ" on Korean IMEs) anywhere
  // closes the carousel detail view.
  useEffect(() => {
    if (!gridState) return;
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key?.toLowerCase();
      if (k === 'a' || k === 'ㅁ') {
        setGridState(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gridState]);

  return (
    <ThemeContext.Provider value="dark">
      <div className="app">
        <CursorOrb />
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <ThemedBg />
          <ambientLight intensity={1.2} />
          <SphereScene gridState={gridState} setGridState={setGridState} />
        </Canvas>

        {/* Carousel detail overlay — only on the central focused card.
            Pressing "a" exits the carousel (handled in keydown listener). */}
        <AnimatePresence mode="wait">
          {focused && (
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
      </div>
    </ThemeContext.Provider>
  );
}
