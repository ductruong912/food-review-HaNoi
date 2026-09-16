'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { soundFX } from '@/lib/audio';

type Theme = 'dark' | 'light' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('foodhn-theme') as Theme | null;
    if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme('system');
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = localStorage.getItem('foodhn-theme') as Theme | null;
      if (!current || current === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const applyTheme = (targetTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (targetTheme === 'system') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isSystemDark ? 'dark' : 'light');
      setResolvedTheme(isSystemDark ? 'dark' : 'light');
    } else {
      root.classList.add(targetTheme);
      setResolvedTheme(targetTheme);
    }
  };

  const handleCycleTheme = () => {
    soundFX.playClick();
    let next: Theme = 'dark';
    if (theme === 'system') next = 'light';
    else if (theme === 'light') next = 'dark';
    else if (theme === 'dark') next = 'system';

    setTheme(next);
    localStorage.setItem('foodhn-theme', next);
    applyTheme(next);
  };

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-card border border-border/70" />
    );
  }

  const tooltip =
    theme === 'system'
      ? `Giao diện: Hệ thống (${resolvedTheme === 'dark' ? 'Tối' : 'Sáng'})`
      : theme === 'dark'
      ? 'Giao diện: Chế độ Tối'
      : 'Giao diện: Chế độ Sáng';

  return (
    <button
      type="button"
      onClick={handleCycleTheme}
      className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card border border-border/80 text-text-secondary hover:text-foreground hover:border-accent-primary/60 hover:bg-card-hover active:scale-95 transition-all cursor-pointer shadow-sm"
      title={tooltip}
      aria-label={tooltip}
    >
      {theme === 'system' ? (
        <Monitor size={17} className="text-accent-secondary" />
      ) : theme === 'light' ? (
        <Sun size={18} className="text-amber-500 animate-in spin-in-90 duration-300" />
      ) : (
        <Moon size={18} className="text-accent-primary animate-in spin-in-90 duration-300" />
      )}
    </button>
  );
}
