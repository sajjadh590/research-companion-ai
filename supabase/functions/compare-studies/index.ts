import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";
import { API_CONFIG, callAI } from "../_shared/config.ts";

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
    // Public endpoint - no authentication required
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

    // Check if AI is configured (supports cascading providers)
    if (!API_CONFIG.ai.isConfigured) {
      console.error('No AI provider configured');
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

    console.log(`Comparing ${articles.length} studies`);

    // Use centralized AI caller with cascading fallback
    const { content: resultText, error, provider } = await callAI([
      { role: 'system', content: 'You are a systematic review expert. Return only valid JSON arrays.' },
      { role: 'user', content: prompt }
    ], { complexity: 'high' });
    if (provider) console.log(`Used provider: ${provider}`);

    if (error) {
      console.error('AI comparison error:', error);
      const status = error.includes('Rate limit') ? 429 : error.includes('quota') ? 402 : 500;
      return new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON from response
    let comparison;
    try {
      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      comparison = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
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
