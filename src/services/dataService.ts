/**
 * dataService.ts
 *
 * Single source-of-truth data layer for CiliaMiner.
 *
 * Architecture:
 *   public/data/ciliaminer.xlsx  ─(fetch)→  SheetJS  ─(parse)→  in-memory cache
 *
 * The workbook is the ONLY data file. When an expected sheet is absent, the
 * corresponding method returns an empty result and records the missing dataset
 * in the DataQualityReport so it is visible in the browser console.
 *
 * Required sheets in ciliaminer.xlsx:
 *   genes                      – main gene table (35 snake_case columns)
 *   symptome_primary           – disease × clinical feature matrix (primary)
 *   symptome_secondary         – disease × clinical feature matrix (secondary)
 *   gene_localisations_ciliacarta – gene × subcellular localisation matrix
 *
 * genes sheet columns:
 *   gene, ensembl_gene_id, overexpression_cilia_length_effect, lof_cilia_length_effect,
 *   ciliated_cells_pct_effect, gene_description, synonym, omim_id, functional_summary,
 *   localization, localization_reference, protein_complexes, subunits_protein_name,
 *   protein_complexes_references, gene_annotation, functional_category, pfam_ids,
 *   domain_descriptions, ciliopathy, ciliopathy_classification, disease_reference,
 *   annotation_ids, annotation_description, annotation_source,
 *   ortholog_mouse, ortholog_celegans, ortholog_xenopus, ortholog_zebrafish,
 *   ortholog_drosophila, mouse_ciliopathy_phenotype, mouse_phenotype,
 *   human_ciliopathy_phenotype, human_phenotype, pubmed_count, top25_recent_pmids
 *
 * Note: Chlamydomonas reinhardtii orthologs are not in the workbook yet — that
 *       organism returns an empty list until a sheet is added.
 */

import type {
  CiliopathyGene,
  OrthologGene,
  CiliopathyFeature,
  GeneNumber,
  BarPlotData,
  PublicationData,
  HeatmapData,
} from '@/types'

import {
  loadWorkbook,
  safeString,
  safeStringOptional,
  safeStringList,
  parseAnnotationIds,
  pickEnsemblId,
  type ParsedWorkbook,
  type DataQualityIssue,
  type DataQualityReport,
  type RawRow,
} from '@/lib/excelParser'

// ── Constants ────────────────────────────────────────────────────────────────

const EXCEL_FILENAME = 'ciliaminer.xlsx'
const MAIN_SHEET = 'genes'

/**
 * All sheets the app expects to find in the workbook.
 * Any sheet absent here will be recorded in the DataQualityReport as missing.
 */
const REQUIRED_SHEETS = [
  'genes',
  'symptome_primary',
  'symptome_secondary',
  'gene_localisations_ciliacarta',
] as const

/**
 * When a sheet is missing from the Excel workbook, fall back to these JSON
 * files (served from public/data/).  The JSON files contain the same row
 * structure that the sheet would have.
 */
const JSON_FALLBACK_MAP: Partial<Record<string, string>> = {
  symptome_primary: 'symptome_primary.json',
  symptome_secondary: 'symptome_secondary.json',
  gene_localisations_ciliacarta: 'gene_localisations_ciliacarta.json',
}

/**
 * Enriched clinical features derived from ClinGen GCEP mappings +
 * human phenotype data.  Same row format as symptome_primary/secondary.
 */
const CLINGEN_FEATURES_FILE = 'clingen_clinical_features.json'

type RequiredSheet = (typeof REQUIRED_SHEETS)[number]

/**
 * Maps organism IDs to the inline ortholog column in the genes sheet.
 * Chlamydomonas has no column yet — it returns empty until added.
 */
const ORTHOLOG_COLUMN_MAP: Record<string, string> = {
  mus_musculus: 'ortholog_mouse',
  caenorhabditis_elegans: 'ortholog_celegans',
  xenopus_laevis: 'ortholog_xenopus',
  danio_rerio: 'ortholog_zebrafish',
  drosophila_melanogaster: 'ortholog_drosophila',
}

/**
 * Maps organism IDs to the CiliopathyGene property name (PascalCase)
 * used after parsing. ORTHOLOG_COLUMN_MAP has the raw Excel column names;
 * this map has the JS object property names.
 */
