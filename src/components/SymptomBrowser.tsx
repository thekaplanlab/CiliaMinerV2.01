'use client'

/**
 * SymptomBrowser — the full clinical-features experience for a disease.
 *
 * For each organ system, a row of clickable chips. Each chip carries the
 * evidence count and an HPO ID badge. Behaviour:
 *
 *   - Hover (desktop only, via `@media (hover: hover)`): a small popover
 *     shows the HPO term name + definition preview.
 *   - Click / tap (both platforms): expands a detail panel beneath the
 *     selected chip. Panel contains:
 *       • Full HPO definition + synonyms + ID link
 *       • The raw OMIM phrases that mapped to this concept (provenance)
 *       • "Also observed in N other diseases" with top-N preview
 *
 * Data sources:
 *   - ClinicalDisease (organ-grouped concepts + provenance)        — S5
 *   - SymptomsFile.concepts[name].diseases (cross-disease lookup)  — v3.3
 *   - HPO term definitions + synonyms                              — HPO
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  type ClinicalDisease,
  type ClinicalConcept,
} from '@/lib/clinicalFeaturesData'
import { loadHpo, type HpoTerm } from '@/lib/hpoData'
import {
  loadSymptoms,
  type SymptomConcept,
  type SymptomsFile,
} from '@/lib/symptomsData'

interface Props {
  diseaseName: string
  clinical: ClinicalDisease
}

interface SelectedState {
  organ: string
  concept: string
}

export default function SymptomBrowser({ diseaseName, clinical }: Props) {
  const [selected, setSelected] = useState<SelectedState | null>(null)
  const [hpo, setHpo] = useState<Record<string, HpoTerm> | null>(null)
  const [symptoms, setSymptoms] = useState<SymptomsFile | null>(null)

  // Load HPO + cross-disease lookup once
  useEffect(() => {
    let cancelled = false
    Promise.all([loadHpo(), loadSymptoms()])
      .then(([h, s]) => {
        if (cancelled) return
        setHpo(h.terms)
        setSymptoms(s)
      })
      .catch(() => { /* page still renders fine without these */ })
    return () => { cancelled = true }
  }, [])

  const organs = Object.keys(clinical.by_organ_records)
  if (organs.length === 0) return null

  // Helper — get the selected concept entry
  const selectedConcept: ClinicalConcept | null = selected
    ? (clinical.by_organ_records[selected.organ] || []).find(
        (c) => c.concept === selected.concept,
      ) ?? null
    : null

  return (
    <div>
      {/* Tooltip styles — hover only on devices with actual hover capability */}
      <style>{tooltipCss}</style>

      <p className="text-xs text-primary-500 leading-relaxed mb-5 max-w-2xl">
        OMIM-derived symptom records, grouped by organ system and mapped to canonical
        HPO concepts. Hover or tap any symptom to see its full definition and the
        original OMIM phrases that produced this association.
      </p>

      <dl className="space-y-6">
        {organs.map((organ) => {
          const concepts = clinical.by_organ_records[organ] || []
          if (concepts.length === 0) return null
          return (
            <div key={organ}>
              <dt className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-2 flex items-baseline gap-2">
                <span>{organ.replace(/_/g, ' ')}</span>
                <span className="font-mono text-primary-300">
                  {concepts.length} concept{concepts.length === 1 ? '' : 's'}
                </span>
              </dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {concepts.map((c) => {
                    const isOpen =
                      selected?.organ === organ && selected?.concept === c.concept
                    const hpoTerm = hpo && c.hpo_id ? hpo[c.hpo_id] : undefined
                    return (
                      <li key={`${organ}-${c.concept}`} className="cm-chip-wrap">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setSelected(
                              isOpen ? null : { organ, concept: c.concept },
                            )
                          }
                          className={`inline-flex items-baseline gap-1.5 border px-2 py-0.5 rounded-sm text-xs transition-colors ${
                            isOpen
                              ? 'bg-accent-soft border-accent text-accent-dark'
                              : 'bg-surface-muted border-primary-100 hover:border-primary-300 text-primary-700 hover:text-accent'
                          }`}
                        >
                          <span>{c.concept}</span>
                          <span className="font-mono text-[11px] text-primary-400">
                            {c.evidence_count}
                          </span>
                        </button>
                        {hpoTerm && (
                          <div className="cm-tip" role="tooltip">
                            <p className="cm-tip-name">{hpoTerm.name}</p>
                            <p className="cm-tip-id font-mono">{hpoTerm.id}</p>
                            {hpoTerm.definition && (
                              <p className="cm-tip-def">
                                {truncate(hpoTerm.definition, 220)}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
          )
        })}
      </dl>

      {/* Selected concept — expanded card */}
      {selectedConcept && (
        <SelectedConceptCard
          concept={selectedConcept}
          organ={selected!.organ}
          diseaseName={diseaseName}
          hpoTerm={hpo && selectedConcept.hpo_id ? hpo[selectedConcept.hpo_id] : null}
          alsoSeenIn={
            symptoms
              ? lookupAlsoSeenIn(symptoms, selectedConcept.concept, diseaseName)
              : null
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────

function SelectedConceptCard({
  concept, organ, diseaseName, hpoTerm, alsoSeenIn, onClose,
}: {
  concept: ClinicalConcept
  organ: string
  diseaseName: string
  hpoTerm: HpoTerm | null
  alsoSeenIn: SymptomConcept | null
  onClose: () => void
}) {
  return (
    <div className="card mt-6 p-6 border-accent/40">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.18em] font-medium text-accent">
            Selected concept
          </span>
          <h3 className="font-display text-primary-800 text-lg leading-tight">
            {concept.concept}
          </h3>
          <span className="text-[11px] uppercase tracking-[0.14em] text-primary-400 font-mono">
            {organ.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[12px] text-primary-500 hover:text-accent transition-colors"
        >
          ✕ Close
        </button>
      </div>
      {concept.parent_concept && (
        <p className="text-xs text-primary-400 italic mb-4">
          ↳ {concept.parent_concept}
        </p>
      )}

      {/* HPO definition */}
      {hpoTerm && (
        <section className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-1.5 flex items-baseline gap-2">
            <span>HPO definition</span>
            <a
              href={`https://hpo.jax.org/browse/term/${hpoTerm.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-primary-500 hover:text-accent underline decoration-primary-200 underline-offset-2"
            >
              {hpoTerm.id} ↗
            </a>
          </p>
          <p className="text-sm text-primary-700 leading-relaxed">
            {hpoTerm.definition || (
              <span className="italic text-primary-400">No HPO definition recorded.</span>
            )}
          </p>
          {hpoTerm.synonyms.length > 0 && (
            <p className="text-xs text-primary-500 italic mt-2">
              Also known as: {hpoTerm.synonyms.slice(0, 5).join('; ')}
            </p>
          )}
        </section>
      )}

      {/* OMIM provenance */}
      {concept.sources.length > 0 && (
        <section className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-2">
            OMIM phrases for {diseaseName} ({concept.evidence_count})
          </p>
          <ul className="space-y-1.5 text-xs text-primary-700 leading-relaxed">
            {concept.sources.slice(0, 10).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary-300 select-none">·</span>
                <span className="flex-1">
                  &ldquo;{s.raw_phrase}&rdquo;
                  {s.mapping_method && (
                    <span className="ml-2 font-mono text-[11px] text-primary-400">
                      [{s.mapping_method}]
                    </span>
                  )}
                </span>
              </li>
            ))}
            {concept.sources.length > 10 && (
              <li className="text-primary-400 italic ml-3">
                +{concept.sources.length - 10} more phrases
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Also seen in */}
      {alsoSeenIn && alsoSeenIn.diseases.length > 1 && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-2">
            Also observed in {alsoSeenIn.diseases.length - 1} other disease
            {alsoSeenIn.diseases.length - 1 === 1 ? '' : 's'}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {alsoSeenIn.diseases
              .filter((d) => d.name !== diseaseName)
              .slice(0, 12)
              .map((d) => (
                <li key={d.slug || d.name}>
                  <Link
                    href={`/disease/${encodeURIComponent(d.name)}`}
                    className="inline-flex items-center gap-1.5 bg-surface text-primary-700 hover:text-accent border border-primary-100 hover:border-primary-300 px-2 py-0.5 rounded-sm text-xs transition-colors"
                    title={`${d.evidence_count} record${d.evidence_count === 1 ? '' : 's'}`}
                  >
                    <span>{d.name}</span>
                    <span className="font-mono text-[11px] text-primary-400">
                      {d.evidence_count}
                    </span>
                  </Link>
                </li>
              ))}
            {alsoSeenIn.diseases.length - 1 > 12 && (
              <li className="text-xs text-primary-400 italic px-2 py-0.5">
                +{alsoSeenIn.diseases.length - 1 - 12} more
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────

function lookupAlsoSeenIn(
  symptoms: SymptomsFile,
  concept: string,
  diseaseName: string,
): SymptomConcept | null {
  const direct = symptoms.concepts[concept]
  if (direct) return direct
  // case-insensitive scan as a fallback
  const target = concept.toLowerCase()
  for (const k of Object.keys(symptoms.concepts)) {
    if (k.toLowerCase() === target) return symptoms.concepts[k]
  }
  return null
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * Tooltip CSS — scoped to the .cm-chip-wrap container. Only fires on
 * devices with real hover (no touchscreens).
 *
 * Position: above the chip, no JS positioning logic — relies on the
 * default `position: absolute` with a fallback to flow below if the chip
 * is near the top of the viewport (CSS-only fallback via aria-expanded).
 */
const tooltipCss = `
.cm-chip-wrap { position: relative; display: inline-block; }
.cm-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 10;
  width: max-content;
  max-width: 320px;
  background: rgb(var(--paper-white));
  border: 1px solid rgb(var(--ink-line-2));
  border-radius: 4px;
  padding: 8px 10px;
  font-family: Outfit, sans-serif;
  font-size: 12px;
  line-height: 1.45;
  color: rgb(var(--ink-soft));
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.cm-tip-name { color: rgb(var(--ink)); font-weight: 500; margin: 0 0 2px; }
.cm-tip-id   { color: rgb(var(--ink-muted)); font-size: 10px; margin: 0 0 6px; }
.cm-tip-def  { color: rgb(var(--ink-soft)); font-size: 12px; margin: 0; }

@media (hover: hover) {
  .cm-chip-wrap:hover .cm-tip {
    opacity: 1;
    transform: translateY(0);
  }
}
`
