/**
 * Clinical Calculators for Internal Medicine
 * All calculations are deterministic TypeScript - NO LLM involvement
 * References included for verification
 */

// ============================================
// Number Needed to Treat (NNT) Calculator
// Reference: Sackett DL. BMJ 1996;313:1232-1233
// ============================================

export interface NNTResult {
  nnt: number;
  arr: number; // Absolute Risk Reduction
  rrr: number; // Relative Risk Reduction
  ci95: { lower: number; upper: number };
  interpretation: string;
}

export function calculateNNT(
  eventRateControl: number, // Control group event rate (0-1)
  eventRateTreatment: number, // Treatment group event rate (0-1)
  n1?: number, // Sample size control
  n2?: number // Sample size treatment
): NNTResult {
  const arr = eventRateControl - eventRateTreatment;
  const rrr = arr / eventRateControl;
  const nnt = arr !== 0 ? Math.abs(1 / arr) : Infinity;
  
  // 95% CI calculation (Wald method)
  let ci95 = { lower: 0, upper: Infinity };
  if (n1 && n2 && arr !== 0) {
    const se = Math.sqrt(
      (eventRateControl * (1 - eventRateControl)) / n1 +
      (eventRateTreatment * (1 - eventRateTreatment)) / n2
    );
    const arrLower = arr - 1.96 * se;
    const arrUpper = arr + 1.96 * se;
    ci95 = {
      lower: arrUpper !== 0 ? Math.abs(1 / arrUpper) : Infinity,
      upper: arrLower !== 0 ? Math.abs(1 / arrLower) : Infinity,
    };
  }

  let interpretation = '';
  if (nnt === Infinity) {
    interpretation = 'No difference between groups';
  } else if (arr > 0) {
    interpretation = `NNT = ${Math.ceil(nnt)}: Treat ${Math.ceil(nnt)} patients to prevent 1 event`;
  } else {
    interpretation = `NNH = ${Math.ceil(nnt)}: Treating ${Math.ceil(nnt)} patients causes 1 additional event`;
  }

  return { nnt, arr, rrr, ci95, interpretation };
}

// ============================================
// eGFR Calculator (CKD-EPI 2021)
// Reference: Inker LA et al. NEJM 2021;385:1737-1749
// ============================================

export interface eGFRResult {
  eGFR: number;
  ckdStage: string;
  interpretation: string;
  formula: string;
}

export function calculateEGFR(
  creatinine: number, // mg/dL
  age: number, // years
  sex: 'male' | 'female',
  useCysC?: number // Cystatin C (mg/L) - optional
): eGFRResult {
  // CKD-EPI 2021 Creatinine equation (race-free)
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const minCrKappa = Math.min(creatinine / kappa, 1);
  const maxCrKappa = Math.max(creatinine / kappa, 1);
  
  let eGFR = 142 * 
    Math.pow(minCrKappa, alpha) * 
    Math.pow(maxCrKappa, -1.200) * 
    Math.pow(0.9938, age);
  
  if (sex === 'female') {
    eGFR *= 1.012;
  }

  // Round to 1 decimal
  eGFR = Math.round(eGFR * 10) / 10;

  // Determine CKD stage
  let ckdStage = '';
  if (eGFR >= 90) ckdStage = 'G1 (Normal or high)';
  else if (eGFR >= 60) ckdStage = 'G2 (Mildly decreased)';
  else if (eGFR >= 45) ckdStage = 'G3a (Mildly to moderately decreased)';
  else if (eGFR >= 30) ckdStage = 'G3b (Moderately to severely decreased)';
  else if (eGFR >= 15) ckdStage = 'G4 (Severely decreased)';
  else ckdStage = 'G5 (Kidney failure)';

  const interpretation = eGFR >= 60 
    ? 'Normal or mildly reduced kidney function'
    : eGFR >= 30 
      ? 'Moderate CKD - Consider nephrology referral'
      : 'Severe CKD - Nephrology referral recommended';

  return {
    eGFR,
    ckdStage,
    interpretation,
    formula: 'CKD-EPI 2021 (race-free)',
  };
}

// ============================================
// CURB-65 Score for Pneumonia Severity
// Reference: Lim WS et al. Thorax 2003;58:377-382
// ============================================

