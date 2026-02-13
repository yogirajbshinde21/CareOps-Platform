// Dark mode color utilities
// Returns dark-aware colors for inline styles
import { useSyncExternalStore } from 'react';

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

// --- Reactive subscription so components re-render on toggle ---
let listeners = new Set();
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return isDark(); }
/** Call this from the toggle handler to notify all dm() consumers */
export const notifyThemeChange = () => listeners.forEach(l => l());
/** Hook: call once per component that uses dm/dt/dmc to subscribe to theme */
export const useDarkMode = () => useSyncExternalStore(subscribe, getSnapshot);

// Pastel backgrounds → dark muted equivalents
const darkBgMap = {
  '#eef2ff': '#312e81',  // indigo pastel
  '#ecfdf5': '#064e3b',  // green pastel
  '#fffbeb': '#78350f',  // yellow pastel
  '#eff6ff': '#1e3a5f',  // blue pastel
  '#fef2f2': '#7f1d1d',  // red pastel
  '#f0fdf4': '#064e3b',  // green tint
  '#fef3c7': '#78350f',  // amber tint
  '#fee2e2': '#7f1d1d',  // red tint
  '#f1f5f9': '#334155',  // slate light
  '#f8fafc': '#1e293b',  // near-white
  '#fafafa': '#1e293b',  // near-white
  '#e0e7ff': '#312e81',  // indigo light
  '#e2e8f0': '#334155',  // slate border
  '#ecfeff': '#164e63',  // cyan pastel
  '#ede9fe': '#4c1d95',  // violet pastel
  '#f5f3ff': '#4c1d95',  // violet tint
  '#f0fdfa': '#134e4a',  // teal pastel
  '#dcfce7': '#064e3b',  // green light
  '#dbeafe': '#1e3a5f',  // blue light
  '#c7d2fe': '#4338ca',  // indigo medium
  '#fafbfc': '#1e293b',  // near-white
  'white': '#1e293b',
  '#ffffff': '#1e293b',
  '#fff': '#1e293b',
};

// Dark text colors → light equivalents
const darkTextMap = {
  '#1e293b': '#f1f5f9',
  '#334155': '#e2e8f0',
  '#475569': '#cbd5e1',
  '#1e1b4b': '#c7d2fe',
  '#1a1a2e': '#e2e8f0',
  '#4c1d95': '#c4b5fd',
  '#92400e': '#fcd34d',
  '#991b1b': '#fca5a5',
  '#1e40af': '#93c5fd',
  '#0f172a': '#f1f5f9',
  '#166534': '#86efac',
  '#64748b': '#94a3b8',
};

export const dm = (bg) => isDark() ? (darkBgMap[bg] || bg) : bg;
export const dt = (color) => isDark() ? (darkTextMap[color] || color) : color;

// Combined: returns { background, color } for dark mode
export const dmc = (bg, color) => isDark()
  ? { background: darkBgMap[bg] || bg, color: darkTextMap[color] || color }
  : { background: bg, color };

// For gradient backgrounds
export const dmGrad = (lightGrad, darkGrad) => isDark() ? darkGrad : lightGrad;

export default { dm, dt, dmc, dmGrad };
