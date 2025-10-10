import { 
  CiliopathyGene, 
  OrthologGene, 
  CiliopathyFeature, 
  GeneNumber, 
  BarPlotData, 
  PublicationData,
  HeatmapData
} from '@/types'

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

class DataService {
  private dataIndex: DataIndex | null = null
  private dataCache: Map<string, any> = new Map()

  async loadDataIndex(): Promise<DataIndex> {
    if (this.dataIndex) return this.dataIndex
    
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch('/data/data_index.json', {
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
      
      const response = await fetch(`/data/${datasetName}.json`, {
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

  // Load ciliopathy genes data
  async getCiliopathyGenes(): Promise<CiliopathyGene[]> {
    const data = await this.loadDataset('homosapiens_ciliopathy')
    return data.map((item: any) => ({
      Ciliopathy: item.Ciliopathy,
      'Human Gene Name': item['Human Gene Name'],
      'Subcellular Localization': item['Subcellular Localization'],
      'Gene MIM Number': item['Gene MIM Number'],
      'OMIM Phenotype Number': item['OMIM Phenotype Number'],
      'Human Gene ID': item['Human Gene ID'],
      'Disease/Gene Reference': item['Disease/Gene Reference'],
      'Localisation Reference': item['Localisation Reference'],
      'Gene Localisation': item['Subcellular Localization'],
      Abbreviation: item.Abbreviation,
      Synonym: item.Synonym
    }))
  }

  // Load gene numbers for pie chart
  async getGeneNumbers(): Promise<GeneNumber[]> {
    const data = await this.loadDataset('gene_numbers_d')
    return data.map((item: any) => ({
      Disease: item.Disease,
      Gene_numbers: item.Gene_numbers
    }))
  }

  // Load bar plot data
  async getBarPlotData(): Promise<BarPlotData[]> {
    const data = await this.loadDataset('bar_plot')
    return data.map((item: any) => ({
      name: item.Ciliary_Localisation,
      value: item.Gene_number
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
    const genes = await this.getCiliopathyGenes()
    const lowerQuery = query.toLowerCase()
    
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
