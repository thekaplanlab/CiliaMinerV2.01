/**
 * similarityData.ts — lazy loader for pre-computed disease similarity.
 *
 * Backed by /data/disease_similarity_v1.json (218 KB, 25 KB gzipped).
 * For each disease, the top-10 most similar diseases by information-content
 * weighted Jaccard similarity over canonicalised concept sets.
 */

export interface SimilarDisease {
  disease: string
  jaccard: number
  shared_count: number
  a_only_count: number
  b_only_count: number
  /** Top shared concepts, sorted by specificity (information content). */
  shared_top: string[]
}

interface SimilarityFile {
  version: string
  method: string
  top_n: number
  count: number
  similar: Record<string, SimilarDisease[]>
}

let cached: SimilarityFile | null = null
let inflight: Promise<SimilarityFile> | null = null
const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH || ''

export async function loadSimilarity(): Promise<SimilarityFile> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = fetch(`${basePath()}/data/disease_similarity_v1.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load similarity (HTTP ${res.status}).`)
      const data = (await res.json()) as SimilarityFile
      cached = data
      return data
    })
    .catch((err) => { inflight = null; throw err })
  return inflight
}

export async function getSimilarFor(disease: string): Promise<SimilarDisease[]> {
  const f = await loadSimilarity()
  if (f.similar[disease]) return f.similar[disease]
  const target = disease.toLowerCase()
  for (const k of Object.keys(f.similar)) {
    if (k.toLowerCase() === target) return f.similar[k]
  }
  return []
}
