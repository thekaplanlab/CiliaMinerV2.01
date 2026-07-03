'use client'

/**
 * /ciliosymptom
 *
 * Free-text → HPO mapping for ciliopathy clinical findings. Backed by
 * 4,690 trigger phrases (derived from S5's 5,767 OMIM clinical-finding
 * records) mapped to 330 HPO-coded canonical concepts across 16 organ
 * systems.
 *
 * UX:
 *   • Multi-line textarea, explicit Search button (no live matching)
 *   • Coverage indicator + organ-grouped matches
 *   • Copy HPO IDs (for external phenotype tools)
 *   • Download JSON (matches + provenance)
 *   • Example queries for first-time users
 *
 * Round 2 scope — just the mapper. Round 3 wires the resulting HPO set
 * into the IC-weighted similarity layer for differential diagnosis.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Copy, Download, Loader2, ArrowRight, Search } from 'lucide-react'
import {
  loadCorpus, match, uniqueHpoIds,
  type CilioCorpus, type MatchResult, type CilioMatch,
} from '@/lib/ciliosymptom'
import {
  loadDxIndex, rankDiseases, dxCoverage,
  type DxResult,
} from '@/lib/ciliosymptomDx'

const EXAMPLES = [
  {
    label: 'Joubert-like',
    text: 'Two-year-old boy with developmental delay, ataxia, polydactyly of both hands, retinal dystrophy, and renal cysts on ultrasound. Brain MRI showed molar tooth sign.',
  },
  {
    label: 'PCD / Kartagener',
    text: 'Adult patient with recurrent respiratory infections, bronchiectasis, situs inversus, and infertility.',
  },
  {
    label: 'Meckel-Gruber',
    text: 'Newborn with encephalocele, cystic kidneys, polydactyly, and hepatic fibrosis.',
  },
  {
    label: 'Bardet-Biedl',
    text: 'Patient presents with cone-rod dystrophy, obesity, polydactyly, hypogonadism, and renal failure.',
  },
]

export default function CilioSymptomPage() {
  return (
    <ErrorBoundary scope="ciliosymptom">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [corpus, setCorpus] = useState<CilioCorpus | null>(null)
  const [corpusErr, setCorpusErr] = useState<string | null>(null)
  const [input, setInput] = useState('')
  // Committed query — the last text the user actually submitted via the
  // Search button. Matching keys off this, never off `input`, so typing
  // in the textarea no longer triggers a live search.
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadCorpus()
      .then(setCorpus)
      .catch((e) => setCorpusErr(e?.message ?? 'Failed to load corpus'))
    // Load the dx index in parallel — used for ranking candidate diseases
    // from the matched HPO set. Failure is non-fatal: the matcher still
    // works, just without the differential-dx panel.
    loadDxIndex().catch(() => {})
  }, [])

  // Run the match only on an explicit submit — no live/debounced matching.
  function runSearch() {
    setQuery(input)
  }

  const result: MatchResult | null = useMemo(() => {
    if (!corpus || !query.trim()) return null
    try {
      return match(query)
    } catch {
      return null
    }
  }, [corpus, query])

  // Compute ranked candidate ciliopathies from the matched concept set.
  // Returns [] if the dx index hasn't loaded yet or no matches exist.
  const ranking: DxResult[] = useMemo(() => {
    if (!result || result.matches.length === 0) return []
    try {
      const concepts = result.matches.map((m) => m.concept)
      return rankDiseases(concepts, 10)
    } catch {
      return []           // dx index not yet ready — silent
    }
  }, [result])

  const dxStats = useMemo(() => dxCoverage(), [ranking])

  // Group matches by organ for display
  const byOrgan = useMemo(() => {
    if (!result) return [] as Array<{ organ: string; items: CilioMatch[] }>
    const m = new Map<string, CilioMatch[]>()
    for (const it of result.matches) {
      const list = m.get(it.organ) || []
      list.push(it)
      m.set(it.organ, list)
    }
    return Array.from(m.entries())
      .map(([organ, items]) => ({ organ, items }))
      .sort((a, b) => b.items.length - a.items.length || a.organ.localeCompare(b.organ))
  }, [result])

  return (
    <Layout>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold text-red-800 tracking-tight">CilioSymptom</h1>
          <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            HPO mapper
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1 max-w-2xl">
          Paste a clinical note or list symptoms. CilioSymptom recognises ciliopathy-relevant
          phenotypes and returns canonical Human Phenotype Ontology terms with provenance.
        </p>
      </div>

      {/* ── Corpus stats strip ───────────────────────────────────── */}
      {corpus && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden mb-4">
          <div className="grid grid-cols-4 divide-x divide-stone-200">
            <Stat n={corpus.stats.triggers_total}    label="Trigger phrases" />
            <Stat n={corpus.stats.concepts}          label="HPO concepts" />
            <Stat n={corpus.stats.organ_systems}     label="Organ systems" />
            <Stat n={corpus.stats.triggers_ambiguous} label="Ambiguous" />
          </div>
        </div>
      )}

      {corpusErr && (
        <div className="bg-red-50/60 border-l-2 border-red-800 px-4 py-3 rounded-r mb-4">
          <p className="text-xs text-red-800">{corpusErr}</p>
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            Symptom input
          </p>
          {!input && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-400 mr-1">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setInput(ex.text)}
                  className="text-[11px] font-medium text-red-800 hover:text-red-900 underline-offset-2 hover:underline"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. polydactyly, retinal dystrophy, renal cysts, molar tooth sign…"
          aria-label="Symptom input"
          rows={6}
          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded font-mono text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition resize-y"
          disabled={!corpus}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={runSearch}
            disabled={!corpus || !input.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-800 text-white rounded text-xs font-semibold hover:bg-red-900 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Search</span>
          </button>
          {input && (
            <button
              type="button"
              onClick={() => { setInput(''); setQuery('') }}
              className="text-[12px] text-stone-400 hover:text-stone-700 transition"
            >
              Clear
            </button>
          )}
          {!corpus && !corpusErr && (
            <span className="text-[12px] text-stone-400 inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              Loading corpus…
            </span>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      {result && (
        <ResultsBlock
          input={query}
          result={result}
          byOrgan={byOrgan}
          ranking={ranking}
          dxStats={dxStats}
        />
      )}

      {/* ── About-this-tool footer ──────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mt-4">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
          About CilioSymptom
        </p>
        <p className="text-xs text-stone-700 leading-relaxed">
          The mapper uses 4,690 trigger phrases canonicalised from 5,767 OMIM clinical-synopsis
          records spanning 77 ciliopathy disease entities, plus a folk-synonym layer for
          lay-language input. Each match returns the canonical leaf concept, one or more HPO
          identifiers, and the originating organ system. Coverage on canonical clinical
          terminology is high; lay terms outside the synonym layer (e.g. "spoke-like")
          may not be recognised — this is reported transparently as the &ldquo;coverage&rdquo;
          metric for each query.
        </p>
        <p className="text-xs text-stone-500 leading-relaxed mt-3">
          The output HPO term set can be used as input to phenotype-driven decision-support
          tools or, on the same page in an upcoming release, fed directly into CiliaMiner&rsquo;s
          information-content-weighted similarity layer to retrieve ranked candidate ciliopathies.
        </p>
      </div>
    </Layout>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="p-4 text-center bg-white">
      <div className="text-xl font-bold text-stone-900 tabular-nums leading-none">
        {n.toLocaleString()}
      </div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mt-2">
        {label}
      </div>
    </div>
  )
}

function ResultsBlock({
  input, result, byOrgan, ranking, dxStats,
}: {
  input: string
  result: MatchResult
  byOrgan: Array<{ organ: string; items: CilioMatch[] }>
  ranking: DxResult[]
  dxStats: { with_symptoms: number } | null
}) {
  const allHpo = useMemo(() => uniqueHpoIds(result), [result])
  const [copied, setCopied] = useState(false)

  function copyHpo() {
    navigator.clipboard.writeText(allHpo.join(', ')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  function downloadJson() {
    const payload = {
      query:    input,
      coverage: result.coverage,
      total_tokens:   result.total_tokens,
      ambiguous_count: result.ambiguous_count,
      matches:        result.matches,
      unmatched_spans: result.unmatched_spans,
      generated_at:   new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ciliosymptom_match_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const pct = Math.round(result.coverage * 100)
  return (
    <>
      {/* Coverage + actions */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-baseline gap-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              Coverage
            </p>
            <span className="text-2xl font-bold text-stone-900 tabular-nums leading-none">
              {pct}%
            </span>
            <span className="text-[12px] text-stone-500 font-mono tabular-nums">
              ({result.matches.length} concepts · {allHpo.length} HPO IDs · {result.total_tokens} tokens)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {allHpo.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={copyHpo}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[12px] font-semibold text-stone-700"
                >
                  <Copy className="w-3 h-3" aria-hidden="true" />
                  <span>{copied ? 'Copied' : 'Copy HPO IDs'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[12px] font-semibold text-stone-700"
                >
                  <Download className="w-3 h-3" aria-hidden="true" />
                  <span>JSON</span>
                </button>
              </>
            )}
          </div>
        </div>
        {/* coverage bar */}
        <div className="relative h-1.5 bg-stone-100 rounded-sm overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-red-800/85 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
            aria-label={`${pct}% coverage`}
          />
        </div>
        {result.ambiguous_count > 0 && (
          <p className="text-[11px] text-stone-500 mt-2">
            <span className="font-semibold text-red-800">{result.ambiguous_count}</span> match
            {result.ambiguous_count === 1 ? '' : 'es'} ambiguous — phrase mapped to multiple
            candidate concepts; all returned with reduced confidence.
          </p>
        )}
      </div>

      {/* Matches grouped by organ */}
      {byOrgan.length > 0 ? (
        byOrgan.map((g) => (
          <div key={g.organ} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-3">
            <div className="flex items-baseline justify-between mb-3 gap-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-red-800">
                {g.organ.replace(/_/g, ' ')}
              </p>
              <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                {g.items.length} {g.items.length === 1 ? 'match' : 'matches'}
              </span>
            </div>
            <ul className="space-y-2">
              {g.items.map((m, i) => (
                <li key={i} className="border-l-2 border-stone-200 pl-3 py-0.5">
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-900">
                        {m.concept}
                      </p>
                      <p className="text-[12px] text-stone-500 mt-0.5">
                        <span className="font-mono">
                          {m.hpo_ids.join(', ') || '—'}
                        </span>
                        <span className="text-stone-300 mx-1.5">·</span>
                        <span className="text-stone-500">{m.parent}</span>
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5 italic">
                        matched: &ldquo;{m.text}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ConfidenceBadge confidence={m.confidence} method={m.method} />
                      {m.ambiguous && (
                        <span
                          className="text-[10px] uppercase tracking-wider font-bold text-red-800 bg-red-50 px-1.5 py-0.5 rounded"
                          title={m.siblings ? `Also matches: ${m.siblings.join(', ')}` : 'Multiple concepts'}
                        >
                          ambig
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-3">
          <p className="text-xs text-stone-500 italic">
            No matches found in the corpus. Try simpler clinical terminology — &ldquo;polydactyly&rdquo;
            rather than &ldquo;extra fingers&rdquo;, or pick one of the example queries above.
          </p>
        </div>
      )}

      {/* Unmatched spans */}
      {result.unmatched_spans.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              Unmatched fragments
            </p>
            <span className="text-[11px] font-mono text-stone-400 tabular-nums">
              {result.unmatched_spans.length}
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {result.unmatched_spans.map((u, i) => (
              <li key={i}>
                <span className="inline-block px-2 py-0.5 bg-stone-50 border border-stone-200 rounded text-[11px] font-mono text-stone-500">
                  {u.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
            These phrases didn&rsquo;t match a known trigger pattern. Most often this means
            the corpus uses a different canonical term (e.g. &ldquo;polydactyly&rdquo;
            rather than &ldquo;extra fingers&rdquo;), or the phrase is too narrow to map
            (e.g. a specific lab value).
          </p>
        </div>
      )}

      {/* CTA / Candidate ciliopathies ranking */}
      {ranking.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-1 gap-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800">
              Candidate ciliopathies
            </p>
            <span className="text-[11px] font-mono text-stone-400 tabular-nums">
              top {ranking.length} {dxStats ? `· of ${dxStats.with_symptoms} with curated symptoms` : ''}
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed mb-4 max-w-2xl">
            Ranked by IC-weighted recall: how much of the IC-weighted symptom set each
            disease&rsquo;s curated profile covers. Rare symptoms (e.g. molar tooth sign)
            dominate the ranking. Ties at the top indicate diseases that are clinically
            indistinguishable on the input symptoms alone.
          </p>
          <ol className="space-y-2">
            {ranking.map((r, i) => (
              <li key={r.disease} className="border-l-2 border-stone-200 pl-3 py-0.5 hover:border-red-800 transition group">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-mono text-stone-400 tabular-nums shrink-0 w-5">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/disease/${encodeURIComponent(r.disease)}`}
                        className="text-xs font-semibold text-stone-900 group-hover:text-red-800 transition"
                      >
                        {r.disease}
                      </Link>
                    </div>
                    <p className="text-[12px] text-stone-500 mt-0.5 ml-7">
                      <span className="font-mono tabular-nums">{r.shared_count}</span> of{' '}
                      <span className="font-mono tabular-nums">{r.query_concept_count}</span>{' '}
                      query concept{r.query_concept_count === 1 ? '' : 's'} shared
                      <span className="text-stone-300 mx-1.5">·</span>
                      <span className="text-stone-400">distinguishing:</span>{' '}
                      <span className="italic">{r.shared_top.slice(0, 3).join(', ')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ScoreBadge label="R" value={r.similarity} title="Recall — fraction of IC-weighted query covered by this disease" />
                    <ScoreBadge label="P" value={r.precision} title="Precision — fraction of IC-weighted disease profile present in query" muted />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-stone-400 mt-4 leading-relaxed">
            Coverage: rankings draw from the {dxStats?.with_symptoms ?? 76} ciliopathies with full
            OMIM-derived symptom records. Diseases without curated clinical synopses
            (broad umbrellas, sparse OMIM data) are not ranked.
          </p>
        </div>
      )}

      {ranking.length === 0 && result.matches.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <div className="flex items-baseline gap-2 mb-2">
            <ArrowRight className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              No matching diseases
            </p>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            The matched symptoms don&rsquo;t overlap with any disease in the curated symptom
            catalogue. Browse all diseases on the{' '}
            <Link href="/ciliopathy-classification" className="font-semibold text-red-800 hover:text-red-900 underline-offset-2 hover:underline">
              Disease Classification page
            </Link>.
          </p>
        </div>
      )}
    </>
  )
}

function ConfidenceBadge({ confidence, method }: { confidence: number; method: string }) {
  const pct = Math.round(confidence * 100)
  const cls =
    confidence >= 0.9 ? 'bg-red-800 text-white' :
    confidence >= 0.7 ? 'bg-red-50 text-red-800 border border-red-200' :
                        'bg-stone-100 text-stone-600 border border-stone-200'
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded tabular-nums ${cls}`}
      title={`Match method: ${method}`}
    >
      {pct}%
    </span>
  )
}

function ScoreBadge({
  label, value, title, muted,
}: {
  label: string
  value: number
  title?: string
  muted?: boolean
}) {
  const pct = Math.round(value * 100)
  const cls = muted
    ? 'bg-stone-50 text-stone-500 border border-stone-200'
    : value >= 0.75 ? 'bg-red-800 text-white'
    : value >= 0.40 ? 'bg-red-50 text-red-800 border border-red-200'
    :                 'bg-stone-100 text-stone-600 border border-stone-200'
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums inline-flex items-baseline gap-0.5 ${cls}`}
      title={title}
    >
      <span className="opacity-70">{label}</span>
      <span>{pct}%</span>
    </span>
  )
}
