import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, HelpCircle, FileText, Download, Brain, Loader2, ExternalLink, Search, Trash2, Upload } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { analyzeArticles } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSelectedArticles } from '@/hooks/useSelectedArticles';
import { ArticleSourceBadge } from '@/components/ArticleSourceBadge';
import { parsePDF } from '@/lib/pdfParser';

interface ScreeningArticle {
  id: string;
  title: string;
  abstract: string;
  status: 'pending' | 'included' | 'excluded' | 'maybe';
  exclusionReason?: string;
  doi?: string;
  pmid?: string;
  source?: string;
  sourceId?: string;
  url?: string;
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
  const navigate = useNavigate();
  const { selectedArticles: globalArticles, clearArticles, count: globalCount } = useSelectedArticles();

  // Convert global articles to screening articles
  const [articles, setArticles] = useState<ScreeningArticle[]>([]);

  // Sync with global articles
  useEffect(() => {
    const screeningArticles: ScreeningArticle[] = globalArticles.map(article => ({
      id: article.id,
      title: article.title,
      abstract: article.abstract || '',
      status: 'pending' as const,
      doi: article.doi,
      source: article.source,
      sourceId: article.sourceId,
      url: article.url,
    }));
    setArticles(screeningArticles);
  }, [globalArticles]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [picoResults, setPicoResults] = useState<string>('');
  const [robResults, setRobResults] = useState<Map<string, Record<string, 'low' | 'moderate' | 'high' | 'unclear'>>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handleClearWorkspace = () => {
    clearArticles();
    toast({ 
      title: t('systematic.workspaceCleared'), 
      description: t('systematic.allArticlesRemoved'),
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const newArticles: ScreeningArticle[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const parsed = await parsePDF(file);
        
        // Extract title from first line or filename
        const lines = parsed.text.split('\n').filter(l => l.trim());
        const title = lines[0]?.slice(0, 200) || file.name.replace('.pdf', '');
        
        // Extract abstract - look for "Abstract" section or use first 500 words
        let abstract = '';
        const abstractMatch = parsed.text.match(/abstract[:\s]*(.{100,1500})/i);
        if (abstractMatch) {
          abstract = abstractMatch[1].trim();
        } else {
          abstract = parsed.text.slice(0, 1500).trim();
        }

        newArticles.push({
          id: `upload-${Date.now()}-${i}`,
          title,
          abstract,
          status: 'pending',
          source: 'Upload',
          sourceId: file.name,
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
        toast({
          title: t('common.error'),
          description: `${t('systematic.uploadFailed')}: ${file.name}`,
          variant: 'destructive',
        });
      }
    }

    if (newArticles.length > 0) {
      setArticles(prev => [...prev, ...newArticles]);
      toast({
        title: t('systematic.uploadSuccess'),
        description: t('systematic.filesUploaded', { count: newArticles.length }),
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const counts = {
    total: articles.length,
    pending: articles.filter(a => a.status === 'pending').length,
    included: articles.filter(a => a.status === 'included').length,
    excluded: articles.filter(a => a.status === 'excluded').length,
    maybe: articles.filter(a => a.status === 'maybe').length,
  };

  const progress = counts.total > 0 ? ((counts.included + counts.excluded + counts.maybe) / counts.total) * 100 : 0;

  // Empty state - no articles
  if (articles.length === 0) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('systematic.title')}</h1>
            <p className="text-muted-foreground mt-1">PRISMA-compliant systematic review workflow</p>
          </div>

          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('systematic.noArticles')}</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                {t('systematic.addArticlesFromSearch')}
              </p>
              <Button onClick={() => navigate('/search')} className="gap-2">
                <Search className="w-4 h-4" />
                {t('systematic.goToSearch')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('systematic.title')}</h1>
            <p className="text-muted-foreground mt-1">PRISMA-compliant systematic review workflow</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {globalCount} {t('systematic.articlesInWorkspace')}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleClearWorkspace} className="gap-1 text-destructive">
              <Trash2 className="w-4 h-4" />
              {t('systematic.clearWorkspace')}
            </Button>
          </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('systematic.screeningTitle')}</CardTitle>
                    <CardDescription>{t('systematic.screeningDesc')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={pdfInputRef}
                      onChange={handlePdfUpload}
                      accept=".pdf"
                      multiple
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-2"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {t('systematic.uploadPdfs')}
                    </Button>
                  </div>
                </div>
                {isUploading && (
                  <div className="mt-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('systematic.uploadingFiles')} ({uploadProgress.toFixed(0)}%)
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-2/5">Title / Abstract</TableHead>
                      <TableHead>Source / Links</TableHead>
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
                          <div className="flex flex-col gap-1.5">
                            {article.doi && (
                              <a
                                href={`https://doi.org/${article.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                DOI <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {article.pmid && (
                              <a
                                href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                PMID:{article.pmid} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {article.source && (
                              <Badge variant="outline" className="w-fit text-xs">
                                {article.source}
                              </Badge>
                            )}
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