export interface CURB65Result {
  score: number;
  mortality30Day: string;
  recommendation: string;
  details: string[];
}

export function calculateCURB65(
  confusion: boolean,
  urea: number, // mmol/L (>7 = positive) or BUN mg/dL (>19 = positive)
  respiratoryRate: number, // ≥30 = positive
  bloodPressureSystolic: number, // <90 = positive
  bloodPressureDiastolic: number, // ≤60 = positive
  age: number, // ≥65 = positive
  isUraBUN: boolean = false // true if urea is in mg/dL (BUN)
): CURB65Result {
  const details: string[] = [];
  let score = 0;

  if (confusion) {
    score++;
    details.push('Confusion: +1');
  }

  const ureaThreshold = isUraBUN ? 19 : 7;
  if (urea > ureaThreshold) {
    score++;
    details.push(`Urea/${isUraBUN ? 'BUN' : 'mmol/L'} > ${ureaThreshold}: +1`);
  }

  if (respiratoryRate >= 30) {
    score++;
    details.push('Respiratory Rate ≥30: +1');
  }

  if (bloodPressureSystolic < 90 || bloodPressureDiastolic <= 60) {
    score++;
    details.push('BP <90 systolic or ≤60 diastolic: +1');
  }

  if (age >= 65) {
    score++;
    details.push('Age ≥65: +1');
  }

  const mortality30DayMap: Record<number, string> = {
    0: '0.6%',
    1: '2.7%',
    2: '6.8%',
    3: '14.0%',
    4: '27.8%',
    5: '27.8%',
  };

  const recommendationMap: Record<number, string> = {
    0: 'Low risk - Consider outpatient treatment',
    1: 'Low risk - Consider outpatient treatment',
    2: 'Moderate risk - Consider short inpatient stay or hospital-supervised outpatient treatment',
    3: 'Severe pneumonia - Hospitalize, consider ICU',
    4: 'Severe pneumonia - Hospitalize, consider ICU',
    5: 'Severe pneumonia - Hospitalize, consider ICU',
  };

  return {
    score,
    mortality30Day: mortality30DayMap[score],
    recommendation: recommendationMap[score],
    details,
  };
}

// ============================================
// Wells Score for DVT
// Reference: Wells PS et al. NEJM 2003;349:1227-1235
// ============================================

export interface WellsDVTResult {
  score: number;
  probability: 'Low' | 'Moderate' | 'High';
  prevalence: string;
  recommendation: string;
}

export function calculateWellsDVT(
  activeCancer: boolean, // Treatment within 6 months or palliative
  paralysisParesis: boolean, // Paralysis, paresis, or recent immobilization
  bedridden3Days: boolean, // >3 days or major surgery within 12 weeks
  localizedTenderness: boolean, // Along deep venous system
  entireLegSwollen: boolean,
  calfSwelling3cm: boolean, // >3cm compared to asymptomatic leg
  pittingEdema: boolean, // Confined to symptomatic leg
  collateralVeins: boolean, // Non-varicose superficial veins
  previousDVT: boolean,
  alternativeDiagnosisLikely: boolean // -2 points if yes
): WellsDVTResult {
  let score = 0;

  if (activeCancer) score += 1;
  if (paralysisParesis) score += 1;
  if (bedridden3Days) score += 1;
  if (localizedTenderness) score += 1;
  if (entireLegSwollen) score += 1;
  if (calfSwelling3cm) score += 1;
  if (pittingEdema) score += 1;
  if (collateralVeins) score += 1;
  if (previousDVT) score += 1;
  if (alternativeDiagnosisLikely) score -= 2;

  let probability: 'Low' | 'Moderate' | 'High';
  let prevalence: string;
  let recommendation: string;

  if (score <= 0) {
    probability = 'Low';
    prevalence = '5%';
    recommendation = 'D-dimer testing. If negative, DVT excluded. If positive, ultrasound.';
  } else if (score <= 2) {
    probability = 'Moderate';
    prevalence = '17%';
    recommendation = 'D-dimer testing. If negative, DVT excluded. If positive, ultrasound.';
  } else {
    probability = 'High';
    prevalence = '53%';
    recommendation = 'Proceed directly to ultrasound. D-dimer not reliable to exclude.';
  }

  return { score, probability, prevalence, recommendation };
}

