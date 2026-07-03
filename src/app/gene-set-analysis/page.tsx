'use client'

/**
 * /gene-set-analysis
 *
 * Annotate a user-supplied gene list against the v15 ciliopathy catalogue.
 * Useful for asking "how many of my RNA-seq hits / CRISPR screen genes /
 * differentially-expressed genes are ciliary?" with class-level breakdown.
 *
 * Self-contained: loads `ciliopathy_genes_v15.json` directly via fetch,
 * computes the analysis in-browser, no server roundtrip.  Standard
 * features: example panels, per-gene table, copy unmatched, CSV export.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Copy, Download, Loader2 } from 'lucide-react'
import {
  loadCatalogue, analyze, resultToCsv,
  type AnalysisResult, type GeneAnnotation,
} from '@/lib/geneSetAnalysis'
import { SvgBarChart } from '@/components/SvgBarChart'

const EXAMPLES = [
  {
    label: 'BBS panel',
    text:  'BBS1 BBS2 BBS4 BBS5 BBS7 BBS9 BBS10 BBS12 MKKS ARL6 TRIM32 TTC8 LZTFL1 BBIP1 CCDC28B SDCCAG8 WDPCP IFT27 IFT172',
  },
  {
    label: 'PCD panel',
    text:  'DNAH5 DNAH11 DNAI1 DNAI2 DNAL1 CCDC39 CCDC40 RSPH1 RSPH4A RSPH9 NME8 CCNO MCIDAS',
  },
  {
    label: 'Joubert panel',
    text:  'AHI1 ARL13B CC2D2A CEP41 CEP104 CEP120 CEP290 INPP5E KIAA0586 MKS1 NPHP1 OFD1 RPGRIP1L TCTN1 TCTN2 TMEM67 TMEM138 TMEM216 TMEM231 TMEM237 CSPP1 KIF7 TCTN3 PDE6D B9D1 B9D2',
  },
  {
    label: 'Mixed (real-world)',
    text:  'TP53 BRCA1 BRCA2 IFT88 ARL13B PKD1 PKD2 EGFR KRAS MYC NPHP1 CEP290',
  },
]

export default function GeneSetAnalysisPage() {
  return (
    <ErrorBoundary scope="gene-set-analysis">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [catSize,  setCatSize]  = useState<number | null>(null)
  const [catErr,   setCatErr]   = useState<string | null>(null)
  const [input,    setInput]    = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [running,  setRunning]  = useState(false)

  useEffect(() => {
    loadCatalogue()
      .then((c) => setCatSize(Object.keys(c.genes || {}).length))
      .catch((e) => setCatErr(e?.message ?? 'Failed to load catalogue'))
  }, [])

  async function runAnalysis() {
    if (!input.trim()) return
    setRunning(true)
    try {
      const catalogue = await loadCatalogue()
      const result = analyze(input, catalogue)
      setAnalysis(result)
    } catch (e) {
      setCatErr((e as Error)?.message ?? 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  function clearAll() {
    setInput('')
    setAnalysis(null)
  }

  return (
    <Layout>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold text-red-800 tracking-tight">Gene Set Analysis</h1>
          <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            ciliopathy annotation
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1 max-w-2xl">
          Paste a list of human gene symbols (from an RNA-seq experiment, CRISPR screen, proteomics
          dataset, or any other source). CiliaMiner annotates each against the curated catalogue
          and breaks down the hits by ciliopathy class, disease association, and functional category.
        </p>
      </div>

      {/* ── Catalogue stats ──────────────────────────────────────── */}
      {catSize != null && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden mb-4">
          <div className="grid grid-cols-3 divide-x divide-stone-200">
            <Stat n={catSize} label="Genes in catalogue" />
            <Stat n={104}     label="Classified diseases" />
            <Stat n={4}       label="Ciliopathy classes" />
          </div>
        </div>
      )}

      {catErr && (
        <div className="bg-red-50/60 border-l-2 border-red-800 px-4 py-3 rounded-r mb-4">
          <p className="text-xs text-red-800">{catErr}</p>
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            Gene list
          </p>
          {!input && (
            <div className="flex items-center gap-1.5 flex-wrap">
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
          placeholder="BBS1, BBS2, IFT88, ARL13B... (comma, space, tab, or newline separated)"
          aria-label="Gene list input"
          rows={6}
          className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded font-mono text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition resize-y"
          disabled={catSize == null}
        />
        {catSize == null && !catErr && (
          <p className="text-[12px] text-stone-400 mt-2 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Loading catalogue…
          </p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!input.trim() || running || catSize == null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            <span>Analyze</span>
          </button>
          {input && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-stone-400 hover:text-stone-700 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      {analysis && <ResultsBlock result={analysis} />}

      {/* ── About panel ───────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mt-4">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
          About Gene Set Analysis
        </p>
        <p className="text-xs text-stone-700 leading-relaxed">
          Each input symbol is uppercased, deduplicated, and matched against the v15 catalogue&rsquo;s
          gene index. Matched genes are aggregated by their ciliopathy class assignments
          (Primary, Tissue-restricted, Motile, Secondary), their associated diseases, their
          functional category, and their subcellular localization. Unmatched symbols are
          reported separately for transparency. Gene symbols not in the catalogue may still be
          ciliary &mdash; this catalogue covers ciliopathy-implicated genes with published
          patient-mutation + ciliary mechanism evidence, not the full ciliary proteome.
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

function ResultsBlock({ result }: { result: AnalysisResult }) {
  const matchPct = result.total_unique === 0 ? 0
    : Math.round((result.matched.length / result.total_unique) * 100)

  function copyUnmatched() {
    if (!result.unmatched.length) return
    navigator.clipboard.writeText(result.unmatched.join('\n')).catch(() => {})
  }

  function downloadCsv() {
    const csv = resultToCsv(result)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ciliaminer_gene_set_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  // Sorted entries for the breakdown panels
  const classOrder = ['Primary Ciliopathies', 'Tissue-restricted Ciliopathies',
                      'Motile Ciliopathies', 'Secondary Diseases']
  const classEntries = classOrder
    .map((c) => [c, result.class_counts[c] || 0] as const)
    .filter(([, n]) => n > 0)

  const diseaseEntries  = Object.entries(result.disease_counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
  const categoryEntries = Object.entries(result.category_counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
  const localizationEntries = Object.entries(result.localization_counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)

  const maxClassCount   = Math.max(1, ...classEntries.map((e) => e[1]))
  const maxDiseaseCount = Math.max(1, ...diseaseEntries.map((e) => e[1]))
  const maxCatCount     = Math.max(1, ...categoryEntries.map((e) => e[1]))
  const maxLocCount     = Math.max(1, ...localizationEntries.map((e) => e[1]))

  return (
    <>
      {/* Match summary */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              Catalogue coverage
            </p>
            <span className="text-2xl font-bold text-stone-900 tabular-nums leading-none">
              {matchPct}%
            </span>
            <span className="text-[12px] text-stone-500 font-mono tabular-nums">
              ({result.matched.length} of {result.total_unique} unique genes
              {result.duplicates_removed > 0 ? ` · ${result.duplicates_removed} duplicate${result.duplicates_removed === 1 ? '' : 's'} removed` : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[12px] font-semibold text-stone-700"
            >
              <Download className="w-3 h-3" aria-hidden="true" />
              <span>CSV</span>
            </button>
          </div>
        </div>
        <div className="relative h-1.5 bg-stone-100 rounded-sm overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-red-800/85 transition-[width] duration-500"
            style={{ width: `${matchPct}%` }}
            aria-label={`${matchPct}% catalogue coverage`}
          />
        </div>
      </div>

      {/* Class distribution + top diseases — side by side on wider screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {classEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-2">
              Ciliopathy class distribution
            </p>
            <p className="text-[11px] text-stone-400 mb-3 leading-relaxed">
              A gene can be implicated in diseases across multiple classes; counts are
              non-exclusive.
            </p>
            <SvgBarChart
              title="Ciliopathy class distribution"
              entries={classEntries}
              max={maxClassCount}
              filename="ciliaminer_gsa_class_distribution"
              hrefBase={(label) => `/ciliopathy-classification?cls=${encodeURIComponent(label)}`}
            />
          </div>
        )}
        {diseaseEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-2">
              Disease associations
            </p>
            <p className="text-[11px] text-stone-400 mb-3 leading-relaxed">
              Top {diseaseEntries.length} ciliopathies represented in the input set, ranked by
              number of implicated input genes.
            </p>
            <SvgBarChart
              title="Disease associations"
              entries={diseaseEntries}
              max={maxDiseaseCount}
              filename="ciliaminer_gsa_disease_associations"
              hrefBase={(label) => `/disease/${encodeURIComponent(label)}`}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {categoryEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-2">
              Functional categories
            </p>
            <SvgBarChart
              title="Functional categories"
              entries={categoryEntries}
              max={maxCatCount}
              filename="ciliaminer_gsa_functional_categories"
            />
          </div>
        )}
        {localizationEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-2">
              Subcellular localization
            </p>
            <SvgBarChart
              title="Subcellular localization"
              entries={localizationEntries}
              max={maxLocCount}
              filename="ciliaminer_gsa_subcellular_localization"
            />
          </div>
        )}
      </div>

      {/* Per-gene table */}
      {result.matched.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-3">
          <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800">
              Matched genes
            </p>
            <span className="text-[11px] font-mono text-stone-400 tabular-nums">
              {result.matched.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="py-2 pr-3 text-[11px] uppercase tracking-wider font-bold text-stone-500">Symbol</th>
                  <th className="py-2 pr-3 text-[11px] uppercase tracking-wider font-bold text-stone-500">Classes</th>
                  <th className="py-2 pr-3 text-[11px] uppercase tracking-wider font-bold text-stone-500">Diseases</th>
                  <th className="py-2 pr-3 text-[11px] uppercase tracking-wider font-bold text-stone-500">Category</th>
                </tr>
              </thead>
              <tbody>
                {result.matched.map((m) => <GeneRow key={m.symbol} m={m} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched */}
      {result.unmatched.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-3">
          <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              Not in catalogue
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                {result.unmatched.length}
              </span>
              <button
                type="button"
                onClick={copyUnmatched}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[11px] font-semibold text-stone-700"
              >
                <Copy className="w-3 h-3" aria-hidden="true" />
                <span>Copy</span>
              </button>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {result.unmatched.map((u) => (
              <li key={u}>
                <span className="inline-block px-2 py-0.5 bg-stone-50 border border-stone-200 rounded text-[11px] font-mono text-stone-500">
                  {u}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-stone-400 mt-3 leading-relaxed">
            These symbols don&rsquo;t appear in the v15 catalogue. They may still be ciliary
            (the catalogue covers ciliopathy-implicated genes with published evidence, not the
            full ciliary proteome), or they may be typos / synonyms / non-ciliary genes.
          </p>
        </div>
      )}
    </>
  )
}

function GeneRow({ m }: { m: GeneAnnotation }) {
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50/50 transition">
      <td className="py-2 pr-3">
        <Link
          href={`/gene/${encodeURIComponent(m.symbol)}`}
          className="font-mono text-xs font-semibold text-stone-900 hover:text-red-800 transition"
        >
          {m.symbol}
        </Link>
        {m.matched_via && m.matched_via !== m.symbol && (
          <span
            className="inline-block ml-1.5 text-[10px] uppercase tracking-wider font-bold text-red-800 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded"
            title={`Your input "${m.matched_via}" is a listed synonym of ${m.symbol}`}
          >
            via {m.matched_via}
          </span>
        )}
        {m.full_name && (
          <div className="text-[11px] text-stone-400 leading-tight max-w-[200px] truncate" title={m.full_name}>
            {m.full_name}
          </div>
        )}
      </td>
      <td className="py-2 pr-3 align-top">
        <ul className="flex flex-wrap gap-1">
          {m.ciliopathy_classes.map((c) => (
            <li key={c} className="text-[10px] uppercase tracking-wider font-bold text-red-800 bg-red-50 px-1.5 py-0.5 rounded">
              {classAbbrev(c)}
            </li>
          ))}
        </ul>
      </td>
      <td className="py-2 pr-3 align-top">
        <ul className="space-y-0.5">
          {m.diseases.slice(0, 3).map((d) => (
            <li key={d}>
              <Link
                href={`/disease/${encodeURIComponent(d)}`}
                className="text-[12px] text-stone-700 hover:text-red-800 transition"
              >
                {d}
              </Link>
            </li>
          ))}
          {m.diseases.length > 3 && (
            <li className="text-[11px] text-stone-400">+ {m.diseases.length - 3} more</li>
          )}
        </ul>
      </td>
      <td className="py-2 pr-3 align-top">
        {m.functional_category.length > 0 ? (
          <ul className="space-y-0.5">
            {m.functional_category.slice(0, 2).map((f) => (
              <li key={f} className="text-[12px] text-stone-600">{f}</li>
            ))}
            {m.functional_category.length > 2 && (
              <li className="text-[11px] text-stone-400">+ {m.functional_category.length - 2} more</li>
            )}
          </ul>
        ) : (
          <span className="text-[11px] text-stone-300 italic">—</span>
        )}
      </td>
    </tr>
  )
}

function classAbbrev(c: string): string {
  // Short labels for table cells
  switch (c) {
    case 'Primary Ciliopathies':            return 'Primary'
    case 'Tissue-restricted Ciliopathies':  return 'Tissue-restricted'
    case 'Motile Ciliopathies':             return 'Motile'
    case 'Secondary Diseases':              return 'Secondary'
    default:                                return c
  }
}
