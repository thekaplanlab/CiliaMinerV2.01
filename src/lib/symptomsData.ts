/**
 * symptomsData.ts
 *
 * Lazy loader for the v3.3 ciliopathy symptoms layer (HPO IDs, organ
 * systems, canonicalised concepts) backed by /data/cilia_symptoms_v3.json.
 *
 * The file is ~1.5 MB (~280 KB gzipped) and is fetched on-demand only
 * by pages that need it (/symptoms-diseases and /disease/[name]).
 */

// --- Wire shape (mirrors the file) ---------------------------------------

export interface SymptomEntry {
  /** Canonical concept label (e.g. "Polydactyly"). */
  concept: string
  /** HPO ontology IDs associated with this concept. */
  hpo_ids: string[]
  /** Organ system bucket (e.g. "CNS", "Eye", "Skeletal"). */
  organ: string
  /** Parent concept (one level up in the ontology). */
  parent_concept?: string
  /** Evidence count — how many raw records mapped to this concept. */
  count: number
}

export interface SymptomDisease {
  name: string
  slug: string
  /** Top-level class ("Primary multisystem", "Primary tissue-specific", "Motile", "Unclassified"). */
  class: string
  /** Catalogue subtype label (matches v15 ciliopathy_class). */
  subtype?: string
  genes: string[]
  n_records: number
  n_hpo: number
  hpo_ids: string[]
  organ_systems: string[]
  /** organ -> count, used to size the organ-rollup chart. */
  organ_counts: Record<string, number>
  symptoms: SymptomEntry[]
  /** organ -> list of [concept, count] for the heatmap-style view. */
  concepts_by_organ: Record<string, Array<[string, number]>>
  search_aliases: string[]
  inheritance: string | null
}

export interface SymptomConcept {
  hpo_ids: string[]
  organ: string
  parent_concept?: string
  diseases: Array<{
    name: string
    slug: string
    class: string
    evidence_count: number
  }>
}

export interface SymptomsFile {
  version: string
  generated_at: string
  stats: {
    n_diseases: number
    n_genes: number
    n_concepts: number
    n_organs: number
    n_records: number
    by_class: Record<string, number>
  }
  diseases: Record<string, SymptomDisease>
  concepts: Record<string, SymptomConcept>
  /** Folk / alternative term → canonical concept (e.g. "crab sign" -> "White matter abnormality"). */
  synonyms: Record<string, string>
}

// --- Loader (singleton promise) -----------------------------------------

let cached: SymptomsFile | null = null
let inflight: Promise<SymptomsFile> | null = null

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export async function loadSymptoms(): Promise<SymptomsFile> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch(`${basePath()}/data/cilia_symptoms_v3.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load symptoms data (HTTP ${res.status}).`)
      }
      const data = (await res.json()) as SymptomsFile
      cached = data
      return data
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

// --- Convenience accessors ----------------------------------------------

/**
 * Look up the symptom block for a disease name. The lookup is
 * case-insensitive and also tries the slug form, so disease names that
 * differ in capitalisation between v15 and v3.3 still resolve.
 */
export async function getSymptomsFor(diseaseName: string): Promise<SymptomDisease | null> {
  const f = await loadSymptoms()
  // direct hit
  if (f.diseases[diseaseName]) return f.diseases[diseaseName]
  // case-insensitive scan (small set, fast enough)
  const target = diseaseName.toLowerCase()
  for (const k of Object.keys(f.diseases)) {
    if (k.toLowerCase() === target) return f.diseases[k]
  }
  // slug match
  const slug = diseaseName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
  for (const k of Object.keys(f.diseases)) {
    if (f.diseases[k].slug === slug) return f.diseases[k]
  }
  return null
}
