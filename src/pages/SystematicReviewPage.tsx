import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, HelpCircle, FileText, Download, Brain, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { analyzeArticles } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ScreeningArticle {
  id: string;
  title: string;
  abstract: string;
  status: 'pending' | 'included' | 'excluded' | 'maybe';
  exclusionReason?: string;
}

// PRISMA stages
const prismaStages = [
  { key: 'identification', count: 0, label: 'Identification' },
  { key: 'screening', count: 0, label: 'Screening' },
  { key: 'eligibility', count: 0, label: 'Eligibility' },
  { key: 'included', count: 0, label: 'Included' },
];

const robDomains = [
  'Selection Bias',
  'Performance Bias',
  'Detection Bias',
  'Attrition Bias',
  'Reporting Bias',
];

export default function SystematicReviewPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  // Demo data for screening
  const [articles, setArticles] = useState<ScreeningArticle[]>([
    { id: '1', title: 'Effects of Exercise on Mental Health: A Systematic Review', abstract: 'This systematic review examines the effects of physical exercise on mental health outcomes...', status: 'pending' },
    { id: '2', title: 'Cognitive Behavioral Therapy for Anxiety: Meta-Analysis', abstract: 'A comprehensive meta-analysis of randomized controlled trials evaluating CBT for anxiety disorders...', status: 'pending' },
    { id: '3', title: 'Impact of Sleep Quality on Academic Performance', abstract: 'This study investigates the relationship between sleep quality and academic outcomes in university students...', status: 'included' },
  ]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [picoResults, setPicoResults] = useState<string>('');
  const [robResults, setRobResults] = useState<Map<string, Record<string, 'low' | 'moderate' | 'high' | 'unclear'>>>(new Map());

  const updateStatus = (id: string, status: 'included' | 'excluded' | 'maybe') => {
    setArticles(articles.map(a => a.id === id ? { ...a, status } : a));
  };

  const runPicoAnalysis = async () => {
    const selected = articles.filter(a => a.status === 'included' || a.status === 'pending');
    if (selected.length === 0) {
      toast({ title: 'Error', description: 'No articles to analyze', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeArticles({
        type: 'pico',
        articles: selected.map(a => ({ title: a.title, abstract: a.abstract })),
        language: i18n.language,
      });

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        setPicoResults(result.result);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to analyze', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runRobAnalysis = async () => {
    const included = articles.filter(a => a.status === 'included');
    if (included.length === 0) {
      toast({ title: 'Error', description: 'No included articles', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeArticles({
        type: 'risk_of_bias',
        articles: included.map(a => ({ title: a.title, abstract: a.abstract })),
        language: i18n.language,
      });

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        // Parse and display results
        toast({ title: 'Success', description: 'Risk of bias assessed' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to analyze', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const counts = {
    total: articles.length,
    pending: articles.filter(a => a.status === 'pending').length,
    included: articles.filter(a => a.status === 'included').length,
    excluded: articles.filter(a => a.status === 'excluded').length,
    maybe: articles.filter(a => a.status === 'maybe').length,
  };

  const progress = ((counts.included + counts.excluded + counts.maybe) / counts.total) * 100;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('systematic.title')}</h1>
          <p className="text-muted-foreground mt-1">PRISMA-compliant systematic review workflow</p>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{counts.total}</div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-warning">{counts.pending}</div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-success">{counts.included}</div>
              <p className="text-sm text-muted-foreground">Included</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{counts.excluded}</div>
              <p className="text-sm text-muted-foreground">Excluded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-info">{counts.maybe}</div>
              <p className="text-sm text-muted-foreground">Maybe</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Screening Progress</span>
              <span className="text-sm text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        <Tabs defaultValue="screening" className="space-y-6">
          <TabsList>
            <TabsTrigger value="screening">{t('systematic.screening')}</TabsTrigger>
            <TabsTrigger value="pico">{t('systematic.pico')}</TabsTrigger>
            <TabsTrigger value="rob">{t('systematic.riskOfBias')}</TabsTrigger>
            <TabsTrigger value="prisma">{t('systematic.flowDiagram')}</TabsTrigger>
          </TabsList>

          {/* Screening Tab */}
          <TabsContent value="screening" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Title/Abstract Screening</CardTitle>
                <CardDescription>Review articles and decide on inclusion/exclusion</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Title / Abstract</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map(article => (
                      <TableRow key={article.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{article.title}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {article.abstract}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            article.status === 'included' ? 'bg-success' :
                            article.status === 'excluded' ? 'bg-destructive' :
                            article.status === 'maybe' ? 'bg-warning' : 'bg-muted'
                          }>
                            {article.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(article.id, 'included')}
                              className={article.status === 'included' ? 'bg-success/20' : ''}
                            >
                              <CheckCircle className="w-4 h-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(article.id, 'excluded')}
                              className={article.status === 'excluded' ? 'bg-destructive/20' : ''}
                            >
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(article.id, 'maybe')}
                              className={article.status === 'maybe' ? 'bg-warning/20' : ''}
                            >
                              <HelpCircle className="w-4 h-4 text-warning" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PICO Tab */}
          <TabsContent value="pico" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('systematic.pico')}</CardTitle>
                    <CardDescription>Extract PICO elements using AI</CardDescription>
                  </div>
                  <Button onClick={runPicoAnalysis} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                    Analyze PICO
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {picoResults ? (
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap p-4 bg-muted/50 rounded-lg">
                    {picoResults}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Analyze PICO" to extract PICO elements from articles</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk of Bias Tab */}
          <TabsContent value="rob" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('systematic.riskOfBias')}</CardTitle>
                    <CardDescription>Assess risk of bias using Cochrane criteria</CardDescription>
                  </div>
                  <Button onClick={runRobAnalysis} disabled={isAnalyzing || counts.included === 0}>
                    {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                    Assess Risk of Bias
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Study</TableHead>
                      {robDomains.map(domain => (
                        <TableHead key={domain} className="text-center">{domain}</TableHead>
                      ))}
                      <TableHead className="text-center">Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.filter(a => a.status === 'included').map(article => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium">{article.title.slice(0, 40)}...</TableCell>
                        {robDomains.map(domain => (
                          <TableCell key={domain} className="text-center">
                            <Select defaultValue="unclear">
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="moderate">Mod</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="unclear">?</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <Badge variant="outline">Unclear</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRISMA Flow Diagram */}
          <TabsContent value="prisma">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('systematic.flowDiagram')}</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4 py-8">
                  {/* Identification */}
                  <div className="w-64 p-4 rounded-lg bg-primary/10 border border-primary text-center">
                    <div className="font-medium">Identification</div>
                    <div className="text-2xl font-bold text-primary">{counts.total}</div>
                    <div className="text-sm text-muted-foreground">Records identified</div>
                  </div>
                  
                  <div className="w-px h-8 bg-border" />
                  
                  {/* Screening */}
                  <div className="w-64 p-4 rounded-lg bg-warning/10 border border-warning text-center">
                    <div className="font-medium">Screening</div>
                    <div className="text-2xl font-bold text-warning">{counts.pending + counts.included + counts.maybe}</div>
                    <div className="text-sm text-muted-foreground">Records screened</div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-px h-8 bg-border" />
                    <div className="w-48 p-3 rounded-lg bg-destructive/10 border border-destructive text-center">
                      <div className="text-sm">Excluded</div>
                      <div className="font-bold text-destructive">{counts.excluded}</div>
                    </div>
                  </div>
                  
                  {/* Eligibility */}
                  <div className="w-64 p-4 rounded-lg bg-info/10 border border-info text-center">
                    <div className="font-medium">Eligibility</div>
                    <div className="text-2xl font-bold text-info">{counts.included + counts.maybe}</div>
                    <div className="text-sm text-muted-foreground">Full-text assessed</div>
                  </div>
                  
                  <div className="w-px h-8 bg-border" />
                  
                  {/* Included */}
                  <div className="w-64 p-4 rounded-lg bg-success/10 border border-success text-center">
                    <div className="font-medium">Included</div>
                    <div className="text-2xl font-bold text-success">{counts.included}</div>
                    <div className="text-sm text-muted-foreground">Studies in review</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
