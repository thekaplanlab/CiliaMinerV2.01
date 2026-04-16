'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { dataService } from '@/services/dataService'
import {
  Database,
  FileText,
  Globe,
  Award,
  Code,
  ExternalLink,
  Mail,
  Copy,
  Check,
} from 'lucide-react'

export default function AboutPage() {
  return (
    <ErrorBoundary scope="about">
      <AboutPageInner />
    </ErrorBoundary>
  )
}

function AboutPageInner() {
  const [stats, setStats] = useState({
    genes: 0,
    ciliopathies: 0,
    organisms: 0,
    publications: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [genes, publications, orthologs] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getPublicationData(),
        dataService.getAllOrthologData(),
      ])

      const uniqueCiliopathies = new Set(
        genes.map(g => g.Ciliopathy?.trim()).filter(c => c && c !== 'Unknown')
      ).size
      const totalPubs = publications.reduce((sum, p) => sum + p.publication_number, 0)
      const uniqueOrganisms = new Set(orthologs.map(o => o.Organism).filter(Boolean)).size

      setStats({
        genes: genes.length,
        ciliopathies: uniqueCiliopathies,
        organisms: uniqueOrganisms,
        publications: totalPubs,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const databaseStats = [
    { label: 'Genes', icon: Database, value: stats.genes },
    { label: 'Ciliopathies', icon: FileText, value: stats.ciliopathies },
    { label: 'Model Organisms', icon: Globe, value: stats.organisms },
    { label: 'Publications', icon: Award, value: stats.publications },
  ]

  const features = [
    { icon: Database, title: 'Comprehensive Gene Database', desc: 'Curated information on ciliopathy genes with detailed annotations including subcellular localization, disease associations, and references.' },
    { icon: Globe, title: 'Cross-Species Orthologs', desc: 'Ortholog data across multiple model organisms including mouse, zebrafish, fruit fly, and others for comparative genomics research.' },
    { icon: FileText, title: 'Clinical Features Database', desc: 'Detailed clinical feature classifications and symptom-disease relationships for clinical research and diagnosis.' },
    { icon: Code, title: 'Advanced Search & Analytics', desc: 'Powerful search capabilities with filters, data export options, and interactive visualizations for data exploration.' },
  ]

  return (
    <Layout>
      <Breadcrumbs trail={[{ label: 'About' }]} />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="py-8 text-center">
          <h1 className="font-display text-display text-primary-800 mb-4">About CiliaMiner</h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
            A comprehensive database and research platform for ciliopathy genetics,
            clinical features, and cross-species orthologs.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {databaseStats.map((stat, index) => (
            <div key={index} className="card text-center py-5">
              <stat.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="text-xl font-semibold text-gray-900">
                {isLoading ? '...' : stat.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-title text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed">
            CiliaMiner aims to accelerate ciliopathy research by providing researchers,
            clinicians, and students with comprehensive, curated data on ciliopathy genes,
            clinical features, and cross-species orthologs. Our platform integrates data
            from multiple sources to create a unified resource for understanding these
            complex genetic disorders.
          </p>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-title text-gray-900 mb-6">Database Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, index) => (
              <div key={index} className="card">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary-50 shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{f.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Citation */}
        <section className="mb-16">
          <h2 className="font-display text-title text-primary-800 mb-4">Citation</h2>
          <CitationBlock />
        </section>

        {/* Contact */}
        <section className="mb-16 text-center">
          <h2 className="text-title text-gray-900 mb-3">Get in Touch</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-lg mx-auto">
            Have questions, suggestions, or want to contribute to CiliaMiner?
          </p>
          <a
            href="mailto:info@ciliaminer.org"
            className="btn-primary inline-flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Contact Us
          </a>
        </section>
      </div>
    </Layout>
  )
}

// ─── Citation block with format-switcher + copy-to-clipboard ────────────

type CitationFormat = 'apa' | 'bibtex' | 'ris'

const CITATION_TEXTS: Record<CitationFormat, string> = {
  apa: 'Turan, M. G., Orhan, E., Cevik, S., & Kaplan, O. I. (2023). CiliaMiner: an integrated database for ciliopathy genes and ciliopathies. Database, 2023, baad047. https://doi.org/10.1093/database/baad047',
  bibtex: `@article{turan2023ciliaminer,
  title   = {CiliaMiner: an integrated database for ciliopathy genes and ciliopathies},
  author  = {Turan, Mehmet Gokhan and Orhan, Efe and Cevik, Sebiha and Kaplan, Oktay I.},
  journal = {Database},
  volume  = {2023},
  pages   = {baad047},
  year    = {2023},
  doi     = {10.1093/database/baad047},
  url     = {https://doi.org/10.1093/database/baad047}
}`,
  ris: `TY  - JOUR
AU  - Turan, M. G.
AU  - Orhan, E.
AU  - Cevik, S.
AU  - Kaplan, O. I.
TI  - CiliaMiner: an integrated database for ciliopathy genes and ciliopathies
JO  - Database
VL  - 2023
SP  - baad047
PY  - 2023
DO  - 10.1093/database/baad047
UR  - https://doi.org/10.1093/database/baad047
ER  - `,
}

const FORMAT_META: { id: CitationFormat; label: string; hint: string }[] = [
  { id: 'apa', label: 'APA', hint: 'Plain text, APA-style' },
  { id: 'bibtex', label: 'BibTeX', hint: 'LaTeX / Overleaf' },
  { id: 'ris', label: 'RIS', hint: 'EndNote / Zotero / Mendeley' },
]

function CitationBlock() {
  const [format, setFormat] = useState<CitationFormat>('apa')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CITATION_TEXTS[format])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — do nothing rather than surface a scary error.
    }
  }

  // Reset "Copied" state when switching formats.
  useEffect(() => { setCopied(false) }, [format])

  const active = FORMAT_META.find(f => f.id === format)!

  return (
    <div className="card p-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-stretch border-b border-primary-100">
        {FORMAT_META.map(f => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              format === f.id
                ? 'border-accent text-accent'
                : 'border-transparent text-primary-500 hover:text-primary-700'
            }`}
            aria-pressed={format === f.id}
          >
            {f.label}
          </button>
        ))}
        <p className="ml-auto flex items-center pr-4 text-[11px] font-mono text-primary-400">
          {active.hint}
        </p>
      </div>

      {/* Body */}
      <div className="relative">
        {format === 'apa' ? (
          <p className="p-5 pr-28 text-sm text-primary-700 leading-relaxed">
            Turan, M. G., Orhan, E., Cevik, S., &amp; Kaplan, O. I. (2023).
            CiliaMiner: an integrated database for ciliopathy genes and
            ciliopathies. <em className="font-display italic">Database</em>, 2023, baad047.
          </p>
        ) : (
          <pre className="p-5 pr-28 text-[12px] leading-relaxed font-mono text-primary-700 overflow-x-auto whitespace-pre">
            {CITATION_TEXTS[format]}
          </pre>
        )}

        <button
          onClick={handleCopy}
          className={`absolute top-4 right-4 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.12em] px-2.5 py-1.5 rounded-sm border transition-colors ${
            copied
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-primary-200 text-primary-600 hover:border-primary-400 hover:text-primary-800'
          }`}
          aria-label={`Copy citation in ${active.label} format`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* DOI footer */}
      <div className="px-5 py-3 bg-surface-muted border-t border-primary-100 flex items-center justify-between gap-3">
        <span className="eyebrow">DOI</span>
        <a
          href="https://doi.org/10.1093/database/baad047"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-accent hover:text-accent-dark transition-colors"
        >
          10.1093/database/baad047
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
