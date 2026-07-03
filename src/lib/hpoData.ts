/**
 * hpoData.ts — lazy loader for HPO term definitions.
 *
 * Backed by /data/hpo_definitions_v1.json (109 KB, 30 KB gzipped).
 * Contains the 326 HPO terms referenced by the v3.3 symptoms layer.
 */

export interface HpoTerm {
  id: string
  name: string
  definition: string
  synonyms: string[]
  parents: string[]
}

interface HpoFile {
  version: string
  source: string
  count: number
  terms: Record<string, HpoTerm>
}

let cached: HpoFile | null = null
let inflight: Promise<HpoFile> | null = null
const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH || ''

export async function loadHpo(): Promise<HpoFile> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = fetch(`${basePath()}/data/hpo_definitions_v1.json`, { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load HPO definitions (HTTP ${res.status}).`)
      const data = (await res.json()) as HpoFile
      cached = data
      return data
    })
    .catch((err) => { inflight = null; throw err })
  return inflight
}

/**
 * Look up an HPO term. Strips any "(organ root)" suffix our v3.3 layer
 * uses on synthetic root markers, and falls back to undefined when the
 * id genuinely isn't in the HPO.
 */
export async function getHpoTerm(rawId: string): Promise<HpoTerm | null> {
  const id = rawId.split(' (organ root)')[0].trim()
  const file = await loadHpo()
  return file.terms[id] ?? null
}
