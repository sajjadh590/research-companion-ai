// Statistical calculations for meta-analysis using jstat and simple-statistics
import jStat from 'jstat';
import * as ss from 'simple-statistics';
import type { MetaAnalysisStudy, MetaAnalysisResult, SampleSizeParams } from '@/types/research';

// Calculate pooled effect size using random effects model (DerSimonian-Laird)
export function calculateMetaAnalysis(studies: MetaAnalysisStudy[]): MetaAnalysisResult {
  const n = studies.length;
  if (n === 0) {
    throw new Error('No studies provided');
  }

  // Calculate weights (inverse variance)
  const weights = studies.map(s => 1 / (s.variance || s.standardError ** 2));
  const totalWeight = ss.sum(weights);

  // Fixed effect estimate
  const fixedEffect = ss.sum(studies.map((s, i) => weights[i] * s.effectSize)) / totalWeight;

  // Q statistic for heterogeneity
  const qStatistic = ss.sum(studies.map((s, i) => weights[i] * (s.effectSize - fixedEffect) ** 2));
  const df = n - 1;
  const qPValue = 1 - jStat.chisquare.cdf(qStatistic, df);

  // Calculate tau-squared (between-study variance)
  const c = totalWeight - ss.sum(weights.map(w => w ** 2)) / totalWeight;
  const tauSquared = Math.max(0, (qStatistic - df) / c);

  // Random effects weights
  const randomWeights = studies.map(s => 1 / ((s.variance || s.standardError ** 2) + tauSquared));
  const totalRandomWeight = ss.sum(randomWeights);

  // Random effects pooled estimate
  const pooledEffect = ss.sum(studies.map((s, i) => randomWeights[i] * s.effectSize)) / totalRandomWeight;
  const pooledVariance = 1 / totalRandomWeight;
  const pooledSE = Math.sqrt(pooledVariance);

  // Confidence interval (95%)
  const zCritical = 1.96;
  const lowerCI = pooledEffect - zCritical * pooledSE;
  const upperCI = pooledEffect + zCritical * pooledSE;

  // Z-test for overall effect
  const zValue = pooledEffect / pooledSE;
  const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zValue), 0, 1));

  // I-squared (percentage of variability due to heterogeneity)
  const iSquared = Math.max(0, ((qStatistic - df) / qStatistic) * 100);

  // Individual study results with weights
  const studyResults = studies.map((s, i) => {
    const se = s.standardError || Math.sqrt(s.variance);
    return {
      name: s.studyName,
      effectSize: s.effectSize,
      lowerCI: s.effectSize - zCritical * se,
      upperCI: s.effectSize + zCritical * se,
      weight: (randomWeights[i] / totalRandomWeight) * 100,
    };
  });

  return {
    pooledEffect,
    pooledSE,
    lowerCI,
    upperCI,
    zValue,
    pValue,
    iSquared,
    qStatistic,
    qPValue,
    tauSquared,
    studies: studyResults,
  };
}

// Calculate effect sizes from raw data
export function calculateCohenD(mean1: number, mean2: number, sd1: number, sd2: number, n1: number, n2: number): number {
  const pooledSD = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2));
  return (mean1 - mean2) / pooledSD;
}

export function calculateHedgesG(cohenD: number, n1: number, n2: number): number {
  const correction = 1 - 3 / (4 * (n1 + n2) - 9);
  return cohenD * correction;
}

export function calculateOddsRatio(events1: number, total1: number, events2: number, total2: number): number {
  const a = events1;
  const b = total1 - events1;
  const c = events2;
  const d = total2 - events2;
  return (a * d) / (b * c);
}

export function calculateRiskRatio(events1: number, total1: number, events2: number, total2: number): number {
  const risk1 = events1 / total1;
  const risk2 = events2 / total2;
  return risk1 / risk2;
}

export function calculateStandardError(effectSize: number, n1: number, n2: number, type: string): number {
  switch (type) {
    case 'smd': // Standardized mean difference
      return Math.sqrt((n1 + n2) / (n1 * n2) + effectSize ** 2 / (2 * (n1 + n2)));
    case 'or': // Log odds ratio
      // Assuming equal events for simplicity; in practice, use actual event counts
      return Math.sqrt(4 / n1 + 4 / n2);
    case 'rr': // Log risk ratio
      return Math.sqrt(1 / n1 + 1 / n2);
    default:
      return Math.sqrt((n1 + n2) / (n1 * n2));
  }
}

