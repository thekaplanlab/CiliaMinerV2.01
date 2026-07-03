/**
 * CilioSymptom — ciliopathy-specific HPO term recognizer.
 *
 * Loads the corpus produced from Supplementary Table S5 (4,690 trigger
 * phrases mapped to 330 HPO-coded canonical concepts across 16 organ
 * systems) and matches user-supplied free text against it.
 *
 * Algorithm:
 *   1. Normalize input (same scheme used at corpus build time)
 *   2. Segment on punctuation + connectives
 *   3. Per segment, longest-first n-gram window against the trigger map
 *   4. Token-overlap fuzzy fallback for segments with no exact hit
 *   5. Resolve ambiguity (96 phrases map to >1 concept) by returning all
 *      with reduced confidence
 *   6. Deduplicate by concept name across the whole input
 *
 * All operations are pure / synchronous after the corpus is loaded.
 * No external dependencies, no model inference, no network calls per
 * query — the corpus lookup is a Map<string, string[]> in memory.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface CilioConcept {
  organ:   string
  parent:  string
  hpo_ids: string[]
  example?: string
}

export interface CilioCorpus {
  version:        string
  generated_at:   string
  stats:          Record<string, number>
  concepts:       Record<string, CilioConcept>
  triggers:       Record<string, string[]>       // normalized phrase → [concept names]
  token_index:    Record<string, string[]>       // token → [normalized phrases containing it]
  sources?:       string[]
}

export type MatchMethod = 'exact' | 'normalized' | 'fuzzy'

export interface CilioMatch {
  span_start: number             // offset in original (un-normalized) input
  span_end:   number
  text:       string             // text from the original input
  concept:    string             // canonical leaf concept name
  hpo_ids:    string[]
  organ:      string
  parent:     string
  confidence: number             // 0..1
  method:     MatchMethod
  ambiguous:  boolean            // true if the trigger maps to >1 concept
  siblings?:  string[]           // other concepts the trigger maps to (when ambiguous)
}

export interface MatchResult {
  matches:           CilioMatch[]
  unmatched_spans:   Array<{ text: string; start: number; end: number }>
  coverage:          number      // fraction of non-trivial input tokens that landed in a match
  ambiguous_count:   number
  total_tokens:      number
}

// ── Normalization ──────────────────────────────────────────────────────
// Must match the corpus build script's `norm()` exactly.

export function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Tokens we ignore in fuzzy matching (too common to anchor on)
const STOPWORDS = new Set([
  'and', 'or', 'with', 'the', 'a', 'an', 'of', 'on', 'in', 'to', 'for',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'had', 'have',
  'mild', 'moderate', 'severe', 'recurrent', 'chronic', 'acute',
  'left', 'right', 'bilateral', 'unilateral',
  'patient', 'affected', 'shows', 'showing', 'shown',
])

// ── Corpus loading ─────────────────────────────────────────────────────

let CORPUS:        CilioCorpus | null = null
let TRIGGER_MAP:   Map<string, string[]> | null = null
let inflight:      Promise<CilioCorpus> | null = null

export async function loadCorpus(basePath = ''): Promise<CilioCorpus> {
  if (CORPUS) return CORPUS
  if (inflight) return inflight
  inflight = fetch(`${basePath}/data/ciliosymptom_corpus_v1.json`, { cache: 'default' })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load CilioSymptom corpus: ${r.status}`)
      return r.json() as Promise<CilioCorpus>
    })
    .then((c) => {
      CORPUS = c
      TRIGGER_MAP = new Map(Object.entries(c.triggers))
      return c
    })
  return inflight
}

// ── Segmentation ───────────────────────────────────────────────────────
// Splits input into clinically-meaningful segments while remembering each
// segment's char offset in the original string for later highlighting.

interface Segment { text: string; start: number; end: number; normalized: string }

function segment(input: string): Segment[] {
  // We want to split on .;,\n and on " and ", " or ".
  // Approach: find delimiter spans, walk character by character, emit segments.
  const out: Segment[] = []
  // Replace " and " / " or " (case-insensitive) with comma equivalents,
  // preserving positions via a mapping.  Simpler: regex-find all delimiters
  // and use their offsets.
  const delim = /[\n.;,]|(?:\s+(?:and|or)\s+)/gi
  let lastEnd = 0
  let m: RegExpExecArray | null
  while ((m = delim.exec(input)) !== null) {
    const start = lastEnd
    const end   = m.index
    if (end > start) {
      const text = input.slice(start, end)
      const n    = normalize(text)
      if (n.length > 0) out.push({ text, start, end, normalized: n })
    }
    lastEnd = m.index + m[0].length
  }
  if (lastEnd < input.length) {
    const text = input.slice(lastEnd)
    const n    = normalize(text)
    if (n.length > 0) out.push({ text, start: lastEnd, end: input.length, normalized: n })
  }
  return out
}

// ── Per-segment matching ──────────────────────────────────────────────

// For a segment, returns the longest n-gram match found, or null.
// Tries decreasing window sizes from full segment down to single tokens.
function findLongestNgramMatch(seg: Segment): { phrase: string; ngramStart: number; ngramEnd: number } | null {
  if (!TRIGGER_MAP) return null
  const tokens = seg.normalized.split(' ')
  if (tokens.length === 0) return null

  // Prefer full-segment match first
  if (TRIGGER_MAP.has(seg.normalized)) {
    return { phrase: seg.normalized, ngramStart: 0, ngramEnd: tokens.length }
  }

  // Sliding window over n-grams, longest first
  for (let n = Math.min(tokens.length, 8); n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + n).join(' ')
      // Skip if the entire phrase is stopwords (avoids matching "with")
      if (n === 1 && STOPWORDS.has(phrase)) continue
      if (TRIGGER_MAP.has(phrase)) {
        return { phrase, ngramStart: i, ngramEnd: i + n }
      }
    }
  }
  return null
}

// Find the character offsets in the ORIGINAL (un-normalized) segment text
// corresponding to a token-range [ngramStart..ngramEnd).
// This walks the original char by char, matching against normalized tokens.
function spanOfTokens(seg: Segment, ngramStart: number, ngramEnd: number): { start: number; end: number } {
  // The simplest approach: split the original on whitespace, but we
  // normalize() removes punctuation, so the token boundaries can differ.
  // We'll do a token-by-token walk in the original text, treating any
  // run of word chars + dash + slash as a token.
  const re = /[\w/-]+/g
  const positions: Array<{ start: number; end: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(seg.text)) !== null) {
    positions.push({ start: seg.start + m.index, end: seg.start + m.index + m[0].length })
  }
  if (positions.length === 0) {
    return { start: seg.start, end: seg.end }
  }
  const s = positions[Math.min(ngramStart, positions.length - 1)]
  const e = positions[Math.min(ngramEnd - 1, positions.length - 1)]
  return { start: s.start, end: e.end }
}

// Token-overlap (Jaccard) fuzzy matcher.  Used only when no exact n-gram
// hit was found. Returns the best concept and its score, or null.
function fuzzyMatch(seg: Segment): { phrase: string; score: number } | null {
  if (!CORPUS || !TRIGGER_MAP) return null
  const tokens = seg.normalized.split(' ').filter((t) => !STOPWORDS.has(t))
  if (tokens.length === 0) return null

  // Use token_index to gather candidate triggers — only triggers that
  // share at least one rare token with the segment.
  const candidateSet = new Set<string>()
  for (const t of tokens) {
    const cands = CORPUS.token_index[t]
    if (cands) for (const c of cands) candidateSet.add(c)
  }
  if (candidateSet.size === 0) return null

  const segSet = new Set(tokens)
  let best: { phrase: string; score: number } | null = null
  // Array.from(...).forEach is used (not for..of) because this project's
  // TS target is es5 with no downlevelIteration, so iterating a Set with
  // for..of is a compile error. Replacing `continue` with `return` inside
  // the callback preserves the same control flow.
  Array.from(candidateSet).forEach((cand) => {
    const candTokens = cand.split(' ').filter((t) => !STOPWORDS.has(t))
    if (candTokens.length === 0) return
    const candSet = new Set(candTokens)
    let intersection = 0
    candSet.forEach((t) => { if (segSet.has(t)) intersection++ })
    const union = segSet.size + candSet.size - intersection
    const jaccard = union === 0 ? 0 : intersection / union
    // Require at least 60% overlap, AND the candidate must contribute its
    // smaller/longer token set substantially (no spurious 1-of-1 matches)
    if (jaccard >= 0.6 && intersection >= Math.min(2, candTokens.length)) {
      if (!best || jaccard > best.score) best = { phrase: cand, score: jaccard }
    }
  })
  return best
}

// ── Top-level match() ─────────────────────────────────────────────────

export function match(input: string): MatchResult {
  if (!CORPUS || !TRIGGER_MAP) {
    throw new Error('CilioSymptom corpus not loaded — call loadCorpus() first')
  }

  const segments = segment(input)
  const matches: CilioMatch[] = []
  const unmatched: Array<{ text: string; start: number; end: number }> = []
  const seenConcepts = new Set<string>()

  for (const seg of segments) {
    const hit = findLongestNgramMatch(seg)
    if (hit) {
      const concepts = TRIGGER_MAP.get(hit.phrase) || []
      const span = spanOfTokens(seg, hit.ngramStart, hit.ngramEnd)
      const ambig = concepts.length > 1
      const isFullSeg = hit.ngramStart === 0 &&
                        hit.ngramEnd === seg.normalized.split(' ').length
      // Confidence: exact full-segment = 1.00, partial n-gram = 0.95,
      // ambiguous shaves 25%.
      const baseConf = isFullSeg ? 1.0 : 0.95
      const confidence = ambig ? baseConf * 0.75 : baseConf

      for (const concept of concepts) {
        if (seenConcepts.has(concept)) continue
        seenConcepts.add(concept)
        const meta = CORPUS.concepts[concept]
        if (!meta) continue
        matches.push({
          span_start: span.start,
          span_end:   span.end,
          text:       input.slice(span.start, span.end),
          concept,
          hpo_ids:    meta.hpo_ids || [],
          organ:      meta.organ,
          parent:     meta.parent,
          confidence,
          method:     isFullSeg ? 'exact' : 'normalized',
          ambiguous:  ambig,
          siblings:   ambig ? concepts.filter((c) => c !== concept) : undefined,
        })
      }
      continue
    }

    // No exact / n-gram match — try fuzzy
    const fz = fuzzyMatch(seg)
    if (fz) {
      const concepts = TRIGGER_MAP.get(fz.phrase) || []
      const ambig = concepts.length > 1
      const confidence = fz.score * (ambig ? 0.6 : 0.8)
      for (const concept of concepts) {
        if (seenConcepts.has(concept)) continue
        seenConcepts.add(concept)
        const meta = CORPUS.concepts[concept]
        if (!meta) continue
        matches.push({
          span_start: seg.start,
          span_end:   seg.end,
          text:       seg.text.trim(),
          concept,
          hpo_ids:    meta.hpo_ids || [],
          organ:      meta.organ,
          parent:     meta.parent,
          confidence,
          method:     'fuzzy',
          ambiguous:  ambig,
          siblings:   ambig ? concepts.filter((c) => c !== concept) : undefined,
        })
      }
      continue
    }

    // Unmatched segment — record if it has content
    const trimmed = seg.text.trim()
    if (trimmed.length > 1) {
      unmatched.push({ text: trimmed, start: seg.start, end: seg.end })
    }
  }

  // Coverage: how much of the input was identified?
  const allTokens = normalize(input).split(' ').filter((t) => t && !STOPWORDS.has(t))
  const matchedTokens = new Set<string>()
  for (const m of matches) {
    normalize(m.text).split(' ').forEach((t) => { if (!STOPWORDS.has(t)) matchedTokens.add(t) })
  }
  const coverage = allTokens.length === 0 ? 0 : matchedTokens.size / allTokens.length

  return {
    matches: matches.sort((a, b) => b.confidence - a.confidence || a.organ.localeCompare(b.organ)),
    unmatched_spans: unmatched,
    coverage,
    ambiguous_count: matches.filter((m) => m.ambiguous).length,
    total_tokens: allTokens.length,
  }
}

// Convenience: get all unique HPO IDs from a match result (for downstream
// differential-dx in Round 3).
export function uniqueHpoIds(result: MatchResult): string[] {
  const seen = new Set<string>()
  for (const m of result.matches) for (const h of m.hpo_ids) seen.add(h)
  return Array.from(seen)
}
