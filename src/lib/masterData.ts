/**
 * masterData.ts
 *
 * Lazy loader for the full v15 master JSON. The home page and the search
 * results list both use the slim ~110 KB search index (see searchIndex.ts).
 * Detail pages (/gene/[symbol], /disease/[name]) need the full record, so
 * we fetch the 1.1 MB master on-demand and cache it module-globally.
 *
 * Splitting these into two files means the home page never pays the cost
 * of fetching the full master.
 */

// --- Wire shapes (camelCase mirror of the v15 file) ----------------------

export interface MasterMetadata {
  title: string
  version: string
  generatedAt: string
  totalGenes: number
  totalDiseases: number
  classificationRule?: {
    principle?: string
    [k: string]: string | undefined
  }
  diseaseClassCounts?: Record<string, number>
  perClassGeneCounts?: Record<string, number>
  geneInclusionCriterion?: string
  dataSources?: string[]
  /** Notes from `metadata.changes_in_this_version`, etc. */
  changesInThisVersion?: string[]
}

export interface MasterGene {
  gene: string
  ensemblId?: string
  omimId?: string
  uniprotId?: string
  synonyms: string[]
  description?: string
  ciliopathies: string[]
  diseaseClassifications: Record<string, string>
  ciliopathyClasses: string[]
  panIdioClass?: string
  panIdioTissues?: number | null
  localization: string[]
  functionalSummary?: string
  functionalCategory: string[]
  proteinComplex?: string
  ciliopathyRefs: string[]
  localizationRefs: string[]
  humanCiliopathyPhenotype?: string
  mouseCiliopathyPhenotype?: string
  evidenceType?: string
  evidenceFlag?: string
  curationNotes?: string
  note?: string
}

export interface DiseaseSynonymBlock {
  synonyms: string[]
  abbreviation?: string
  omimPreferred?: string
  notes?: string
}

export interface MasterDisease {
  name: string
  className: string
  rationale?: string
  synonyms: string[]
  abbreviation?: string
  omimPreferred?: string
  notes?: string
  /** Genes mapped to this disease (built up at load time). */
  genes: Array<{ symbol: string; classes: string[] }>
}

export interface LoadedMaster {
  metadata: MasterMetadata
  /** Lookup by gene symbol (UPPER-cased keys). */
  genesBySymbol: Map<string, MasterGene>
  /** Lookup by disease name (case-insensitive — keys are lowercased). */
  diseasesByName: Map<string, MasterDisease>
}

// --- Raw shape (matches v15 JSON exactly) --------------------------------

interface RawGene {
  gene: string
  ensembl_id?: string
  omim_id?: string
  uniprot_id?: string
  synonyms?: string[]
  description?: string
  ciliopathies?: string[]
  disease_classifications?: Record<string, string>
  ciliopathy_classes?: string[]
  pan_idio_class?: string
  pan_idio_tissues?: number | null
  localization?: string[]
  functional_summary?: string
  functional_category?: string[]
  protein_complex?: string
  ciliopathy_refs?: string[]
  localization_refs?: string[]
  human_ciliopathy_phenotype?: string
  mouse_ciliopathy_phenotype?: string
  evidence_type?: string
  evidence_flag?: string
  curation_notes?: string
  note?: string
}

interface RawMaster {
  metadata: {
    title?: string
    version?: string
    generated_at?: string
    last_updated?: string
    total_genes?: number
    total_diseases?: number
    classification_rule?: Record<string, string>
    disease_class_counts?: Record<string, number>
    per_class_gene_counts?: Record<string, number>
    gene_inclusion_criterion?: string
    data_sources?: string[]
    changes_in_this_version?: string[]
  }
  disease_classifications?: Record<string, string>
  disease_rationale?: Record<string, string>
  diseases_by_class?: Record<string, string[]>
  disease_synonyms?: Record<
    string,
    {
      synonyms?: string[]
      abbreviation?: string
      omim_preferred?: string
      notes?: string
    }
  >
  genes: Record<string, RawGene>
}

// --- Loader (lazy, cached) -----------------------------------------------

let cached: LoadedMaster | null = null
let inflight: Promise<LoadedMaster> | null = null

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

