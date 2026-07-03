'use client'

/**
 * Disease detail page — overhaul.
 *
 *   1. Header / disease card    : classification badge, abbreviation,
 *                                 synonyms, abstract rationale, notes,
 *                                 external links (OMIM, Orphanet,
 *                                 MedlinePlus, GeneReviews).
 *   2. Representative excerpts  : 1-3 short OMIM phrases (S5).
 *   3. Associated genes table   : Gene | ENSG | Gene OMIM | UniProt |
 *                                 Localization | Other diseases. CSV
 *                                 download. Rows link to /gene/{symbol}.
 *   4. Symptoms table           : Symptom | Organ | HPO ID | Evidence.
 *                                 CSV download. Rows link to the symptom
 *                                 detail panel.
 *   5. Differential diagnosis   : Existing DiffDxPanel.
 *
 * Template classes throughout (bg-white, border-stone-200, bg-stone-50,
 * text-red-800).
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Download, ExternalLink } from 'lucide-react'
import DiffDxPanel from '@/components/DiffDxPanel'
import { loadClinical, type ClinicalDisease } from '@/lib/clinicalFeaturesData'

// ── Data shape (master JSON) ───────────────────────────────────────────

interface RawGene {
  gene: string
  ensembl_id?: string | null
  omim_id?: string | number | null
  uniprot_id?: string | null
  localization?: string[] | string | null
  ciliopathies?: string[]
  ciliopathy_classes?: string[]
}

interface RawSynonym {
  synonyms?: string[]
  omim_preferred?: string
  abbreviation?: string
  notes?: string
}

interface RawMaster {
  genes: Record<string, RawGene>
  disease_classifications: Record<string, string>
  disease_synonyms: Record<string, RawSynonym>
  disease_rationale?: Record<string, string>
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v.length > 0) return v.split(';').map((s) => s.trim()).filter(Boolean)
  return []
}

// ── Page ───────────────────────────────────────────────────────────────

export default function DiseaseDetailClient({ name }: { name: string }) {
  return (
    <ErrorBoundary scope="disease-detail">
      <Inner name={decodeURIComponent(name)} />
    </ErrorBoundary>
  )
}

interface DerivedGene {
  symbol:        string
  ensembl:       string
  omim:          string
  uniprot:       string
  localization:  string[]
  otherDiseases: string[]
  className:     string
}

function Inner({ name }: { name: string }) {
  const [master, setMaster] = useState<RawMaster | null>(null)
  const [clinical, setClinical] = useState<ClinicalDisease | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/ciliopathy_genes_v15.json', { cache: 'default' }).then((r) => r.json()),
      loadClinical().catch(() => null),
    ])
      .then(([m, cl]: [RawMaster, any]) => {
        if (cancelled) return
        setMaster(m)
        if (cl && cl.diseases) {
          const direct = cl.diseases[name]
          if (direct) setClinical(direct)
          else {
            const target = name.toLowerCase()
            for (const k of Object.keys(cl.diseases)) {
              if (k.toLowerCase() === target) { setClinical(cl.diseases[k]); break }
            }
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message ?? 'Failed to load disease data')
      })
    return () => { cancelled = true }
  }, [name])

  // ── Derived data ───────────────────────────────────────────────────
  const className = master?.disease_classifications?.[name] ?? ''
  const meta      = master?.disease_synonyms?.[name] ?? {}
  const rationale = master?.disease_rationale?.[name] ?? ''

  const genes: DerivedGene[] = useMemo(() => {
    if (!master) return []
    const out: DerivedGene[] = []
    for (const g of Object.values(master.genes)) {
      const cilios = arr(g.ciliopathies)
      if (!cilios.includes(name)) continue
      const others = cilios.filter((c) => c !== name)
      out.push({
        symbol:        g.gene || '',
        ensembl:       String(g.ensembl_id || '').trim(),
        omim:          String(g.omim_id    || '').trim(),
        uniprot:       String(g.uniprot_id || '').trim(),
        localization:  arr(g.localization),
        otherDiseases: others,
        className:     (g.ciliopathy_classes && g.ciliopathy_classes[0]) || '',
      })
    }
    out.sort((a, b) => a.symbol.localeCompare(b.symbol))
    return out
  }, [master, name])

  // Flatten clinical features → row per symptom×organ entry
  interface SymptomRow {
    symptom:       string
    organ:         string
    hpoId:         string
    parentConcept: string
    evidence:      number
  }
  const symptoms: SymptomRow[] = useMemo(() => {
    if (!clinical) return []
    const out: SymptomRow[] = []
    for (const [organ, concepts] of Object.entries(clinical.by_organ_records || {})) {
      for (const c of (concepts as any[])) {
        out.push({
          symptom:       c.concept,
          organ:         organ,
          hpoId:         c.hpo_id || '',
          parentConcept: c.parent_concept || '',
          evidence:      c.evidence_count || 0,
        })
      }
    }
    out.sort((a, b) => b.evidence - a.evidence || a.symptom.localeCompare(b.symptom))
    return out
  }, [clinical])

  // ── Loading / error ────────────────────────────────────────────────
  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </Layout>
    )
  }
  if (!master) {
    return (
      <Layout>
        <p className="text-xs text-stone-400 font-mono py-12 text-center">Loading…</p>
      </Layout>
    )
  }

  const synonyms = arr(meta.synonyms)
  const abbreviation = meta.abbreviation || ''
  const notes = meta.notes || ''

  return (
    <Layout>
      {/* Breadcrumb */}
      <nav className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-stone-900 transition">Home</Link>
        {' › '}
        <Link href="/ciliopathy-classification" className="hover:text-stone-900 transition">
          Disease Classification
        </Link>
      </nav>

      {/* ── Disease header card ─────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 mb-4">
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <span className="text-[11px] uppercase tracking-wider font-bold text-red-800">
            {className || 'Disease'}
          </span>
          {abbreviation && (
            <span className="text-[11px] font-mono text-stone-500">
              {abbreviation}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-red-800 tracking-tight leading-tight mb-3">
          {name}
        </h1>

        {synonyms.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1.5">
              Also known as
            </p>
            <p className="text-xs text-stone-600 leading-relaxed italic">
              {synonyms.join(' · ')}
            </p>
          </div>
        )}

        {rationale && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1.5">
              Why this class
            </p>
            <p className="text-xs text-stone-700 leading-relaxed">{rationale}</p>
          </div>
        )}

        {notes && (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1.5">
              Curator notes
            </p>
            <p className="text-xs text-stone-700 leading-relaxed">{notes}</p>
          </div>
        )}

        {/* External links — search OMIM/Orphanet/etc. by disease name */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-stone-100">
          <ExtLink
            label="OMIM"
            url={`https://www.omim.org/search?index=entry&search=${encodeURIComponent(name)}`}
          />
          <ExtLink
            label="Orphanet"
            url={`https://www.orpha.net/en/disease/search?diseaseGroup=${encodeURIComponent(name)}&diseaseType=Pat`}
          />
          <ExtLink
            label="GeneReviews"
            url={`https://www.ncbi.nlm.nih.gov/books/?term=${encodeURIComponent(name)}`}
          />
          <ExtLink
            label="ClinVar"
            url={`https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(name)}`}
          />
        </div>
      </div>

      {/* ── Representative clinical description (OMIM excerpts) ─── */}
      {clinical && clinical.representative_phrases && clinical.representative_phrases.length > 0 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 mb-4">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
            Representative clinical description
          </p>
          <ul className="space-y-2">
            {clinical.representative_phrases.slice(0, 3).map((r: any, i: number) => (
              <li key={i} className="text-xs text-stone-700 leading-relaxed italic border-l-2 border-stone-200 pl-3">
                &ldquo;{r.phrase}&rdquo;
                <span className="not-italic ml-2 text-[11px] uppercase tracking-wider text-stone-400 font-mono">
                  {r.concept}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Associated genes table ──────────────────────────────── */}
      <GenesSection genes={genes} diseaseName={name} />

      {/* ── Symptoms table ──────────────────────────────────────── */}
      <SymptomsSection
        symptoms={symptoms}
        diseaseName={name}
        clinical={clinical}
      />

      {/* ── Differential diagnosis ──────────────────────────────── */}
      {clinical && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 mb-4">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
            Differential diagnosis
          </p>
          <DiffDxPanel diseaseName={name} />
        </div>
      )}
    </Layout>
  )
}

// ── Genes section ─────────────────────────────────────────────────────

function GenesSection({ genes, diseaseName }: { genes: DerivedGene[]; diseaseName: string }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-stone-200 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            Associated genes
          </h2>
          <span className="text-[12px] font-mono text-stone-400 tabular-nums">
            {genes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => downloadGenesCsv(genes, diseaseName)}
          disabled={genes.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-xs font-semibold rounded transition"
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          <span>Download CSV</span>
        </button>
      </div>

      {genes.length === 0 ? (
        <p className="px-6 py-10 text-center text-xs text-stone-400 italic">
          No genes recorded for this disease.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="py-2.5 px-4 text-left">Gene</th>
                <th className="py-2.5 px-4 text-left">ENSG ID</th>
                <th className="py-2.5 px-4 text-left hidden sm:table-cell">Gene OMIM</th>
                <th className="py-2.5 px-4 text-left hidden md:table-cell">UniProt</th>
                <th className="py-2.5 px-4 text-left">Localization</th>
                <th className="py-2.5 px-4 text-left hidden lg:table-cell">Other diseases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {genes.map((g) => (
                <tr key={g.symbol} className="hover:bg-stone-50/50 transition">
                  <td className="py-2.5 px-4 font-semibold">
                    <Link
                      href={`/gene/${encodeURIComponent(g.symbol)}`}
                      className="text-stone-900 hover:text-red-800 transition"
                    >
                      {g.symbol}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-stone-500">
                    {g.ensembl ? (
                      <a
                        href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${g.ensembl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-red-800 transition"
                      >
                        {g.ensembl}
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-stone-500 hidden sm:table-cell">
                    {g.omim ? (
                      <a
                        href={`https://www.omim.org/entry/${g.omim}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-red-800 transition"
                      >
                        {g.omim}
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-stone-500 hidden md:table-cell">
                    {g.uniprot ? (
                      <a
                        href={`https://www.uniprot.org/uniprotkb/${g.uniprot}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-red-800 transition"
                      >
                        {g.uniprot}
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-stone-600">
                    {g.localization.slice(0, 3).join(', ') || (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-stone-500 hidden lg:table-cell">
                    {g.otherDiseases.slice(0, 2).join(', ')}
                    {g.otherDiseases.length > 2 && (
                      <span className="text-stone-400 italic ml-1">
                        +{g.otherDiseases.length - 2}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Symptoms section ──────────────────────────────────────────────────

interface SymptomRow {
  symptom:       string
  organ:         string
  hpoId:         string
  parentConcept: string
  evidence:      number
}

function SymptomsSection({
  symptoms, diseaseName, clinical,
}: {
  symptoms: SymptomRow[]
  diseaseName: string
  clinical: ClinicalDisease | null
}) {
  const summary = clinical?.summary || {}

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-stone-200 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            Symptoms
          </h2>
          {symptoms.length > 0 && (
            <span className="text-[12px] font-mono text-stone-400 tabular-nums">
              {symptoms.length} concept{symptoms.length === 1 ? '' : 's'}
              {summary.n_organs ? ` · ${summary.n_organs} organs` : ''}
              {summary.mapped_records ? ` · ${summary.mapped_records.toLocaleString()} records` : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => downloadSymptomsCsv(symptoms, diseaseName)}
          disabled={symptoms.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 text-xs font-semibold rounded transition"
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          <span>Download CSV</span>
        </button>
      </div>

      {symptoms.length === 0 ? (
        <p className="px-6 py-10 text-center text-xs text-stone-400 italic">
          {clinical ? 'No symptoms recorded for this disease.' : 'Loading symptom data…'}
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="py-2.5 px-4 text-left">Symptom</th>
                <th className="py-2.5 px-4 text-left">Organ</th>
                <th className="py-2.5 px-4 text-left">HPO ID</th>
                <th className="py-2.5 px-4 text-left hidden md:table-cell">Parent concept</th>
                <th className="py-2.5 px-4 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {symptoms.map((s, i) => (
                <tr key={`${s.symptom}-${s.organ}-${i}`} className="hover:bg-stone-50/50 transition">
                  <td className="py-2.5 px-4 font-semibold">
                    <Link
                      href={`/symptoms-diseases/#concept=${encodeURIComponent(s.symptom)}`}
                      className="text-stone-900 hover:text-red-800 transition"
                    >
                      {s.symptom}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 text-stone-500">
                    {s.organ.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-stone-500">
                    {s.hpoId ? (
                      <a
                        href={`https://hpo.jax.org/browse/term/${s.hpoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-red-800 transition"
                      >
                        {s.hpoId}
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-stone-500 italic hidden md:table-cell">
                    {s.parentConcept || ''}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-stone-600 tabular-nums">
                    {s.evidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Small UI helpers ──────────────────────────────────────────────────

function ExtLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-red-800 text-xs font-semibold rounded transition"
    >
      <span>{label}</span>
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
    </a>
  )
}

// ── CSV download helpers ──────────────────────────────────────────────

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60) || 'disease'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadGenesCsv(genes: DerivedGene[], diseaseName: string) {
  const header = [
    'gene_symbol', 'ensg_id', 'gene_omim', 'uniprot_id',
    'localization', 'disease', 'gene_class', 'other_diseases',
  ]
  const rows: Array<Array<string | number>> = [header]
  for (const g of genes) {
    rows.push([
      g.symbol,
      g.ensembl,
      g.omim,
      g.uniprot,
      g.localization.join('; '),
      diseaseName,
      g.className,
      g.otherDiseases.join('; '),
    ])
  }
  downloadCsv(`ciliaminer_genes_${slug(diseaseName)}_${today()}.csv`, rows)
}

function downloadSymptomsCsv(symptoms: SymptomRow[], diseaseName: string) {
  const header = ['symptom', 'organ_system', 'hpo_id', 'parent_concept', 'evidence_count', 'disease']
  const rows: Array<Array<string | number>> = [header]
  for (const s of symptoms) {
    rows.push([
      s.symptom,
      s.organ,
      s.hpoId,
      s.parentConcept,
      s.evidence,
      diseaseName,
    ])
  }
  downloadCsv(`ciliaminer_symptoms_${slug(diseaseName)}_${today()}.csv`, rows)
}
