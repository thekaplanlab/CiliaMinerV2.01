'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded bg-gray-200', className)}
      style={style}
      aria-hidden
    />
  )
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full space-y-3" role="status" aria-live="polite" aria-label="Loading chart">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-3" role="status" aria-live="polite" aria-label="Loading table">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
