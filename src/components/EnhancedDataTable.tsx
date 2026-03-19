'use client'

import React, { useState, useMemo } from 'react'
import { Download, ChevronUp, ChevronDown, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downloadCSV, downloadJSON } from '@/lib/utils'

interface Column {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  width?: string
  render?: (value: any, row: any) => React.ReactNode
}

interface EnhancedDataTableProps {
  data: any[]
  columns: Column[]
  title?: string
  onExport?: (format: 'csv' | 'json') => void
  className?: string
  pageSize?: number
  searchable?: boolean
}

export function EnhancedDataTable({
  data,
  columns,
  title,
  onExport,
  className,
  pageSize = 20,
  searchable = true
}: EnhancedDataTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(row =>
          String(row[key]).toLowerCase().includes(value.toLowerCase())
        )
      }
    })

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        
        if (aVal === bVal) return 0
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        
        const comparison = aVal < bVal ? -1 : 1
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }, [data, searchTerm, filters, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentData = processedData.slice(startIndex, endIndex)

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  // Handle filter change
  const handleFilterChange = (columnKey: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }))
    setCurrentPage(1)
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({})
    setSearchTerm('')
    setCurrentPage(1)
  }

  // Check if any filters are active
  const hasActiveFilters = searchTerm || Object.values(filters).some(value => value)

  // Export functions
  const handleExport = (format: 'csv' | 'json') => {
    if (onExport) {
      onExport(format)
    } else {
      if (format === 'csv') {
        downloadCSV(processedData, `${title || 'data'}_export.csv`)
      } else {
        downloadJSON(processedData, `${title || 'data'}_export.json`)
      }
    }
  }

  // Render cell value
  const renderCell = (column: Column, row: any) => {
    const value = row[column.key]
    
    if (column.render) {
      return column.render(value, row)
    }
    
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>
    }
    
    return String(value)
  }

  return (
    <div className={cn("bg-white rounded-lg shadow-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {title || 'Data Table'}
            </h3>
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, processedData.length)} of {processedData.length} results
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                hasActiveFilters 
                  ? "bg-primary text-white" 
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-white text-primary rounded-full">
                  {Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0)}
                </span>
              )}
            </button>
            
            {/* Export buttons */}
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Filters</h4>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search filter */}
            {searchable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search all columns..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}
            
            {/* Column filters */}
            {columns
              .filter(col => col.filterable !== false)
              .map(column => (
                <div key={column.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {column.label}
                  </label>
                  <input
                    type="text"
                    value={filters[column.key] || ''}
                    onChange={(e) => handleFilterChange(column.key, e.target.value)}
                    placeholder={`Filter ${column.label.toLowerCase()}...`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" role="table">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => {
                const isActive = sortColumn === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider",
                      isActive ? "text-primary font-bold" : "text-gray-500",
                      column.width && `w-${column.width}`,
                      column.sortable !== false && "cursor-pointer hover:bg-gray-100"
                    )}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable !== false && (
                        <div className="flex flex-col">
                          <ChevronUp 
                            className={cn(
                              "h-3 w-3",
                              isActive && sortDirection === 'asc' 
                                ? "text-primary" 
                                : "text-gray-400"
                            )}
                          />
                          <ChevronDown 
                            className={cn(
                              "h-3 w-3 -mt-1",
                              isActive && sortDirection === 'desc' 
                                ? "text-primary" 
                                : "text-gray-400"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {renderCell(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
