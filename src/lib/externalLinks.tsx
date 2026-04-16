'use client'

import React from 'react'

/**
 * Centralized external-link helpers.
 *
 * Every helper validates the identifier before returning a URL. When an ID
 * fails validation the helper returns `null` and the caller should render
 * plain text (or a dash) instead of a broken link.
 *
 * This replaces the ad-hoc `createEnsemblLink`, `createOMIMLink`, and
 * `createPubMedLinks` helpers that were duplicated across pages and sometimes
 * emitted URLs that resolved to the wrong record.
 */

const ENSEMBL_ID = /^ENSG\d{11}(\.\d+)?$/
const OMIM_ID = /^\d{5,6}$/
const PUBMED_ID = /^\d{1,9}$/
const GO_ID = /^GO:\d{7}$/
const REACTOME_ID = /^R-[A-Z]{3}-\d+(-\d+)?$/
const KEGG_ID = /^[A-Za-z]{3,}\d+$/

export function ensemblHref(geneId: string | null | undefined): string | null {
  if (!geneId) return null
  const trimmed = geneId.trim()
  if (!ENSEMBL_ID.test(trimmed)) return null
  return `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(trimmed)}`
}

export function omimHref(id: string | null | undefined): string | null {
  if (!id) return null
  const digits = id.replace(/[^\d]/g, '')
  if (!OMIM_ID.test(digits)) return null
  return `https://omim.org/entry/${digits}`
}

export function pubmedHref(id: string | null | undefined): string | null {
  if (!id) return null
  const digits = id.replace(/[^\d]/g, '')
  if (!PUBMED_ID.test(digits)) return null
  return `https://pubmed.ncbi.nlm.nih.gov/${digits}`
}

export function goHref(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = id.trim()
  if (!GO_ID.test(trimmed)) return null
  return `https://www.ebi.ac.uk/QuickGO/term/${encodeURIComponent(trimmed)}`
}

export function reactomeHref(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = id.trim()
  if (!REACTOME_ID.test(trimmed)) return null
  return `https://reactome.org/content/detail/${encodeURIComponent(trimmed)}`
}

export function keggHref(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = id.trim()
  if (!KEGG_ID.test(trimmed)) return null
  return `https://www.kegg.jp/entry/${encodeURIComponent(trimmed)}`
}

// ── Display components ───────────────────────────────────────────────────────

export const EMPTY_CELL = <span className="text-primary-200" aria-label="no value">—</span>

interface ExternalLinkProps {
  href: string | null
  children: React.ReactNode
  className?: string
  title?: string
}

/**
 * Consistent external-link style. Renders plain text when href is null
 * (i.e., the ID was invalid), so users don't click broken links.
 */
export function ExternalLink({ href, children, className = '', title }: ExternalLinkProps) {
  if (!href) {
    return <span className={`text-primary-500 ${className}`}>{children}</span>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`text-accent hover:text-accent-dark underline decoration-accent/30 decoration-dotted underline-offset-2 hover:decoration-accent ${className}`}
    >
      {children}
    </a>
  )
}

// Convenience wrappers that auto-validate and render consistently.

export function EnsemblLink({ id }: { id: string | null | undefined }) {
  const href = ensemblHref(id)
  if (!id || id === '-') return EMPTY_CELL
  return <ExternalLink href={href} className="font-mono text-xs">{id}</ExternalLink>
}

export function OmimLink({ id }: { id: string | null | undefined }) {
  const href = omimHref(id)
  if (!id || id === '-') return EMPTY_CELL
  return <ExternalLink href={href} className="font-mono text-xs">{id}</ExternalLink>
}

export function PubmedLinks({ ids }: { ids: string | null | undefined }) {
  if (!ids || ids === '-') return EMPTY_CELL
  const list = ids.split(/[,;]/).map(r => r.trim()).filter(Boolean)
  if (list.length === 0) return EMPTY_CELL
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 justify-center">
      {list.map((ref, idx) => (
        <ExternalLink key={idx} href={pubmedHref(ref)} className="font-mono text-[11px]">
          {ref}
        </ExternalLink>
      ))}
    </div>
  )
}

export function IdList({
  ids,
  hrefFn,
  limit = 3,
}: {
  ids: string[] | null | undefined
  hrefFn: (id: string) => string | null
  limit?: number
}) {
  if (!ids || ids.length === 0) return EMPTY_CELL
  const shown = ids.slice(0, limit)
  const remaining = ids.length - shown.length
  return (
    <div className="flex flex-col gap-0.5 items-center">
      {shown.map(id => (
        <ExternalLink key={id} href={hrefFn(id)} className="font-mono text-[11px]">
          {id}
        </ExternalLink>
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-primary-300 font-mono">+{remaining} more</span>
      )}
    </div>
  )
}
