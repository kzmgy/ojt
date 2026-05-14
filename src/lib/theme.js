import { createContext, useContext } from 'react';

// Site is dark-only now. ThemeContext + useTheme are kept as no-ops so
// existing consumers (Card.jsx etc.) don't need to change shape.
export const ThemeContext = createContext('dark');
export const useTheme = () => useContext(ThemeContext);

// Colors used throughout the 3D scenes. Single (dark) palette.
export function colors() {
  return {
    fg: '#f0f0f0',
    dim: '#9a9a9a',
    line: '#f0f0f0',
    bg: '#0a0a0a',
  };
}
