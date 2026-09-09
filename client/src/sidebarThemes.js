import emeraldMarble from './assets/sidebar-emerald-marble.svg';
import alpineLake from './assets/sidebar-alpine-lake.svg';

export const SIDEBAR_THEMES = [
  { id: 'emerald-marble', label: 'Emerald Marble', image: emeraldMarble },
  { id: 'alpine-lake', label: 'Alpine Lake', image: alpineLake }
];

const STORAGE_KEY = 'tessera-sidebar-theme';

export function readSidebarTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SIDEBAR_THEMES.some((theme) => theme.id === saved)) return saved;
  } catch {
    // The default still works when browser storage is unavailable.
  }
  return SIDEBAR_THEMES[0].id;
}

export function saveSidebarTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Keep the selection usable for this session in restricted browsers.
  }
}
