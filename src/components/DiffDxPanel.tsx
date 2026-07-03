'use client'

/**
 * DiffDxPanel — differential diagnosis panel for a disease.
 *
 * Renders the top-N most phenotypically similar diseases by
 * information-content-weighted Jaccard similarity over canonicalised
 * symptom concept sets, with the most discriminative shared concepts
 * shown beneath each entry.
 *
 * Data: pre-computed at build time in /data/disease_similarity_v1.json
 * (lazy-loaded via lib/similarityData.ts).
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSimilarFor, type SimilarDisease } from '@/lib/similarityData'

interface Props {
  diseaseName: string
}

export default function DiffDxPanel({ diseaseName }: Props) {
  const [similar, setSimilar] = useState<SimilarDisease[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSimilarFor(diseaseName)
      .then((s) => { if (!cancelled) setSimilar(s) })
      .catch(() => { if (!cancelled) setSimilar([]) })
    return () => { cancelled = true }
  }, [diseaseName])

  if (similar === null) {
    return (
      <p className="text-xs text-primary-400 font-mono">
        Loading differential diagnosis…
      </p>
    )
  }
  if (similar.length === 0) {
    return (
      <p className="text-xs text-primary-400 italic">
        No similarity data available for this disease.
      </p>
    )
  }

  const visible = expanded ? similar : similar.slice(0, 5)

  return (
    <>
      <p className="text-xs text-primary-500 leading-relaxed mb-5 max-w-2xl">
        Diseases ranked by clinical-feature overlap, using information-content-weighted
        Jaccard similarity over canonicalised HPO concept sets. Rare symptoms count
        more than common ones, so high scores reflect shared <em className="italic">specific</em> phenotypes.
      </p>

      <ol className="space-y-3">
        {visible.map((s, i) => (
          <li key={s.disease} className="border-l-2 border-primary-100 hover:border-accent transition-colors pl-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                <span className="font-mono text-[12px] text-primary-400 tabular-nums w-6 shrink-0">
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <Link
                  href={`/disease/${encodeURIComponent(s.disease)}`}
                  className="font-display text-primary-800 text-base hover:text-accent transition-colors leading-tight"
                >
                  {s.disease}
                </Link>
              </div>
              <div className="flex items-baseline gap-3 text-[12px] font-mono tabular-nums whitespace-nowrap">
                <span className="text-primary-700">
                  J&nbsp;=&nbsp;{s.jaccard.toFixed(3)}
                </span>
                <span className="text-primary-400">
                  {s.shared_count} shared
                </span>
              </div>
            </div>

            {/* Tiny overlap visualisation bar */}
            <div className="mt-2 mb-2 flex h-1 rounded-sm overflow-hidden bg-surface-muted">
              <div
                className="bg-accent/70"
                style={{ flex: s.shared_count }}
                title={`${s.shared_count} shared`}
              />
              <div
                className="bg-primary-200"
                style={{ flex: Math.max(s.a_only_count, 1) }}
                title={`${s.a_only_count} only in ${diseaseName}`}
              />
              <div
                className="bg-primary-200/50"
                style={{ flex: Math.max(s.b_only_count, 1) }}
                title={`${s.b_only_count} only in ${s.disease}`}
              />
            </div>

            {/* Top shared concepts */}
            {s.shared_top.length > 0 && (
              <ul className="flex flex-wrap gap-1 mt-2">
                {s.shared_top.slice(0, 5).map((c) => (
                  <li
                    key={c}
                    className="bg-surface-muted text-primary-700 px-1.5 py-0.5 rounded-sm text-[12px]"
                  >
                    {c}
                  </li>
                ))}
                {s.shared_top.length > 5 && (
                  <li className="text-[12px] text-primary-400 italic px-1.5 py-0.5">
                    +{s.shared_top.length - 5} more
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {similar.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-xs text-accent hover:text-accent-dark underline decoration-accent/30 underline-offset-2 transition-colors"
        >
          {expanded ? 'Show fewer' : `Show all ${similar.length} similar diseases`}
        </button>
      )}
    </>
  )
}
