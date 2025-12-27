import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calculator, Search, BookOpen, TrendingUp, Code, Info, ExternalLink } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { calculateSampleSize, calculatePower } from '@/lib/statistics';
import { useToast } from '@/hooks/use-toast';

// Formula documentation for transparency
const SAMPLE_SIZE_FORMULAS = {
  two_means: {
    name: "Two Independent Means (Cohen's d)",
    formula: 'n = 2 × ((Zα + Zβ)² × σ²) / δ²',
    description: 'Standard formula for comparing two group means',
    reference: 'Cohen, J. (1988). Statistical Power Analysis'
  },
  two_proportions: {
    name: 'Two Proportions (Chi-square)',
    formula: 'n = ((Zα√(2p̄q̄) + Zβ√(p₁q₁ + p₂q₂))² / (p₁ - p₂)²',
    description: 'Arcsin approximation for proportion comparisons',
    reference: 'Fleiss, J.L. (1981). Statistical Methods'
  },
  correlation: {
    name: 'Correlation (Fisher Z)',
    formula: "n = ((Zα + Zβ) / C)² + 3, where C = 0.5×ln((1+r)/(1-r))",
    description: "Fisher's Z transformation for correlation",
    reference: 'Fisher, R.A. (1921). On the probable error'
  },
  one_sample_mean: {
    name: 'One Sample Mean',
    formula: 'n = ((Zα + Zβ) × σ / δ)²',
    description: 'Single group comparison to known value',
    reference: 'Cohen, J. (1988). Statistical Power Analysis'
  },
  paired: {
    name: 'Paired Samples',
    formula: 'n = ((Zα + Zβ) / d)²',
    description: 'Matched pairs or repeated measures',
    reference: 'Cohen, J. (1988). Statistical Power Analysis'
  }
};

const studyTypes = [
  { value: 'two_means', label: 'Two Independent Means (t-test)', labelFa: 'مقایسه دو میانگین مستقل' },
  { value: 'two_proportions', label: 'Two Proportions', labelFa: 'مقایسه دو نسبت' },
  { value: 'correlation', label: 'Correlation', labelFa: 'همبستگی' },
  { value: 'one_sample_mean', label: 'One Sample Mean', labelFa: 'میانگین تک نمونه' },
  { value: 'paired', label: 'Paired Samples', labelFa: 'نمونه‌های زوجی' },
];

const effectSizeGuide = {
  two_means: { small: 0.2, medium: 0.5, large: 0.8 },
  two_proportions: { small: 0.2, medium: 0.5, large: 0.8 },
  correlation: { small: 0.1, medium: 0.3, large: 0.5 },
  one_sample_mean: { small: 0.2, medium: 0.5, large: 0.8 },
  paired: { small: 0.2, medium: 0.5, large: 0.8 },
};

