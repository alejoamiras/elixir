import * as React from 'react';

export type Theme = 'dark' | 'light' | 'system';
type Resolved = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  resolved: Resolved;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'yacana.theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';
const ThemeContext = React.createContext<ThemeState | undefined>(undefined);

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light' || v === 'system';

const readStored = (): Theme | undefined => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isTheme(v) ? v : undefined;
  } catch {
    return undefined;
  }
};

const systemTheme = (): Resolved => (window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark');

/**
 * Dark is the product's default; light is a setting. The resolved theme is a class on <html>
 * (`light` or `dark`, see theme.css) and a `data-theme` attribute for anything that reads it.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(() => readStored() ?? defaultTheme);
  const [resolved, setResolved] = React.useState<Resolved>(() =>
    theme === 'system' ? systemTheme() : theme,
  );

  React.useEffect(() => {
    const apply = () => {
      const next = theme === 'system' ? systemTheme() : theme;
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(next);
      root.dataset.theme = next;
      setResolved(next);
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia(LIGHT_QUERY);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: the choice lasts the session */
    }
    setThemeState(next);
  }, []);

  const value = React.useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeState => {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
