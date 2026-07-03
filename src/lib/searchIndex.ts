/**
 * searchIndex.ts
 *
 * Lightweight client-side search index for genes and diseases.
 *
 * Loads /data/search_index.json once and answers autocomplete queries
 * against an in-memory representation. The index file is built from
 * ciliopathy_genes_FINAL_v15.json (see scripts) and ships ~110 KB raw
 * / ~23 KB gzipped, which is small enough to keep on every page that
 * needs the search box.
 *
 * Used by:
 *   - the home page search box (see src/app/page.tsx)
 *   - any other page that wants autocomplete without pulling the full
 *     master JSON.
 *
 * The loader is a singleton (module-level promise) — multiple components
 * may call loadSearchIndex() concurrently and they will all wait on the
 * same fetch.
 */

// --- Wire types (mirror the compact keys produced by the build script) ----

interface RawGene {
  g: string                     // gene symbol
  s: string[]                   // synonyms
  d: string[]                   // diseases
  c: string[]                   // class(es)
  n: number                     // disease count
  o?: string                    // OMIM id
}

interface RawDisease {
  n: string                     // name
  c: string                     // class
  s: string[]                   // synonyms
  a: string                     // abbreviation
  g: number                     // gene count
  op?: string                   // OMIM preferred name
}

interface RawIndex {
  stats: {
    total_genes: number
    total_diseases: number
    total_classes: number
    version: string
    generated_at: string
    principle: string
    class_counts: Record<string, number>
    per_class_gene_counts: Record<string, number>
  }
  genes: RawGene[]
  diseases: RawDisease[]
}

// --- Public-facing types --------------------------------------------------

export interface GeneRecord {
  symbol: string
  synonyms: string[]
  diseases: string[]
  classes: string[]
  diseaseCount: number
  omimId?: string
}

export interface DiseaseRecord {
  name: string
  className: string
  synonyms: string[]
  abbreviation: string
  geneCount: number
  omimPreferred?: string
}

export interface SearchStats {
  totalGenes: number
  totalDiseases: number
  totalClasses: number
  version: string
  generatedAt: string
  principle: string
  classCounts: Record<string, number>
  perClassGeneCounts: Record<string, number>
}

export interface LoadedIndex {
  stats: SearchStats
  genes: GeneRecord[]
  diseases: DiseaseRecord[]
}

// --- Loader ---------------------------------------------------------------

