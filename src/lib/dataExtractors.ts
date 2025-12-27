/**
 * Client-side Data Extractors
 * Extract numbers, effect sizes, sample sizes from text using regex patterns
 * LLM only validates/confirms - code does the extraction
 */

export interface ExtractedNumber {
  value: number;
  context: string;
  type: 'sample_size' | 'effect_size' | 'p_value' | 'ci' | 'percentage' | 'generic';
  confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedEffectSize {
  type: 'cohen_d' | 'hedges_g' | 'odds_ratio' | 'risk_ratio' | 'hazard_ratio' | 'mean_difference' | 'correlation';
  value: number;
  ci?: { lower: number; upper: number };
  pValue?: number;
  context: string;
}

export interface ExtractedSampleSize {
  total?: number;
  treatment?: number;
  control?: number;
  context: string;
}

/**
 * Extract sample sizes from text
 * Patterns: N=45, n = 100, sample of 200, 150 participants, enrolled 50 patients
 */
export function extractSampleSizes(text: string): ExtractedSampleSize[] {
  const results: ExtractedSampleSize[] = [];
  
  // Common patterns for sample sizes
  const patterns = [
    // N = 123 or n=123
    /\b[Nn]\s*[=:]\s*(\d+)/g,
    // "sample of 123" or "sample size of 123"
    /sample(?:\s+size)?\s+(?:of\s+)?(\d+)/gi,
    // "123 participants/patients/subjects"
    /(\d+)\s+(?:participants?|patients?|subjects?|individuals?)/gi,
    // "enrolled 123" or "recruited 123"
    /(?:enrolled|recruited|included)\s+(\d+)/gi,
    // "total of 123"
    /total\s+(?:of\s+)?(\d+)/gi,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseInt(match[1], 10);
      if (value > 0 && value < 1000000) { // Reasonable range
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const context = text.slice(start, end);
        
        results.push({
          total: value,
          context: context.trim(),
        });
      }
    }
  });
  
  // Look for treatment/control group sizes
  const groupPattern = /(\d+)\s+(?:in\s+(?:the\s+)?)?(?:treatment|intervention|experimental)\s+(?:group|arm)[\s\S]{0,50}?(\d+)\s+(?:in\s+(?:the\s+)?)?(?:control|placebo|comparison)/gi;
  let groupMatch;
  while ((groupMatch = groupPattern.exec(text)) !== null) {
    results.push({
      treatment: parseInt(groupMatch[1], 10),
      control: parseInt(groupMatch[2], 10),
      total: parseInt(groupMatch[1], 10) + parseInt(groupMatch[2], 10),
      context: groupMatch[0],
    });
  }
  
  return results;
}

/**
 * Extract effect sizes from text
 * Patterns: d = 0.5, Cohen's d = 0.8, OR 2.3 (95% CI 1.2-4.5), RR = 1.5
 */
