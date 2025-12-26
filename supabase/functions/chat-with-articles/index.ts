import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  question: string;
  articles: { title: string; abstract: string; authors?: string; journal?: string; year?: string }[];
  history?: { role: 'user' | 'assistant'; content: string }[];
  language?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, articles, history = [], language = 'en' }: ChatRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question }
    ];

    console.log(`Chat with ${articles.length} articles, question: ${question.substring(0, 50)}...`);

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
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI chat failed');
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
