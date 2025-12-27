import { supabase } from '@/integrations/supabase/client';
import type { Article } from '@/types/research';

// Client-side cache for search results (free, no server cost)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const searchCache = new Map<string, { data: { articles: Article[] }; timestamp: number }>();

function getCacheKey(params: SearchParams): string {
  return JSON.stringify({
    query: params.query,
    sources: params.sources.sort(),
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    maxResults: params.maxResults,
    openAccessOnly: params.openAccessOnly
  });
}

function getFromCache(key: string): { articles: Article[] } | null {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  searchCache.delete(key);
  return null;
}

function setCache(key: string, data: { articles: Article[] }): void {
  // Limit cache size to prevent memory issues
  if (searchCache.size > 50) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
}

interface SearchParams {
  query: string;
  sources: string[];
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;
  openAccessOnly?: boolean;
}

interface AnalyzeParams {
  type: 'summarize' | 'unified_summary' | 'research_gaps' | 'pico' | 'risk_of_bias' | 'key_findings';
  articles: { title: string; abstract: string }[];
  language?: string;
}

interface ProposalParams {
  topic: string;
  researchQuestions: string[];
  articles: { title: string; abstract: string }[];
  section: 'introduction' | 'literature_review' | 'methodology' | 'objectives' | 'timeline' | 'references' | 'full';
  language?: string;
  previousSections?: Record<string, string>;
}

export async function searchArticles(params: SearchParams): Promise<{ articles: Article[]; error?: string }> {
  // Check cache first
  const cacheKey = getCacheKey(params);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('Returning cached search results');
    return cached;
  }

  const { data, error } = await supabase.functions.invoke('search-articles', {
    body: params,
  });

  if (error) {
    console.error('Search error:', error);
    return { articles: [], error: error.message };
  }

  // Cache successful results
  if (data && !data.error) {
    setCache(cacheKey, data);
  }

  return data;
}

export async function analyzeArticles(params: AnalyzeParams): Promise<{ result: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('analyze-articles', {
    body: params,
  });

  if (error) {
    console.error('Analysis error:', error);
    return { result: '', error: error.message };
  }

  return data;
}

export async function generateProposal(params: ProposalParams): Promise<{ content: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('generate-proposal', {
    body: params,
  });

  if (error) {
    console.error('Proposal generation error:', error);
    return { content: '', error: error.message };
  }

  return data;
}
