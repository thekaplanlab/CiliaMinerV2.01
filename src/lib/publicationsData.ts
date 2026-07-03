/**
 * publicationsData.ts
 *
 * Lazy loader for the Publications section, backed by /data/publications.json.
 *
 * Records are ingested weekly from Europe PMC and summarized exactly once, at
 * ingest time (see backend/app/services/publications_ingest.py). This loader
 * only reads the stored `ai_summary` — it never generates summaries on load.
 */

export interface Publication {
  pmid: string
  title: string | null
  authors: string | null
  journal: string | null
  date: string | null
  /** Omitted from the public copy to keep the payload small; kept in the backend store. */
  abstract?: string | null
  /** Null when the article has no summary yet (no abstract, or backfilled without one). */
  ai_summary: string | null
  /** DOI or PubMed URL — always populated. */
  source_link: string
  genes: string[]
  diseases?: string[]
  /** ISO date the record was first ingested; drives the "New" badge. */
  first_seen?: string | null
}

let cached: Publication[] | null = null
let inflight: Promise<Publication[]> | null = null

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export async function loadPublications(): Promise<Publication[]> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch(`${basePath()}/data/publications.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load publications (HTTP ${res.status}).`)
      }
      const data = (await res.json()) as Publication[]
      cached = Array.isArray(data) ? data : []
      return cached
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

/**
 * Normalise a disease name for tolerant matching — lower-cased, punctuation and
 * runs of whitespace collapsed to single spaces. Lets "Bardet-Biedl Syndrome"
 * match the publications tag "Bardet-Biedl syndrome".
 */
export function normalizeDiseaseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Build a lookup of normalised disease name → PMIDs (newest first, de-duped),
 * from the publications corpus. Used to surface a real PubMed citation for a
 * disease where one exists. Returns {} if publications fail to load.
 */
export async function loadDiseasePmidIndex(): Promise<Record<string, string[]>> {
  let pubs: Publication[]
  try {
    pubs = await loadPublications()
  } catch {
    return {}
  }
  const grouped: Record<string, Array<{ pmid: string; date: string }>> = {}
  for (const p of pubs) {
    if (!p.pmid) continue
    for (const dz of p.diseases ?? []) {
      const key = normalizeDiseaseName(dz)
      if (!key) continue
      ;(grouped[key] ||= []).push({ pmid: p.pmid, date: p.date || '' })
    }
  }
  const index: Record<string, string[]> = {}
  for (const [key, arr] of Object.entries(grouped)) {
    // Newest first (ISO date strings sort lexicographically); undated last.
    arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const seen = new Set<string>()
    index[key] = arr
      .map((x) => x.pmid)
      .filter((pmid) => (seen.has(pmid) ? false : (seen.add(pmid), true)))
  }
  return index
}
