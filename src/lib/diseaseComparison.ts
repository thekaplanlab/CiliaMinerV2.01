/**
 * Disease comparison — set-based analysis of the curated symptom concepts
 * shared across 2 to 4 selected ciliopathies.
 *
 * For each concept present in any selected disease, we track which of the
 * selected diseases exhibits it. The result supports:
 *
 *   • summary counts: union, shared-by-all, unique-per-disease
 *   • filtering: "shared by all" / "shared by ≥ N" / "unique to disease X"
 *   • grouping by organ system
 *   • CSV export
 *
 * Data source: clinical_features_v1.json (76 curated diseases).
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ConceptRow {
  organ:          string
  concept:        string
  hpo_id:         string | null
  parent_concept: string
  /** Boolean flags: which of the selected diseases exhibit this concept */
  presence:       boolean[]        // length === selected.length
  present_count:  number           // how many diseases share it
}

export interface Comparison {
  selected:              string[]
  total_concepts:        number
  shared_by_all_count:   number
  shared_by_at_least_2:  number
  unique_by_disease:     Record<string, number>
  rows:                  ConceptRow[]      // sorted: organ, then most-shared first
}

interface ConceptEntry {
  concept:        string
  hpo_id:         string | null
  parent_concept: string
}
interface DiseaseRecord {
  by_organ_records?: Record<string, ConceptEntry[]>
}
export interface ClinicalFile {
  diseases: Record<string, DiseaseRecord>
}

// ── Loader ───────────────────────────────────────────────────────────

let CLINICAL: ClinicalFile | null = null
let inflight: Promise<ClinicalFile> | null = null
export async function loadClinical(): Promise<ClinicalFile> {
  if (CLINICAL) return CLINICAL
  if (inflight) return inflight
  inflight = fetch('/data/clinical_features_v1.json', { cache: 'default' })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load clinical_features_v1.json: ${r.status}`)
      return r.json() as Promise<ClinicalFile>
    })
    .then((c) => { CLINICAL = c; return c })
  return inflight
}

// ── Core comparison ──────────────────────────────────────────────────

/**
 * Compute the intersection / union / uniqueness analysis for the given
 * selected diseases. Diseases without curated data are silently dropped.
 */
export function compare(
  selected:  string[],
  clinical:  ClinicalFile,
): Comparison {
  // Filter to diseases actually present in the catalogue
  const valid = selected.filter((d) => clinical.diseases[d])
  if (valid.length === 0) {
    return {
      selected: [],
      total_concepts: 0,
      shared_by_all_count: 0,
      shared_by_at_least_2: 0,
      unique_by_disease: {},
      rows: [],
    }
  }

  // Aggregate: concept → { organ, hpo_id, parent, presence per disease }
  interface AggEntry {
    organ:          string
    concept:        string
    hpo_id:         string | null
    parent_concept: string
    presence:       boolean[]
  }
  const agg = new Map<string, AggEntry>()

  valid.forEach((disease, dIdx) => {
    const rec = clinical.diseases[disease]
    if (!rec) return
    const bor = rec.by_organ_records || {}
    Object.entries(bor).forEach(([organ, entries]) => {
      if (!Array.isArray(entries)) return
      entries.forEach((e) => {
        if (!e || typeof e.concept !== 'string') return
        let a = agg.get(e.concept)
        if (!a) {
          a = {
            organ,
            concept:        e.concept,
            hpo_id:         e.hpo_id || null,
            parent_concept: e.parent_concept || '',
            presence:       new Array(valid.length).fill(false),
          }
          agg.set(e.concept, a)
        }
        a.presence[dIdx] = true
      })
    })
  })

  // Materialise + counts
  const rows: ConceptRow[] = []
  const uniqueByDisease: Record<string, number> = {}
  valid.forEach((d) => { uniqueByDisease[d] = 0 })
  let sharedByAll   = 0
  let sharedByTwoPlus = 0

  agg.forEach((entry) => {
    const present_count = entry.presence.filter(Boolean).length
    rows.push({
      organ:          entry.organ,
      concept:        entry.concept,
      hpo_id:         entry.hpo_id,
      parent_concept: entry.parent_concept,
      presence:       entry.presence,
      present_count,
    })
    if (present_count === valid.length) sharedByAll++
    if (present_count >= 2)             sharedByTwoPlus++
    if (present_count === 1) {
      const idx = entry.presence.indexOf(true)
      uniqueByDisease[valid[idx]]++
    }
  })

  // Sort: organ alphabetical, then present_count desc, then concept alphabetical
  rows.sort((a, b) => {
    if (a.organ !== b.organ) return a.organ.localeCompare(b.organ)
    if (a.present_count !== b.present_count) return b.present_count - a.present_count
    return a.concept.localeCompare(b.concept)
  })

  return {
    selected:             valid,
    total_concepts:       rows.length,
    shared_by_all_count:  sharedByAll,
    shared_by_at_least_2: sharedByTwoPlus,
    unique_by_disease:    uniqueByDisease,
    rows,
  }
}

// ── Available diseases (for the picker) ──────────────────────────────

export function listAvailableDiseases(clinical: ClinicalFile): string[] {
  return Object.keys(clinical.diseases).sort()
}

// ── CSV export ───────────────────────────────────────────────────────

export function comparisonToCsv(c: Comparison): string {
  const header = ['organ', 'concept', 'hpo_id', 'parent_concept', 'present_count', ...c.selected]
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const rows: string[] = [header.map((h) => esc(h)).join(',')]
  c.rows.forEach((r) => {
    rows.push([
      esc(r.organ),
      esc(r.concept),
      r.hpo_id || '',
      esc(r.parent_concept),
      String(r.present_count),
      ...r.presence.map((p) => (p ? '1' : '0')),
    ].join(','))
  })
  return rows.join('\n')
}