// ============================================
// CHA₂DS₂-VASc Score for Atrial Fibrillation
// Reference: Lip GY et al. Chest 2010;137:263-272
// ============================================

export interface CHADSVAScResult {
  score: number;
  annualStrokeRisk: string;
  recommendation: string;
}

export function calculateCHADSVASc(
  age: number,
  sex: 'male' | 'female',
  chf: boolean, // Congestive Heart Failure
  hypertension: boolean,
  diabetes: boolean,
  stroke: boolean, // Stroke/TIA/Thromboembolism (2 points)
  vascularDisease: boolean // Prior MI, PAD, or aortic plaque
): CHADSVAScResult {
  let score = 0;

  if (chf) score += 1;
  if (hypertension) score += 1;
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;
  if (diabetes) score += 1;
  if (stroke) score += 2;
  if (vascularDisease) score += 1;
  if (sex === 'female') score += 1;

  const strokeRiskMap: Record<number, string> = {
    0: '0%',
    1: '1.3%',
    2: '2.2%',
    3: '3.2%',
    4: '4.0%',
    5: '6.7%',
    6: '9.8%',
    7: '9.6%',
    8: '6.7%',
    9: '15.2%',
  };

  let recommendation: string;
  if (score === 0 && sex === 'male') {
    recommendation = 'No anticoagulation recommended';
  } else if (score === 1 && sex === 'male') {
    recommendation = 'Consider anticoagulation (weak indication)';
  } else if (score === 1 && sex === 'female') {
    recommendation = 'No anticoagulation (score driven by female sex alone)';
  } else {
    recommendation = 'Oral anticoagulation recommended (DOAC preferred over warfarin)';
  }

  return {
    score,
    annualStrokeRisk: strokeRiskMap[Math.min(score, 9)],
    recommendation,
  };
}

// ============================================
// APACHE II Score (Simplified)
// Reference: Knaus WA et al. Crit Care Med 1985;13:818-829
// ============================================

export interface APACHEII_Result {
  score: number;
  mortalityEstimate: string;
  category: string;
}

export function calculateAPACHEII_APS(
  temperature: number, // °C
  meanArterialPressure: number, // mmHg
  heartRate: number,
  respiratoryRate: number,
  oxygenation: number, // PaO2 if FiO2 < 0.5, A-aDO2 if FiO2 >= 0.5
  fio2High: boolean, // true if FiO2 >= 0.5
  arterialPH: number,
  sodium: number, // mEq/L
  potassium: number, // mEq/L
  creatinine: number, // mg/dL (double points if acute renal failure)
  acuteRenalFailure: boolean,
  hematocrit: number, // %
  wbc: number, // x1000/mm³
  gcs: number, // Glasgow Coma Scale (3-15)
  age: number,
  chronicHealth: 'none' | 'elective' | 'emergency' // Surgery type or chronic organ insufficiency
): APACHEII_Result {
  let score = 0;

  // Temperature scoring
  if (temperature >= 41) score += 4;
  else if (temperature >= 39) score += 3;
  else if (temperature >= 38.5) score += 1;
  else if (temperature >= 36) score += 0;
  else if (temperature >= 34) score += 1;
  else if (temperature >= 32) score += 2;
  else if (temperature >= 30) score += 3;
  else score += 4;

  // MAP scoring
  if (meanArterialPressure >= 160) score += 4;
  else if (meanArterialPressure >= 130) score += 3;
  else if (meanArterialPressure >= 110) score += 2;
  else if (meanArterialPressure >= 70) score += 0;
  else if (meanArterialPressure >= 50) score += 2;
  else score += 4;

  // Heart rate scoring
  if (heartRate >= 180) score += 4;
  else if (heartRate >= 140) score += 3;
  else if (heartRate >= 110) score += 2;
  else if (heartRate >= 70) score += 0;
  else if (heartRate >= 55) score += 2;
  else if (heartRate >= 40) score += 3;
  else score += 4;

  // Respiratory rate scoring
  if (respiratoryRate >= 50) score += 4;
  else if (respiratoryRate >= 35) score += 3;
  else if (respiratoryRate >= 25) score += 1;
  else if (respiratoryRate >= 12) score += 0;
  else if (respiratoryRate >= 10) score += 1;
  else if (respiratoryRate >= 6) score += 2;
  else score += 4;

  // GCS scoring (15 - GCS)
  score += (15 - gcs);

  // Age points
  if (age >= 75) score += 6;
  else if (age >= 65) score += 5;
  else if (age >= 55) score += 3;
  else if (age >= 45) score += 2;
  else score += 0;

  // Chronic health points
  if (chronicHealth === 'emergency') score += 5;
  else if (chronicHealth === 'elective') score += 2;

  // Estimate mortality (approximate)
  let mortalityEstimate: string;
  if (score <= 4) mortalityEstimate = '~4%';
  else if (score <= 9) mortalityEstimate = '~8%';
  else if (score <= 14) mortalityEstimate = '~15%';
  else if (score <= 19) mortalityEstimate = '~25%';
  else if (score <= 24) mortalityEstimate = '~40%';
  else if (score <= 29) mortalityEstimate = '~55%';
  else if (score <= 34) mortalityEstimate = '~75%';
  else mortalityEstimate = '>85%';

  let category: string;
  if (score <= 10) category = 'Low severity';
  else if (score <= 20) category = 'Moderate severity';
  else if (score <= 30) category = 'High severity';
  else category = 'Very high severity';

  return { score, mortalityEstimate, category };
}

