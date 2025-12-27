import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";
import { API_CONFIG, callAI } from "../_shared/config.ts";

interface ProposalRequest {
  topic: string;
  researchQuestions: string[];
  articles: { title: string; abstract: string }[];
  section: 'introduction' | 'literature_review' | 'methodology' | 'objectives' | 'timeline' | 'references' | 'full';
  language?: string;
  previousSections?: Record<string, string>;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Public endpoint - no authentication required
    const { topic, researchQuestions, articles, section, language = 'en', previousSections = {} }: ProposalRequest = await req.json();

    // Input validation
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'Topic is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (topic.length > 500) {
      return new Response(JSON.stringify({ error: 'Topic too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validSections = ['introduction', 'literature_review', 'methodology', 'objectives', 'timeline', 'references', 'full'];
    if (!section || !validSections.includes(section)) {
      return new Response(JSON.stringify({ error: 'Invalid section type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (articles && articles.length > 30) {
      return new Response(JSON.stringify({ error: 'Maximum 30 articles allowed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if AI is configured (supports multiple providers)
    if (!API_CONFIG.ai.isConfigured) {
      console.error(`AI provider (${API_CONFIG.ai.provider}) not configured`);
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const languageInstructions: Record<string, string> = {
      en: 'Write in formal academic English.',
      fa: 'Write in formal academic Persian (Farsi).',
      ar: 'Write in formal academic Arabic.',
      tr: 'Write in formal academic Turkish.',
    };

    const langInstruction = languageInstructions[language] || languageInstructions.en;

    const articlesSummary = (articles || []).slice(0, 10).map((a, i) => `${i + 1}. ${a.title}`).join('\n');
    const questionsFormatted = (researchQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n');

    const sectionPrompts: Record<string, string> = {
      introduction: `Write the Introduction section for a research proposal.

Topic: ${topic}
Research Questions:
${questionsFormatted}

Key Literature:
${articlesSummary}

${langInstruction}

Include:
- Background and context
- Problem statement
- Significance of the study
- Research objectives
- Brief overview of methodology

Write in a natural, human style.`,

      literature_review: `Write the Literature Review section for a research proposal.

Topic: ${topic}
Previous sections context: ${JSON.stringify(previousSections)}

Relevant articles to cite:
${(articles || []).map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

${langInstruction}

Include:
- Theoretical framework
- Review of relevant studies
- Synthesis of findings
- Identification of gaps
- How this study addresses the gaps`,

      methodology: `Write the Methodology section for a research proposal.

Topic: ${topic}
Research Questions:
${questionsFormatted}

${langInstruction}

Include:
- Research design and approach
- Population and sampling
- Data collection methods
- Data analysis procedures
- Ethical considerations
- Limitations`,

      objectives: `Write the Objectives and Hypotheses section for a research proposal.

Topic: ${topic}
Research Questions:
${questionsFormatted}

${langInstruction}

Include:
- General objective
- Specific objectives (3-5)
- Research hypotheses (if applicable)
- Expected outcomes`,

      timeline: `Create a research timeline for a proposal.

Topic: ${topic}

${langInstruction}

Create a realistic 12-month timeline including:
- Literature review phase
- Methodology development
- Data collection
- Data analysis
- Writing and revision
- Submission`,

      references: `Format these articles as academic references.

Articles:
${(articles || []).map((a, i) => `${i + 1}. Title: ${a.title}`).join('\n\n')}

Format in APA 7th edition style.`,

      full: `Write a complete research proposal outline.

Topic: ${topic}
Research Questions:
${questionsFormatted}

Key Literature:
${articlesSummary}

${langInstruction}

Include all major sections with brief content for each:
1. Introduction
2. Literature Review
3. Research Objectives
4. Methodology
5. Expected Outcomes
6. Timeline
7. References`,
    };

    const prompt = sectionPrompts[section];

    console.log(`Generating proposal section: ${section} using ${API_CONFIG.ai.provider}`);

    // Use centralized AI caller (supports Lovable, OpenAI, Anthropic)
    const { content, error } = await callAI([
      { role: 'system', content: 'You are an expert academic writer specializing in research proposals.' },
      { role: 'user', content: prompt }
    ]);

    if (error) {
      console.error('AI proposal error:', error);
      const status = error.includes('Rate limit') ? 429 : error.includes('quota') ? 402 : 500;
      return new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Proposal section generated successfully');

    return new Response(JSON.stringify({ content, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Generation failed. Please try again.');
  }
});
