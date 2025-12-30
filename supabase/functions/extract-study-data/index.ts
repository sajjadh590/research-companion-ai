import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedStudy {
  studyName: string;
  sampleSizeControl: number | null;
  sampleSizeIntervention: number | null;
  meanControl: number | null;
  meanIntervention: number | null;
  sdControl: number | null;
  sdIntervention: number | null;
  effectSize: number | null;
  standardError: number | null;
  eventsControl: number | null;
  eventsIntervention: number | null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, tables, language = 'en' } = await req.json();

    if (!text && (!tables || tables.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'No content to analyze' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-study-data] Processing document with ${text?.length || 0} chars, ${tables?.length || 0} tables`);

    const systemPrompt = `You are a precise data extraction expert specializing in meta-analysis research papers. 
Extract statistical data from research documents with high accuracy.

IMPORTANT RULES:
1. Only extract data that is CLEARLY stated in the document
2. Use null for any values that are not explicitly provided
3. For study names, use "Author(s) Year" format (e.g., "Smith et al. 2024")
4. Look for data in tables first, then in text
5. Common locations: Results section, Tables showing group comparisons
6. Convert all effect sizes to the same direction if possible

Return a JSON array of extracted studies.`;

    const userPrompt = `Extract meta-analysis data from this research document.

${tables && tables.length > 0 ? `TABLES FOUND:\n${tables.join('\n\n')}` : ''}

DOCUMENT TEXT:
${text?.slice(0, 15000) || 'No text extracted'}

Return ONLY a valid JSON array with this structure:
[
  {
    "studyName": "Author et al. Year",
    "sampleSizeControl": number or null,
    "sampleSizeIntervention": number or null,
    "meanControl": number or null,
    "meanIntervention": number or null,
    "sdControl": number or null,
    "sdIntervention": number or null,
    "effectSize": number or null (if pre-calculated),
    "standardError": number or null,
    "eventsControl": number or null (for binary outcomes),
    "eventsIntervention": number or null (for binary outcomes)
  }
]

If multiple studies are reported, extract each one separately.
If this is a single study, extract its data as one entry.
If no extractable data is found, return an empty array [].`;

    // Use high complexity for accurate extraction
    const result = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { complexity: 'high', temperature: 0.1, maxTokens: 4000 }
    );

    if (result.error) {
      console.error('[extract-study-data] AI error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-study-data] AI response from ${result.provider}`);

    // Parse the JSON response
    let studies: ExtractedStudy[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = result.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Try to find array in response
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
      
      studies = JSON.parse(jsonStr);
      
      // Validate structure
      if (!Array.isArray(studies)) {
        studies = [studies];
      }
      
      // Clean up and validate each study
      studies = studies.map(study => ({
        studyName: study.studyName || 'Unknown Study',
        sampleSizeControl: parseNumOrNull(study.sampleSizeControl),
        sampleSizeIntervention: parseNumOrNull(study.sampleSizeIntervention),
        meanControl: parseNumOrNull(study.meanControl),
        meanIntervention: parseNumOrNull(study.meanIntervention),
        sdControl: parseNumOrNull(study.sdControl),
        sdIntervention: parseNumOrNull(study.sdIntervention),
        effectSize: parseNumOrNull(study.effectSize),
        standardError: parseNumOrNull(study.standardError),
        eventsControl: parseNumOrNull(study.eventsControl),
        eventsIntervention: parseNumOrNull(study.eventsIntervention),
      }));
      
    } catch (parseError) {
      console.error('[extract-study-data] Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse extracted data',
          rawResponse: result.content.slice(0, 500)
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-study-data] Extracted ${studies.length} studies`);

    return new Response(
      JSON.stringify({ 
        studies,
        provider: result.provider,
        count: studies.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-study-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}
