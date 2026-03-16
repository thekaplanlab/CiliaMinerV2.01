/**
 * excelParser.ts
 *
 * Loads the CiliaMiner Excel workbook in the browser via SheetJS (xlsx) and
 * exposes typed validation helpers. All data parsing and validation happens
 * here; the data service builds domain objects on top of these primitives.
 */

import * as XLSX from 'xlsx'

// ── Public types ─────────────────────────────────────────────────────────────

export type RawRow = Record<string, unknown>

/**
 * A single validation issue recorded while mapping an Excel row to a typed
 * domain object. Only required fields generate issues; optional fields that
 * are null/empty are silently coerced.
 */
export interface DataQualityIssue {
  /** Sheet the row came from */
  sheet: string
  /** 0-based row index inside the sheet */
  rowIndex: number
  /** Gene name of the row (best-effort, may be "unknown") */
  gene: string
  /** Column / field that had the problem */
  field: string
  /** Nature of the problem */
  issue: 'missing' | 'empty' | 'invalid'
  /** Raw cell value */
  originalValue: unknown
  /** Fallback value used instead */
  usedFallback: string
}

export interface DataQualityReport {
  /** URL the workbook was fetched from */
  source: string
  /** ISO timestamp of the load */
  loadedAt: string
  /** All sheet names found in the workbook */
  sheetsFound: string[]
  /** Expected sheets not present in the workbook */
  sheetsMissing: string[]
  /**
   * Datasets that could not be read from the workbook and were loaded from a
   * static JSON fallback file instead.
   */
  datasetsFromFallbackJson: string[]
  totalRowsProcessed: number
  totalIssues: number
  /** Per-field issue counts – useful for spotting systematic data gaps */
  issuesByField: Record<string, number>
  /** Full issue list, capped at MAX_ISSUES_IN_REPORT to avoid memory bloat */
  issues: DataQualityIssue[]
}

export interface ParsedWorkbook {
  sheets: Record<string, RawRow[]>
  sheetNames: string[]
  hasSheet: (name: string) => boolean
  getSheet: (name: string) => RawRow[]
}

// ── Internal constants ───────────────────────────────────────────────────────

/** Sheets the app knows how to consume; absence is reported as a warning. */
const EXPECTED_SHEETS = [
  'genes',
  'symptome_primary',
  'symptome_secondary',
  'gene_localisations_ciliacarta',
]

const MAX_ISSUES_IN_REPORT = 500

// ── Workbook loader ──────────────────────────────────────────────────────────

/**
 * Fetches the Excel workbook at `url`, parses it with SheetJS and returns a
 * thin wrapper with sheet accessors plus the list of expected-but-missing
 * sheets.
 */
export async function loadWorkbook(
  url: string
): Promise<{ workbook: ParsedWorkbook; missingSheets: string[] }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch workbook from "${url}" (HTTP ${response.status} ${response.statusText})`
    )
  }

  const buffer = await response.arrayBuffer()
  // cellDates: false keeps dates as serial numbers (simpler for our data)
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const sheets: Record<string, RawRow[]> = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    // defval: null ensures missing cells become null rather than undefined
    sheets[name] = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null })
  }

  const missingSheets = EXPECTED_SHEETS.filter(name => !(name in sheets))

  return {
    workbook: {
      sheets,
      sheetNames: wb.SheetNames,
      hasSheet: (name: string) => name in sheets,
      getSheet: (name: string) => sheets[name] ?? [],
    },
    missingSheets,
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────

/**
 * Returns a non-empty trimmed string or `fallback`, recording a quality issue
 * when the original value was absent or empty. Use for **required** fields.
 */
export function safeString(
  value: unknown,
  fieldName: string,
  rowIndex: number,
  sheetName: string,
  gene: string,
  issues: DataQualityIssue[],
  fallback = 'Unknown'
): string {
  if (value === null || value === undefined) {
    if (issues.length < MAX_ISSUES_IN_REPORT) {
      issues.push({
        sheet: sheetName,
        rowIndex,
        gene,
        field: fieldName,
        issue: 'missing',
        originalValue: value,
        usedFallback: fallback,
      })
    }
    return fallback
  }

  const str = String(value).trim()
  if (!str) {
    if (issues.length < MAX_ISSUES_IN_REPORT) {
      issues.push({
        sheet: sheetName,
        rowIndex,
        gene,
        field: fieldName,
        issue: 'empty',
        originalValue: value,
        usedFallback: fallback,
      })
    }
    return fallback
  }

  return str
}

/**
 * Returns a trimmed string without recording a quality issue. Use for
 * **optional** fields where absence is normal.
 */
export function safeStringOptional(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value).trim() || fallback
}

/**
 * Splits a delimited cell value (semicolons, commas, or " | ") into a
 * trimmed, de-duplicated string array.
 */
export function safeStringList(value: unknown): string[] {
  if (value === null || value === undefined) return []
  const str = String(value).trim()
  if (!str) return []
  const parts = str.split(/[;,]\s*|\s*\|\s*/).map(s => s.trim()).filter(Boolean)
  return Array.from(new Set(parts))
}

// ── Annotation ID parser ─────────────────────────────────────────────────────

const RE_GO = /^GO:\d{7}$/
const RE_REACTOME = /^R-HSA-\d+$/
const RE_KEGG = /^(?:path:)?hsa\d+$|^ko\d+$|^map\d+$/

export interface AnnotationIds {
  go_terms: string[]
  reactome_pathways: string[]
  kegg_pathways: string[]
  other_annotations: string[]
}

/**
 * Parses the mixed annotation ID string (column "ID" in the main gene sheet)
 * into typed lists. Mirrors the Python logic in scripts/convert_excel_to_json.py.
 */
export function parseAnnotationIds(value: unknown): AnnotationIds {
  const ids = safeStringList(value)
  const result: AnnotationIds = {
    go_terms: [],
    reactome_pathways: [],
    kegg_pathways: [],
    other_annotations: [],
  }

  for (const id of ids) {
    if (RE_GO.test(id)) result.go_terms.push(id)
    else if (RE_REACTOME.test(id)) result.reactome_pathways.push(id)
    else if (RE_KEGG.test(id)) result.kegg_pathways.push(id.replace('path:', ''))
    else result.other_annotations.push(id)
  }

  return result
}

/**
 * Picks the first ENSG* Ensembl gene ID from a comma-separated cell value.
 * Returns empty string if none found.
 */
export function pickEnsemblId(value: unknown): string {
  for (const token of safeStringList(value)) {
    if (token.startsWith('ENSG')) return token
  }
  return ''
}
