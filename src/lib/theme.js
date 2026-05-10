import { createContext, useContext } from 'react';

export const ThemeContext = createContext('light');
export const useTheme = () => useContext(ThemeContext);

// Theme-resolved colors used throughout the 3D scenes.
export function colors(theme) {
  const dark = theme === 'dark';
  return {
    fg: dark ? '#f0f0f0' : '#0a0a0a',
    dim: dark ? '#9a9a9a' : '#888888',
    line: dark ? '#f0f0f0' : '#0a0a0a',
    bg: dark ? '#0a0a0a' : '#ffffff',
  };
}
