import Fuse from 'fuse.js'
import { CiliopathyGene, OrthologGene, CiliopathyFeature } from '@/types'

// Search configuration for Fuse.js
const fuseOptions = {
  threshold: 0.3,
  keys: [
    'Human Gene Name',
    'Ciliopathy',
    'Subcellular Localization',
    'Gene MIM Number',
    'OMIM Phenotype Number'
  ]
}

export class CiliaMinerSearch {
  private geneFuse: Fuse<CiliopathyGene>
  private orthologFuse: Fuse<OrthologGene>
  private featureFuse: Fuse<CiliopathyFeature>

  constructor(
    genes: CiliopathyGene[],
    orthologs: OrthologGene[],
    features: CiliopathyFeature[]
  ) {
    this.geneFuse = new Fuse(genes, fuseOptions)
    this.orthologFuse = new Fuse(orthologs, {
      ...fuseOptions,
      keys: [
        'Human Gene Name',
        'Human Disease',
        'Ortholog Gene Name',
        'Organism'
      ]
    })
    this.featureFuse = new Fuse(features, {
      ...fuseOptions,
      keys: ['Ciliopathy', 'Feature', 'Category']
    })
  }

  searchGenes(query: string): CiliopathyGene[] {
    if (!query.trim()) return []
    return this.geneFuse.search(query).map(result => result.item)
  }

  searchOrthologs(query: string): OrthologGene[] {
    if (!query.trim()) return []
    return this.orthologFuse.search(query).map(result => result.item)
  }

  searchFeatures(query: string): CiliopathyFeature[] {
    if (!query.trim()) return []
    return this.featureFuse.search(query).map(result => result.item)
  }

  searchAll(query: string): {
    genes: CiliopathyGene[]
    orthologs: OrthologGene[]
    features: CiliopathyFeature[]
  } {
    return {
      genes: this.searchGenes(query),
      orthologs: this.searchOrthologs(query),
      features: this.searchFeatures(query)
    }
  }

  // Advanced search with filters
  searchGenesAdvanced(
    query: string,
    filters: {
      ciliopathy?: string
      localization?: string
      organism?: string
    }
  ): CiliopathyGene[] {
    let results = this.searchGenes(query)
    
    if (filters.ciliopathy) {
      results = results.filter(gene => 
        gene.Ciliopathy.toLowerCase().includes(filters.ciliopathy!.toLowerCase())
      )
    }
    
    if (filters.localization) {
      results = results.filter(gene => 
        gene['Subcellular Localization'].toLowerCase().includes(filters.localization!.toLowerCase())
      )
    }
    
    return results
  }

  // Get suggestions for autocomplete
  getSuggestions(query: string, type: 'gene' | 'ciliopathy' | 'feature'): string[] {
    if (!query.trim()) return []
    
    const suggestions = new Set<string>()
    
    switch (type) {
      case 'gene':
        this.searchGenes(query).forEach(gene => {
          suggestions.add(gene['Human Gene Name'])
          suggestions.add(gene.Ciliopathy)
        })
        break
      case 'ciliopathy':
        this.searchFeatures(query).forEach(feature => {
          suggestions.add(feature.Ciliopathy)
        })
        break
      case 'feature':
        this.searchFeatures(query).forEach(feature => {
          suggestions.add(feature.Feature)
          suggestions.add(feature.Category)
        })
        break
    }
    
    return Array.from(suggestions).slice(0, 10)
  }
}

// Helper function to create search instance
export function createSearchInstance(
  genes: CiliopathyGene[],
  orthologs: OrthologGene[],
  features: CiliopathyFeature[]
): CiliaMinerSearch {
  return new CiliaMinerSearch(genes, orthologs, features)
}
