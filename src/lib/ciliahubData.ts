/**
 * ciliahubData.ts
 *
 * Lazy loader for the ciliahub enrichment layer — fields not present in
 * the v15 master (ClinVar variants, GO terms, AlphaFold URL, orthologs
 * across 5 organisms, ciliogenics screens, publications).
 *
 * The slim file is ~1.9 MB (~270 KB gzipped) and only contains records
 * for the 561 of 607 v15 genes that exist in the ciliahub dataset.
 * Genes outside that intersection silently fall through (the page just
 * doesn't render the augmentation sections for them).
 */

export interface ClinvarVariant {
  id: string
  title: string
  significance: string | null
  url: string
}

export interface Publication {
  pmid: string
  title: string
  year: string | number
}

export interface CiliahubOrthologs {
  mouse: string
  c_elegans: string
  xenopus: string
  zebrafish: string
  drosophila: string
}

export interface CiliahubEnrichment {
  ensembl_id: string
  uniprot_id: string
  alphafold_url: string
  go_bp: string[]
  go_mf: string[]
  go_cc: string[]
  pfam_ids: string[]
  domain_descriptions: string[]
  orthologs: CiliahubOrthologs
  clinvar_count: number
  clinvar_top: ClinvarVariant[]
  lof_effects: string
  overexpression_effects: string
  percent_ciliated_cells_effects: string
  publications: Publication[]
  source: string
  evidence_tier: string
}

export type CiliahubFile = Record<string, CiliahubEnrichment>

let cached: CiliahubFile | null = null
let inflight: Promise<CiliahubFile> | null = null

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export async function loadCiliahub(): Promise<CiliahubFile> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch(`${basePath()}/data/ciliahub_slim.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load ciliahub data (HTTP ${res.status}).`)
      }
      const data = (await res.json()) as CiliahubFile
      cached = data
      return data
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

/** Returns the enrichment for a gene symbol, or null if not in the slim file. */
export async function getEnrichment(symbol: string): Promise<CiliahubEnrichment | null> {
  const f = await loadCiliahub()
  return f[symbol] ?? f[symbol.toUpperCase()] ?? null
}