// Egger's test for publication bias
export function eggersTest(studies: MetaAnalysisStudy[]): { intercept: number; se: number; pValue: number } {
  const x = studies.map(s => 1 / s.standardError); // Precision
  const y = studies.map(s => s.effectSize / s.standardError); // Standardized effect

  const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
  const intercept = regression.b;

  // Calculate SE of intercept
  const predicted = x.map(xi => regression.m * xi + regression.b);
  const residuals = y.map((yi, i) => yi - predicted[i]);
  const mse = ss.sum(residuals.map(r => r ** 2)) / (x.length - 2);
  const xMean = ss.mean(x);
  const sxx = ss.sum(x.map(xi => (xi - xMean) ** 2));
  const seIntercept = Math.sqrt(mse * (1 / x.length + xMean ** 2 / sxx));

  // t-test for intercept
  const tValue = intercept / seIntercept;
  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tValue), x.length - 2));

  return { intercept, se: seIntercept, pValue };
}

// Sample size calculations
export function calculateSampleSize(params: SampleSizeParams): number {
  const { studyType, effectSize, power, alpha, ratio = 1, tails = 2 } = params;

  const zAlpha = tails === 2 ? jStat.normal.inv(1 - alpha / 2, 0, 1) : jStat.normal.inv(1 - alpha, 0, 1);
  const zBeta = jStat.normal.inv(power, 0, 1);

  switch (studyType) {
    case 'two_means': {
      // n per group for comparing two means
      const n1 = Math.ceil((2 * (zAlpha + zBeta) ** 2) / effectSize ** 2);
      return n1 * (1 + ratio);
    }
    case 'two_proportions': {
      // Assuming effect size is the difference in proportions
      // Using arcsine transformation approximation
      const h = effectSize; // Cohen's h
      const n1 = Math.ceil((zAlpha + zBeta) ** 2 / (2 * h ** 2));
      return n1 * (1 + ratio);
    }
    case 'correlation': {
      // Fisher's z transformation
      const z = 0.5 * Math.log((1 + effectSize) / (1 - effectSize));
      const n = Math.ceil(((zAlpha + zBeta) / z) ** 2 + 3);
      return n;
    }
    case 'one_sample_mean': {
      const n = Math.ceil(((zAlpha + zBeta) / effectSize) ** 2);
      return n;
    }
    case 'paired': {
      const n = Math.ceil(((zAlpha + zBeta) / effectSize) ** 2 * 2);
      return n;
    }
    default:
      throw new Error('Unknown study type');
  }
}

// Power calculation (inverse of sample size)
export function calculatePower(n: number, effectSize: number, alpha: number, studyType: string): number {
  const zAlpha = jStat.normal.inv(1 - alpha / 2, 0, 1);

  switch (studyType) {
    case 'two_means': {
      const nPerGroup = n / 2;
      const lambda = effectSize * Math.sqrt(nPerGroup / 2);
      return 1 - jStat.normal.cdf(zAlpha - lambda, 0, 1);
    }
    case 'correlation': {
      const z = 0.5 * Math.log((1 + effectSize) / (1 - effectSize));
      const lambda = z * Math.sqrt(n - 3);
      return 1 - jStat.normal.cdf(zAlpha - lambda, 0, 1);
    }
    default: {
      const lambda = effectSize * Math.sqrt(n);
      return 1 - jStat.normal.cdf(zAlpha - lambda, 0, 1);
    }
  }
}

// Sensitivity analysis - leave-one-out
export function leaveOneOutAnalysis(studies: MetaAnalysisStudy[]): MetaAnalysisResult[] {
  return studies.map((_, i) => {
    const subset = studies.filter((_, j) => j !== i);
    return calculateMetaAnalysis(subset);
  });
}

// Subgroup analysis
export function subgroupAnalysis(studies: MetaAnalysisStudy[]): Map<string, MetaAnalysisResult> {
  const groups = new Map<string, MetaAnalysisStudy[]>();
  
  for (const study of studies) {
    const group = study.subgroup || 'Overall';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(study);
  }

  const results = new Map<string, MetaAnalysisResult>();
  for (const [group, groupStudies] of groups) {
    if (groupStudies.length > 0) {
      results.set(group, calculateMetaAnalysis(groupStudies));
    }
  }

  return results;
}
