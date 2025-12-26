import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompareRequest {
  articles: { title: string; abstract: string; authors?: string }[];
  language?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articles, language = 'en' }: CompareRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

Return ONLY a valid JSON array with objects for each study. Example format:
[
  {
    "title": "Short study title",
    "population": "Adults with diabetes",
    "intervention": "Exercise program",
    "comparison": "Standard care",
    "outcome": "HbA1c levels",
    "design": "RCT",
    "sampleSize": "150",
    "keyFindings": "Significant reduction in HbA1c"
  }
]`;

    console.log(`Comparing ${articles.length} studies`);

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
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI comparison failed');
    }

    const data = await response.json();
    let resultText = data.choices?.[0]?.message?.content || '[]';
    
    // Clean up the response to extract JSON
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }
    
    let comparison;
    try {
      comparison = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse comparison JSON:', resultText);
      comparison = [];
    }

    console.log('Study comparison completed successfully');

    return new Response(JSON.stringify({ comparison }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Comparison error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
