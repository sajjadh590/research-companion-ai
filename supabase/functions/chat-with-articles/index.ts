import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";
import { API_CONFIG, callAI } from "../_shared/config.ts";

interface ChatRequest {
  question: string;
  articles: { title: string; abstract: string; authors?: string; journal?: string; year?: string }[];
  history?: { role: 'user' | 'assistant'; content: string }[];
  language?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Public endpoint - no authentication required
    const { question, articles, history = [], language = 'en' }: ChatRequest = await req.json();

    // Input validation
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (question.length > 2000) {
      return new Response(JSON.stringify({ error: 'Question too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one article is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (articles.length > 20) {
      return new Response(JSON.stringify({ error: 'Maximum 20 articles allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if AI is configured (supports cascading providers)
    if (!API_CONFIG.ai.isConfigured) {
      console.error('No AI provider configured');
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const languageInstructions: Record<string, string> = {
      en: 'You MUST respond in English.',
      fa: 'شما باید به زبان فارسی پاسخ دهید. You MUST respond in Persian (Farsi).',
      ar: 'يجب أن تجيب باللغة العربية. You MUST respond in Arabic.',
      tr: 'Türkçe yanıt vermelisiniz. You MUST respond in Turkish.',
    };

    const langInstruction = languageInstructions[language] || 'Respond in the same language as the user\'s question.';

    const articlesContext = articles.map((a, i) => 
      `[${i + 1}] "${a.title}"${a.authors ? ` by ${a.authors}` : ''}${a.journal ? ` (${a.journal}` : ''}${a.year ? `, ${a.year}` : ''}${a.journal ? ')' : ''}\nAbstract: ${a.abstract || 'Not available'}`
    ).join('\n\n');

    const systemPrompt = `You are an expert research assistant with deep knowledge of academic literature analysis. 
You have access to the following ${articles.length} academic articles:

${articlesContext}

${langInstruction}

Your role is to:
- Answer questions about these articles accurately
- Compare and contrast findings across studies
- Identify methodological approaches
- Synthesize information from multiple sources
- Provide citations when referencing specific articles (e.g., [1], [2])
- Be honest when information is not available in the provided articles

Keep responses concise but informative. Use the article numbers in brackets when citing.`;

    // Build messages array with history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question }
    ];

    console.log(`Chat with ${articles.length} articles`);

    // Use centralized AI caller with cascading fallback (low complexity for chat)
    const { content: responseText, error, provider } = await callAI(messages, { complexity: 'low' });
    if (provider) console.log(`Used provider: ${provider}`);

    if (error) {
      console.error('AI chat error:', error);
      const status = error.includes('Rate limit') ? 429 : error.includes('quota') ? 402 : 500;
      return new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Chat failed. Please try again.');
  }
});
