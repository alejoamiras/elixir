import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme-provider.tsx';

function Probe() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme}/{resolved}
    </button>
  );
}

const matchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    window.matchMedia = matchMedia(false) as unknown as typeof window.matchMedia;
  });
  afterEach(() => localStorage.clear());

  test('dark by default, toggles the html class and persists', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => screen.getByRole('button').click());
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button')).toHaveTextContent('light/light');
    expect(localStorage.getItem('yacana.theme')).toBe('light');
  });

  test('a stored choice wins over the default; system follows the media query', () => {
    localStorage.setItem('yacana.theme', 'system');
    window.matchMedia = matchMedia(true) as unknown as typeof window.matchMedia;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('system/light');
    expect(document.documentElement).toHaveClass('light');
  });

  test('useTheme outside the provider throws', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });
});
