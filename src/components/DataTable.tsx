'use client'

import React, { useState, useMemo } from 'react'
import { Download, X } from 'lucide-react'
import { escapeCsvValue } from '@/lib/utils'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  title?: string
  pageSize?: number
  maxHeight?: string
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  title,
  pageSize = 50,
  maxHeight = '60vh',
  onDownload,
  onClear,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(data.length / pageSize)
  const start = (currentPage - 1) * pageSize
  const end = Math.min(start + pageSize, data.length)
  const pageData = useMemo(() => data.slice(start, end), [data, start, end])

  // Reset to page 1 when data changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  if (data.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gray-500">No data to display.</p>
      </div>
    )
  }

  const handleDefaultDownload = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const content = JSON.stringify(data, null, 2)
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'data'}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const csvContent = [
        columns.map(c => escapeCsvValue(c.label)).join(','),
        ...data.map(row =>
          columns.map(c => escapeCsvValue(row[c.key])).join(',')
        ),
      ].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'data'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const download = onDownload ?? handleDefaultDownload

  return (
    <div className="card overflow-hidden p-0">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 bg-surface-muted flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          )}
          <span className="text-xs text-gray-500">
            {data.length.toLocaleString()} result{data.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onClear && (
            <button onClick={onClear} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          <button onClick={() => download('csv')} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> CSV
          </button>
          <button onClick={() => download('json')} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> JSON
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-surface-muted sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-surface-muted"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {pageData.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-hover transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-center text-xs text-gray-700">
                    {col.render ? col.render(row) : (
                      <span>{row[col.key] != null ? String(row[col.key]) : <span className="text-gray-300">—</span>}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-surface-muted flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {start + 1}–{end} of {data.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
