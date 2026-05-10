import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scene as SphereScene } from './components/Scene';
import { GroupScene } from './components/GroupScene';
import { NodeScene } from './components/NodeScene';
import { SpaceScene } from './components/SpaceScene';
import { CursorOrb } from './components/CursorOrb';
import { IMAGES } from './data/images';

function buildGridState(card) {
  const rel = card.relatedIds.slice();
  const half = Math.floor(rel.length / 2);
  const rowIds = [...rel.slice(0, half), card.id, ...rel.slice(half)];
  return { rowIds, focusedId: card.id, anchorIdx: half };
}

export default function App() {
  const [viewMode, setViewMode] = useState('sphere');
  const [gridState, setGridState] = useState(null);
  // Remember where the user opened the grid from, so Back returns there.
  const [gridReturnView, setGridReturnView] = useState('sphere');

  const focused = gridState
    ? IMAGES.find((i) => i.id === gridState.focusedId)
    : null;

  const switchView = (mode) => {
    if (mode === viewMode) return;
    setGridState(null);
    setViewMode(mode);
  };

  // Open carousel grid for a specific card (called from Group / Node views).
  const openCardGrid = (card) => {
    setGridReturnView(viewMode);
    setGridState(buildGridState(card));
    setViewMode('sphere'); // grid renders inside SphereScene
  };

  const closeGrid = () => {
    setGridState(null);
    setViewMode(gridReturnView);
  };

  return (
    <div className="app">
      <CursorOrb />
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 12], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff')}
      >
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
            ← Back
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {viewMode === 'sphere' && focused && (
          <motion.div
            key={`info-${focused.id}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="info-card"
          >
            <div className="info-cat">{focused.category}</div>
            <div className="info-title">{focused.title}</div>
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
    </div>
  );
}
