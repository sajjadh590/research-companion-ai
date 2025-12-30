import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, BarChart3, Download, Calculator, Info, Code, Upload, Loader2, FileText, Check, X } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { calculateMetaAnalysis, eggersTest, leaveOneOutAnalysis } from '@/lib/statistics';
import type { MetaAnalysisStudy, MetaAnalysisResult } from '@/types/research';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ErrorBar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { parsePDF } from '@/lib/pdfParser';
import { supabase } from '@/integrations/supabase/client';

// Formula references for transparency
const FORMULA_REFS = {
  pooledEffect: {
    name: 'Inverse Variance Weighting (Random Effects)',
    formula: 'θ̂ = Σ(wᵢθᵢ) / Σwᵢ, where wᵢ = 1/(Vᵢ + τ²)',
    reference: 'DerSimonian & Laird, 1986'
  },
  iSquared: {
    name: 'Higgins I² Statistic',
    formula: 'I² = max(0, (Q - df) / Q × 100%)',
    reference: 'Higgins et al., 2003'
  },
  tauSquared: {
    name: 'Between-study Variance (τ²)',
    formula: 'τ² = (Q - df) / C, where C = Σwᵢ - Σwᵢ²/Σwᵢ',
    reference: 'DerSimonian & Laird, 1986'
  }
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

function FormulaTooltip({ formulaKey }: { formulaKey: keyof typeof FORMULA_REFS }) {
  const ref = FORMULA_REFS[formulaKey];
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-medium">{ref.name}</p>
          <code className="text-xs block mt-1 bg-muted p-1 rounded">{ref.formula}</code>
          <p className="text-xs text-muted-foreground mt-1">Ref: {ref.reference}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

const defaultStudy: Partial<MetaAnalysisStudy> = {
  studyName: '',
  effectSize: 0,
  standardError: 0.1,
  effectSizeType: 'smd',
  subgroup: '',
};

export default function MetaAnalysisPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [studies, setStudies] = useState<MetaAnalysisStudy[]>([]);
  const [newStudy, setNewStudy] = useState(defaultStudy);
  const [effectSizeType, setEffectSizeType] = useState('smd');
  const [result, setResult] = useState<MetaAnalysisResult | null>(null);
  
  // PDF extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedStudies, setExtractedStudies] = useState<ExtractedStudy[]>([]);

  const addStudy = () => {
    if (!newStudy.studyName || newStudy.standardError === 0) {
      toast({ title: 'Error', description: 'Please fill in study name and standard error', variant: 'destructive' });
      return;
    }
    
    const study: MetaAnalysisStudy = {
      id: crypto.randomUUID(),
      projectId: '',
      studyName: newStudy.studyName!,
      effectSize: newStudy.effectSize || 0,
      effectSizeType: effectSizeType,
      standardError: newStudy.standardError!,
      variance: newStudy.standardError! ** 2,
      subgroup: newStudy.subgroup,
    };
    
    setStudies([...studies, study]);
    setNewStudy(defaultStudy);
  };

  const removeStudy = (id: string) => {
    setStudies(studies.filter(s => s.id !== id));
  };

  const runAnalysis = () => {
    if (studies.length < 2) {
      toast({ title: 'Error', description: 'Need at least 2 studies for meta-analysis', variant: 'destructive' });
      return;
    }

    try {
      const analysisResult = calculateMetaAnalysis(studies);
      setResult(analysisResult);
      toast({ title: 'Success', description: 'Meta-analysis completed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run meta-analysis', variant: 'destructive' });
    }
  };

  // Handle PDF upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsExtracting(true);
    toast({ title: t('meta.uploadingPdf'), description: file.name });

    try {
      // Parse PDF
      const pdfResult = await parsePDF(file);
      
      if (!pdfResult.text && pdfResult.tables.length === 0) {
        throw new Error('No content extracted from PDF');
      }

      // Call edge function to extract study data
      const { data, error } = await supabase.functions.invoke('extract-study-data', {
        body: {
          text: pdfResult.text,
          tables: pdfResult.tables,
          language: i18n.language,
        },
      });

      if (error) throw error;

      if (data.studies && data.studies.length > 0) {
        setExtractedStudies(data.studies);
        toast({ 
          title: t('meta.extractionSuccess'), 
          description: `${data.studies.length} ${t('meta.studiesExtracted')}`,
        });
      } else {
        toast({ 
          title: t('meta.noDataFound'), 
          description: t('meta.noDataFoundDesc'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('PDF extraction error:', error);
      toast({ 
        title: t('meta.extractionFailed'), 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Add extracted study to table
  const addExtractedStudy = (extracted: ExtractedStudy) => {
    // Calculate effect size and SE if we have the raw data
    let effectSize = extracted.effectSize || 0;
    let standardError = extracted.standardError || 0.1;

    // If we have means and SDs, calculate SMD
    if (extracted.meanControl !== null && extracted.meanIntervention !== null &&
        extracted.sdControl !== null && extracted.sdIntervention !== null &&
        extracted.sampleSizeControl !== null && extracted.sampleSizeIntervention !== null) {
      
      const pooledSD = Math.sqrt(
        ((extracted.sampleSizeControl - 1) * extracted.sdControl ** 2 + 
         (extracted.sampleSizeIntervention - 1) * extracted.sdIntervention ** 2) /
        (extracted.sampleSizeControl + extracted.sampleSizeIntervention - 2)
      );
      
      if (pooledSD > 0) {
        effectSize = (extracted.meanIntervention - extracted.meanControl) / pooledSD;
        standardError = Math.sqrt(
          (extracted.sampleSizeControl + extracted.sampleSizeIntervention) / 
          (extracted.sampleSizeControl * extracted.sampleSizeIntervention) +
          (effectSize ** 2) / (2 * (extracted.sampleSizeControl + extracted.sampleSizeIntervention))
        );
      }
    }

    const study: MetaAnalysisStudy = {
      id: crypto.randomUUID(),
      projectId: '',
      studyName: extracted.studyName,
      effectSize,
      effectSizeType: effectSizeType,
      standardError,
      variance: standardError ** 2,
      sampleSizeControl: extracted.sampleSizeControl || undefined,
      sampleSizeTreatment: extracted.sampleSizeIntervention || undefined,
      meanControl: extracted.meanControl || undefined,
      meanTreatment: extracted.meanIntervention || undefined,
      sdControl: extracted.sdControl || undefined,
      sdTreatment: extracted.sdIntervention || undefined,
    };

    setStudies([...studies, study]);
    setExtractedStudies(extractedStudies.filter(e => e !== extracted));
    toast({ title: t('meta.studyAdded'), description: extracted.studyName });
  };

  // Discard extracted study
  const discardExtractedStudy = (extracted: ExtractedStudy) => {
    setExtractedStudies(extractedStudies.filter(e => e !== extracted));
  };

  const forestPlotData = useMemo(() => {
    if (!result) return [];
    return result.studies.map(s => ({
      name: s.name,
      effectSize: s.effectSize,
      lowerCI: s.lowerCI,
      upperCI: s.upperCI,
      weight: s.weight,
      error: [s.effectSize - s.lowerCI, s.upperCI - s.effectSize],
    }));
  }, [result]);

  const funnelPlotData = useMemo(() => {
    if (!result) return [];
    return studies.map(s => ({
      effectSize: s.effectSize,
      standardError: s.standardError,
      precision: 1 / s.standardError,
    }));
  }, [result, studies]);

  const exportResults = () => {
    if (!result) return;
    const data = {
      pooledEffect: result.pooledEffect,
      confidence: { lower: result.lowerCI, upper: result.upperCI },
      heterogeneity: { iSquared: result.iSquared, qStatistic: result.qStatistic, tauSquared: result.tauSquared },
      pValue: result.pValue,
      studies: result.studies,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meta-analysis-results.json';
    a.click();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('meta.title')}</h1>
          <p className="text-muted-foreground mt-1">Calculate pooled effects, heterogeneity, and generate plots</p>
        </div>

        <Tabs defaultValue="data" className="space-y-6">
          <TabsList>
            <TabsTrigger value="data">{t('meta.dataEntry')}</TabsTrigger>
            <TabsTrigger value="results" disabled={!result}>{t('meta.calculations')}</TabsTrigger>
            <TabsTrigger value="forest" disabled={!result}>{t('meta.forestPlot')}</TabsTrigger>
            <TabsTrigger value="funnel" disabled={!result}>{t('meta.funnelPlot')}</TabsTrigger>
          </TabsList>

          {/* Data Entry Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* PDF Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  {t('meta.uploadStudyPdf')}
                </CardTitle>
                <CardDescription>{t('meta.uploadStudyPdfDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isExtracting}
                  variant="outline"
                  className="gap-2"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('meta.extractingData')}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {t('meta.selectPdfFile')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Extracted Studies Review */}
            {extractedStudies.length > 0 && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-primary">{t('meta.extractedStudies')}</CardTitle>
                  <CardDescription>{t('meta.reviewExtractedData')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedStudies.map((study, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{study.studyName}</h4>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => addExtractedStudy(study)} className="gap-1">
                            <Check className="w-4 h-4" /> {t('meta.addToStudies')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => discardExtractedStudy(study)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">N (Control): </span>
                          <span>{study.sampleSizeControl ?? 'NR'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">N (Intervention): </span>
                          <span>{study.sampleSizeIntervention ?? 'NR'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mean (C): </span>
                          <span>{study.meanControl?.toFixed(2) ?? 'NR'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mean (I): </span>
                          <span>{study.meanIntervention?.toFixed(2) ?? 'NR'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SD (C): </span>
                          <span>{study.sdControl?.toFixed(2) ?? 'NR'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SD (I): </span>
                          <span>{study.sdIntervention?.toFixed(2) ?? 'NR'}</span>
                        </div>
                        {study.effectSize !== null && (
                          <div>
                            <span className="text-muted-foreground">Effect: </span>
                            <span>{study.effectSize.toFixed(3)}</span>
                          </div>
                        )}
                        {study.standardError !== null && (
                          <div>
                            <span className="text-muted-foreground">SE: </span>
                            <span>{study.standardError.toFixed(3)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Manual Data Entry */}
            <Card>
              <CardHeader>
                <CardTitle>Add Study Data</CardTitle>
                <CardDescription>Enter effect size and standard error for each study</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Study Name</Label>
                    <Input
                      value={newStudy.studyName}
                      onChange={(e) => setNewStudy({ ...newStudy, studyName: e.target.value })}
                      placeholder="Author et al. 2024"
                    />
                  </div>
                  <div>
                    <Label>Effect Size</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newStudy.effectSize}
                      onChange={(e) => setNewStudy({ ...newStudy, effectSize: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Standard Error</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newStudy.standardError}
                      onChange={(e) => setNewStudy({ ...newStudy, standardError: parseFloat(e.target.value) || 0.1 })}
                    />
                  </div>
                  <div>
                    <Label>Effect Type</Label>
                    <Select value={effectSizeType} onValueChange={setEffectSizeType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smd">SMD (Cohen's d)</SelectItem>
                        <SelectItem value="or">Odds Ratio (log)</SelectItem>
                        <SelectItem value="rr">Risk Ratio (log)</SelectItem>
                        <SelectItem value="md">Mean Difference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addStudy} className="w-full">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {studies.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Study</TableHead>
                        <TableHead>Effect Size</TableHead>
                        <TableHead>SE</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studies.map((study) => (
                        <TableRow key={study.id}>
                          <TableCell>{study.studyName}</TableCell>
                          <TableCell>{study.effectSize.toFixed(3)}</TableCell>
                          <TableCell>{study.standardError.toFixed(3)}</TableCell>
                          <TableCell>{study.effectSizeType}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeStudy(study.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="flex gap-2">
                  <Button onClick={runAnalysis} disabled={studies.length < 2}>
                    <Calculator className="w-4 h-4 mr-1" />
                    Run Meta-Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            {result && (
              <>
                {/* Calculated Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-success/20 text-success border-success/30">
                    <Code className="w-3 h-3 mr-1" />
                    Calculated (Not AI-Generated)
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    All statistics computed using deterministic TypeScript functions
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        Pooled Effect
                        <FormulaTooltip formulaKey="pooledEffect" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-primary">{result.pooledEffect.toFixed(3)}</div>
                      <p className="text-sm text-muted-foreground">
                        95% CI: [{result.lowerCI.toFixed(3)}, {result.upperCI.toFixed(3)}]
                      </p>
                      <p className="text-sm text-muted-foreground">p = {result.pValue.toFixed(4)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        Heterogeneity
                        <FormulaTooltip formulaKey="iSquared" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-primary">I² = {result.iSquared.toFixed(1)}%</div>
                      <p className="text-sm text-muted-foreground flex items-center">
                        Q = {result.qStatistic.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center">
                        τ² = {result.tauSquared.toFixed(4)}
                        <FormulaTooltip formulaKey="tauSquared" />
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Interpretation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-lg font-medium ${result.pValue < 0.05 ? 'text-success' : 'text-warning'}`}>
                        {result.pValue < 0.05 ? 'Significant' : 'Not Significant'}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Heterogeneity: {result.iSquared < 25 ? 'Low' : result.iSquared < 75 ? 'Moderate' : 'High'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Based on Cochrane Handbook thresholds
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Study Weights</CardTitle>
                      <Button variant="outline" size="sm" onClick={exportResults}>
                        <Download className="w-4 h-4 mr-1" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Study</TableHead>
                          <TableHead>Effect Size</TableHead>
                          <TableHead>95% CI</TableHead>
                          <TableHead>Weight (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.studies.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.effectSize.toFixed(3)}</TableCell>
                            <TableCell>[{s.lowerCI.toFixed(3)}, {s.upperCI.toFixed(3)}]</TableCell>
                            <TableCell>{s.weight.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell>Pooled (Random Effects)</TableCell>
                          <TableCell>{result.pooledEffect.toFixed(3)}</TableCell>
                          <TableCell>[{result.lowerCI.toFixed(3)}, {result.upperCI.toFixed(3)}]</TableCell>
                          <TableCell>100%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Forest Plot Tab */}
          <TabsContent value="forest">
            {result && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('meta.forestPlot')}</CardTitle>
                    <Badge className="bg-success/20 text-success border-success/30">
                      <Code className="w-3 h-3 mr-1" />
                      Rendered from Calculated Data
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={forestPlotData}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                        <YAxis type="category" dataKey="name" width={90} />
                        <Tooltip />
                        <ReferenceLine x={0} stroke="hsl(var(--primary))" strokeWidth={2} />
                        <ReferenceLine x={result.pooledEffect} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                        <Bar dataKey="effectSize" fill="hsl(var(--primary))" barSize={20}>
                          <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke="hsl(var(--foreground))" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground text-center">
                      Solid line = null effect (0) | Dashed line = pooled effect ({result.pooledEffect.toFixed(3)})
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Effect sizes and CIs calculated using Inverse Variance Weighting (DerSimonian-Laird)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Funnel Plot Tab */}
          <TabsContent value="funnel">
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('meta.funnelPlot')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="effectSize" name="Effect Size" />
                        <YAxis type="number" dataKey="standardError" name="Standard Error" reversed />
                        <ZAxis range={[60, 60]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <ReferenceLine x={result.pooledEffect} stroke="hsl(var(--primary))" strokeWidth={2} />
                        <Scatter name="Studies" data={funnelPlotData} fill="hsl(var(--primary))" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Vertical line = pooled effect | Asymmetry may indicate publication bias
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
