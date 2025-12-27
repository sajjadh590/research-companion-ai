import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";

interface CompareRequest {
  articles: { title: string; abstract: string; authors?: string }[];
  language?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { articles, language = 'en' }: CompareRequest = await req.json();

    // Input validation
    if (!Array.isArray(articles) || articles.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 articles are required' }), {
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
      en: 'Respond in English.',
      fa: 'Respond in Persian (Farsi).',
      ar: 'Respond in Arabic.',
      tr: 'Respond in Turkish.',
    };

    const langInstruction = languageInstructions[language] || languageInstructions.en;

    const prompt = `You are a systematic review expert. Extract and compare key characteristics from these ${articles.length} studies.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAuthors: ${a.authors || 'N/A'}\nAbstract: ${a.abstract}`).join('\n\n')}

For EACH study, extract the following in a structured JSON format:
- title: Short title (max 50 chars)
- population: Study population/participants
- intervention: Main intervention or exposure
- comparison: Control/comparison group
- outcome: Primary outcomes measured
- design: Study design (RCT, cohort, cross-sectional, etc.)
- sampleSize: Number of participants (use "NR" if not reported)
- keyFindings: Main findings in 1-2 sentences

Return ONLY a valid JSON array with objects for each study.`;

    console.log(`User ${user.id} comparing ${articles.length} studies`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a systematic review expert. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
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
      return new Response(JSON.stringify({ error: 'Comparison failed. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let resultText = data.choices?.[0]?.message?.content || '[]';
    
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }
    
    let comparison;
    try {
      comparison = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse comparison JSON');
      comparison = [];
    }

    console.log('Study comparison completed successfully');

    return new Response(JSON.stringify({ comparison }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Comparison failed. Please try again.');
  }
});
