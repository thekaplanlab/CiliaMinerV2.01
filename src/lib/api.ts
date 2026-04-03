/**
 * API client configuration for CiliaMiner backend.
 */

// API base URL - defaults to localhost for development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Check if the backend API is available.
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch data from the backend API.
 */
export async function fetchFromAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * POST data to the backend API.
 */
export async function postToAPI<T>(
  endpoint: string,
  data: any
): Promise<T> {
  return fetchFromAPI<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * API endpoint helpers
 */
export const api = {
  baseUrl: API_BASE_URL,
  
  // Genes
  genes: {
    search: (query: string, page = 1, limit = 50) => 
      fetchFromAPI<any>(`/api/genes/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`),
    getAll: (page = 1, limit = 50) => 
      fetchFromAPI<any>(`/api/genes?page=${page}&limit=${limit}`),
    suggestions: (query: string, limit = 10) => 
      fetchFromAPI<{suggestions: string[]}>(`/api/genes/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`),
    diseases: () => 
      fetchFromAPI<{diseases: string[]}>('/api/genes/diseases'),
    localizations: () => 
      fetchFromAPI<{localizations: string[]}>('/api/genes/localizations'),
  },
  
  // Orthologs
  orthologs: {
    search: (query: string, organism?: string, page = 1, limit = 50) => {
      let url = `/api/orthologs/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
      if (organism) url += `&organism=${encodeURIComponent(organism)}`;
      return fetchFromAPI<any>(url);
    },
    byOrganism: (organism: string, page = 1, limit = 50) => 
      fetchFromAPI<any>(`/api/orthologs/${organism}?page=${page}&limit=${limit}`),
    organisms: () => 
      fetchFromAPI<{organisms: any[]}>('/api/orthologs/organisms'),
  },
  
  // Features
  features: {
    search: (query: string, searchType = 'disease', page = 1, limit = 50) => 
      fetchFromAPI<any>(`/api/features/search?q=${encodeURIComponent(query)}&search_type=${searchType}&page=${page}&limit=${limit}`),
    byDisease: (disease: string, page = 1, limit = 50) => 
      fetchFromAPI<any>(`/api/features/by-disease/${encodeURIComponent(disease)}?page=${page}&limit=${limit}`),
    suggestions: (query: string, limit = 10) => 
      fetchFromAPI<{suggestions: string[]}>(`/api/features/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`),
    diseases: () => 
      fetchFromAPI<{diseases: string[]}>('/api/features/diseases'),
    categories: () => 
      fetchFromAPI<{categories: string[]}>('/api/features/categories'),
  },
  
  // Statistics
  stats: {
    getAll: () => fetchFromAPI<any>('/api/stats'),
    summary: () => fetchFromAPI<any>('/api/stats/summary'),
    geneNumbers: () => fetchFromAPI<any>('/api/stats/charts/gene-numbers'),
    barPlot: () => fetchFromAPI<any>('/api/stats/charts/bar-plot'),
    publications: () => fetchFromAPI<any>('/api/stats/charts/publications'),
    topGenes: (limit = 10) => fetchFromAPI<any>(`/api/stats/charts/top-genes?limit=${limit}`),
    organisms: () => fetchFromAPI<any>('/api/stats/organisms'),
  },
  
  // Submissions
  submissions: {
    submit: (data: any) => postToAPI<any>('/api/submissions', data),
    get: (id: string) => fetchFromAPI<any>(`/api/submissions/${id}`),
  },
  
  // Export
  export: {
    genes: (format: 'csv' | 'json' = 'json') => 
      `${API_BASE_URL}/api/export/genes?format=${format}`,
    orthologs: (format: 'csv' | 'json' = 'json', organism?: string) => {
      let url = `${API_BASE_URL}/api/export/orthologs?format=${format}`;
      if (organism) url += `&organism=${encodeURIComponent(organism)}`;
      return url;
    },
    features: (format: 'csv' | 'json' = 'json') => 
      `${API_BASE_URL}/api/export/features?format=${format}`,
    publications: (format: 'csv' | 'json' = 'json') => 
      `${API_BASE_URL}/api/export/publications?format=${format}`,
  },
};

export default api;