const ORTHOLOG_GENE_PROP_MAP: Record<string, keyof CiliopathyGene> = {
  mus_musculus: 'Ortholog_Mouse',
  caenorhabditis_elegans: 'Ortholog_C_elegans',
  xenopus_laevis: 'Ortholog_Xenopus',
  danio_rerio: 'Ortholog_Zebrafish',
  drosophila_melanogaster: 'Ortholog_Drosophila',
}

const ORGANISM_DISPLAY_NAMES: Record<string, string> = {
  mus_musculus: 'Mus musculus',
  danio_rerio: 'Danio rerio',
  xenopus_laevis: 'Xenopus laevis',
  drosophila_melanogaster: 'Drosophila melanogaster',
  caenorhabditis_elegans: 'Caenorhabditis elegans',
  chlamydomonas_reinhardtii: 'Chlamydomonas reinhardtii',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

// ── DataService class ────────────────────────────────────────────────────────

class DataService {
  private workbook: ParsedWorkbook | null = null
  private workbookPromise: Promise<ParsedWorkbook> | null = null
  private dataCache = new Map<string, unknown>()
  /**
   * In-flight promise dedup. When multiple pages mount in parallel and each
   * requests the same dataset (e.g. getCiliopathyGenes), the second+ callers
   * receive the first caller's pending promise instead of kicking off their
   * own fetch+parse pass. Populated entries are cleared in a `finally`.
   */
  private inflight = new Map<string, Promise<unknown>>()

  private qualityIssues: DataQualityIssue[] = []
  private sheetsFound: string[] = []
  private sheetsMissing: string[] = []
  private loadedAt = ''
  private totalRowsProcessed = 0

  /**
   * Runs `factory` once per cache key while it is in flight.
   * Subsequent callers with the same key await the same promise.
   */
  private async dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    if (this.dataCache.has(key)) return this.dataCache.get(key) as T
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>
    const promise = factory()
      .then((result) => {
        this.dataCache.set(key, result)
        return result
      })
      .finally(() => {
        this.inflight.delete(key)
      })
    this.inflight.set(key, promise)
    return promise
  }

  // ── Workbook loader ────────────────────────────────────────────────────────

  private getWorkbook(): Promise<ParsedWorkbook> {
    if (this.workbook) return Promise.resolve(this.workbook)
    if (this.workbookPromise) return this.workbookPromise

    const url = `${getBasePath()}/data/${EXCEL_FILENAME}`
    this.workbookPromise = loadWorkbook(url).then(({ workbook, missingSheets }) => {
      this.workbook = workbook
      this.sheetsFound = workbook.sheetNames
      this.sheetsMissing = missingSheets
      this.loadedAt = new Date().toISOString()

      if (missingSheets.length > 0) {
        console.warn(
          `[CiliaMiner] The following sheets are missing from ${EXCEL_FILENAME}:\n` +
            missingSheets.map(s => `  • ${s}`).join('\n') +
            '\nData for those sections will be shown as empty until the sheets are added.'
        )
      }
      return workbook
    })
    return this.workbookPromise
  }

  /**
   * Returns the rows of a sheet, or falls back to a JSON file when absent.
   * Records a quality issue the first time a missing sheet is accessed so the
   * report stays accurate even for sheets checked lazily.
   */
  private async getSheetRows(sheetName: RequiredSheet): Promise<RawRow[]> {
    const wb = await this.getWorkbook()
    if (wb.hasSheet(sheetName)) return wb.getSheet(sheetName)

    // Try loading from a fallback JSON file
    const jsonFile = JSON_FALLBACK_MAP[sheetName]
    if (jsonFile) {
      const cacheKey = `__json_fallback_${sheetName}`
      if (this.dataCache.has(cacheKey)) return this.dataCache.get(cacheKey) as RawRow[]

      try {
        const url = `${getBasePath()}/data/${jsonFile}`
        const res = await fetch(url)
        if (res.ok) {
          const rows: RawRow[] = await res.json()
          this.dataCache.set(cacheKey, rows)
          console.info(
            `[CiliaMiner] Sheet "${sheetName}" missing from workbook — loaded ${rows.length} rows from ${jsonFile}`
          )
          return rows
        }
      } catch {
        // Fall through to record as missing
      }
    }

    // Record a missing-sheet issue if not already noted
    const alreadyNoted = this.qualityIssues.some(
      i => i.sheet === sheetName && i.issue === 'missing'
    )
    if (!alreadyNoted) {
      this.qualityIssues.push({
        sheet: sheetName,
        rowIndex: -1,
        gene: '',
        field: '(entire sheet)',
        issue: 'missing',
        originalValue: null,
        usedFallback: '(empty — add the sheet to ciliaminer.xlsx)',
      })
    }
    return []
  }

  // ── Primary gene dataset ───────────────────────────────────────────────────

  async getCiliopathyGenes(): Promise<CiliopathyGene[]> {
    return this.dedupe('genes', async () => {
      const rows = await this.getSheetRows('genes')
      const genes = this._parseGeneRows(rows)
      this.totalRowsProcessed += genes.length
      this.logQualityReport()
      return genes
    })
  }

  private _parseGeneRows(rows: RawRow[]): CiliopathyGene[] {
    return rows.map((row, i) => {
      const geneName = safeString(
        row['gene'], 'gene', i, MAIN_SHEET,
        String(row['gene'] ?? 'unknown'), this.qualityIssues
      )
      const ciliopathy = safeString(
        row['ciliopathy'], 'ciliopathy', i, MAIN_SHEET,
        geneName, this.qualityIssues, 'Unknown'
      )
      const annotations = parseAnnotationIds(row['annotation_ids'])

      return {
        Ciliopathy: ciliopathy,
        'Human Gene Name': geneName,
        'Subcellular Localization': safeStringOptional(row['localization']),
        'Gene MIM Number': safeStringOptional(row['omim_id']),
        'OMIM Phenotype Number': safeStringOptional(row['omim_id']),
        'Disease/Gene Reference': safeStringOptional(row['disease_reference']),
        'Human Gene ID': pickEnsemblId(row['ensembl_gene_id']),
        'Localisation Reference': safeStringOptional(row['localization_reference']),
        'Gene Localisation': safeStringOptional(row['localization']),
        Abbreviation: '',
        Synonym: safeStringOptional(row['synonym']),

        Gene: geneName,
        'ensembl_gene_id.x.x': safeStringOptional(row['ensembl_gene_id']),
        'Overexpression effects on cilia length (increase/decrease/no effect)':
          safeStringOptional(row['overexpression_cilia_length_effect']),
        'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)':
          safeStringOptional(row['lof_cilia_length_effect']),
        'Percentage of ciliated cells (increase/decrease/no effect)':
          safeStringOptional(row['ciliated_cells_pct_effect']),
        'Gene.Description': safeStringOptional(row['gene_description']),
        'Functional.Summary.from.Literature': safeStringOptional(row['functional_summary']),
        'Protein.complexes': safeStringOptional(row['protein_complexes']),
        subunits_protein_name: safeStringOptional(row['subunits_protein_name']),
        'Protein.complexes Referances': safeStringOptional(row['protein_complexes_references']),
        'Gene.annotation': safeStringOptional(row['gene_annotation']),
        'Functional.category': safeStringOptional(row['functional_category']),
        PFAM_IDs: safeStringOptional(row['pfam_ids']),
        Domain_Descriptions: safeStringOptional(row['domain_descriptions']),
        'Ciliopathy Classification': safeStringOptional(row['ciliopathy_classification']),
        Description: safeStringOptional(row['annotation_description']),
        Source: safeStringOptional(row['annotation_source']),

        Ortholog_Mouse: safeStringOptional(row['ortholog_mouse']),
        Ortholog_C_elegans: safeStringOptional(row['ortholog_celegans']),
        Ortholog_Xenopus: safeStringOptional(row['ortholog_xenopus']),
        Ortholog_Zebrafish: safeStringOptional(row['ortholog_zebrafish']),
        Ortholog_Drosophila: safeStringOptional(row['ortholog_drosophila']),

        mouse_ciliopathy_phenotype: safeStringOptional(row['mouse_ciliopathy_phenotype']),
        mouse_phenotype: safeStringOptional(row['mouse_phenotype']),
        human_ciliopathy_phenotype: safeStringOptional(row['human_ciliopathy_phenotype']),
        human_phenotype: safeStringOptional(row['human_phenotype']),

        go_terms: annotations.go_terms,
        reactome_pathways: annotations.reactome_pathways,
        kegg_pathways: annotations.kegg_pathways,
        ciliopathies: safeStringList(row['ciliopathy']),
        gene_id: pickEnsemblId(row['ensembl_gene_id']),
        source_annotations_raw: safeStringList(row['annotation_ids']),
      } satisfies CiliopathyGene
    })
  }

  // ── Derived chart / classification datasets ────────────────────────────────

  async getGeneNumbers(): Promise<GeneNumber[]> {
    const genes = await this.getCiliopathyGenes()
    const counts = new Map<string, number>()
    for (const g of genes) {
      const category =
        (g['Ciliopathy Classification'] || g.Ciliopathy || 'Unclassified').trim() ||
        'Unclassified'
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([Disease, Gene_numbers]) => ({
      Disease,
      Gene_numbers,
    }))
  }

  async getBarPlotData(): Promise<BarPlotData[]> {
    const genes = await this.getCiliopathyGenes()
    const buckets: Record<string, number> = {
      Cilia: 0,
      'Basal Body': 0,
      'Transition Zone': 0,
      Others: 0,
    }
    for (const g of genes) {
      const loc = (g['Subcellular Localization'] || '').toLowerCase()
      let bucket = 'Others'
      if (loc.includes('basal')) bucket = 'Basal Body'
      else if (loc.includes('transition')) bucket = 'Transition Zone'
      else if (loc.includes('cilia') || loc.includes('flagella')) bucket = 'Cilia'
      buckets[bucket] += 1
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }

  async getCiliopathiesByCategory(): Promise<Record<string, CiliopathyGene[]>> {
    const genes = await this.getCiliopathyGenes()
    const categories: Record<string, CiliopathyGene[]> = {
      Primary: [],
      Secondary: [],
      Atypical: [],
    }
    for (const g of genes) {
      const cls = (g['Ciliopathy Classification'] || '').toLowerCase()
      if (cls.includes('primary')) categories.Primary.push(g)
      else if (cls.includes('secondary')) categories.Secondary.push(g)
      else categories.Atypical.push(g)
    }
    return categories
  }

  // ── Publication data ───────────────────────────────────────────────────────

  async getPublicationData(): Promise<PublicationData[]> {
    const rows = await this.getSheetRows('genes')
    return rows
      .filter(row => row['gene'] && row['pubmed_count'] != null)
      .map(row => ({
        gene_name: String(row['gene']),
        publication_number: Number(row['pubmed_count']) || 0,
        year: 0,
      }))
  }

  async getGenePMIDs(geneName: string): Promise<string[]> {
    const rows = await this.getSheetRows('genes')
    const row = rows.find(
      r => String(r['gene'] ?? '').toLowerCase() === geneName.toLowerCase()
    )
    if (!row || !row['top25_recent_pmids']) return []
    return safeStringList(row['top25_recent_pmids'])
  }

  // ── Ortholog data ──────────────────────────────────────────────────────────

  async getOrthologData(organism: string): Promise<OrthologGene[]> {
    return this.dedupe(`orthologs_${organism}`, async () => {
      return this._loadOrthologData(organism)
    })
  }

  private async _loadOrthologData(organism: string): Promise<OrthologGene[]> {
    const geneProp = ORTHOLOG_GENE_PROP_MAP[organism]
    let result: OrthologGene[] = []

    if (geneProp) {
      const genes = await this.getCiliopathyGenes()
      const displayName = ORGANISM_DISPLAY_NAMES[organism] ?? organism
      result = genes
        .filter(g => g[geneProp])
        .map(g => {
          const orthologName = safeStringOptional(g[geneProp])
          return {
            'Human Gene': g['Human Gene Name'],
            'Human Gene ID': g['Human Gene ID'],
            'Human Gene Name': g['Human Gene Name'],
            'Human Gene MIM': g['Gene MIM Number'],
            'Human Disease': g.Ciliopathy,
            'Human Disease MIM': g['OMIM Phenotype Number'],
            'Ortholog Gene': orthologName,
            'Ortholog Gene ID': '',
            'Ortholog Gene Name': orthologName,
            'Ortholog Gene MIM': g['Gene MIM Number'],
            'Ortholog Disease': g.Ciliopathy,
            'Ortholog Disease MIM': g['OMIM Phenotype Number'],
            Organism: displayName,
          }
        })
    } else if (organism === 'chlamydomonas_reinhardtii') {
      // No column in workbook yet — record as missing once
      const alreadyNoted = this.qualityIssues.some(
        i => i.field === 'ortholog_creinhardtii (column)' && i.issue === 'missing'
      )
      if (!alreadyNoted) {
        this.qualityIssues.push({
          sheet: 'genes',
          rowIndex: -1,
          gene: '',
          field: 'ortholog_creinhardtii (column)',
          issue: 'missing',
          originalValue: null,
          usedFallback: '(empty — add ortholog_creinhardtii column to the genes sheet)',
        })
      }
    } else {
      console.warn(`[CiliaMiner] Unknown organism: "${organism}"`)
    }

    return result
  }

  async getAllOrthologData(): Promise<OrthologGene[]> {
    const results = await Promise.all(
      Object.keys(ORGANISM_DISPLAY_NAMES).map(o =>
        this.getOrthologData(o).catch(() => [])
      )
    )
    return results.flat()
  }

  async getOrganismStats(organism: string): Promise<{ geneCount: number; orthologCount: number }> {
    const data = await this.getOrthologData(organism).catch(() => [])
    return { geneCount: data.length, orthologCount: data.length }
  }

  // ── Symptom / clinical feature data ───────────────────────────────────────

  async getSymptomsData(): Promise<HeatmapData[]> {
    const [primary, secondary] = await Promise.all([
      this.getSheetRows('symptome_primary'),
      this.getSheetRows('symptome_secondary'),
    ])
    return this.buildHeatmapFromSymptomRows([...primary, ...secondary])
  }

  async getCiliopathyFeatures(): Promise<CiliopathyFeature[]> {
    return this.dedupe('ciliopathy_features', () => this._loadCiliopathyFeatures())
  }

  private async _loadCiliopathyFeatures(): Promise<CiliopathyFeature[]> {
    const [primary, secondary] = await Promise.all([
      this.getSheetRows('symptome_primary'),
      this.getSheetRows('symptome_secondary'),
    ])

    const features: CiliopathyFeature[] = []
    const seen = new Set<string>()

    // Parse original symptom matrix rows
    for (const row of [...primary, ...secondary]) {
      const featureName = safeStringOptional(row['Ciliopathy / Clinical Features'])
      const category = safeStringOptional(row['General Titles'])
      for (const key of Object.keys(row)) {
        if (key === 'Ciliopathy / Clinical Features' || key === 'General Titles') continue
        if (row[key] === 1 || row[key] === 1.0) {
          const dedupKey = `${featureName}||${key}`
          seen.add(dedupKey)
          features.push({
            'Ciliopathy / Clinical Features': featureName,
            'General Titles': category,
            Category: category,
            Ciliopathy: key,
            Disease: key,
            Feature: featureName,
            Count: 1,
          })
        }
      }
    }

    // Merge ClinGen GCEP-derived clinical features
    try {
      const url = `${getBasePath()}/data/${CLINGEN_FEATURES_FILE}`
      const res = await fetch(url)
      if (res.ok) {
        const clingenRows: RawRow[] = await res.json()
        let added = 0
        for (const row of clingenRows) {
          const featureName = safeStringOptional(row['Ciliopathy / Clinical Features'])
          const category = safeStringOptional(row['General Titles'])
          for (const key of Object.keys(row)) {
            if (key === 'Ciliopathy / Clinical Features' || key === 'General Titles') continue
            if (row[key] === 1 || row[key] === 1.0) {
              const dedupKey = `${featureName}||${key}`
              if (!seen.has(dedupKey)) {
                seen.add(dedupKey)
                features.push({
                  'Ciliopathy / Clinical Features': featureName,
                  'General Titles': category,
                  Category: category,
                  Ciliopathy: key,
                  Disease: key,
                  Feature: featureName,
                  Count: 1,
                })
                added++
              }
            }
          }
        }
        console.info(`[CiliaMiner] Merged ${added} ClinGen-derived clinical features`)
      }
    } catch {
      // ClinGen features file not available — continue with base data
    }

    return features
  }

  private buildHeatmapFromSymptomRows(rows: RawRow[]): HeatmapData[] {
    return rows.flatMap(row => {
      const feature = safeStringOptional(row['Ciliopathy / Clinical Features'])
      const category = safeStringOptional(row['General Titles'])
      return Object.keys(row)
        .filter(k => k !== 'Ciliopathy / Clinical Features' && k !== 'General Titles')
        .filter(k => row[k] === 1 || row[k] === 1.0)
        .map(k => ({ x: k, y: feature, value: 1, category }))
    })
  }

  // ── Gene localisation data ─────────────────────────────────────────────────

  async getGeneLocalizationData(): Promise<HeatmapData[]> {
    const rows = await this.getSheetRows('gene_localisations_ciliacarta')
    return rows.flatMap(item => {
      const gene = safeStringOptional(item['Human Gene Name'])
      const entries: HeatmapData[] = []
      if (item['Basal Body'] === 1) entries.push({ x: gene, y: 'Basal Body', value: 1 })
      if (item['Transition Zone'] === 1) entries.push({ x: gene, y: 'Transition Zone', value: 1 })
      if (item['Cilia'] === 1) entries.push({ x: gene, y: 'Cilia', value: 1 })
      return entries
    })
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async searchCiliopathyGenes(query: string): Promise<CiliopathyGene[]> {
    const genes = await this.getCiliopathyGenes()
    const q = query.toLowerCase()
    return genes
      .filter(g => {
        const haystack = [
          g['Human Gene Name'],
          g.Ciliopathy,
          g['Gene MIM Number'],
          g.Synonym ?? '',
          g['Subcellular Localization'],
          g['Ciliopathy Classification'] ?? '',
          g['Functional.category'] ?? '',
          ...(g.go_terms ?? []),
          ...(g.reactome_pathways ?? []),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 500)
  }

  async searchGenes(query: string): Promise<CiliopathyGene[]> {
    return this.searchCiliopathyGenes(query)
  }

  // ── Sheet availability check ───────────────────────────────────────────────

  async hasSheet(sheetName: string): Promise<boolean> {
    const wb = await this.getWorkbook()
    return wb.hasSheet(sheetName)
  }

  async getMissingSheets(): Promise<string[]> {
    await this.getWorkbook()
    return [...this.sheetsMissing]
  }

  // ── Data quality report ────────────────────────────────────────────────────

  getDataQualityReport(): DataQualityReport {
    const issuesByField: Record<string, number> = {}
    for (const issue of this.qualityIssues) {
      issuesByField[issue.field] = (issuesByField[issue.field] ?? 0) + 1
    }

    return {
      source: `${getBasePath()}/data/${EXCEL_FILENAME}`,
      loadedAt: this.loadedAt,
      sheetsFound: this.sheetsFound,
      sheetsMissing: this.sheetsMissing,
      datasetsFromFallbackJson: [],
      totalRowsProcessed: this.totalRowsProcessed,
      totalIssues: this.qualityIssues.length,
      issuesByField,
      issues: this.qualityIssues,
    }
  }

  private logQualityReport(): void {
    const report = this.getDataQualityReport()

    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__ciliaminer_quality_report = report
    }

    console.group('[CiliaMiner] Data Quality Report')
    console.log(`Source : ${report.source}`)
    console.log(`Loaded : ${report.loadedAt}`)
    console.log(`Sheets found    : ${report.sheetsFound.join(', ')}`)
    console.log(`Rows processed  : ${report.totalRowsProcessed}`)

    if (report.sheetsMissing.length) {
      console.warn(
        `Missing sheets  : ${report.sheetsMissing.join(', ')}\n` +
          '  → Add these sheets to ciliaminer.xlsx to populate the missing sections.'
      )
    }
    if (report.totalIssues > 0) {
      console.warn(`Field issues    : ${report.totalIssues}`, report.issuesByField)
      console.info(
        'Run window.__ciliaminer_quality_report.issues in the console for the full list.'
      )
    } else {
      console.log('Field issues    : none ✓')
    }
    console.groupEnd()
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────

export const dataService = new DataService()

export const {
  getCiliopathyGenes,
  getGeneNumbers,
  getBarPlotData,
  getOrthologData,
  getSymptomsData,
  getGeneLocalizationData,
  getOrganismStats,
  getPublicationData,
  getGenePMIDs,
  searchCiliopathyGenes,
  searchGenes,
  getCiliopathiesByCategory,
  getCiliopathyFeatures,
  getAllOrthologData,
  getDataQualityReport,
  hasSheet,
  getMissingSheets,
} = dataService
