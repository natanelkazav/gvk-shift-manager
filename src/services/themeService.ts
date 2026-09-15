export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'gvk-app-theme';
const DEFAULT_THEME: AppTheme = 'light';

function isAppTheme(value: string | null): value is AppTheme {
  return value === 'light' || value === 'dark';
}

function readStoredTheme(): AppTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const themeService = {
  initialize(): AppTheme {
    const theme = readStoredTheme();
    applyTheme(theme);
    return theme;
  },

  get(): AppTheme {
    return readStoredTheme();
  },

  set(theme: AppTheme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The visual preference can still be applied for the current session.
    }
    applyTheme(theme);
  },
};
