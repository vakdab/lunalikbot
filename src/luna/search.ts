import { Logger } from '../utils/logger';

export interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface SearchConfig {
  apiKey?: string;
  location?: string;
  language?: string;
  country?: string;
  googleDomain?: string;
}

export class SerpApiSearchService {
  constructor(private readonly config: SearchConfig) {}

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    if (!this.config.apiKey) return [];

    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      api_key: this.config.apiKey,
      num: String(Math.min(Math.max(limit, 1), 10)),
      location: this.config.location || 'Ukraine',
      hl: this.config.language || 'uk',
      gl: this.config.country || 'ua',
      google_domain: this.config.googleDomain || 'google.com.ua',
    });

    try {
      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!response.ok) {
        Logger.warn(`SerpAPI returned HTTP ${response.status}`);
        return [];
      }

      const data = await response.json() as any;
      return (data.organic_results || [])
        .slice(0, limit)
        .map((item: any) => ({
          title: typeof item.title === 'string' ? item.title : '',
          link: typeof item.link === 'string' ? item.link : '',
          snippet: typeof item.snippet === 'string' ? item.snippet : undefined,
        }))
        .filter((item: SearchResult) => item.title && item.link);
    } catch (err) {
      Logger.error('SerpAPI search failed', err);
      return [];
    }
  }
}