export async function loadMaster(): Promise<LoadedMaster> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch(`${basePath()}/data/ciliopathy_genes_v15.json`, {
    cache: 'force-cache',
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to load master data (HTTP ${res.status}). ` +
          `Make sure public/data/ciliopathy_genes_v15.json exists.`
        )
      }
      const raw = (await res.json()) as RawMaster
      const loaded = transformMaster(raw)
      cached = loaded
      return loaded
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

function transformMaster(raw: RawMaster): LoadedMaster {
  const md = raw.metadata || {}
  const metadata: MasterMetadata = {
    title: md.title ?? 'Ciliopathy Genes',
    version: md.version ?? '',
    generatedAt: md.generated_at ?? md.last_updated ?? '',
    totalGenes: md.total_genes ?? Object.keys(raw.genes || {}).length,
    totalDiseases: md.total_diseases ?? 0,
    classificationRule: md.classification_rule,
    diseaseClassCounts: md.disease_class_counts,
    perClassGeneCounts: md.per_class_gene_counts,
    geneInclusionCriterion: md.gene_inclusion_criterion,
    dataSources: md.data_sources,
    changesInThisVersion: md.changes_in_this_version,
  }

  // -- genes --
  const genesBySymbol = new Map<string, MasterGene>()
  for (const [sym, g] of Object.entries(raw.genes || {})) {
    genesBySymbol.set(sym.toUpperCase(), {
      gene: g.gene ?? sym,
      ensemblId: g.ensembl_id,
      omimId: g.omim_id ? String(g.omim_id) : undefined,
      uniprotId: g.uniprot_id,
      synonyms: g.synonyms ?? [],
      description: g.description,
      ciliopathies: g.ciliopathies ?? [],
      diseaseClassifications: g.disease_classifications ?? {},
      ciliopathyClasses: g.ciliopathy_classes ?? [],
      panIdioClass: g.pan_idio_class,
      panIdioTissues: g.pan_idio_tissues ?? null,
      localization: g.localization ?? [],
      functionalSummary: g.functional_summary,
      functionalCategory: g.functional_category ?? [],
      proteinComplex: g.protein_complex,
      ciliopathyRefs: (g.ciliopathy_refs ?? []).map(String),
      localizationRefs: (g.localization_refs ?? []).map(String),
      humanCiliopathyPhenotype: g.human_ciliopathy_phenotype,
      mouseCiliopathyPhenotype: g.mouse_ciliopathy_phenotype,
      evidenceType: g.evidence_type,
      evidenceFlag: g.evidence_flag,
      curationNotes: g.curation_notes,
      note: g.note,
    })
  }

  // -- diseases (built from disease_classifications + disease_synonyms +
  //    disease_rationale + reverse map from genes) --
  const diseasesByName = new Map<string, MasterDisease>()

  const diseaseClassifications = raw.disease_classifications ?? {}
  const diseaseRationale = raw.disease_rationale ?? {}
  const diseaseSynonyms = raw.disease_synonyms ?? {}

  const allNames = new Set<string>(Object.keys(diseaseClassifications))
  for (const n of Object.keys(diseaseSynonyms)) allNames.add(n)
  for (const dlist of Object.values(raw.diseases_by_class ?? {})) {
    if (Array.isArray(dlist)) dlist.forEach((n) => allNames.add(n))
  }
  Array.from(genesBySymbol.values()).forEach((g) => {
    g.ciliopathies.forEach((n) => allNames.add(n))
  })

  Array.from(allNames).forEach((name) => {
    const syn = diseaseSynonyms[name] || {}
    diseasesByName.set(name.toLowerCase(), {
      name,
      className: diseaseClassifications[name] ?? 'Unclassified',
      rationale: diseaseRationale[name],
      synonyms: syn.synonyms ?? [],
      abbreviation: syn.abbreviation,
      omimPreferred: syn.omim_preferred,
      notes: syn.notes,
      genes: [],
    })
  })

  // Build the reverse "this disease's genes" list
  Array.from(genesBySymbol.values()).forEach((g) => {
    for (const dname of g.ciliopathies) {
      const d = diseasesByName.get(dname.toLowerCase())
      if (d) d.genes.push({ symbol: g.gene, classes: g.ciliopathyClasses })
    }
  })
  Array.from(diseasesByName.values()).forEach((d) => {
    d.genes.sort((a, b) => a.symbol.localeCompare(b.symbol))
  })

  return { metadata, genesBySymbol, diseasesByName }
}

// --- Convenience accessors ----------------------------------------------

export async function getGene(symbol: string): Promise<MasterGene | null> {
  const m = await loadMaster()
  return m.genesBySymbol.get(symbol.toUpperCase()) ?? null
}

export async function getDisease(name: string): Promise<MasterDisease | null> {
  const m = await loadMaster()
  return m.diseasesByName.get(name.toLowerCase()) ?? null
}
