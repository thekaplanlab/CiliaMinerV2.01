import { 
  CiliopathyGene, 
  OrthologGene, 
  CiliopathyFeature, 
  GeneNumber, 
  BarPlotData, 
  PublicationData,
  HeatmapData
} from '@/types'

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Data index structure
interface DataIndex {
  datasets: {
    [key: string]: {
      filename: string
      record_count: number
      columns: string[]
      size_kb: number
    }
  }
}

// Get the base path for data fetching (GitHub Pages support)
function getBasePath(): string {
  // Check if we're in production and deployed to a subdirectory
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    // If the path starts with /CiliaMinerV2.01, use that as basePath
    if (path.startsWith('/CiliaMinerV2.01')) {
      return '/CiliaMinerV2.01'
    }
  }
  return ''
}

interface GeneSearchIndexEntry {
  gene: CiliopathyGene
  search: string
}

class DataService {
  private dataIndex: DataIndex | null = null
  private dataCache: Map<string, any> = new Map()
  private basePath: string = getBasePath()
  private useBackend: boolean = false
  private backendChecked: boolean = false

  // Check if backend API is available
  private async checkBackendAvailability(): Promise<boolean> {
    if (this.backendChecked) return this.useBackend
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      this.useBackend = response.ok
      console.log(this.useBackend ? '✅ Backend API available' : '⚠️ Backend not available, using static files')
    } catch {
      this.useBackend = false
      console.log('⚠️ Backend not available, using static files')
    }
    
