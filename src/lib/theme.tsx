'use client'

/**
 * ThemeProvider — light / dark / system theme handling.
 *
 * Stores the user's choice in localStorage under "ciliaminer-theme" and
 * applies it by setting `data-theme="light|dark"` on <html>. To avoid the
 * usual flash-of-wrong-theme on initial paint, see the inline script in
 * src/app/layout.tsx which runs *before* React hydrates.
 *
 * Usage:
 *   const { theme, setTheme, resolved } = useTheme()
 *   <button onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (t: Theme) => void
}

const STORAGE_KEY = 'ciliaminer-theme'

const Ctx = createContext<ThemeCtx | null>(null)

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Tolerant default — if a consumer renders before the provider mounts
    // we want a sensible no-op instead of a crash.
    return {
      theme: 'system',
      resolved: 'light',
      setTheme: () => {},
    }
  }
  return ctx
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined') return 'light'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // We initialise to 'system' on the server, then sync from localStorage on
  // mount. The pre-hydration script in layout.tsx will already have applied
  // the correct attribute, so there's no visible flash.
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolved, setResolved] = useState<ResolvedTheme>('light')

  // First mount — read storage, apply, subscribe to OS changes.
  useEffect(() => {
    const initial = getInitialTheme()
    setThemeState(initial)
    const r = resolveTheme(initial)
    setResolved(r)
    applyTheme(r)

    // When the user has theme='system', follow OS changes live.
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onOsChange = () => {
      // re-read current theme from state in a fresh closure; we
      // intentionally use a state-setter callback to avoid stale captures.
      setThemeState((current) => {
        if (current === 'system') {
          const next = mql.matches ? 'dark' : 'light'
          setResolved(next)
          applyTheme(next)
        }
        return current
      })
    }
    mql.addEventListener?.('change', onOsChange)
    return () => mql.removeEventListener?.('change', onOsChange)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try { window.localStorage.setItem(STORAGE_KEY, t) } catch {}
    const r = resolveTheme(t)
    setResolved(r)
    applyTheme(r)
  }, [])

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>
}

/**
 * Inline script string for app/layout.tsx — runs synchronously BEFORE React
 * hydration so the first paint is already in the right mode. Keeping it as
 * a module-level constant lets us reference the same STORAGE_KEY name.
 */
export const PRE_HYDRATION_SCRIPT = `
(function () {
  try {
    var k = '${STORAGE_KEY}';
    var t = localStorage.getItem(k) || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim()
