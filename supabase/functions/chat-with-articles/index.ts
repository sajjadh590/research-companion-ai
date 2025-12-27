import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
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

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question }
    ];

    console.log(`Chat with ${articles.length} articles`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Service quota exceeded. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('AI gateway error:', response.status);
      return new Response(JSON.stringify({ error: 'Chat failed. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Chat failed. Please try again.');
  }
});