export default function SampleSizePage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = ['fa', 'ar'].includes(i18n.language);

  const [studyType, setStudyType] = useState<keyof typeof effectSizeGuide>('two_means');
  const [effectSize, setEffectSize] = useState(0.5);
  const [power, setPower] = useState(0.8);
  const [alpha, setAlpha] = useState(0.05);
  const [ratio, setRatio] = useState(1);
  const [tails, setTails] = useState<1 | 2>(2);
  
  const [result, setResult] = useState<number | null>(null);
  
  // Power analysis
  const [sampleSizeForPower, setSampleSizeForPower] = useState(100);
  const [powerResult, setPowerResult] = useState<number | null>(null);

  const calculate = () => {
    try {
      const n = calculateSampleSize({
        studyType,
        effectSize,
        power,
        alpha,
        ratio,
        tails,
      });
      setResult(n);
      toast({ title: t('sample.result'), description: `n = ${n}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to calculate sample size', variant: 'destructive' });
    }
  };

  const calculatePowerResult = () => {
    try {
      const p = calculatePower(sampleSizeForPower, effectSize, alpha, studyType);
      setPowerResult(p);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to calculate power', variant: 'destructive' });
    }
  };

  const guide = effectSizeGuide[studyType];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('sample.title')}</h1>
          <p className="text-muted-foreground mt-1">Calculate required sample size and statistical power</p>
        </div>

        <Tabs defaultValue="sample" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sample">
              <Calculator className="w-4 h-4 mr-2" />
              Sample Size
            </TabsTrigger>
            <TabsTrigger value="power">
              <TrendingUp className="w-4 h-4 mr-2" />
              Power Analysis
            </TabsTrigger>
          </TabsList>

          {/* Sample Size Calculator */}
          <TabsContent value="sample" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Parameters</CardTitle>
                    <CardDescription>Enter study parameters to calculate sample size</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>{t('sample.studyType')}</Label>
                      <Select value={studyType} onValueChange={(v) => setStudyType(v as keyof typeof effectSizeGuide)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {studyTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {isRTL ? type.labelFa : type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>{t('sample.effectSize')}: {effectSize.toFixed(2)}</Label>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEffectSize(guide.small)}>
                            Small ({guide.small})
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEffectSize(guide.medium)}>
                            Medium ({guide.medium})
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEffectSize(guide.large)}>
                            Large ({guide.large})
                          </Button>
                        </div>
                      </div>
                      <Slider
                        value={[effectSize]}
                        onValueChange={([v]) => setEffectSize(v)}
                        min={0.1}
                        max={1.5}
                        step={0.05}
                      />
                    </div>

                    <div>
                      <Label>{t('sample.power')}: {(power * 100).toFixed(0)}%</Label>
                      <Slider
                        value={[power]}
                        onValueChange={([v]) => setPower(v)}
                        min={0.7}
                        max={0.99}
                        step={0.01}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>{t('sample.alpha')}: {alpha}</Label>
                      <Select value={alpha.toString()} onValueChange={(v) => setAlpha(parseFloat(v))}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.01">0.01 (1%)</SelectItem>
                          <SelectItem value="0.05">0.05 (5%)</SelectItem>
                          <SelectItem value="0.10">0.10 (10%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Allocation Ratio (n2/n1)</Label>
                        <Input
                          type="number"
                          value={ratio}
                          onChange={(e) => setRatio(parseFloat(e.target.value) || 1)}
                          min={0.5}
                          max={3}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Tails</Label>
                        <Select value={tails.toString()} onValueChange={(v) => setTails(parseInt(v) as 1 | 2)}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">One-tailed</SelectItem>
                            <SelectItem value="2">Two-tailed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={calculate} className="w-full" size="lg">
                      <Calculator className="w-4 h-4 mr-2" />
                      {t('sample.calculate')}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Result */}
              <div className="space-y-6">
                <Card className={result ? 'border-primary' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {t('sample.result')}
                      {result && (
                        <Badge className="bg-success/20 text-success border-success/30">
                          <Code className="w-3 h-3 mr-1" />
                          Calculated
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result ? (
                      <div className="text-center">
                        <div className="text-5xl font-bold text-primary mb-2">{result}</div>
                        <p className="text-muted-foreground">Total participants required</p>
                        {studyType === 'two_means' && ratio === 1 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            ({Math.ceil(result / 2)} per group)
                          </p>
                        )}
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-left">
                          <p className="text-xs font-medium text-foreground mb-1">Formula Used:</p>
                          <code className="text-xs text-muted-foreground block">
                            {SAMPLE_SIZE_FORMULAS[studyType].formula}
                          </code>
                          <p className="text-xs text-muted-foreground mt-2">
                            Ref: {SAMPLE_SIZE_FORMULAS[studyType].reference}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground">
                        Enter parameters and click Calculate
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Effect Size Guide</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Small:</span>
                      <span className="font-medium">{guide.small}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medium:</span>
                      <span className="font-medium">{guide.medium}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Large:</span>
                      <span className="font-medium">{guide.large}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      Based on Cohen's conventions (1988)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-1">
                      <Info className="w-4 h-4" />
                      About This Calculator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      This calculator uses deterministic formulas—no AI/LLM involvement.
                    </p>
                    <p>
                      <strong>Method:</strong> {SAMPLE_SIZE_FORMULAS[studyType].name}
                    </p>
                    <a
                      href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3148614/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Learn more about sample size calculation
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Power Analysis */}
          <TabsContent value="power" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Power Analysis</CardTitle>
                <CardDescription>Calculate statistical power given a sample size</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Sample Size (Total N)</Label>
                    <Input
                      type="number"
                      value={sampleSizeForPower}
                      onChange={(e) => setSampleSizeForPower(parseInt(e.target.value) || 10)}
                      min={10}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Effect Size: {effectSize.toFixed(2)}</Label>
                    <Slider
                      value={[effectSize]}
                      onValueChange={([v]) => setEffectSize(v)}
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      className="mt-4"
                    />
                  </div>
                </div>

                <Button onClick={calculatePowerResult}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Calculate Power
                </Button>

                {powerResult !== null && (
                  <div className="p-4 rounded-lg bg-muted text-center">
                    <div className="text-4xl font-bold text-primary">
                      {(powerResult * 100).toFixed(1)}%
                    </div>
                    <p className="text-muted-foreground">Statistical Power</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {powerResult >= 0.8 
                        ? '✓ Adequate power (≥80%)' 
                        : '⚠ Consider increasing sample size'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
