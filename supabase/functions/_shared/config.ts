// ============================================
// Central API Configuration for Research Copilot
// ============================================
// This file manages all API keys and configurations
// Add your API keys via Supabase secrets for enhanced rate limits

export const API_CONFIG = {
  // ============================================
  // PubMed E-utilities API
  // Rate: 3 req/sec without key, 10 req/sec with key
  // Get key: https://www.ncbi.nlm.nih.gov/account/
  // ============================================
  pubmed: {
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    apiKey: Deno.env.get('PUBMED_API_KEY') || null,
    email: Deno.env.get('PUBMED_EMAIL') || 'research@example.com',
    get rateLimit() {
      return this.apiKey ? 10 : 3; // requests per second
    },
  },

  // ============================================
  // Semantic Scholar API
  // Rate: 100 req/5min without key, 1 req/sec with key
  // Get key: https://www.semanticscholar.org/product/api
  // ============================================
  semanticScholar: {
    baseUrl: 'https://api.semanticscholar.org/graph/v1',
    apiKey: Deno.env.get('SEMANTIC_SCHOLAR_API_KEY') || null,
    get rateLimit() {
      return this.apiKey ? 60 : 20; // requests per minute
    },
  },

  // ============================================
  // OpenAlex API
  // Rate: 100,000 req/day (no key needed)
  // Polite pool (faster): add email to User-Agent
  // ============================================
  openAlex: {
    baseUrl: 'https://api.openalex.org',
    email: Deno.env.get('OPENALEX_EMAIL') || 'research@example.com',
    rateLimit: 100000, // requests per day
  },

  // ============================================
  // arXiv API
  // Rate: ~1 req/3sec (no key available)
  // ============================================
  arxiv: {
    baseUrl: 'http://export.arxiv.org/api',
    rateLimit: 20, // requests per minute (recommended)
  },

  // ============================================
  // AI Provider Configuration - Cascading Fallback
  // Priority: Groq 70B -> Groq 8B -> Lovable Gateway
  // ============================================
  ai: {
    // Provider configurations
    providers: {
      groq_70b: {
        name: 'Groq Llama 3.3 70B',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: Deno.env.get('GROQ_API_KEY') || '',
        model: 'llama-3.3-70b-versatile',
        complexity: 'high' as const,
      },
      groq_8b: {
        name: 'Groq Llama 3.1 8B',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: Deno.env.get('GROQ_API_KEY') || '',
        model: 'llama-3.1-8b-instant',
        complexity: 'low' as const,
      },
      lovable: {
        name: 'Lovable AI Gateway',
        baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        apiKey: Deno.env.get('LOVABLE_API_KEY') || '',
        model: 'google/gemini-2.5-flash',
        complexity: 'any' as const,
      },
    },
    
    // Priority list for fallback
    priorityList: ['groq_70b', 'groq_8b', 'lovable'] as const,
    
    // Get available providers (those with API keys)
    get availableProviders() {
      return this.priorityList.filter(key => {
        const provider = this.providers[key];
        return !!provider.apiKey;
      });
    },
    
    // Check if any AI is configured
    get isConfigured(): boolean {
      return this.availableProviders.length > 0;
    },
  },
};

// ============================================
// Helper: Build PubMed URL with optional API key
// ============================================
export function buildPubMedUrl(endpoint: string, params: Record<string, string>): string {
  const url = new URL(`${API_CONFIG.pubmed.baseUrl}/${endpoint}`);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  
  if (API_CONFIG.pubmed.apiKey) {
    url.searchParams.append('api_key', API_CONFIG.pubmed.apiKey);
  }
  
  if (API_CONFIG.pubmed.email) {
    url.searchParams.append('email', API_CONFIG.pubmed.email);
  }
  
  return url.toString();
}

// ============================================
// Helper: Get headers for Semantic Scholar
// ============================================
export function getSemanticScholarHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (API_CONFIG.semanticScholar.apiKey) {
    headers['x-api-key'] = API_CONFIG.semanticScholar.apiKey;
  }
  
  return headers;
}

// ============================================
// Helper: Get headers for OpenAlex
// ============================================
export function getOpenAlexHeaders(): Record<string, string> {
  return {
    'User-Agent': `ResearchCopilot/1.0 (mailto:${API_CONFIG.openAlex.email})`,
    'Content-Type': 'application/json',
  };
}

// ============================================
// Helper: Make AI API call with Cascading Fallback
// Tries providers in priority order, skips if missing key
// ============================================
export async function callAI(
  messages: { role: string; content: string }[],
  options?: { 
    model?: string; 
    temperature?: number; 
    maxTokens?: number;
    complexity?: 'high' | 'low';  // 'high' uses 70B first, 'low' uses 8B first
  }
): Promise<{ content: string; error?: string; provider?: string }> {
  const config = API_CONFIG.ai;
  
  if (!config.isConfigured) {
    return { content: '', error: 'No AI provider configured. Please add GROQ_API_KEY or LOVABLE_API_KEY.' };
  }
  
  // Determine priority order based on complexity
  let priorityOrder = [...config.priorityList];
  if (options?.complexity === 'low') {
    // For low complexity, prefer 8B over 70B
    priorityOrder = ['groq_8b', 'groq_70b', 'lovable'];
  }
  
  const errors: string[] = [];
  
  for (const providerKey of priorityOrder) {
    const provider = config.providers[providerKey];
    
    // Skip if no API key
    if (!provider.apiKey) {
      console.log(`[AI] Skipping ${provider.name}: No API key`);
      continue;
    }
    
    const model = options?.model || provider.model;
    
    try {
      console.log(`[AI] Trying ${provider.name} with model ${model}...`);
      
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          ...(options?.temperature !== undefined && { temperature: options.temperature }),
          ...(options?.maxTokens && { max_tokens: options.maxTokens }),
        }),
      });
      
      // Handle rate limits and server errors - try next provider
      if (response.status === 429) {
        console.warn(`[AI] ${provider.name}: Rate limited (429), trying next...`);
        errors.push(`${provider.name}: Rate limited`);
        continue;
      }
      
      if (response.status === 402) {
        console.warn(`[AI] ${provider.name}: Quota exceeded (402), trying next...`);
        errors.push(`${provider.name}: Quota exceeded`);
        continue;
      }
      
      if (response.status >= 500) {
        console.warn(`[AI] ${provider.name}: Server error (${response.status}), trying next...`);
        errors.push(`${provider.name}: Server error ${response.status}`);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] ${provider.name} error:`, errorText);
        errors.push(`${provider.name}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log(`[AI] Success with ${provider.name}`);
      return { content, provider: provider.name };
      
    } catch (error) {
      console.error(`[AI] ${provider.name} exception:`, error);
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      continue;
    }
  }
  
  // All providers failed
  return { 
    content: '', 
    error: `All AI providers failed: ${errors.join('; ')}` 
  };
}

// ============================================
// Environment Variable Reference
// ============================================
// Add these secrets in Supabase Dashboard:
//
// Required (at least one):
// - GROQ_API_KEY         : Free tier at console.groq.com
// - LOVABLE_API_KEY      : Auto-configured by Lovable
//
// Optional (for enhanced features):
// - PUBMED_API_KEY       : Increase rate limit to 10 req/sec
// - PUBMED_EMAIL         : Required for PubMed API key
// - SEMANTIC_SCHOLAR_API_KEY : Get stable 1 req/sec rate
// - OPENALEX_EMAIL       : Access to polite pool (faster)
// ============================================