let cached: LoadedIndex | null = null
let inflight: Promise<LoadedIndex> | null = null

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export async function loadSearchIndex(): Promise<LoadedIndex> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch(`${basePath()}/data/search_index.json`, { cache: 'force-cache' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to load search index (HTTP ${res.status}). ` +
          `Make sure public/data/search_index.json exists.`
        )
      }
      const raw = (await res.json()) as RawIndex
      const loaded: LoadedIndex = {
        stats: {
          totalGenes:          raw.stats.total_genes,
          totalDiseases:       raw.stats.total_diseases,
          totalClasses:        raw.stats.total_classes,
          version:             raw.stats.version,
          generatedAt:         raw.stats.generated_at,
          principle:           raw.stats.principle,
          classCounts:         raw.stats.class_counts || {},
          perClassGeneCounts:  raw.stats.per_class_gene_counts || {},
        },
        genes: raw.genes.map((g) => ({
          symbol:        g.g,
          synonyms:      g.s || [],
          diseases:      g.d || [],
          classes:       g.c || [],
          diseaseCount:  g.n ?? (g.d?.length ?? 0),
          omimId:        g.o,
        })),
        diseases: raw.diseases.map((d) => ({
          name:           d.n,
          className:      d.c,
          synonyms:       d.s || [],
          abbreviation:   d.a || '',
          geneCount:      d.g ?? 0,
          omimPreferred:  d.op,
        })),
      }
      cached = loaded
      return loaded
    })
    .catch((err) => {
      // reset inflight on error so a retry can be attempted
      inflight = null
      throw err
    })

  return inflight
}

// --- Search --------------------------------------------------------------

export type SuggestionKind = 'gene' | 'disease'

export interface Suggestion {
  kind: SuggestionKind
  /** Display label (gene symbol or disease name). */
  label: string
  /** A short secondary line shown beneath the label. */
  sublabel?: string
  /** Optional tertiary chip (e.g. disease class, gene count). */
  meta?: string
  /** When the match came from a synonym/abbreviation, show what we matched. */
  matchedOn?: string
  /** Where Enter / click should go. */
  href: string
}

interface RankedSuggestion extends Suggestion {
  _score: number
}

/**
 * Returns ranked suggestions for the given query.
 *
 * Ranking rules (lower = better):
 *  - exact case-insensitive match on symbol / name      : 0
 *  - prefix match on symbol / name                       : 1
 *  - exact match on a synonym / abbreviation             : 2
 *  - prefix match on a synonym / abbreviation            : 3
 *  - substring match on name or synonym                  : 4
 *
 * Ties are broken by disease count (more = better) for genes,
 * and by gene count (more = better) for diseases.
 */
export function searchIndex(
  index: LoadedIndex,
  rawQuery: string,
  limit = 10
): Suggestion[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return []

  const out: RankedSuggestion[] = []

  // ---- genes -----------------------------------------------------------
  for (const g of index.genes) {
    const symLower = g.symbol.toLowerCase()
    let score = -1
    let matchedOn: string | undefined

    if (symLower === q) score = 0
    else if (symLower.startsWith(q)) score = 1
    else {
      // synonym pass
      for (const syn of g.synonyms) {
        const sl = syn.toLowerCase()
        if (sl === q) { score = 2; matchedOn = syn; break }
        if (sl.startsWith(q)) {
          if (score < 0 || score > 3) { score = 3; matchedOn = syn }
        }
      }
      if (score < 0 && symLower.includes(q)) score = 4
    }

    if (score < 0) continue

    const diseaseHead = g.diseases[0] ?? ''
    const sub =
      g.diseaseCount > 1
        ? `${diseaseHead} +${g.diseaseCount - 1} more`
        : diseaseHead
    const cls = g.classes[0]

    out.push({
      _score: score - g.diseaseCount * 0.001,
      kind: 'gene',
      label: g.symbol,
      sublabel: sub || undefined,
      meta: cls,
      matchedOn,
      href: `/gene/${encodeURIComponent(g.symbol)}`,
    })
  }

  // ---- diseases --------------------------------------------------------
  for (const d of index.diseases) {
    const nameLower = d.name.toLowerCase()
    let score = -1
    let matchedOn: string | undefined

    if (nameLower === q) score = 0
    else if (nameLower.startsWith(q)) score = 1
    else if (d.abbreviation) {
      // Abbreviations may be compound, e.g. "JBTS / JS" or "PCD, CILD".
      // Split on slash, comma, and bullet so each token can match on its
      // own — typing "JS" still finds Joubert Syndrome.
      const abbrParts = d.abbreviation
        .split(/[/,·•]/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const part of abbrParts) {
        const pl = part.toLowerCase()
        if (pl === q) { score = 2; matchedOn = part; break }
        if (pl.startsWith(q) && (score < 0 || score > 3)) {
          score = 3; matchedOn = part
        }
      }
    }
    if (score < 0) {
      for (const syn of d.synonyms) {
        const sl = syn.toLowerCase()
        if (sl === q) { score = 2; matchedOn = syn; break }
        if (sl.startsWith(q)) {
          if (score < 0 || score > 3) { score = 3; matchedOn = syn }
        }
      }
      if (score < 0 && nameLower.includes(q)) score = 4
    }

    if (score < 0) continue

    out.push({
      _score: score - d.geneCount * 0.001,
      kind: 'disease',
      label: d.name,
      sublabel: d.geneCount > 0
        ? `${d.geneCount} gene${d.geneCount === 1 ? '' : 's'}`
        : undefined,
      meta: d.className,
      matchedOn,
      href: `/disease/${encodeURIComponent(d.name)}`,
    })
  }

  // sort by score then alphabetic on label (stable enough for tied cases)
  out.sort((a, b) => a._score - b._score || a.label.localeCompare(b.label))

  // strip score and trim
  return out.slice(0, limit).map(({ _score, ...rest }) => rest)
}
