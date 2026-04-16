'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'

// ── SearchInput ──────────────────────────────────────────────────────────────

export type SuggestionKind = 'gene' | 'disease' | 'ortholog' | 'feature' | 'other'

export interface RichSuggestion {
  label: string
  kind?: SuggestionKind
  hint?: string
}

const KIND_LABEL: Record<SuggestionKind, string> = {
  gene: 'gene',
  disease: 'disease',
  ortholog: 'ortholog',
  feature: 'feature',
  other: '',
}

function normalizeSuggestions(
  suggestions: string[] | RichSuggestion[] | undefined
): RichSuggestion[] {
  if (!suggestions || suggestions.length === 0) return []
  if (typeof suggestions[0] === 'string') {
    return (suggestions as string[]).map(label => ({ label, kind: 'gene' as const }))
  }
  return suggestions as RichSuggestion[]
}

interface SearchInputProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
  /** Accepts either plain strings (legacy) or rich objects with kind/hint. */
  suggestions?: string[] | RichSuggestion[]
  onSearch?: (value?: string) => void
  isLoading?: boolean
  /** id used for aria-activedescendant; pass a stable one if mounting >1 input on the page. */
  listboxId?: string
}

export function SearchInput({
  placeholder,
  value,
  onChange,
  suggestions,
  onSearch,
  isLoading = false,
  listboxId = 'search-suggestions',
}: SearchInputProps) {
  const items = useMemo(() => normalizeSuggestions(suggestions), [suggestions])

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // Open the dropdown only when the user is actively typing — i.e. the input
    // is focused. This prevents the suggestions panel from popping open over
    // results when a parent programmatically sets `value` (e.g. via a chip click).
    if (items.length === 0) {
      setShowSuggestions(false)
    } else if (isFocused && value.length > 0) {
      setShowSuggestions(true)
    }
    setActiveIndex(-1)
  }, [items, value, isFocused])

  const commit = (label: string) => {
    onChange(label)
    setShowSuggestions(false)
    setActiveIndex(-1)
    // Pass the chosen label to onSearch so parents don't race stale state.
    onSearch?.(label)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const open = showSuggestions && items.length > 0

    switch (e.key) {
      case 'ArrowDown':
        if (!open) return
        e.preventDefault()
        setActiveIndex(i => (i + 1) % items.length)
        return

      case 'ArrowUp':
        if (!open) return
        e.preventDefault()
        setActiveIndex(i => (i <= 0 ? items.length - 1 : i - 1))
        return

      case 'Home':
        if (!open) return
        e.preventDefault()
        setActiveIndex(0)
        return

      case 'End':
        if (!open) return
        e.preventDefault()
        setActiveIndex(items.length - 1)
        return

      case 'Tab':
        if (open && activeIndex >= 0) {
          e.preventDefault()
          commit(items[activeIndex].label)
        }
        return

      case 'Enter':
        if (open && activeIndex >= 0) {
          e.preventDefault()
          commit(items[activeIndex].label)
        } else {
          onSearch?.()
          setShowSuggestions(false)
        }
        return

      case 'Escape':
        setShowSuggestions(false)
        setActiveIndex(-1)
        return
    }
  }

  const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true)
              if (value.length > 0 && items.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={showSuggestions && items.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            className="input-field pl-10 pr-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-300" aria-hidden />
          {isLoading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" role="status" aria-live="polite" aria-label="Searching">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
            </div>
          ) : value ? (
            <button
              type="button"
              onClick={() => { onChange(''); setShowSuggestions(false); setActiveIndex(-1) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300 hover:text-accent transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onSearch?.()}
          disabled={isLoading}
          className="btn-primary shrink-0"
        >
          Search
        </button>
      </div>

      {showSuggestions && items.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-surface border border-primary-200 rounded-sm shadow-sm max-h-72 overflow-y-auto"
        >
          {items.map((item, index) => {
            const active = index === activeIndex
            const kindLabel = item.kind ? KIND_LABEL[item.kind] : ''
            return (
              <li
                key={`${item.label}-${index}`}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={active}
              >
                <button
                  type="button"
                  onClick={() => commit(item.label)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center justify-between gap-3 transition-colors',
                    active ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className={cn(
                      'block text-sm truncate',
                      item.kind === 'gene' ? 'font-mono font-semibold text-primary-800' : 'text-primary-700'
                    )}>
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="block text-[11px] text-primary-400 truncate">{item.hint}</span>
                    )}
                  </span>
                  {kindLabel && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-primary-400 font-medium">
                      {kindLabel}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Shared table toolbar ─────────────────────────────────────────────────────

function TableToolbar({
  count,
  onDownload,
  onClear,
}: {
  count: number
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 bg-surface-muted flex justify-between items-center gap-4 flex-wrap">
      <h3 className="text-sm font-semibold text-gray-900">
        Results <span className="font-normal text-gray-500">({count.toLocaleString()})</span>
      </h3>
      <div className="flex gap-2">
        {onClear && (
          <button onClick={onClear} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
        {onDownload && (
          <>
            <button onClick={() => onDownload('csv')} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </button>
            <button onClick={() => onDownload('json')} className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> JSON
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared pagination ────────────────────────────────────────────────────────

function TablePagination({
  currentPage,
  totalPages,
  start,
  end,
  total,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  start: number
  end: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-surface-muted flex items-center justify-between">
      <p className="text-xs text-gray-500">{start}–{end} of {total.toLocaleString()}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-gray-600">{currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ── SearchResults ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50
const TABLE_MAX_HEIGHT = '60vh'

interface SearchResultsProps {
  results: CiliopathyGene[] | CiliopathyFeature[]
  type: 'gene' | 'ciliopathy' | 'feature'
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}

export function SearchResults({ results, type, onDownload, onClear }: SearchResultsProps) {
  const [page, setPage] = useState(1)

  // Reset page when results change
  useEffect(() => { setPage(1) }, [results.length])

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No results found. Please try a different search term.
      </div>
    )
  }

  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, results.length)
  const pageData = results.slice(start, end)

  const renderLinks = (ids: string[], makeHref: (id: string) => string) => {
    if (!ids || ids.length === 0) return <span className="text-gray-300">—</span>
    const shown = ids.slice(0, 3)
    const remaining = ids.length - shown.length
    return (
      <div className="flex flex-col gap-0.5 items-center">
        {shown.map((id) => (
          <a key={id} href={makeHref(id)} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:text-primary-light hover:underline text-xs font-medium">{id}</a>
        ))}
        {remaining > 0 && <span className="text-xs text-gray-400">+{remaining} more</span>}
      </div>
    )
  }

  const createOMIMLink = (mim: string) => {
    if (!mim || mim === '-') return <span className="text-gray-300">—</span>
    const clean = mim.replace(/[^\d]/g, '')
    if (!clean) return <span>{mim}</span>
    return (
      <a href={`https://omim.org/entry/${clean}`} target="_blank" rel="noopener noreferrer"
        className="text-primary hover:text-primary-light hover:underline text-xs font-medium">{mim}</a>
    )
  }

  const createEnsemblLink = (geneId: string, geneName: string) => {
    if (!geneId || geneId === '-') return <span className="text-gray-300">—</span>
    const href = geneId.startsWith('ENSG')
      ? `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${geneId}`
      : `https://www.ensembl.org/Homo_sapiens/Search/Results?q=${geneName}`
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-primary hover:text-primary-light hover:underline text-xs font-medium">{geneId}</a>
    )
  }

  const geneHeaders = ['Ciliopathy', 'Gene Name', 'Ensembl ID', 'Localization', 'MIM', 'OMIM Phenotype', 'GO', 'Reactome', 'KEGG']

  // Inline editorial layout for feature results — denser and more scannable
  // than a three-column table when the Category/Feature columns repeat.
  if (type === 'feature') {
    // Shared grid template so header, rows, and any wrapping stay aligned.
    const featureGrid =
      'grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[2.5rem_minmax(0,1.1fr)_minmax(0,1fr)_12rem] gap-x-6 items-start'

    return (
      <div className="card overflow-hidden p-0">
        <TableToolbar count={results.length} onDownload={onDownload} onClear={onClear} />

        {/* Sticky column header — same grid as rows below to guarantee alignment. */}
        <div
          className={`${featureGrid} px-5 py-2.5 bg-surface-muted border-b border-primary-200 sticky top-0 z-10`}
        >
          <span className="eyebrow">#</span>
          <span className="eyebrow">Disease</span>
          <span className="eyebrow">Clinical feature</span>
          <span className="eyebrow text-right hidden md:block">Category</span>
        </div>

        <ol
          className="divide-y divide-primary-100 overflow-auto"
          style={{ maxHeight: TABLE_MAX_HEIGHT }}
        >
          {pageData.map((result, index) => {
            const f = result as CiliopathyFeature
            const disease = f.Disease || f.Ciliopathy || '—'
            const feature = f['Ciliopathy / Clinical Features'] || f.Feature || '—'
            const category = f.Category
            return (
              <li
                key={index}
                className={`${featureGrid} px-5 py-2.5 hover:bg-surface-muted transition-colors`}
              >
                <span className="font-mono text-[11px] tabular-nums text-primary-300 pt-[3px]">
                  {String(start + index + 1).padStart(3, '0')}
                </span>
                <span className="text-sm text-primary-800 font-medium leading-relaxed">
                  {disease}
                </span>
                <span className="text-sm text-primary-600 leading-relaxed">
                  {feature}
                </span>
                <span className="hidden md:block text-[10px] uppercase tracking-[0.14em] text-primary-400 font-medium text-right leading-relaxed pt-[2px]">
                  {category || '—'}
                </span>
              </li>
            )
          })}
        </ol>
        <TablePagination
          currentPage={page} totalPages={totalPages}
          start={start + 1} end={end} total={results.length}
          onPageChange={setPage}
        />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <TableToolbar count={results.length} onDownload={onDownload} onClear={onClear} />

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100 overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
        {pageData.map((result, index) => (
          <div key={index} className="p-4 hover:bg-surface-hover transition-colors">
            <div className="space-y-1.5">
              <div className="text-sm font-mono font-semibold text-primary-800">{(result as CiliopathyGene)['Human Gene Name']}</div>
              <div className="text-xs text-gray-500">{(result as CiliopathyGene).Ciliopathy}</div>
              <div className="text-xs text-gray-500">{(result as CiliopathyGene)['Subcellular Localization'] || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table with scroll container + sticky header */}
      <div className="hidden md:block overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-surface-muted sticky top-0 z-10">
            <tr>
              {geneHeaders.map((header) => (
                <th key={header} scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-surface-muted">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {pageData.map((result, index) => (
              <tr key={index} className="hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2.5 text-center text-xs text-gray-700">{(result as CiliopathyGene).Ciliopathy}</td>
                <td className="px-4 py-2.5 text-center text-xs font-mono font-semibold text-primary-800">{(result as CiliopathyGene)['Human Gene Name']}</td>
                <td className="px-4 py-2.5 text-center text-xs">{createEnsemblLink((result as CiliopathyGene)['Human Gene ID'] || '-', (result as CiliopathyGene)['Human Gene Name'])}</td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-700">{(result as CiliopathyGene)['Subcellular Localization']}</td>
                <td className="px-4 py-2.5 text-center text-xs">{createOMIMLink((result as CiliopathyGene)['Gene MIM Number'])}</td>
                <td className="px-4 py-2.5 text-center text-xs">{createOMIMLink((result as CiliopathyGene)['OMIM Phenotype Number'])}</td>
                <td className="px-4 py-2.5 text-center text-xs">{renderLinks((result as CiliopathyGene).go_terms || [], (id) => `https://www.ebi.ac.uk/QuickGO/term/${encodeURIComponent(id)}`)}</td>
                <td className="px-4 py-2.5 text-center text-xs">{renderLinks((result as CiliopathyGene).reactome_pathways || [], (id) => `https://reactome.org/content/detail/${encodeURIComponent(id)}`)}</td>
                <td className="px-4 py-2.5 text-center text-xs">{renderLinks((result as CiliopathyGene).kegg_pathways || [], (id) => `https://www.kegg.jp/entry/${encodeURIComponent(id)}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={page} totalPages={totalPages}
        start={start + 1} end={end} total={results.length}
        onPageChange={setPage}
      />
    </div>
  )
}

// ── OrthologResults ──────────────────────────────────────────────────────────

interface OrthologResultsProps {
  results: OrthologGene[]
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}

export function OrthologResults({ results, onDownload, onClear }: OrthologResultsProps) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [results.length])

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No results found. Please try a different search term.
      </div>
    )
  }

  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, results.length)
  const pageData = results.slice(start, end)

  return (
    <div className="card overflow-hidden p-0">
      <TableToolbar count={results.length} onDownload={onDownload} onClear={onClear} />

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100 overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
        {pageData.map((result, index) => (
          <div key={index} className="p-4 hover:bg-surface-hover transition-colors">
            <div className="text-sm font-mono font-semibold text-primary-800">{result['Human Gene Name']}</div>
            <div className="text-xs text-gray-500 mt-1">{result.Organism} — {result['Ortholog Gene Name']}</div>
            <div className="text-xs text-gray-400 mt-0.5">{result['Human Disease']}</div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-surface-muted sticky top-0 z-10">
            <tr>
              {['Human Gene', 'Human Disease', 'Ortholog Gene', 'Organism', 'Ortholog Disease'].map(h => (
                <th key={h} scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-surface-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {pageData.map((result, index) => (
              <tr key={index} className="hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2.5 text-center text-xs font-mono font-semibold text-primary-800">{result['Human Gene Name']}</td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-700">{result['Human Disease']}</td>
                <td className="px-4 py-2.5 text-center text-xs font-mono text-primary-700">{result['Ortholog Gene Name']}</td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-700">{result.Organism}</td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-700">{result['Ortholog Disease']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={page} totalPages={totalPages}
        start={start + 1} end={end} total={results.length}
        onPageChange={setPage}
      />
    </div>
  )
}

// ── TabPanel (kept for compatibility) ────────────────────────────────────────

interface TabPanelProps {
  tabs: Array<{ id: string; label: string; count: number }>
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function TabPanel({ tabs, activeTab, onTabChange }: TabPanelProps) {
  return (
    <div className="card">
      <div className="flex gap-1 border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-150',
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
    </div>
  )
}
