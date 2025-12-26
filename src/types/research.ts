export interface Article {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  authors: { name: string }[];
  abstract: string;
  publicationDate: string;
  journal: string;
  doi: string;
  url: string;
  citationsCount: number;
  pdfUrl: string | null;
  isOpenAccess: boolean;
}

export interface SavedArticle extends Article {
  projectId?: string;
  tags?: string[];
  notes?: string;
  screeningStatus: 'pending' | 'included' | 'excluded' | 'maybe';
  exclusionReason?: string;
  riskOfBias?: RiskOfBias;
  extractedData?: ExtractedData;
}

export interface RiskOfBias {
  selectionBias: 'low' | 'moderate' | 'high' | 'unclear';
  performanceBias: 'low' | 'moderate' | 'high' | 'unclear';
  detectionBias: 'low' | 'moderate' | 'high' | 'unclear';
  attritionBias: 'low' | 'moderate' | 'high' | 'unclear';
  reportingBias: 'low' | 'moderate' | 'high' | 'unclear';
  overall: 'low' | 'moderate' | 'high';
  notes?: string;
}

export interface ExtractedData {
  pico?: {
    population: string;
    intervention: string;
    comparison: string;
    outcome: string;
  };
  sampleSize?: number;
  effectSize?: number;
  effectSizeType?: string;
  confidenceInterval?: [number, number];
  pValue?: number;
}

export interface ResearchProject {
  id: string;
  title: string;
  description?: string;
  topic: string;
  status: 'active' | 'completed' | 'archived';
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAnalysisStudy {
  id: string;
  projectId: string;
  articleId?: string;
  studyName: string;
  effectSize: number;
  effectSizeType: string;
  standardError: number;
  variance: number;
  sampleSizeTreatment?: number;
  sampleSizeControl?: number;
  meanTreatment?: number;
  sdTreatment?: number;
  meanControl?: number;
  sdControl?: number;
  eventsTreatment?: number;
  eventsControl?: number;
  weight?: number;
  subgroup?: string;
}

export interface MetaAnalysisResult {
  pooledEffect: number;
  pooledSE: number;
  lowerCI: number;
  upperCI: number;
  zValue: number;
  pValue: number;
  iSquared: number;
  qStatistic: number;
  qPValue: number;
  tauSquared: number;
  studies: {
    name: string;
    effectSize: number;
    lowerCI: number;
    upperCI: number;
    weight: number;
  }[];
}

export interface SampleSizeParams {
  studyType: 'two_means' | 'two_proportions' | 'correlation' | 'one_sample_mean' | 'paired';
  effectSize: number;
  power: number;
  alpha: number;
  ratio?: number; // n2/n1 ratio
  tails?: 1 | 2;
}

export interface Proposal {
  id: string;
  projectId: string;
  title: string;
  sections: ProposalSection[];
  templateFormat?: string;
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ProposalSection {
  id: string;
  type: 'introduction' | 'literature_review' | 'methodology' | 'objectives' | 'timeline' | 'references' | 'custom';
  title: string;
  content: string;
  isApproved: boolean;
}
