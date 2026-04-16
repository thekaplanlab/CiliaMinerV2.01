'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Syncs a single string-like value with a URL query param.
 *
 * - Reads from `searchParams` on every render (URL is source of truth).
 * - Writes via `router.replace` so the browser history isn't polluted.
 * - Omits the param entirely when it equals `defaultValue`, keeping URLs clean.
 *
 * Must be used inside a component wrapped in <Suspense>, since
 * useSearchParams() triggers client-bailout in static rendering otherwise.
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: T,
  opts: { scroll?: boolean } = {}
): [string, (next: string) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const raw = searchParams.get(key)
  const value = raw ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!next || next === defaultValue) params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: opts.scroll ?? false,
      })
    },
    [searchParams, router, pathname, key, defaultValue, opts.scroll]
  )

  return [value, setValue]
}

/** Number variant — useful for pagination. */
export function useUrlNumberState(
  key: string,
  defaultValue: number,
  opts: { scroll?: boolean } = {}
): [number, (next: number) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const raw = searchParams.get(key)
  const parsed = raw != null ? Number.parseInt(raw, 10) : NaN
  const value = Number.isFinite(parsed) && parsed >= 1 ? parsed : defaultValue

  const setValue = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!Number.isFinite(next) || next === defaultValue) params.delete(key)
      else params.set(key, String(Math.max(1, Math.floor(next))))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: opts.scroll ?? false,
      })
    },
    [searchParams, router, pathname, key, defaultValue, opts.scroll]
  )

  return [value, setValue]
}

/**
 * Updates multiple URL params atomically in a single router.replace call.
 * Use when toggling a filter that should reset pagination to 1.
 */
export function useUrlStateBatch() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  return useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '') params.delete(k)
        else params.set(k, String(v))
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )
}
