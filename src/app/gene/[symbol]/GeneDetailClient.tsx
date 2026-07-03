'use client'

/**
 * Gene detail — the full "gene card".
 *
 * Surfaces every field from the v15 master, plus optional enrichment from
 * the ciliahub layer when the gene exists there (561 of 607 v15 genes do):
 *
 *   v15 sections:
 *     • Header (symbol, description, synonyms, OMIM/Ensembl/UniProt/NCBI/GeneCards)
 *     • Associated ciliopathies (linked)
 *     • Subcellular localization + localization references
 *     • Function (functional category, protein complex, pan/idio, summary)
 *     • Ciliary phenotypes (human / mouse)
 *     • Evidence & curation
 *     • References (PubMed)
 *
 *   Ciliahub augmentation (only when getEnrichment(symbol) returns non-null):
 *     • Genomic context: ClinVar variant count + top variants, AlphaFold link
 *     • Gene Ontology: BP / MF / CC term chips
 *     • Pfam domains
 *     • Orthologs across mouse, c. elegans, xenopus, zebrafish, drosophila
 *     • Experimental effects (LoF, overexpression, ciliated-cell %)
 *     • Related publications (PubMed)
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getGene, type MasterGene } from '@/lib/masterData'
import { getEnrichment, type CiliahubEnrichment } from '@/lib/ciliahubData'
import { downloadGeneCsv } from '@/lib/geneDiseaseCsv'
import { GeneHpoPhenotype } from '@/components/GeneHpoPhenotype'
import { ExternalLink, Download } from 'lucide-react'

export default function GeneDetailClient({ symbol }: { symbol: string }) {
  return (
    <ErrorBoundary scope="gene-detail">
      <GenePageInner symbol={decodeURIComponent(symbol)} />
    </ErrorBoundary>
  )
}

function GenePageInner({ symbol }: { symbol: string }) {
  const [gene, setGene] = useState<MasterGene | null | undefined>(undefined)
  const [enrich, setEnrich] = useState<CiliahubEnrichment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getGene(symbol), getEnrichment(symbol).catch(() => null)])
      .then(([g, e]) => {
        if (cancelled) return
        setGene(g)
        setEnrich(e)
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(err?.message ?? 'Failed to load gene')
      })
    return () => { cancelled = true }
  }, [symbol])

  const trail = [
    { label: 'Search', href: '/advanced-search' },
    { label: symbol.toUpperCase() },
  ]

  return (
    <Layout>
      <Breadcrumbs trail={trail} />

      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="card text-center py-10">
            <p className="text-sm text-accent-dark">{error}</p>
          </div>
        )}

        {!error && gene === undefined && (
          <div className="py-16 text-center text-sm text-primary-400 font-mono">Loading…</div>
        )}

        {!error && gene === null && (
          <div className="card text-center py-12">
            <p className="font-display text-2xl text-primary-700 mb-2">No record for {symbol}.</p>
            <p className="text-sm text-primary-500 mb-4">
              This gene is not in the curated v15 catalogue (607 genes).
            </p>
            <Link
              href="/advanced-search"
              className="text-sm text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              ← Back to search
            </Link>
          </div>
        )}

        {gene && <GeneCard gene={gene} enrich={enrich} />}
      </div>
    </Layout>
  )
}

function GeneCard({ gene, enrich }: { gene: MasterGene; enrich: CiliahubEnrichment | null }) {
  const cleanSynonyms = gene.synonyms.filter(
    (s) => s && s.toUpperCase() !== gene.gene.toUpperCase() && !s.startsWith('ENSG'),
  )

  const allRefs = Array.from(new Set([...gene.ciliopathyRefs, ...gene.localizationRefs]))
  allRefs.sort((a, b) => Number(b) - Number(a))

  // Evidence section shows PMID citations as links. Prefer any PubMed IDs
  // embedded in the free-text evidence flag (e.g. "…(Zhou 2025, PMID 41071877)");
  // otherwise fall back to the gene's disease reference PMIDs, which are the
  // citations backing the ciliopathy association — so a PMID link is shown for
  // every gene that has references.
  const evidenceFlagPmids = extractPmids(gene.evidenceFlag)
  const evidencePmids = evidenceFlagPmids.length > 0 ? evidenceFlagPmids : gene.ciliopathyRefs

  return (
    <article className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="card p-6 sm:p-8">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-accent">
            Gene · curated entry · v15
            {enrich && <span className="text-primary-400 ml-2">+ ciliahub enrichment</span>}
          </p>
          <button
            type="button"
            onClick={() => downloadGeneCsv(gene)}
            className="inline-flex items-center gap-1.5 border border-primary-200 hover:border-primary-400 hover:bg-surface-muted text-primary-700 hover:text-accent px-2.5 py-1 rounded-sm text-[12px] font-mono tracking-tight transition-colors"
          >
            <Download className="h-3 w-3" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
          <h1 className="font-mono font-semibold text-primary-800 text-4xl tracking-tight">
            {gene.gene}
          </h1>
          {gene.ciliopathyClasses.length > 0 && (
            <span className="text-[12px] uppercase tracking-[0.14em] text-primary-400 font-mono">
              {gene.ciliopathyClasses.join(' · ')}
            </span>
          )}
        </div>

        {gene.description && (
          <p className="text-base text-primary-700 leading-relaxed max-w-2xl mb-5">
            {stripBracketSource(gene.description)}
          </p>
        )}

        {cleanSynonyms.length > 0 && (
          <div className="mb-5">
            <Eyebrow inline>Synonyms</Eyebrow>
            <ul className="inline-flex flex-wrap gap-1.5 ml-3 align-middle">
              {cleanSynonyms.map((s) => (
                <li key={s} className="bg-surface-muted text-primary-700 px-2 py-0.5 rounded-sm text-xs font-mono">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs pt-4 border-t border-primary-100">
          {gene.omimId && <ExternalIdLink label="OMIM" value={gene.omimId} href={`https://omim.org/entry/${gene.omimId}`} />}
          {gene.ensemblId && <ExternalIdLink label="Ensembl" value={gene.ensemblId} href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`} />}
          {gene.uniprotId && <ExternalIdLink label="UniProt" value={gene.uniprotId} href={`https://www.uniprot.org/uniprotkb/${gene.uniprotId}`} />}
          <ExternalIdLink label="NCBI Gene" value={gene.gene} href={`https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(gene.gene)}%5BGene+Name%5D+AND+human%5BORGN%5D`} />
          <ExternalIdLink label="GeneCards" value={gene.gene} href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encodeURIComponent(gene.gene)}`} />
          {enrich?.alphafold_url && <ExternalIdLink label="AlphaFold" value="structure" href={enrich.alphafold_url} />}
        </div>
      </header>

      {/* ── Associated diseases ─────────────────────────────────── */}
      {gene.ciliopathies.length > 0 && (
        <Section eyebrow="Associated ciliopathies" note={`${gene.ciliopathies.length} disease${gene.ciliopathies.length === 1 ? '' : 's'}`}>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gene.ciliopathies.map((dname) => {
              const cls = gene.diseaseClassifications[dname]
              return (
                <li key={dname}>
                  <Link
                    href={`/disease/${encodeURIComponent(dname)}`}
                    className="block bg-surface border border-primary-100 hover:border-primary-300 hover:bg-surface-muted rounded-sm p-4 transition-colors group"
                  >
                    <p className="text-primary-800 group-hover:text-accent transition-colors leading-tight text-sm font-medium mb-1.5">
                      {dname}
                    </p>
                    {cls && (
                      <p className="text-[11px] uppercase tracking-[0.14em] text-primary-400 font-mono">{cls}</p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* ── Clinical phenotype (HPO aggregation across associated diseases) ─── */}
      <GeneHpoPhenotype symbol={gene.gene} associatedDiseases={gene.ciliopathies} />

      {/* ── Localization ───────────────────────────────────────── */}
      {(gene.localization.length > 0 || gene.localizationRefs.length > 0) && (
        <Section eyebrow="Subcellular localization">
          {gene.localization.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 mb-4">
              {gene.localization.map((loc) => (
                <li key={loc} className="bg-surface-muted text-primary-700 px-2.5 py-1 rounded-sm text-xs">
                  {loc}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-primary-400 italic mb-4">Not annotated.</p>
          )}
          {gene.localizationRefs.length > 0 && (
            <div>
              <Eyebrow>Localization references</Eyebrow>
              <PmidChips pmids={gene.localizationRefs} />
            </div>
          )}
        </Section>
      )}

      {/* ── Function ────────────────────────────────────────────── */}
      {(gene.functionalCategory.length > 0 || gene.proteinComplex || gene.functionalSummary || gene.panIdioClass) && (
        <Section eyebrow="Function">
          <dl className="space-y-5">
            {gene.functionalCategory.length > 0 && (
              <Fact label="Functional category">
                <ul className="flex flex-wrap gap-1.5">
                  {gene.functionalCategory.map((fc) => (
                    <li key={fc} className="bg-surface-muted text-primary-700 px-2 py-0.5 rounded-sm text-xs">{fc}</li>
                  ))}
                </ul>
              </Fact>
            )}
            {gene.proteinComplex && (
              <Fact label="Protein complex">
                <span className="text-sm text-primary-700">{gene.proteinComplex}</span>
              </Fact>
            )}
            {gene.panIdioClass && (
              <Fact label="Pan / idio class">
                <span className="font-mono text-sm text-primary-700">{gene.panIdioClass}</span>
                {gene.panIdioTissues != null && (
                  <span className="text-primary-400 text-sm">
                    {' · '}{gene.panIdioTissues} tissue{gene.panIdioTissues === 1 ? '' : 's'}
                  </span>
                )}
              </Fact>
            )}
            {gene.functionalSummary && (
              <Fact label="Functional summary">
                <p className="text-sm text-primary-700 leading-relaxed whitespace-pre-line">
                  {linkifyPmids(gene.functionalSummary)}
                </p>
              </Fact>
            )}
          </dl>
        </Section>
      )}

      {/* ── Gene Ontology (ciliahub) ───────────────────────────── */}
      {enrich && (enrich.go_bp.length + enrich.go_mf.length + enrich.go_cc.length) > 0 && (
        <Section eyebrow="Gene Ontology" note="ciliahub">
          <dl className="space-y-4">
            {enrich.go_bp.length > 0 && <Fact label="Biological process">{renderGoChips(enrich.go_bp)}</Fact>}
            {enrich.go_mf.length > 0 && <Fact label="Molecular function">{renderGoChips(enrich.go_mf)}</Fact>}
            {enrich.go_cc.length > 0 && <Fact label="Cellular component">{renderGoChips(enrich.go_cc)}</Fact>}
          </dl>
        </Section>
      )}

      {/* ── Pfam domains (ciliahub) ────────────────────────────── */}
      {enrich && (enrich.pfam_ids.length > 0 || enrich.domain_descriptions.length > 0) && (
        <Section eyebrow="Protein domains" note="ciliahub">
          <dl className="space-y-4">
            {enrich.pfam_ids.length > 0 && (
              <Fact label="Pfam IDs">
                <ul className="flex flex-wrap gap-1.5">
                  {enrich.pfam_ids.map((p) => (
                    <li key={p}>
                      <a
                        href={`https://www.ebi.ac.uk/interpro/entry/pfam/${encodeURIComponent(p)}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-surface-muted border border-primary-100 hover:border-primary-300 text-primary-700 hover:text-accent px-2 py-0.5 rounded-sm text-[12px] font-mono transition-colors"
                      >
                        {p}
                      </a>
                    </li>
                  ))}
                </ul>
              </Fact>
            )}
            {enrich.domain_descriptions.length > 0 && (
              <Fact label="Domain descriptions">
                <ul className="flex flex-wrap gap-1.5">
                  {enrich.domain_descriptions.map((d) => (
                    <li key={d} className="bg-surface-muted text-primary-700 px-2 py-0.5 rounded-sm text-xs">{d}</li>
                  ))}
                </ul>
              </Fact>
            )}
          </dl>
        </Section>
      )}

      {/* ── Orthologs (ciliahub) ───────────────────────────────── */}
      {enrich && Object.values(enrich.orthologs).some(Boolean) && (
        <Section eyebrow="Orthologs" note="ciliahub">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {([
              ['Mouse', enrich.orthologs.mouse, 'Mus musculus'],
              ['Zebrafish', enrich.orthologs.zebrafish, 'Danio rerio'],
              ['Xenopus', enrich.orthologs.xenopus, 'Xenopus laevis'],
              ['Drosophila', enrich.orthologs.drosophila, 'Drosophila melanogaster'],
              ['C. elegans', enrich.orthologs.c_elegans, 'Caenorhabditis elegans'],
            ] as const).map(
              ([label, value, latin]) =>
                value ? (
                  <div key={label}>
                    <dt className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-1">
                      {label} <span className="normal-case italic text-primary-300">{latin}</span>
                    </dt>
                    <dd className="font-mono text-sm text-primary-700">{value}</dd>
                  </div>
                ) : null,
            )}
          </dl>
        </Section>
      )}

      {/* ── Genomic variants (ciliahub) ────────────────────────── */}
      {enrich && enrich.clinvar_count > 0 && (
        <Section eyebrow="Genomic variants" note={`${enrich.clinvar_count.toLocaleString()} on ClinVar`}>
          <p className="text-xs text-primary-500 mb-4 max-w-2xl">
            The first {Math.min(enrich.clinvar_top.length, enrich.clinvar_count)} ClinVar variants listed for this gene
            — click any title to open ClinVar.
          </p>
          {enrich.clinvar_top.length > 0 ? (
            <ul className="divide-y divide-primary-100 border-y border-primary-100">
              {enrich.clinvar_top.map((v) => (
                <li key={v.id}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-3 py-2.5 px-2 -mx-2 hover:bg-surface-muted rounded-sm transition-colors"
                  >
                    <span className="font-mono text-sm text-primary-700 group-hover:text-accent transition-colors flex-1 min-w-0 truncate">
                      {v.title}
                    </span>
                    {v.significance && (
                      <span className="text-[11px] uppercase tracking-[0.14em] text-primary-400 font-mono whitespace-nowrap">
                        {v.significance}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-primary-400 italic">Variant list not loaded.</p>
          )}
          <p className="text-xs text-primary-400 mt-3">
            <a
              href={`https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(gene.gene)}%5Bgene%5D`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-primary-200 underline-offset-2 hover:decoration-accent hover:text-accent"
            >
              View all {enrich.clinvar_count.toLocaleString()} variants on ClinVar →
            </a>
          </p>
        </Section>
      )}

      {/* ── Experimental effects (ciliahub) ────────────────────── */}
      {enrich && (enrich.lof_effects || enrich.overexpression_effects || enrich.percent_ciliated_cells_effects) && (
        <Section eyebrow="Experimental effects" note="ciliahub">
          <dl className="space-y-4 text-sm">
            {enrich.lof_effects && enrich.lof_effects !== 'Not Reported' && (
              <Fact label="Loss of function (cilia length)">
                <span className="text-primary-700">{enrich.lof_effects}</span>
              </Fact>
            )}
            {enrich.overexpression_effects && enrich.overexpression_effects !== 'Not Reported' && (
              <Fact label="Overexpression (cilia length)">
                <span className="text-primary-700">{enrich.overexpression_effects}</span>
              </Fact>
            )}
            {enrich.percent_ciliated_cells_effects && enrich.percent_ciliated_cells_effects !== 'Not Reported' && (
              <Fact label="Effect on % ciliated cells">
                <span className="text-primary-700">{enrich.percent_ciliated_cells_effects}</span>
              </Fact>
            )}
          </dl>
        </Section>
      )}

      {/* ── Phenotypes ─────────────────────────────────────────── */}
      {(gene.humanCiliopathyPhenotype || gene.mouseCiliopathyPhenotype) && (
        <Section eyebrow="Ciliary phenotypes">
          <dl className="space-y-5">
            {gene.humanCiliopathyPhenotype && (
              <Fact label="Human">
                <p className="text-sm text-primary-700 leading-relaxed">{gene.humanCiliopathyPhenotype}</p>
              </Fact>
            )}
            {gene.mouseCiliopathyPhenotype && (
              <Fact label="Mouse">
                <p className="text-sm text-primary-700 leading-relaxed italic">{gene.mouseCiliopathyPhenotype}</p>
              </Fact>
            )}
          </dl>
        </Section>
      )}

      {/* ── Evidence & curation ────────────────────────────────── */}
      {(gene.evidenceType || evidencePmids.length > 0 || gene.curationNotes || gene.note) && (
        <Section eyebrow="Evidence & curation">
          <dl className="space-y-4">
            {gene.evidenceType && (
              <Fact label="Evidence type">
                <span className="font-mono text-xs text-primary-700">{gene.evidenceType}</span>
              </Fact>
            )}
            {evidencePmids.length > 0 && (
              <Fact label="Evidence (PubMed)">
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {evidencePmids.map((pmid) => (
                    <li key={pmid}>
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent hover:text-accent-dark underline decoration-accent/40 hover:decoration-accent underline-offset-2 transition-colors"
                      >
                        PMID&nbsp;{pmid}
                      </a>
                    </li>
                  ))}
                </ul>
              </Fact>
            )}
            {(gene.curationNotes || gene.note) && (
              <Fact label="Curation note">
                <p className="text-sm text-primary-600 leading-relaxed italic">
                  {gene.curationNotes || gene.note}
                </p>
              </Fact>
            )}
          </dl>
        </Section>
      )}

      {/* ── References ─────────────────────────────────────────── */}
      {allRefs.length > 0 && (
        <Section eyebrow="References" note={`${allRefs.length} PMID${allRefs.length === 1 ? '' : 's'} on PubMed`}>
          {gene.ciliopathyRefs.length > 0 && (
            <div className="mb-4">
              <Eyebrow>Disease references</Eyebrow>
              <PmidChips pmids={gene.ciliopathyRefs} />
            </div>
          )}
          {gene.localizationRefs.length > 0 && (
            <div className="mb-4">
              <Eyebrow>Localization references</Eyebrow>
              <PmidChips pmids={gene.localizationRefs} />
            </div>
          )}
          {enrich && enrich.publications.length > 0 && (
            <div>
              <Eyebrow>Related publications (ciliahub)</Eyebrow>
              <ul className="space-y-2 mt-2">
                {enrich.publications.map((p) => (
                  <li key={p.pmid} className="text-xs text-primary-700 leading-relaxed">
                    {p.pmid && (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-accent hover:underline mr-2"
                      >
                        PMID&nbsp;{p.pmid}
                      </a>
                    )}
                    <span>{p.title}</span>
                    {p.year && <span className="text-primary-400"> · {p.year}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}
    </article>
  )
}

// ── Tiny presentational pieces ─────────────────────────────────────────

function Section({
  eyebrow, note, children,
}: { eyebrow: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="eyebrow">{eyebrow}</h2>
        {note && <span className="text-[12px] font-mono text-primary-400 tabular-nums">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 mb-1.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Eyebrow({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <p className={`text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400 ${inline ? 'inline-block' : 'mb-2'}`}>
      {children}
    </p>
  )
}

function ExternalIdLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-1.5 text-primary-500 hover:text-accent transition-colors group"
    >
      <span className="text-[11px] uppercase tracking-[0.14em] text-primary-400 group-hover:text-accent transition-colors">{label}</span>
      <span className="font-mono">{value}</span>
      <ExternalLink className="h-2.5 w-2.5 text-primary-300 group-hover:text-accent transition-colors" aria-hidden="true" />
    </a>
  )
}

function PmidChips({ pmids }: { pmids: string[] }) {
  const unique = Array.from(new Set(pmids))
  unique.sort((a, b) => Number(b) - Number(a))
  return (
    <ul className="flex flex-wrap gap-1.5">
      {unique.map((pmid) => (
        <li key={pmid}>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-surface-muted border border-primary-100 hover:border-primary-300 text-primary-700 hover:text-accent px-2 py-0.5 rounded-sm text-[12px] font-mono transition-colors"
          >
            PMID&nbsp;{pmid}
          </a>
        </li>
      ))}
    </ul>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract every PubMed ID embedded in a free-text string. Matches "PMID 123456",
 * "PMID: 123456", "PMID123456" (6–9 digit ids), returning a de-duplicated list
 * preserving first-seen order. Returns [] for empty/undefined input.
 */
function extractPmids(text?: string): string[] {
  if (!text) return []
  const out: string[] = []
  const seen = new Set<string>()
  const re = /PMID[:\s]*?(\d{6,9})/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const pmid = m[1]
    if (!seen.has(pmid)) { seen.add(pmid); out.push(pmid) }
  }
  return out
}

function stripBracketSource(desc: string): string {
  return desc.replace(/\s*\[Source:[^\]]+\]\s*$/, '').trim()
}

function linkifyPmids(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\(\s*(?:PMID[:\s]*)?(\d{6,9})\s*\)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
    const pmid = m[1]
    parts.push(
      <a
        key={`pmid-${key++}`}
        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent font-mono underline decoration-accent/30 underline-offset-2 hover:decoration-accent transition-colors"
      >
        (PMID&nbsp;{pmid})
      </a>,
    )
    lastIdx = re.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

/**
 * Render a list of GO terms as chips. Term format from ciliahub is typically
 * "GO:0007049 cell cycle" — if the GO ID is present, link the chip to the
 * QuickGO browser; otherwise just render as plain text.
 */
function renderGoChips(terms: string[]): React.ReactNode {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {terms.map((t, i) => {
        const m = t.match(/^(GO:\d{7})\s*(.*)$/)
        if (m) {
          const id = m[1]
          const label = m[2] || id
          return (
            <li key={`${id}-${i}`}>
              <a
                href={`https://www.ebi.ac.uk/QuickGO/term/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline gap-1.5 bg-surface-muted border border-primary-100 hover:border-primary-300 text-primary-700 hover:text-accent px-2 py-0.5 rounded-sm text-[12px] transition-colors"
              >
                <span className="font-mono text-[11px] text-primary-400">{id}</span>
                <span>{label}</span>
              </a>
            </li>
          )
        }
        return (
          <li key={`${t}-${i}`} className="bg-surface-muted text-primary-700 px-2 py-0.5 rounded-sm text-xs">
            {t}
          </li>
        )
      })}
    </ul>
  )
}
