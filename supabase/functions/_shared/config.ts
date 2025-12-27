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
  // AI Provider Configuration
  // Supports: 'lovable' | 'openai' | 'anthropic'
  // Default: Lovable AI Gateway (no setup needed)
  // ============================================
  ai: {
    provider: (Deno.env.get('AI_PROVIDER') || 'lovable') as 'lovable' | 'openai' | 'anthropic',
    
    // Lovable AI Gateway (default)
    lovable: {
      baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
      apiKey: Deno.env.get('LOVABLE_API_KEY') || '',
      defaultModel: 'google/gemini-2.5-flash',
      availableModels: [
        'google/gemini-2.5-flash',
        'google/gemini-2.5-pro',
        'openai/gpt-5',
        'openai/gpt-5-mini',
      ],
    },
    
    // OpenAI (optional)
    openai: {
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: Deno.env.get('OPENAI_API_KEY') || '',
      defaultModel: 'gpt-4o-mini',
      availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-5'],
    },
    
    // Anthropic (optional)
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1/messages',
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
      defaultModel: 'claude-sonnet-4-20250514',
      availableModels: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    },
    
    // Get current provider config
    get current() {
      return this[this.provider];
    },
    
    // Check if AI is properly configured
    get isConfigured(): boolean {
      const currentProvider = this[this.provider];
      return !!currentProvider.apiKey;
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
// Helper: Make AI API call (supports multiple providers)
// ============================================
export async function callAI(
  messages: { role: string; content: string }[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ content: string; error?: string }> {
  const config = API_CONFIG.ai;
  const provider = config.provider;
  const providerConfig = config.current;
  
  if (!providerConfig.apiKey) {
    return { content: '', error: `${provider} API key not configured` };
  }
  
  const model = options?.model || providerConfig.defaultModel;
  
  try {
    if (provider === 'anthropic') {
      // Anthropic has different API format
      const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': providerConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens || 4096,
          messages: messages.filter(m => m.role !== 'system'),
          system: messages.find(m => m.role === 'system')?.content || '',
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Anthropic API error:', error);
        return { content: '', error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      return { content: data.content?.[0]?.text || '' };
    } else {
      // OpenAI and Lovable use the same format
      const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          ...(options?.temperature !== undefined && { temperature: options.temperature }),
          ...(options?.maxTokens && { max_tokens: options.maxTokens }),
        }),
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          return { content: '', error: 'Rate limit exceeded. Please try again later.' };
        }
        if (response.status === 402) {
          return { content: '', error: 'Service quota exceeded. Please try again later.' };
        }
        const error = await response.text();
        console.error(`${provider} API error:`, error);
        return { content: '', error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      return { content: data.choices?.[0]?.message?.content || '' };
    }
  } catch (error) {
    console.error('AI call error:', error);
    return { content: '', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// Environment Variable Reference
// ============================================
// Add these secrets in Supabase Dashboard:
//
// Required:
// - LOVABLE_API_KEY (auto-configured by Lovable)
//
// Optional (for enhanced features):
// - PUBMED_API_KEY      : Increase rate limit to 10 req/sec
// - PUBMED_EMAIL        : Required for PubMed API key
// - SEMANTIC_SCHOLAR_API_KEY : Get stable 1 req/sec rate
// - OPENALEX_EMAIL      : Access to polite pool (faster)
//
// To switch AI provider:
// - AI_PROVIDER         : 'lovable' | 'openai' | 'anthropic'
// - OPENAI_API_KEY      : If using OpenAI
// - ANTHROPIC_API_KEY   : If using Anthropic
// ============================================
