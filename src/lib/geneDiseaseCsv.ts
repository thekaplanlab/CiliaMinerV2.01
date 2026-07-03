/**
 * geneDiseaseCsv.ts
 *
 * Small helpers that turn MasterGene / MasterDisease records into CSV
 * downloads. The columns are fixed (research-friendly, stable order) and
 * the resulting file can be opened in Excel / Numbers / pandas without
 * fiddling.
 *
 * Two entry points:
 *   downloadGeneCsv(gene)     → one-row CSV with every field of a gene
 *   downloadDiseaseGenesCsv(disease, getGene)
 *                             → multi-row CSV of every gene linked to a
 *                               disease, with per-gene detail
 */

import { escapeCsvValue } from '@/lib/utils'
import type { MasterGene, MasterDisease } from '@/lib/masterData'

/** A list, in order, of every column the gene CSV exports. */
const GENE_COLUMNS: ReadonlyArray<[string, (g: MasterGene) => unknown]> = [
  ['gene',                       (g) => g.gene],
  ['synonyms',                   (g) => g.synonyms.join('; ')],
  ['description',                (g) => g.description ?? ''],
  ['ensembl_id',                 (g) => g.ensemblId ?? ''],
  ['omim_id',                    (g) => g.omimId ?? ''],
  ['uniprot_id',                 (g) => g.uniprotId ?? ''],
  ['ciliopathies',               (g) => g.ciliopathies.join('; ')],
  ['disease_classifications',    (g) =>
    Object.entries(g.diseaseClassifications)
      .map(([d, c]) => `${d}=${c}`)
      .join('; ')],
  ['ciliopathy_classes',         (g) => g.ciliopathyClasses.join('; ')],
  ['pan_idio_class',             (g) => g.panIdioClass ?? ''],
  ['pan_idio_tissues',           (g) => g.panIdioTissues ?? ''],
  ['localization',               (g) => g.localization.join('; ')],
  ['localization_refs',          (g) => g.localizationRefs.join('; ')],
  ['functional_category',        (g) => g.functionalCategory.join('; ')],
  ['protein_complex',            (g) => g.proteinComplex ?? ''],
  ['functional_summary',         (g) => g.functionalSummary ?? ''],
  ['ciliopathy_refs',            (g) => g.ciliopathyRefs.join('; ')],
  ['human_ciliopathy_phenotype', (g) => g.humanCiliopathyPhenotype ?? ''],
  ['mouse_ciliopathy_phenotype', (g) => g.mouseCiliopathyPhenotype ?? ''],
  ['evidence_type',              (g) => g.evidenceType ?? ''],
  ['evidence_flag',              (g) => g.evidenceFlag ?? ''],
  ['curation_notes',             (g) => g.curationNotes ?? g.note ?? ''],
]

function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>, header: ReadonlyArray<string>): string {
  const out: string[] = []
  out.push(header.map(escapeCsvValue).join(','))
  for (const row of rows) {
    out.push(row.map(escapeCsvValue).join(','))
  }
  // Add a trailing newline so most parsers handle the file cleanly.
  return out.join('\n') + '\n'
}

function triggerDownload(content: string, filename: string): void {
  // BOM so Excel opens the file as UTF-8 (otherwise it mangles non-ASCII).
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Filename-safe slug (kebab case, ASCII only). */
function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 64) || 'untitled'
}

const TODAY = () => new Date().toISOString().slice(0, 10)

// --- Public entry points -------------------------------------------------

/**
 * Single-row CSV with every field of a gene. Header row uses snake_case
 * field names so the file is friendly to pandas / R.
 */
export function downloadGeneCsv(gene: MasterGene): void {
  const header = GENE_COLUMNS.map(([h]) => h)
  const row = GENE_COLUMNS.map(([, get]) => get(gene))
  const csv = buildCsv([row], header)
  triggerDownload(csv, `ciliaminer_${slug(gene.gene)}_${TODAY()}.csv`)
}

/**
 * Multi-row CSV — one row per gene associated with the disease — with the
 * full per-gene detail. The first column is the disease name, then the same
 * column set as the gene CSV.
 *
 * `getGeneSync` is supplied by the caller. We expect the master file to
 * already be loaded by the time the download button is clicked (it was
 * needed to render the page) — so the lookup is just a Map.get.
 */
export function downloadDiseaseGenesCsv(
  disease: MasterDisease,
  getGeneSync: (symbol: string) => MasterGene | null
): void {
  const header = ['disease', ...GENE_COLUMNS.map(([h]) => h)]
  const rows: unknown[][] = []

  for (const entry of disease.genes) {
    const g = getGeneSync(entry.symbol)
    if (!g) continue
    rows.push([disease.name, ...GENE_COLUMNS.map(([, get]) => get(g))])
  }

  const csv = buildCsv(rows, header)
  triggerDownload(
    csv,
    `ciliaminer_${slug(disease.name)}_genes_${TODAY()}.csv`
  )
}
