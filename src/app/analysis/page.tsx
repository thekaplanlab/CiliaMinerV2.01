'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import {
  BarChart3,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Shield,
  ChevronDown,
  ChevronUp,
  Target,
  Activity,
} from 'lucide-react'

// ── Types for the analysis JSON ─────────────────────────────────────────────

interface Evidence {
  evidence_type: string
  detail: string
  supporting_entity: string
  weight: number
}

interface PredictionResult {
  gene: string
  disease: string
  confidence: number
  evidence: Evidence[]
  supporting_genes: string[]
}

interface SymptomGap {
  disease: string
  known_symptom_count: number
  coverage_score: number
  missing_symptoms: string[]
  notes: string
}

interface NovelHypothesis {
  gene: string
  predicted_disease: string
  confidence: number
  evidence: Evidence[]
  rationale: string
}

interface AnalysisData {
  matched_relations: { gene: string; disease: string }[]
  missed_relations: { gene: string; disease: string }[]
  predicted_diseases: PredictionResult[]
  confidence_scores: Record<string, number>
  missing_symptoms: SymptomGap[]
  novel_hypotheses: NovelHypothesis[]
  dataset_reliability: number
  prediction_accuracy: {
    precision: number
    recall: number
    f1: number
    coverage: number
  }
  dataset_reliability_detail?: {
    reliability: number
    dimensions: Record<string, number>
    counts: Record<string, number>
  }
  orphan_clusters?: { genes: string[]; size: number; shared_pathways: string[] }[]
}

// ── Helper components ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-primary',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-orange-500'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct}%</span>
    </div>
  )
}

function EvidenceBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    direct: 'bg-green-100 text-green-800',
    pathway: 'bg-blue-100 text-blue-800',
    localization: 'bg-purple-100 text-purple-800',
    phenotype: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  )
}