// ============================================
// Confidence Interval for Proportions
// Wilson Score Interval (recommended over Wald)
// Reference: Newcombe RG. Stat Med 1998;17:857-872
// ============================================

export interface ProportionCIResult {
  proportion: number;
  lower: number;
  upper: number;
  method: string;
}

export function calculateProportionCI(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): ProportionCIResult {
  const p = successes / total;
  const z = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;
  
  // Wilson Score Interval
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const offset = (z / denominator) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));

  return {
    proportion: p,
    lower: Math.max(0, center - offset),
    upper: Math.min(1, center + offset),
    method: 'Wilson Score Interval',
  };
}

// ============================================
// Sensitivity, Specificity, PPV, NPV
// ============================================

export interface DiagnosticTestResult {
  sensitivity: number;
  specificity: number;
  ppv: number; // Positive Predictive Value
  npv: number; // Negative Predictive Value
  plr: number; // Positive Likelihood Ratio
  nlr: number; // Negative Likelihood Ratio
  accuracy: number;
  prevalence: number;
}

export function calculateDiagnosticTest(
  truePositive: number,
  falsePositive: number,
  falseNegative: number,
  trueNegative: number
): DiagnosticTestResult {
  const total = truePositive + falsePositive + falseNegative + trueNegative;
  const diseased = truePositive + falseNegative;
  const healthy = falsePositive + trueNegative;
  const testPositive = truePositive + falsePositive;
  const testNegative = falseNegative + trueNegative;

  const sensitivity = diseased > 0 ? truePositive / diseased : 0;
  const specificity = healthy > 0 ? trueNegative / healthy : 0;
  const ppv = testPositive > 0 ? truePositive / testPositive : 0;
  const npv = testNegative > 0 ? trueNegative / testNegative : 0;
  const plr = specificity < 1 ? sensitivity / (1 - specificity) : Infinity;
  const nlr = sensitivity > 0 ? (1 - sensitivity) / specificity : Infinity;
  const accuracy = total > 0 ? (truePositive + trueNegative) / total : 0;
  const prevalence = total > 0 ? diseased / total : 0;

  return {
    sensitivity: Math.round(sensitivity * 1000) / 1000,
    specificity: Math.round(specificity * 1000) / 1000,
    ppv: Math.round(ppv * 1000) / 1000,
    npv: Math.round(npv * 1000) / 1000,
    plr: Math.round(plr * 100) / 100,
    nlr: Math.round(nlr * 1000) / 1000,
    accuracy: Math.round(accuracy * 1000) / 1000,
    prevalence: Math.round(prevalence * 1000) / 1000,
  };
}
