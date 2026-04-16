import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  hint?: React.ReactNode
  action?: React.ReactNode
}

/**
 * Consistent empty-state card.
 * Use when a query or filter returns zero results, OR when a data section
 * is genuinely empty (awaiting upload, missing sheet, etc).
 */
export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="card py-12 flex flex-col items-center text-center">
      {Icon && <Icon className="h-10 w-10 text-primary-200 mb-4" strokeWidth={1.2} />}
      <h3 className="font-display text-xl text-primary-700 leading-tight mb-2">{title}</h3>
      {hint && <p className="text-sm text-primary-500 max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
