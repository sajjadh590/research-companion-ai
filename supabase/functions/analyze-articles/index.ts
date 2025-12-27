import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";

interface AnalyzeRequest {
  type: 'summarize' | 'unified_summary' | 'research_gaps' | 'pico' | 'risk_of_bias' | 'key_findings';
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
    const { type, articles, language = 'en' }: AnalyzeRequest = await req.json();

    // Input validation
    if (!type || !['summarize', 'unified_summary', 'research_gaps', 'pico', 'risk_of_bias', 'key_findings'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid analysis type' }), {
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

    if (articles.length > 50) {
      return new Response(JSON.stringify({ error: 'Maximum 50 articles allowed' }), {
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

    const prompts: Record<string, string> = {
      summarize: `You are a research assistant. Provide a brief summary for EACH of these academic articles separately.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

For each article, provide:
- A 2-3 sentence summary of the main findings
- The key methodology used
- The main conclusion`,

      unified_summary: `You are a research synthesis expert. Analyze ALL these academic articles TOGETHER and provide ONE comprehensive, unified synthesis.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

Provide a UNIFIED analysis that:
1. Identifies the overarching themes and patterns across ALL studies
2. Synthesizes the collective findings into a coherent narrative
3. Highlights areas of consensus and divergence between studies
4. Summarizes the combined methodological approaches
5. Draws integrated conclusions based on the entire body of evidence
6. Identifies the overall contribution to the field

Do NOT summarize each article separately. Instead, weave them together into one cohesive synthesis.`,

      research_gaps: `You are a research methodology expert. Analyze these articles to identify research gaps.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

Identify:
1. Unexplored or under-researched aspects
2. Methodological limitations in current studies
3. Populations or contexts not studied
4. Suggested future research directions
5. Specific research questions that remain unanswered`,

      pico: `You are a systematic review expert. Extract PICO elements from these articles.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

For each article, extract:
- P (Population): Who was studied?
- I (Intervention): What intervention or exposure?
- C (Comparison): What was the comparison group?
- O (Outcome): What outcomes were measured?

Format as a structured JSON array.`,

      risk_of_bias: `You are a methodological quality assessor. Evaluate potential biases in these studies.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

Assess each study for:
1. Selection bias (randomization, allocation)
2. Performance bias (blinding)
3. Detection bias (outcome assessment)
4. Attrition bias (incomplete data)
5. Reporting bias (selective reporting)
6. Overall quality rating (Low/Moderate/High risk)`,

      key_findings: `You are a research analyst. Extract key findings from these articles.

${langInstruction}

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

For each article, extract:
1. Primary finding/conclusion
2. Statistical results mentioned (if any)
3. Effect sizes or key numbers
4. Clinical/practical significance
5. Limitations acknowledged`,
    };

    const prompt = prompts[type];

    console.log(`Analyzing ${articles.length} articles with type: ${type}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert academic research assistant with deep knowledge of systematic reviews, meta-analyses, and research methodology.' },
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
      return new Response(JSON.stringify({ error: 'Analysis failed. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    console.log('Analysis completed successfully');

    return new Response(JSON.stringify({ result, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Analysis failed. Please try again.');
  }
});