export function extractEffectSizes(text: string): ExtractedEffectSize[] {
  const results: ExtractedEffectSize[] = [];
  
  // Cohen's d or Hedges' g
  const dPattern = /(?:cohen'?s?\s*)?[dg]\s*[=:]\s*(-?\d+\.?\d*)/gi;
  let match;
  while ((match = dPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && Math.abs(value) < 10) {
      const context = getContext(text, match.index, 50);
      const ciMatch = extractCIFromContext(text.slice(match.index, match.index + 100));
      const pMatch = extractPValueFromContext(text.slice(match.index, match.index + 100));
      
      results.push({
        type: match[0].toLowerCase().includes('g') ? 'hedges_g' : 'cohen_d',
        value,
        ci: ciMatch,
        pValue: pMatch,
        context,
      });
    }
  }
  
  // Odds Ratio: OR = 2.3 or OR 2.3 (95% CI 1.2-4.5)
  const orPattern = /\bOR\s*[=:]?\s*(\d+\.?\d*)\s*(?:\(?\s*95%?\s*CI[:\s]*(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)\)?)?/gi;
  while ((match = orPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && value > 0 && value < 1000) {
      results.push({
        type: 'odds_ratio',
        value,
        ci: match[2] && match[3] ? { lower: parseFloat(match[2]), upper: parseFloat(match[3]) } : undefined,
        pValue: extractPValueFromContext(text.slice(match.index, match.index + 100)),
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  // Risk Ratio / Relative Risk: RR = 1.5
  const rrPattern = /\bRR\s*[=:]?\s*(\d+\.?\d*)\s*(?:\(?\s*95%?\s*CI[:\s]*(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)\)?)?/gi;
  while ((match = rrPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && value > 0 && value < 1000) {
      results.push({
        type: 'risk_ratio',
        value,
        ci: match[2] && match[3] ? { lower: parseFloat(match[2]), upper: parseFloat(match[3]) } : undefined,
        pValue: extractPValueFromContext(text.slice(match.index, match.index + 100)),
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  // Hazard Ratio: HR = 0.7
  const hrPattern = /\bHR\s*[=:]?\s*(\d+\.?\d*)\s*(?:\(?\s*95%?\s*CI[:\s]*(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)\)?)?/gi;
  while ((match = hrPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && value > 0 && value < 1000) {
      results.push({
        type: 'hazard_ratio',
        value,
        ci: match[2] && match[3] ? { lower: parseFloat(match[2]), upper: parseFloat(match[3]) } : undefined,
        pValue: extractPValueFromContext(text.slice(match.index, match.index + 100)),
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  // Mean Difference: MD = -2.3 or mean difference of 5.2
  const mdPattern = /(?:\bMD\s*[=:]?\s*(-?\d+\.?\d*)|mean\s+difference\s+(?:of\s+)?(-?\d+\.?\d*))/gi;
  while ((match = mdPattern.exec(text)) !== null) {
    const value = parseFloat(match[1] || match[2]);
    if (!isNaN(value)) {
      results.push({
        type: 'mean_difference',
        value,
        ci: extractCIFromContext(text.slice(match.index, match.index + 100)),
        pValue: extractPValueFromContext(text.slice(match.index, match.index + 100)),
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  // Correlation: r = 0.65
  const rPattern = /\br\s*[=:]\s*(-?\d+\.?\d*)/gi;
  while ((match = rPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && Math.abs(value) <= 1) {
      results.push({
        type: 'correlation',
        value,
        pValue: extractPValueFromContext(text.slice(match.index, match.index + 100)),
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  return results;
}

/**
 * Extract p-values from text
 * Patterns: p < 0.05, p = 0.001, P-value = 0.03
 */
export function extractPValues(text: string): ExtractedNumber[] {
  const results: ExtractedNumber[] = [];
  
  const patterns = [
    /[Pp]\s*[<>=]+\s*(0?\.\d+)/g,
    /[Pp]-?value\s*[=:]\s*(0?\.\d+)/gi,
    /significance.*?(0?\.\d+)/gi,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value >= 0 && value <= 1) {
        results.push({
          value,
          context: getContext(text, match.index, 40),
          type: 'p_value',
          confidence: 'high',
        });
      }
    }
  });
  
  return results;
}

/**
 * Extract confidence intervals from text
 * Patterns: 95% CI 1.2-4.5, CI: [0.3, 0.8], (95% CI: 2.1 to 5.6)
 */
export function extractConfidenceIntervals(text: string): Array<{ lower: number; upper: number; level: number; context: string }> {
  const results: Array<{ lower: number; upper: number; level: number; context: string }> = [];
  
  const pattern = /(\d+)%?\s*CI[:\s]*\(?(\d+\.?\d*)\s*[-–to,]+\s*(\d+\.?\d*)\)?/gi;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const level = parseInt(match[1], 10);
    const lower = parseFloat(match[2]);
    const upper = parseFloat(match[3]);
    
    if (!isNaN(lower) && !isNaN(upper) && lower < upper) {
      results.push({
        lower,
        upper,
        level: level || 95,
        context: getContext(text, match.index, 50),
      });
    }
  }
  
  return results;
}

/**
 * Extract percentages from text
 */
export function extractPercentages(text: string): ExtractedNumber[] {
  const results: ExtractedNumber[] = [];
  
  const pattern = /(\d+\.?\d*)\s*%/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      results.push({
        value,
        context: getContext(text, match.index, 30),
        type: 'percentage',
        confidence: 'medium',
      });
    }
  }
  
  return results;
}

/**
 * Extract all statistical data from text
 */
export function extractAllStatistics(text: string): {
  sampleSizes: ExtractedSampleSize[];
  effectSizes: ExtractedEffectSize[];
  pValues: ExtractedNumber[];
  confidenceIntervals: Array<{ lower: number; upper: number; level: number; context: string }>;
  percentages: ExtractedNumber[];
} {
  return {
    sampleSizes: extractSampleSizes(text),
    effectSizes: extractEffectSizes(text),
    pValues: extractPValues(text),
    confidenceIntervals: extractConfidenceIntervals(text),
    percentages: extractPercentages(text),
  };
}

// Helper functions

function getContext(text: string, index: number, radius: number): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return '...' + text.slice(start, end).trim() + '...';
}

function extractCIFromContext(context: string): { lower: number; upper: number } | undefined {
  const ciMatch = context.match(/95%?\s*CI[:\s]*\(?(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)/i);
  if (ciMatch) {
    return { lower: parseFloat(ciMatch[1]), upper: parseFloat(ciMatch[2]) };
  }
  return undefined;
}

function extractPValueFromContext(context: string): number | undefined {
  const pMatch = context.match(/[Pp]\s*[<>=]+\s*(0?\.\d+)/);
  if (pMatch) {
    return parseFloat(pMatch[1]);
  }
  return undefined;
}

/**
 * Validate extracted data with simple rules
 * This can be used to filter out false positives before showing to user
 */
export function validateExtractedData<T extends { context: string }>(
  data: T[],
  validator: (item: T) => boolean
): T[] {
  return data.filter(validator);
}

/**
 * Score confidence of extraction based on context
 */
export function scoreExtractionConfidence(context: string, type: string): 'high' | 'medium' | 'low' {
  const lowerContext = context.toLowerCase();
  
  // High confidence keywords
  const highConfidenceTerms = ['result', 'found', 'significant', 'analysis', 'study', 'effect'];
  if (highConfidenceTerms.some(term => lowerContext.includes(term))) {
    return 'high';
  }
  
  // Low confidence indicators
  const lowConfidenceTerms = ['may', 'might', 'could', 'possible', 'estimate'];
  if (lowConfidenceTerms.some(term => lowerContext.includes(term))) {
    return 'low';
  }
  
  return 'medium';
}
