import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalRequest {
  topic: string;
  researchQuestions: string[];
  articles: { title: string; abstract: string }[];
  section: 'introduction' | 'literature_review' | 'methodology' | 'objectives' | 'timeline' | 'references' | 'full';
  language?: string;
  previousSections?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, researchQuestions, articles, section, language = 'en', previousSections = {} }: ProposalRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const languageInstructions = {
      en: 'Write in formal academic English.',
      fa: 'Write in formal academic Persian (Farsi).',
      ar: 'Write in formal academic Arabic.',
      tr: 'Write in formal academic Turkish.',
    };

    const langInstruction = languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.en;

    const articlesSummary = articles.slice(0, 10).map((a, i) => `${i + 1}. ${a.title}`).join('\n');

    const sectionPrompts: Record<string, string> = {
      introduction: `Write the Introduction section for a research proposal.

Topic: ${topic}
Research Questions:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Key Literature:
${articlesSummary}

${langInstruction}

Include:
- Background and context
- Problem statement
- Significance of the study
- Research objectives
- Brief overview of methodology

Write in a natural, human style. Vary sentence structure and length. Avoid repetitive patterns.`,

      literature_review: `Write the Literature Review section for a research proposal.

Topic: ${topic}
Previous sections context: ${JSON.stringify(previousSections)}

Relevant articles to cite:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}\nAbstract: ${a.abstract}`).join('\n\n')}

${langInstruction}

Include:
- Theoretical framework
- Review of relevant studies
- Synthesis of findings
- Identification of gaps
- How this study addresses the gaps

Write naturally with varied sentence structure. Cite the provided articles appropriately.`,

      methodology: `Write the Methodology section for a research proposal.

Topic: ${topic}
Research Questions:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${langInstruction}

Include:
- Research design and approach
- Population and sampling
- Data collection methods
- Data analysis procedures
- Ethical considerations
- Limitations

Be specific but adaptable to various research contexts.`,

      objectives: `Write the Objectives and Hypotheses section for a research proposal.

Topic: ${topic}
Research Questions:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${langInstruction}

Include:
- General objective
- Specific objectives (3-5)
- Research hypotheses (if applicable)
- Expected outcomes`,

      timeline: `Create a research timeline/Gantt chart description for a proposal.

Topic: ${topic}

${langInstruction}

Create a realistic 12-month timeline including:
- Literature review phase
- Methodology development
- Data collection
- Data analysis
- Writing and revision
- Submission

Present as a structured timeline with months and activities.`,

      references: `Format these articles as academic references.

Articles:
${articles.map((a, i) => `${i + 1}. Title: ${a.title}`).join('\n\n')}

Format in APA 7th edition style.`,

      full: `Write a complete research proposal outline.

Topic: ${topic}
Research Questions:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

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
7. References

Write naturally and professionally.`,
    };

    const prompt = sectionPrompts[section];
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Invalid section type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating proposal section: ${section}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert academic writer specializing in research proposals. Write in a natural, human style that varies in sentence structure. Avoid repetitive patterns or obvious AI-generated text. Be thorough but concise.' },
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
      throw new Error('Proposal generation failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ content, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Proposal generation error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