    this.backendChecked = true
    return this.useBackend
  }

  // Fetch from backend API
  private async fetchFromAPI<T>(endpoint: string): Promise<T | null> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`)
      if (!response.ok) return null
      return await response.json()
    } catch {
      return null
    }
  }

  async loadDataIndex(): Promise<DataIndex> {
    if (this.dataIndex) return this.dataIndex
    
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(`${this.basePath}/data/data_index.json`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      this.dataIndex = data
      return data
    } catch (error) {
      console.error('Failed to load data index:', error)
      // Return a default data index instead of throwing
      return {
        datasets: {}
      }
    }
  }

  async loadDataset(datasetName: string): Promise<any[]> {
    if (this.dataCache.has(datasetName)) {
      return this.dataCache.get(datasetName)!
    }

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout for large files
      
      const response = await fetch(`${this.basePath}/data/${datasetName}.json`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Get the response as text first to handle NaN values
      const text = await response.text()
      
      // Replace NaN with null to make it valid JSON
      const validJsonText = text.replace(/:\s*NaN/g, ': null')
      
      const data = JSON.parse(validJsonText)
      this.dataCache.set(datasetName, data)
      return data
    } catch (error) {
      console.error(`Failed to load dataset ${datasetName}:`, error)
      // Return empty array instead of throwing to prevent app crashes
      return []
    }
  }

  private async getGeneSearchIndex(): Promise<GeneSearchIndexEntry[]> {
    const data = await this.loadDataset('gene-search-index')
    if (!Array.isArray(data)) return []

    return data.map((item: any) => ({
      gene: {
        Ciliopathy: item.gene?.Ciliopathy || '',
        'Human Gene Name': item.gene?.['Human Gene Name'] || '',
        'Subcellular Localization': item.gene?.['Subcellular Localization'] || '',
        'Gene MIM Number': item.gene?.['Gene MIM Number'] || '',
        'OMIM Phenotype Number': item.gene?.['OMIM Phenotype Number'] || '',
        'Human Gene ID': item.gene?.['Human Gene ID'] || '',
        'Disease/Gene Reference': item.gene?.['Disease/Gene Reference'] || '',
        'Localisation Reference': item.gene?.['Localisation Reference'] || '',
        'Gene Localisation': item.gene?.['Gene Localisation'] || item.gene?.['Subcellular Localization'] || '',
        Abbreviation: item.gene?.Abbreviation || '',
        Synonym: item.gene?.Synonym || '',
        go_terms: item.gene?.go_terms || [],
        reactome_pathways: item.gene?.reactome_pathways || [],
        kegg_pathways: item.gene?.kegg_pathways || []
      },
      search: typeof item.search === 'string' ? item.search : ''
    }))
  }

  // Load ciliopathy genes data
  async getCiliopathyGenes(): Promise<CiliopathyGene[]> {
    const data = await this.loadDataset('homosapiens_ciliopathy')
    return data.map((item: any) => ({
      // Core fields used across the app
      Ciliopathy: item.Ciliopathy || 'Unknown',
      'Human Gene Name': item['Human Gene Name'] || item.Gene,
      'Subcellular Localization': item['Subcellular Localization'] || item.Localization || '',
      'Gene MIM Number': String(item['Gene MIM Number'] ?? item['OMIM Phenotype Number'] ?? ''),
      'OMIM Phenotype Number': String(item['OMIM Phenotype Number'] ?? ''),
      'Disease/Gene Reference': item['Disease/Gene Reference'] ?? item['Disease Reference'] ?? '',
      'Human Gene ID': String(item['Human Gene ID'] ?? item.gene_id ?? item['ensembl_gene_id.x.x'] ?? ''),
      'Localisation Reference': item['Localisation Reference'] ?? String(item.Reference ?? ''),
      'Gene Localisation': item['Subcellular Localization'] || item.Localization || '',
      Abbreviation: item.Abbreviation ?? '',
      Synonym: item.Synonym ?? item['Synonym.'] ?? '',

      // Extended annotation mapped through for richer views
      Gene: item.Gene,
      'ensembl_gene_id.x.x': item['ensembl_gene_id.x.x'],
      'Overexpression effects on cilia length (increase/decrease/no effect)':
        item['Overexpression effects on cilia length (increase/decrease/no effect)'],
      'Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)':
        item['Loss-of-Function (LoF) effects on cilia length (increase/decrease/no effect)'],
      'Percentage of ciliated cells (increase/decrease/no effect)':
        item['Percentage of ciliated cells (increase/decrease/no effect)'],
      'Gene.Description': item['Gene.Description'],
      'Functional.Summary.from.Literature': item['Functional.Summary.from.Literature'],
      'Protein.complexes': item['Protein.complexes'],
      subunits_protein_name: item.subunits_protein_name,
      'Protein.complexes Referances': item['Protein.complexes Referances'],
      'Gene.annotation': item['Gene.annotation'],
      'Functional.category': item['Functional.category'],
      PFAM_IDs: item['PFAM_IDs'],
      Domain_Descriptions: item['Domain_Descriptions'],
      'Ciliopathy Classification': item['Ciliopathy Classification'],
      Description: item.Description,
      Source: item.Source,
      go_terms: item.go_terms || [],
      reactome_pathways: item.reactome_pathways || [],
      kegg_pathways: item.kegg_pathways || [],
      ciliopathies: item.ciliopathies || [],
      Ortholog_Mouse: item['Ortholog_Mouse'],
      Ortholog_C_elegans: item['Ortholog_C_elegans'],
      Ortholog_Xenopus: item['Ortholog_Xenopus'],
      Ortholog_Zebrafish: item['Ortholog_Zebrafish'],
      Ortholog_Drosophila: item['Ortholog_Drosophila'],
      mouse_ciliopathy_phenotype: item['mouse_ciliopathy_phenotype'],
      mouse_phenotype: item['mouse_phenotype'],
      human_ciliopathy_phenotype: item['human_ciliopathy_phenotype'],
      human_phenotype: item['human_phenotype']
    }))
  }

  // Load gene numbers for pie chart
  async getGeneNumbers(): Promise<GeneNumber[]> {
    // Derive categories directly from the integrated gene table
    const genes = await this.getCiliopathyGenes()

    // Use Ciliopathy Classification when available, fall back to Ciliopathy string
    const counts = new Map<string, number>()
    genes.forEach(gene => {
      const rawCategory =
        (gene['Ciliopathy Classification'] as string | null | undefined) ||
        gene.Ciliopathy ||
        'Unclassified'

      const category = rawCategory.trim() || 'Unclassified'
      const current = counts.get(category) ?? 0
      counts.set(category, current + 1)
    })

    return Array.from(counts.entries()).map(([Disease, Gene_numbers]) => ({
      Disease,
      Gene_numbers
    }))
  }

  // Load bar plot data
  async getBarPlotData(): Promise<BarPlotData[]> {
    // Derive localization distribution from the integrated gene table
    const genes = await this.getCiliopathyGenes()

    const buckets: Record<string, number> = {
      Cilia: 0,
      'Basal Body': 0,
      'Transition Zone': 0,
      Others: 0
    }

    genes.forEach(gene => {
      const loc = (gene['Subcellular Localization'] || '').toLowerCase()

      let bucket: keyof typeof buckets = 'Others'
      if (loc.includes('basal')) bucket = 'Basal Body'
      else if (loc.includes('transition')) bucket = 'Transition Zone'
      else if (loc.includes('cilia') || loc.includes('flagella')) bucket = 'Cilia'

      buckets[bucket] += 1
    })

    return Object.entries(buckets).map(([name, value]) => ({
      name,
      value
    }))
  }

  // Load ortholog data for specific organism
  async getOrthologData(organism: string): Promise<OrthologGene[]> {
    const datasetMap: { [key: string]: string } = {
      'mus_musculus': 'ortholog_human_mmusculus',
      'danio_rerio': 'ortholog_human_drerio',
      'xenopus_laevis': 'ortholog_human_xlaevis',
      'drosophila_melanogaster': 'ortholog_human_drosophila',
      'caenorhabditis_elegans': 'ortholog_human_celegans',
      'chlamydomonas_reinhardtii': 'ortholog_human_creinhardtii'
    }

    const datasetName = datasetMap[organism]
    if (!datasetName) {
      throw new Error(`Unknown organism: ${organism}`)
    }

    const data = await this.loadDataset(datasetName)
    return data.map((item: any) => ({
      'Human Gene': item['Human Gene Name'],
      'Human Gene ID': item['Human Gene ID']?.toString() || '',
      'Human Gene Name': item['Human Gene Name'],
      'Human Gene MIM': item['Gene MIM Number'],
      'Human Disease': item.Ciliopathy,
      'Human Disease MIM': item['OMIM Phenotype Number'],
      'Ortholog Gene': item[`${organism.split('_')[0].charAt(0).toUpperCase() + organism.split('_')[0].slice(1)} ${organism.split('_')[1]}` + ' Gene Name'] || item['Human Gene Name'],
      'Ortholog Gene ID': item['Human Gene ID']?.toString() || '',
      'Ortholog Gene Name': item[`${organism.split('_')[0].charAt(0).toUpperCase() + organism.split('_')[0].slice(1)} ${organism.split('_')[1]}` + ' Gene Name'] || item['Human Gene Name'],
      'Ortholog Gene MIM': item['Gene MIM Number'],
      'Ortholog Disease': item.Ciliopathy,
      'Ortholog Disease MIM': item['OMIM Phenotype Number'],
      'Organism': this.getOrganismDisplayName(organism)
    }))
  }

  // Load symptoms data for heatmap
  async getSymptomsData(): Promise<HeatmapData[]> {
    const primarySymptoms = await this.loadDataset('symptome_primary')
    const secondarySymptoms = await this.loadDataset('symptome_secondary')
    
    const allSymptoms = [...primarySymptoms, ...secondarySymptoms]
    const heatmapData: HeatmapData[] = []

    allSymptoms.forEach((symptom: any) => {
      const feature = symptom['Ciliopathy / Clinical Features']
      const generalTitle = symptom['General Titles']
      
      // Extract disease columns (skip metadata columns)
      const diseaseColumns = Object.keys(symptom).filter(key => 
        key !== 'Ciliopathy / Clinical Features' && 
        key !== 'General Titles' && 
        symptom[key] === 1.0
      )

      diseaseColumns.forEach(disease => {
        heatmapData.push({
          x: disease,
          y: feature,
          value: 1,
          category: generalTitle
        })
      })
    })

    return heatmapData
  }

  // Load gene localization data for heatmap
  async getGeneLocalizationData(): Promise<HeatmapData[]> {
    const data = await this.loadDataset('gene_localisations_ciliacarta')
    const heatmapData: HeatmapData[] = []

    data.forEach((item: any) => {
      const gene = item['Human Gene Name']
      
      // Check each localization column
      if (item['Basal Body'] === 1) {
        heatmapData.push({ x: gene, y: 'Basal Body', value: 1 })
      }
      if (item['Transition Zone'] === 1) {
        heatmapData.push({ x: gene, y: 'Transition Zone', value: 1 })
      }
      if (item['Cilia'] === 1) {
        heatmapData.push({ x: gene, y: 'Cilia', value: 1 })
      }
    })

    return heatmapData
  }

  // Get organism display names
  private getOrganismDisplayName(organismId: string): string {
    const displayNames: { [key: string]: string } = {
      'mus_musculus': 'Mus musculus',
      'danio_rerio': 'Danio rerio',
      'xenopus_laevis': 'Xenopus laevis',
      'drosophila_melanogaster': 'Drosophila melanogaster',
      'caenorhabditis_elegans': 'Caenorhabditis elegans',
      'chlamydomonas_reinhardtii': 'Chlamydomonas reinhardtii'
    }
    return displayNames[organismId] || organismId
  }

  // Get statistics for organism
  async getOrganismStats(organism: string): Promise<{ geneCount: number; orthologCount: number }> {
    try {
      const data = await this.getOrthologData(organism)
      return {
        geneCount: data.length,
        orthologCount: data.length
      }
    } catch (error) {
      console.error(`Failed to get stats for ${organism}:`, error)
      return { geneCount: 0, orthologCount: 0 }
    }
  }

  // Get publication data
  async getPublicationData(): Promise<PublicationData[]> {
    try {
      const data = await this.loadDataset('publication_table')
      // Transform the data to match the expected structure and filter out null values
      const validData = data.filter((item: any) => 
        item.gene_name && item.year && item.publication_number
      )
      
      return validData.map((item: any) => ({
        gene_name: item.gene_name,
        publication_number: parseInt(item.publication_number) || 0,
        year: parseInt(item.year) || 2023
      }))
    } catch (error) {
      console.error('Failed to load publication data:', error)
      return []
    }
  }

  // Search ciliopathy genes
  async searchCiliopathyGenes(query: string): Promise<CiliopathyGene[]> {
    // Try backend API first
    await this.checkBackendAvailability()
    
    if (this.useBackend) {
      try {
        const response = await this.fetchFromAPI<{ results: any[] }>(
          `/api/genes/search?q=${encodeURIComponent(query)}&limit=500`
        )
        if (response && response.results) {
          return response.results.map((item: any) => ({
            Ciliopathy: item.Ciliopathy || item.ciliopathy || '',
            'Human Gene Name': item['Human Gene Name'] || item.human_gene_name || '',
            'Subcellular Localization': item['Subcellular Localization'] || item.subcellular_localization || '',
            'Gene MIM Number': item['Gene MIM Number'] || item.gene_mim_number || '',
            'OMIM Phenotype Number': item['OMIM Phenotype Number'] || item.omim_phenotype_number || '',
            'Human Gene ID': item['Human Gene ID'] || item.human_gene_id || '',
            'Disease/Gene Reference': item['Disease/Gene Reference'] || item.disease_gene_reference || '',
            'Localisation Reference': item['Localisation Reference'] || item.localisation_reference || '',
            'Gene Localisation': item['Subcellular Localization'] || item.subcellular_localization || '',
            Abbreviation: item.Abbreviation || item.abbreviation || '',
            Synonym: item.Synonym || item.synonym || ''
          }))
        }
      } catch (error) {
        console.error('Backend search failed, falling back to static:', error)
      }
    }
    const lowerQuery = query.toLowerCase()

    // Try optimized search index first
    try {
      const index = await this.getGeneSearchIndex()
      if (index.length > 0) {
        return index
          .filter(entry => entry.search.includes(lowerQuery))
          .slice(0, 500)
          .map(entry => entry.gene)
      }
    } catch (error) {
      console.error('Failed to use gene search index, falling back to full dataset:', error)
    }

    // Fallback to static file search
    const genes = await this.getCiliopathyGenes()
    return genes.filter(gene => 
      gene.Ciliopathy.toLowerCase().includes(lowerQuery) ||
      gene['Human Gene Name'].toLowerCase().includes(lowerQuery) ||
      gene['Gene MIM Number'].toLowerCase().includes(lowerQuery)
    )
  }

  // Search genes (alias for searchCiliopathyGenes)
  async searchGenes(query: string): Promise<CiliopathyGene[]> {
    return this.searchCiliopathyGenes(query)
  }

  // Get ciliopathy by category
  async getCiliopathiesByCategory(): Promise<{ [key: string]: CiliopathyGene[] }> {
    const genes = await this.getCiliopathyGenes()
    const categories: { [key: string]: CiliopathyGene[] } = {
      'Primary': [],
      'Secondary': [],
      'Atypical': []
    }

    // This is a simplified categorization - in real implementation you'd have a proper category field
    genes.forEach(gene => {
      if (gene.Ciliopathy.includes('Polycystic') || gene.Ciliopathy.includes('Bardet')) {
        categories['Primary'].push(gene)
      } else if (gene.Ciliopathy.includes('Syndrome')) {
        categories['Secondary'].push(gene)
      } else {
        categories['Atypical'].push(gene)
      }
    })

    return categories
  }

  // Get ciliopathy features data
  async getCiliopathyFeatures(): Promise<CiliopathyFeature[]> {
    try {
      console.log('Loading ciliopathy features...')
      const primarySymptoms = await this.loadDataset('symptome_primary')
      const secondarySymptoms = await this.loadDataset('symptome_secondary')
      
      console.log('Primary symptoms loaded:', primarySymptoms.length)
      console.log('Secondary symptoms loaded:', secondarySymptoms.length)
      
      if (primarySymptoms.length === 0 && secondarySymptoms.length === 0) {
        console.warn('No symptom data loaded!')
        return []
      }
      
      const allSymptoms = [...primarySymptoms, ...secondarySymptoms]
      const features: CiliopathyFeature[] = []
      
      // Transform the data: each row is a clinical feature, and diseases are columns
      allSymptoms.forEach((symptom: any, index: number) => {
        const featureName = symptom['Ciliopathy / Clinical Features']
        const category = symptom['General Titles']
        
        if (index === 0) {
          console.log('Sample symptom data:', symptom)
          console.log('Keys:', Object.keys(symptom))
        }
        
        // Skip the metadata columns and iterate through disease columns
        Object.keys(symptom).forEach(key => {
          if (key !== 'Ciliopathy / Clinical Features' && key !== 'General Titles') {
            const value = symptom[key]
            // Only include if the value is 1.0 or 1 (meaning this disease has this feature)
            // Skip null, undefined, NaN values
            if (value === 1.0 || value === 1) {
              features.push({
                'Ciliopathy / Clinical Features': featureName || '',
                'General Titles': category || '',
                Category: category || '',
                Ciliopathy: key,
                Disease: key,
                Feature: featureName || '',
                Count: 1
              })
            }
          }
        })
      })
      
      console.log(`✅ Loaded ${features.length} clinical features`)
      if (features.length > 0) {
        console.log('Sample feature:', features[0])
      }
      return features
    } catch (error) {
      console.error('❌ Failed to load ciliopathy features:', error)
      return []
    }
  }

  // Get all ortholog data (for filter options)
  async getAllOrthologData(): Promise<OrthologGene[]> {
    try {
      const allOrthologs: OrthologGene[] = []
      
      // Load ortholog data for all organisms
      const organisms = ['mus_musculus', 'danio_rerio', 'xenopus_laevis', 'drosophila_melanogaster', 'caenorhabditis_elegans', 'chlamydomonas_reinhardtii']
      
      for (const organism of organisms) {
        try {
          const orthologs = await this.getOrthologData(organism)
          allOrthologs.push(...orthologs)
        } catch (error) {
          console.error(`Failed to load orthologs for ${organism}:`, error)
        }
      }
      
      return allOrthologs
    } catch (error) {
      console.error('Failed to load all ortholog data:', error)
      return []
    }
  }
}

// Export singleton instance
export const dataService = new DataService()

// Export individual functions for convenience
export const {
  getCiliopathyGenes,
  getGeneNumbers,
  getBarPlotData,
  getOrthologData,
  getSymptomsData,
  getGeneLocalizationData,
  getOrganismStats,
  getPublicationData,
  searchCiliopathyGenes,
  searchGenes,
  getCiliopathiesByCategory,
  getCiliopathyFeatures,
  getAllOrthologData
} = dataService