function Collapsible({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-800">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-gray-400">({count})</span>
          )}
        </span>
        {open ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-50">{children}</div>}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/analysis_results.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Failed to load analysis results</h2>
          <p className="text-gray-500 mt-2">
            Run the analysis pipeline first:
            <code className="block mt-2 bg-gray-100 px-4 py-2 rounded text-sm mx-auto max-w-xl">
              python3 -m analysis.main --mode full --data-source json --json-dir backend/data --output results.json
            </code>
          </p>
        </div>
      </Layout>
    )
  }

  const dims = data.dataset_reliability_detail?.dimensions
  const counts = data.dataset_reliability_detail?.counts

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary">Disease Prediction Analysis</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mt-3">
            CiliaMiner + ClinGen integrated knowledge-graph analysis
          </p>
          <p className="text-sm text-gray-400 mt-1">
            2,591 genes &middot; {counts?.total_diseases ?? '–'} diseases &middot; {counts?.total_genes ?? '–'} pathway-annotated genes
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={CheckCircle2}
            label="Matched Relations"
            value={data.matched_relations.length}
            sub="Gene-disease pairs confirmed"
            color="text-green-600"
          />
          <StatCard
            icon={XCircle}
            label="Missed Relations"
            value={data.missed_relations.length}
            sub="Known but not predicted"
            color="text-red-500"
          />
          <StatCard
            icon={Lightbulb}
            label="Novel Hypotheses"
            value={data.novel_hypotheses.length}
            sub="New gene-disease candidates"
            color="text-amber-500"
          />
          <StatCard
            icon={Activity}
            label="Disease Predictions"
            value={data.predicted_diseases.length}
            sub="For queried gene panel"
            color="text-purple-600"
          />
          <StatCard
            icon={Shield}
            label="Dataset Reliability"
            value={`${Math.round(data.dataset_reliability * 100)}%`}
            sub="Overall data completeness"
            color="text-blue-600"
          />
        </div>

        {/* Prediction accuracy */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Prediction Accuracy
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {(['precision', 'recall', 'f1', 'coverage'] as const).map((key) => (
              <div key={key}>
                <p className="text-sm text-gray-500 capitalize mb-1">{key === 'f1' ? 'F1 Score' : key}</p>
                <ConfidenceBar value={data.prediction_accuracy[key]} />
              </div>
            ))}
          </div>
        </div>

        {/* Dataset reliability detail */}
        {dims && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Dataset Coverage Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(dims).map(([key, val]) => (
                <div key={key}>
                  <p className="text-sm text-gray-500 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    {counts && (
                      <span className="text-gray-400 ml-1">
                        ({counts[key.replace('coverage', '').replace(/_$/, '').replace('gene_', 'genes_with_').replace('disease_', 'diseases_with_')] || '–'})
                      </span>
                    )}
                  </p>
                  <ConfidenceBar value={val} />
                </div>
              ))}
            </div>
            {counts && (
              <p className="text-xs text-gray-400 mt-4">
                Total: {counts.total_genes} genes, {counts.total_diseases} diseases
              </p>
            )}
          </div>
        )}

        {/* Disease predictions */}
        <Collapsible
          title="Disease Predictions"
          count={data.predicted_diseases.length}
          defaultOpen={true}
        >
          <div className="mt-4 space-y-4">
            {data.predicted_diseases.map((pred, i) => {
              const evidenceTypes = Array.from(new Set(pred.evidence.map((e) => e.evidence_type)))
              return (
                <div
                  key={i}
                  className="border border-gray-100 rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800">{pred.disease}</h3>
                    <div className="w-40">
                      <ConfidenceBar value={pred.confidence} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {evidenceTypes.map((t) => (
                      <EvidenceBadge key={t} type={t} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Query: <span className="font-medium">{pred.gene.length > 60 ? pred.gene.slice(0, 60) + ' …' : pred.gene}</span>
                    {' · '}
                    {pred.evidence.length} evidence line(s)
                    {pred.supporting_genes && pred.supporting_genes.length > 0 && (
                      <span className="text-gray-400">
                        {' — '}
                        {pred.supporting_genes.slice(0, 8).join(', ')}
                        {pred.supporting_genes.length > 8 && ' …'}
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        </Collapsible>

        {/* Novel hypotheses */}
        <Collapsible title="Novel Hypotheses" count={data.novel_hypotheses.length}>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Gene</th>
                  <th className="pb-2 pr-4">Predicted Disease</th>
                  <th className="pb-2 pr-4 w-32">Confidence</th>
                  <th className="pb-2 pr-4">Evidence</th>
                  <th className="pb-2">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {data.novel_hypotheses.slice(0, 50).map((h, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 pr-4 font-medium text-primary">{h.gene}</td>
                    <td className="py-2 pr-4">{h.predicted_disease}</td>
                    <td className="py-2 pr-4">
                      <ConfidenceBar value={h.confidence} />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {h.evidence && h.evidence.map((e, j) => (
                          <EvidenceBadge key={j} type={e.evidence_type} />
                        ))}
                      </div>
                      {h.evidence && h.evidence.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{h.evidence[0].supporting_entity}</p>
                      )}
                    </td>
                    <td className="py-2 text-gray-500 text-xs">{h.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.novel_hypotheses.length > 50 && (
              <p className="text-xs text-gray-400 mt-2">
                Showing 50 of {data.novel_hypotheses.length} hypotheses
              </p>
            )}
          </div>
        </Collapsible>

        {/* Symptom gaps */}
        <Collapsible title="Symptom Coverage Gaps" count={data.missing_symptoms.filter((g) => g.known_symptom_count === 0).length}>
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-3">
              Diseases with no symptom data in the dataset ({data.missing_symptoms.filter((g) => g.known_symptom_count === 0).length} of {data.missing_symptoms.length} total)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.missing_symptoms
                .filter((g) => g.known_symptom_count === 0)
                .slice(0, 20)
                .map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-red-50/50">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">{gap.disease}</p>
                      {gap.notes && <p className="text-xs text-gray-500">{gap.notes}</p>}
                      {gap.missing_symptoms.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Suggested: {gap.missing_symptoms.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Collapsible>

        {/* Matched relations sample */}
        <Collapsible title="Matched Relations (sample)" count={data.matched_relations.length}>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Gene</th>
                  <th className="pb-2">Disease</th>
                </tr>
              </thead>
              <tbody>
                {data.matched_relations.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-4 font-medium text-green-700">{r.gene}</td>
                    <td className="py-1.5 text-gray-700">{r.disease}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.matched_relations.length > 25 && (
              <p className="text-xs text-gray-400 mt-2">
                Showing 25 of {data.matched_relations.length}
              </p>
            )}
          </div>
        </Collapsible>

        {/* Orphan clusters */}
        {data.orphan_clusters && data.orphan_clusters.length > 0 && (
          <Collapsible title="Orphan Gene Clusters" count={data.orphan_clusters.length}>
            <div className="mt-4 space-y-4">
              {data.orphan_clusters.map((c, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4">
                  <p className="font-medium text-gray-800 mb-1">
                    Cluster of {c.size} genes (no disease annotation)
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Genes: {c.genes.slice(0, 15).join(', ')}
                    {c.genes.length > 15 && ' …'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Shared pathways: {c.shared_pathways.slice(0, 10).join(', ')}
                    {c.shared_pathways.length > 10 && ' …'}
                  </p>
                </div>
              ))}
            </div>
          </Collapsible>
        )}
      </div>
    </Layout>
  )
}
