import { escapeCsvValue } from './utils'

/**
 * Unified download helper.
 *
 * Produces filenames in the pattern:  ciliaminer_{scope}_{YYYY-MM-DD}.{ext}
 * so exports are sortable, attributable, and consistent across pages.
 *
 * Previously every page hand-rolled its own CSV serialization with
 * slightly different headers, escape rules, and filename conventions.
 */

export type ExportFormat = 'csv' | 'json'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function sanitizeScope(scope: string): string {
  return scope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'results'
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.map(escapeCsvValue).join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => escapeCsvValue(row[h])).join(','))
  }
  return lines.join('\n')
}

function triggerBlobDownload(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export rows as CSV or JSON with a conventional filename.
 *
 *   downloadAs('csv', genes, 'search_BBS')
 *   → ciliaminer_search_bbs_2026-04-15.csv
 */
export function downloadAs(
  format: ExportFormat,
  rows: Record<string, unknown>[],
  scope: string
): void {
  if (rows.length === 0) return
  const filename = `ciliaminer_${sanitizeScope(scope)}_${todayIso()}.${format}`
  if (format === 'csv') {
    triggerBlobDownload(rowsToCsv(rows), 'text/csv;charset=utf-8', filename)
  } else {
    triggerBlobDownload(JSON.stringify(rows, null, 2), 'application/json', filename)
  }
}

/**
 * Multi-section CSV — used by advanced search where one export contains
 * genes + features + orthologs. Each section gets its own header block
 * separated by a blank line.
 */
export function downloadMultiSectionCsv(
  sections: Array<{ title: string; rows: Record<string, unknown>[] }>,
  scope: string
): void {
  const nonEmpty = sections.filter(s => s.rows.length > 0)
  if (nonEmpty.length === 0) return

  const parts: string[] = []
  nonEmpty.forEach((section, i) => {
    if (i > 0) parts.push('')
    parts.push(`# ${section.title}`)
    parts.push(rowsToCsv(section.rows))
  })

  const filename = `ciliaminer_${sanitizeScope(scope)}_${todayIso()}.csv`
  triggerBlobDownload(parts.join('\n'), 'text/csv;charset=utf-8', filename)
}
