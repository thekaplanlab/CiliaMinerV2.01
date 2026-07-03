/**
 * CilioSymptom differential diagnosis — ranks ciliopathies by IC-weighted
 * recall of the query concept set against each disease's curated concept
 * set.
 *
 * Data source: `clinical_features_v1.json` (76 diseases with full curated
 * symptom records derived from OMIM clinical synopses).
 *
 * Why recall (asymmetric) and not Jaccard (symmetric) for ranking:
 *
 *   The disease-vs-disease similarity used elsewhere in CiliaMiner is
 *   symmetric (both sides are diseases) — IC-weighted Jaccard is the
 *   right metric there.
 *
 *   Query-vs-disease is asymmetric:  given a patient symptom set Q, the
 *   clinically meaningful question is *"how well does this disease's
 *   typical symptom set explain Q?"* — i.e. what fraction of the
 *   IC-weighted query is covered by the disease.  This is recall:
 *
 *     recall(Q, D) = Σ IC(c) over c ∈ (Q ∩ D)
 *                    -----------------------------
 *                       Σ IC(c) over c ∈ Q
 *
 *   IC(c) = -log( n_diseases_with(c) / (N + 1) ).  Rare symptoms dominate
 *   (a shared molar-tooth-sign carries more weight than a shared
 *   hypotonia), so the ranking is driven by distinctive evidence.
 *
 *   Jaccard tends to over-rank small narrowly-defined disease entries
 *   that happen to share one rare symptom with the query, because |D|
 *   inflates the denominator for broader syndromes (BBS, Joubert).
 *   Recall fixes this without losing the IC weighting.
 *
 * Both metrics are computed; results carry `similarity` (recall, used for
 * sorting), `precision`, and `jaccard` for completeness and for any UI
 * that wants to surface the trade-off explicitly.
 */

export interface DxResult {
  disease:               string
  similarity:            number     // 0..1, IC-weighted RECALL — primary rank
  precision:             number     // shared / |D|, IC-weighted
  jaccard:               number     // shared / |Q ∪ D|, IC-weighted
  shared_count:          number
  shared_concepts:       string[]   // canonical concept names in Q ∩ D
  shared_top:            string[]   // top 5 by IC weight (most distinctive)
  disease_concept_count: number     // |D|
  query_concept_count:   number     // |Q ∩ catalog| (only concepts known in catalog)
}

interface DxIndex {
  // disease → set of canonical concept names
  diseases:        Map<string, Set<string>>
  // canonical concept → IC weight
  ic:              Map<string, number>
  total_diseases:  number
}

let DX_INDEX: DxIndex | null = null
let inflight:  Promise<DxIndex> | null = null

export async function loadDxIndex(basePath = ''): Promise<DxIndex> {
  if (DX_INDEX) return DX_INDEX
  if (inflight) return inflight
  inflight = fetch(`${basePath}/data/clinical_features_v1.json`, { cache: 'default' })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load clinical_features_v1.json: ${r.status}`)
      return r.json()
    })
    .then((cf: any) => {
      const diseases = new Map<string, Set<string>>()
      const conceptCounts = new Map<string, number>()

      const cfDiseases = cf.diseases || {}
      Object.entries(cfDiseases).forEach(([disease, rec]: [string, any]) => {
        const concepts = new Set<string>()
        const bor = rec.by_organ_records || {}
        Object.values(bor).forEach((organConcepts: any) => {
          if (!Array.isArray(organConcepts)) return
          organConcepts.forEach((c: any) => {
            if (c && typeof c.concept === 'string' && c.concept) {
              concepts.add(c.concept)
            }
          })
        })
        diseases.set(disease, concepts)
        concepts.forEach((c) => {
          conceptCounts.set(c, (conceptCounts.get(c) || 0) + 1)
        })
      })

      const totalDiseases = diseases.size
      const ic = new Map<string, number>()
      conceptCounts.forEach((count, concept) => {
        // IC = -log( p ), with p = count / (N + 1) to avoid log(1) = 0
        // for universally-present concepts (would zero out the ranking)
        const p = count / (totalDiseases + 1)
        ic.set(concept, -Math.log(p))
      })

      DX_INDEX = { diseases, ic, total_diseases: totalDiseases }
      return DX_INDEX
    })
  return inflight
}

/**
 * Rank diseases by IC-weighted Jaccard similarity to the query concept set.
 * Returns top-N results sorted by similarity descending.  Diseases with no
 * shared concepts are excluded.
 */
export function rankDiseases(
  queryConcepts: string[],
  topN: number = 10,
): DxResult[] {
  if (!DX_INDEX) {
    throw new Error('CilioSymptom dx index not loaded — call loadDxIndex() first')
  }
  // Deduplicate and intersect with the IC-known concept space.
  // Query concepts not present in any disease are silently dropped (they
  // carry no information about the ranking — every disease is equally
  // distant from them).
  const querySet = new Set<string>()
  queryConcepts.forEach((c) => {
    if (DX_INDEX!.ic.has(c)) querySet.add(c)
  })
  if (querySet.size === 0) return []

  let queryIcSum = 0
  querySet.forEach((c) => {
    queryIcSum += DX_INDEX!.ic.get(c) || 0
  })

  const out: DxResult[] = []
  DX_INDEX.diseases.forEach((diseaseConcepts, disease) => {
    const shared: string[] = []
    let sharedIcSum  = 0
    let diseaseIcSum = 0
    diseaseConcepts.forEach((c) => {
      const w = DX_INDEX!.ic.get(c) || 0
      diseaseIcSum += w
      if (querySet.has(c)) {
        shared.push(c)
        sharedIcSum += w
      }
    })
    if (shared.length === 0) return

    // Recall — primary ranking score. How much of the query the disease covers.
    const recall    = queryIcSum   > 0 ? sharedIcSum / queryIcSum   : 0
    // Precision — secondary signal. How much of the disease is in the query.
    const precision = diseaseIcSum > 0 ? sharedIcSum / diseaseIcSum : 0
    // Jaccard — for users who want symmetric similarity for comparison
    // with the existing disease-vs-disease layer.
    const unionIcSum = queryIcSum + diseaseIcSum - sharedIcSum
    const jaccard    = unionIcSum  > 0 ? sharedIcSum / unionIcSum    : 0

    // top 5 shared concepts by IC weight (most distinctive matches)
    const sharedTop = shared
      .slice()
      .sort((a, b) => (DX_INDEX!.ic.get(b) || 0) - (DX_INDEX!.ic.get(a) || 0))
      .slice(0, 5)

    out.push({
      disease,
      similarity:            recall,
      precision,
      jaccard,
      shared_count:          shared.length,
      shared_concepts:       shared,
      shared_top:            sharedTop,
      disease_concept_count: diseaseConcepts.size,
      query_concept_count:   querySet.size,
    })
  })

  return out
    .sort((a, b) => {
      // Sort by recall (similarity) primarily; break ties with precision
      // so that when two diseases tie on coverage, the more focused one
      // (smaller |D|) ranks higher.
      if (b.similarity !== a.similarity) return b.similarity - a.similarity
      return b.precision - a.precision
    })
    .slice(0, topN)
}

/** Coverage info — how many diseases have curated symptom data, for the UI */
export function dxCoverage(): { with_symptoms: number; total_referenced?: number } | null {
  if (!DX_INDEX) return null
  return { with_symptoms: DX_INDEX.total_diseases }
}
