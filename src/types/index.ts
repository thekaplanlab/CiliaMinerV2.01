// Main data types for CiliaMiner application

export interface CiliopathyGene {
  Ciliopathy: string;
  'Human Gene Name': string;
  'Subcellular Localization': string;
  'Gene MIM Number': string;
  'OMIM Phenotype Number': string;
  'Disease/Gene Reference': string;
  'Human Gene ID': string;
  'Localisation Reference': string;
  'Gene Localisation': string;
  Abbreviation?: string;
  Synonym?: string;
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
