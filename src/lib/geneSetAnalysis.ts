/**
 * Gene Set Analysis — annotate a user-supplied list of gene symbols
 * against the CiliaMiner v15 catalogue.
 *
 * For each input gene, returns whether it's in the catalogue and (if so)
 * its associated diseases, ciliopathy classes, functional category,
 * localization, and full name.  Aggregated counts across all matched
 * genes power the breakdown charts on the analysis page.
 *
 * Defensive parsing: v15 data fields can be `""`, `null`, semicolon-joined
 * strings, or arrays — the `arr()` helper normalises all of these.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface GeneAnnotation {
  symbol:               string
  in_catalogue:         boolean
  matched_via?:         string             // the input symbol, if it differed from canonical (i.e. matched via synonym)
  full_name?:           string
  diseases:             string[]
  ciliopathy_classes:   string[]
  functional_category:  string[]
  localization:         string[]
}

export interface AnalysisResult {
  total_input:          number
  total_unique:         number
  matched:              GeneAnnotation[]    // in catalogue
  unmatched:            string[]            // not in catalogue
  duplicates_removed:   number

  // Aggregated counts across matched genes
  class_counts:         Record<string, number>     // Primary / TR / Motile / Secondary
  disease_counts:       Record<string, number>     // disease name → # input genes implicated
  category_counts:      Record<string, number>     // functional category → count
  localization_counts:  Record<string, number>     // localization → count

  // Catalogue baseline for enrichment context
  catalogue_size:       number
}

interface RawV15 {
  genes: Record<string, {
    full_name?:           string | null
    ciliopathies?:        string[] | string | null
    ciliopathy_classes?:  string[] | string | null
    functional_category?: string[] | string | null
    localization?:        string[] | string | null
    synonyms?:            string[] | string | null
  }>
}

// ── Catalogue loader (cached after first call) ─────────────────────────

let CATALOGUE: RawV15 | null = null
let inflight:  Promise<RawV15> | null = null

export async function loadCatalogue(basePath = ''): Promise<RawV15> {
  if (CATALOGUE) return CATALOGUE
  if (inflight) return inflight
  inflight = fetch(`${basePath}/data/ciliopathy_genes_v15.json`, { cache: 'default' })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load v15 catalogue: ${r.status}`)
      return r.json() as Promise<RawV15>
    })
    .then((c) => { CATALOGUE = c; return c })
  return inflight
}

// ── Defensive field parsing ────────────────────────────────────────────

/** Normalises a v15 field that may be array, semicolon-string, null, or "". */
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String)
  if (typeof v === 'string') {
    if (!v.trim()) return []
    return v.split(';').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

// ── Input parsing ──────────────────────────────────────────────────────

/**
 * Splits a free-form input on commas, whitespace, tabs, newlines, and
 * semicolons. Uppercases and trims each token. Drops empties.
 */
export function parseGeneList(input: string): { symbols: string[]; duplicates: number } {
  if (!input || !input.trim()) return { symbols: [], duplicates: 0 }
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9][A-Z0-9._-]*$/.test(t))
  const seen = new Set<string>()
  let dups = 0
  for (const t of tokens) {
    if (seen.has(t)) dups++
    else seen.add(t)
  }
  return { symbols: Array.from(seen), duplicates: dups }
}

// ── Core analysis ──────────────────────────────────────────────────────

export function analyze(input: string, catalogue: RawV15): AnalysisResult {
  const { symbols, duplicates } = parseGeneList(input)
  const total_input = symbols.length + duplicates

  const matched:   GeneAnnotation[] = []
  const unmatched: string[]         = []

  // Build two lookup indices:
  //   canonicalUpper — key: UPPERCASE canonical symbol → value: canonical (original case)
  //   synonymUpper   — key: UPPERCASE synonym          → value: canonical (original case)
  //
  // Canonical wins over synonym: if a token matches both a canonical symbol and a
  // synonym of some other gene (rare but possible), we prefer the canonical match.
  const canonicalUpper = new Map<string, string>()
  const synonymUpper   = new Map<string, string>()
  Object.keys(catalogue.genes || {}).forEach((canonical) => {
    canonicalUpper.set(canonical.toUpperCase(), canonical)
  })
  Object.entries(catalogue.genes || {}).forEach(([canonical, gene]) => {
    for (const syn of arr(gene.synonyms)) {
      const synKey = syn.toUpperCase()
      // Don't overwrite: canonical always wins; first-registered synonym wins over later duplicates
      if (canonicalUpper.has(synKey))  continue
      if (synonymUpper.has(synKey))    continue
      synonymUpper.set(synKey, canonical)
    }
  })

  for (const sym of symbols) {
    let canonical = canonicalUpper.get(sym)
    let matchedVia: string | undefined
    if (!canonical) {
      const viaSyn = synonymUpper.get(sym)
      if (viaSyn) {
        canonical  = viaSyn
        matchedVia = sym                     // the input token that matched (a synonym)
      }
    }
    if (!canonical) {
      unmatched.push(sym)
      continue
    }
    const g = catalogue.genes[canonical]
    matched.push({
      symbol:              canonical,
      in_catalogue:        true,
      matched_via:         matchedVia,
      full_name:           (g.full_name || undefined) as string | undefined,
      diseases:            arr(g.ciliopathies),
      ciliopathy_classes:  arr(g.ciliopathy_classes),
      functional_category: arr(g.functional_category),
      localization:        arr(g.localization),
    })
  }

  // Aggregated counts
  const class_counts:        Record<string, number> = {}
  const disease_counts:      Record<string, number> = {}
  const category_counts:     Record<string, number> = {}
  const localization_counts: Record<string, number> = {}

  for (const m of matched) {
    for (const c of m.ciliopathy_classes) class_counts[c]        = (class_counts[c]        || 0) + 1
    for (const d of m.diseases)           disease_counts[d]      = (disease_counts[d]      || 0) + 1
    for (const f of m.functional_category) category_counts[f]    = (category_counts[f]     || 0) + 1
    for (const l of m.localization)       localization_counts[l] = (localization_counts[l] || 0) + 1
  }

  return {
    total_input,
    total_unique:        symbols.length,
    matched,
    unmatched,
    duplicates_removed:  duplicates,
    class_counts,
    disease_counts,
    category_counts,
    localization_counts,
    catalogue_size:      Object.keys(catalogue.genes || {}).length,
  }
}

// ── CSV export ─────────────────────────────────────────────────────────

export function resultToCsv(result: AnalysisResult): string {
  const header = [
    'gene_symbol',
    'in_catalogue',
    'matched_via_synonym',
    'full_name',
    'ciliopathy_classes',
    'diseases',
    'functional_category',
    'localization',
  ].join(',')

  const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const rows: string[] = [header]

  for (const m of result.matched) {
    rows.push([
      m.symbol,
      'TRUE',
      m.matched_via || '',
      escape(m.full_name || ''),
      escape(m.ciliopathy_classes.join('; ')),
      escape(m.diseases.join('; ')),
      escape(m.functional_category.join('; ')),
      escape(m.localization.join('; ')),
    ].join(','))
  }
  for (const u of result.unmatched) {
    rows.push([u, 'FALSE', '', '', '', '', '', ''].join(','))
  }
  return rows.join('\n')
}
