import { supabase } from '@/integrations/supabase/client';
import type { Article } from '@/types/research';

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
  const { data, error } = await supabase.functions.invoke('search-articles', {
    body: params,
  });

  if (error) {
    console.error('Search error:', error);
    return { articles: [], error: error.message };
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
