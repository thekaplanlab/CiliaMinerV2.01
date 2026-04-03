// Main data types for CiliaMiner application

export interface CiliopathyGene {
  Ciliopathy: string
  'Human Gene Name': string
  'Subcellular Localization': string
  'Gene MIM Number': string
  'OMIM Phenotype Number': string
  'Disease/Gene Reference': string
  'Human Gene ID': string
  'Localisation Reference': string
  'Gene Localisation': string
  Abbreviation?: string
  Synonym?: string

  // Extended annotation fields from the integrated Excel
  Gene?: string
  'ensembl_gene_id.x.x'?: string
  'Overexpression effects on cilia length (increase/decrease/no effect)'?: string
  'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'?: string
  'Percentage of ciliated cells (increase/decrease/no effect)'?: string
  'Gene.Description'?: string
  'Functional.Summary.from.Literature'?: string
  'Protein.complexes'?: string
  subunits_protein_name?: string
  'Protein.complexes Referances'?: number | string | null
  'Gene.annotation'?: string | null
  'Functional.category'?: string | null
  PFAM_IDs?: string | null
  Domain_Descriptions?: string | null
  'Ciliopathy Classification'?: string | null
  Description?: string | null
  Source?: string | null
  Ortholog_Mouse?: string | null
  Ortholog_C_elegans?: string | null
  Ortholog_Xenopus?: string | null
  Ortholog_Zebrafish?: string | null
  Ortholog_Drosophila?: string | null
  mouse_ciliopathy_phenotype?: string | null
  mouse_phenotype?: string | null
  human_ciliopathy_phenotype?: string | null
  human_phenotype?: string | null

  // Processed annotation fields (do not confuse with gene_id)
  gene_id?: string
  ciliopathies?: string[]
  go_terms?: string[]
  reactome_pathways?: string[]
  kegg_pathways?: string[]
  source_annotations_raw?: string[]
}

export interface OrthologGene {
  'Human Gene': string;
  'Human Gene ID': string;
  'Human Gene Name': string;
  'Human Gene MIM': string;
  'Human Disease': string;
  'Human Disease MIM': string;
  'Ortholog Gene': string;
  'Ortholog Gene ID': string;
  'Ortholog Gene Name': string;
  'Ortholog Gene MIM': string;
  'Ortholog Disease': string;
  'Ortholog Disease MIM': string;
  'Organism': string;
  'Sequence Identity'?: number;
  'Functional Conservation'?: string;
}

export interface CiliopathyFeature {
  Ciliopathy: string;
  Feature: string;
  Category: string;
  Disease?: string;
  Count?: number;
  'Ciliopathy / Clinical Features'?: string;
  'General Titles'?: string;
}

export interface GeneNumber {
  Disease: string;
  Gene_numbers: number;
}

export interface BarPlotData {
  name: string;
  value: number;
  color?: string;
}

export interface PublicationData {
  gene_name: string;
  publication_number: number;
  year: number;
}

export interface SearchResult {
  type: 'gene' | 'ciliopathy';
  data: CiliopathyGene[] | CiliopathyFeature[];
}

export interface OrganSystem {
  name: string;
  icon: string;
  count: number;
  color: string;
}

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  count?: number;
  category?: string;
}

export interface TabPanel {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface SearchFilters {
  geneName?: string;
  ciliopathyName?: string;
  localization?: string;
  organism?: string;
  feature?: string;
  category?: string;
  searchType?: 'gene' | 'disease' | 'ortholog';
}
