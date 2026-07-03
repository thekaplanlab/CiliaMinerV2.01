/**
 * clinicalFeaturesData.ts — lazy loader for the OMIM-derived clinical
 * features layer (S5 v25 provenance). Backed by
 * /data/clinical_features_v1.json — 1.4 MB, 160 KB gzipped.
 *
 * Per disease, gives:
 *   - by_organ_records: organ → concept entries with the raw OMIM phrases
 *     that mapped to each canonical concept (the actual provenance trail)
 *   - representative_phrases: 1-3 short OMIM excerpts to display as a
 *     "clinical description" block (license-safe: short excerpts only)
 *   - summary: aggregate counts and the original Top-5-concepts string
 */

export interface ProvenanceSource {
  raw_phrase: string
  mapping_method: string
  hpo_id: string
  parent_concept: string
  note: string
}

export interface ClinicalConcept {
  concept: string
  hpo_id: string
  parent_concept: string
  evidence_count: number
  sources: ProvenanceSource[]
}

export interface ClinicalDisease {
  by_organ_records: Record<string, ClinicalConcept[]>
  representative_phrases: Array<{ phrase: string; concept: string }>
  summary: {
    total_records?: number
    mapped_records?: number
    n_organs?: number
    n_concepts?: number
    organs_involved?: string[]
    top_concepts_text?: string
  }
}

export interface ClinicalFile {
  version: string
  source: string
  count: number
  diseases: Record<string, ClinicalDisease>
}

let cached: ClinicalFile | null = null
let inflight: Promise<ClinicalFile> | null = null
const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH || ''

export async function loadClinical(): Promise<ClinicalFile> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = fetch(`${basePath()}/data/clinical_features_v1.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load clinical features (HTTP ${res.status}).`)
      const data = (await res.json()) as ClinicalFile
      cached = data
      return data
    })
    .catch((err) => { inflight = null; throw err })
  return inflight
}

/**
 * Case-insensitive disease lookup, tolerant of capitalisation drift between
 * v15 and S5 (eg "Joubert Syndrome" vs "Joubert syndrome").
 */
export async function getClinicalFor(diseaseName: string): Promise<ClinicalDisease | null> {
  const file = await loadClinical()
  if (file.diseases[diseaseName]) return file.diseases[diseaseName]
  const target = diseaseName.toLowerCase()
  for (const k of Object.keys(file.diseases)) {
    if (k.toLowerCase() === target) return file.diseases[k]
  }
  return null
}
