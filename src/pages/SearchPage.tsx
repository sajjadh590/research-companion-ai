import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Search, Loader2, BookOpen, ExternalLink, Download, Brain } from 'lucide-react';
import { searchArticles, analyzeArticles } from '@/lib/api';
import { Layout } from '@/components/Layout';
import { SaveToLibraryDialog } from '@/components/SaveToLibraryDialog';
import { ArticleChatDialog } from '@/components/ArticleChatDialog';
import { CitationGeneratorDialog } from '@/components/CitationGeneratorDialog';
import { StudyComparisonDialog } from '@/components/StudyComparisonDialog';
import type { Article } from '@/types/research';
import { useToast } from '@/hooks/use-toast';

const sources = [
  { id: 'pubmed', label: 'PubMed', color: 'bg-blue-500' },
  { id: 'openalex', label: 'OpenAlex', color: 'bg-green-500' },
  { id: 'semantic_scholar', label: 'Semantic Scholar', color: 'bg-purple-500' },
  { id: 'arxiv', label: 'arXiv', color: 'bg-orange-500' },
];

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState(['pubmed', 'openalex']);
  const [yearRange, setYearRange] = useState([2019, 2024]);
  const [maxResults, setMaxResults] = useState(20);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [expandedAbstract, setExpandedAbstract] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (selectedSources.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one source', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setArticles([]);
    setAnalysisResult('');

    try {
      const result = await searchArticles({
        query: query.trim(),
        sources: selectedSources,
        yearFrom: yearRange[0],
        yearTo: yearRange[1],
        maxResults,
        openAccessOnly,
      });

      if (result.error) {
        toast({ title: 'Search Error', description: result.error, variant: 'destructive' });
      } else {
        setArticles(result.articles);
        toast({ title: 'Search Complete', description: `Found ${result.articles.length} articles` });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to search articles', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyze = async (type: 'summarize' | 'unified_summary' | 'research_gaps' | 'pico' | 'key_findings') => {
    const selected = articles.filter(a => selectedArticles.has(a.id));
    if (selected.length === 0) {
      toast({ title: 'Error', description: 'Please select articles to analyze', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeArticles({
        type,
        articles: selected.map(a => ({ title: a.title, abstract: a.abstract })),
        language: i18n.language,
      });

      if (result.error) {
        toast({ title: 'Analysis Error', description: result.error, variant: 'destructive' });
      } else {
        setAnalysisResult(result.result);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to analyze articles', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId) ? prev.filter(s => s !== sourceId) : [...prev, sourceId]
    );
  };

  const toggleArticle = (articleId: string) => {
    setSelectedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map(a => a.id)));
    }
  };

  const exportResults = (format: 'csv' | 'json') => {
    const data = articles.filter(a => selectedArticles.size === 0 || selectedArticles.has(a.id));
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'articles.json';
      a.click();
    } else {
      const headers = ['Title', 'Authors', 'Year', 'Journal', 'DOI', 'Citations', 'Source'];
      const rows = data.map(a => [
        `"${a.title.replace(/"/g, '""')}"`,
        `"${a.authors.map(au => au.name).join('; ')}"`,
        a.publicationDate,
        `"${a.journal}"`,
        a.doi,
        a.citationsCount,
        a.source,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'articles.csv';
      a.click();
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('search.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('search.subtitle')}</p>
        </div>

        {/* Search Controls */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Search Input */}
            <div className="flex gap-3">
              <Input
                placeholder={t('search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{t('search.search')}</span>
              </Button>
            </div>

            {/* Sources */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t('search.sources')}</label>
              <div className="flex flex-wrap gap-3">
                {sources.map(source => (
                  <label
                    key={source.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                      selectedSources.includes(source.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedSources.includes(source.id)}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                    <span className={`w-2 h-2 rounded-full ${source.color}`} />
                    <span className="text-sm">{source.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('search.yearRange')}: {yearRange[0]} - {yearRange[1]}
                </label>
                <Slider
                  value={yearRange}
                  onValueChange={setYearRange}
                  min={1990}
                  max={2024}
                  step={1}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('search.maxResults')}: {maxResults}
                </label>
                <Slider
                  value={[maxResults]}
                  onValueChange={([v]) => setMaxResults(v)}
                  min={10}
                  max={100}
                  step={10}
                  className="mt-2"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={openAccessOnly} onCheckedChange={(c) => setOpenAccessOnly(c as boolean)} />
                  <span className="text-sm">{t('search.openAccess')}</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {articles.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('search.results')} ({articles.length})</CardTitle>
                  <CardDescription>{selectedArticles.size} selected</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedArticles.size === articles.length ? t('search.deselectAll') : t('search.selectAll')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportResults('csv')} className="gap-1">
                    <Download className="w-4 h-4" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportResults('json')} className="gap-1">
                    <Download className="w-4 h-4" /> JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Analysis Buttons */}
              <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAnalyze('summarize')}
                  disabled={isAnalyzing || selectedArticles.size === 0}
                  className="gap-1"
                >
                  <Brain className="w-4 h-4" />
                  {isAnalyzing ? t('search.analyzing') : t('search.individualSummaries')}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAnalyze('unified_summary')}
                  disabled={isAnalyzing || selectedArticles.size === 0}
                  className="gap-1"
                >
                  <Brain className="w-4 h-4" />
                  {t('search.unifiedSynthesis')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAnalyze('research_gaps')}
                  disabled={isAnalyzing || selectedArticles.size === 0}
                >
                  {t('search.researchGaps')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAnalyze('pico')}
                  disabled={isAnalyzing || selectedArticles.size === 0}
                >
                  {t('search.picoAnalysis')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAnalyze('key_findings')}
                  disabled={isAnalyzing || selectedArticles.size === 0}
                >
                  {t('search.keyFindings')}
                </Button>
                
                {/* New AI Tools */}
                <ArticleChatDialog 
                  articles={articles.filter(a => selectedArticles.has(a.id))} 
                />
                <CitationGeneratorDialog 
                  articles={articles.filter(a => selectedArticles.has(a.id))} 
                />
                <StudyComparisonDialog 
                  articles={articles.filter(a => selectedArticles.has(a.id))} 
                />
                <SaveToLibraryDialog 
                  articles={articles.filter(a => selectedArticles.has(a.id))} 
                />
              </div>

              {/* Analysis Result */}
              {analysisResult && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    {t('search.aiAnalysis')}
                  </h4>
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                    {analysisResult}
                  </div>
                </div>
              )}

              {/* Article List */}
              <div className="space-y-3">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className={`p-4 rounded-lg border transition-all ${
                      selectedArticles.has(article.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedArticles.has(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <h4 className="font-medium text-foreground leading-tight">{article.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {article.source}
                            </Badge>
                            {article.isOpenAccess && (
                              <Badge className="bg-success text-success-foreground text-xs">OA</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {article.authors.slice(0, 3).map(a => a.name).join(', ')}
                          {article.authors.length > 3 && ' et al.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{article.journal}</span>
                          <span>{article.publicationDate}</span>
                          {article.citationsCount > 0 && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {article.citationsCount} {t('search.citations')}
                            </span>
                          )}
                        </div>
                        {expandedAbstract === article.id && article.abstract && (
                          <p className="text-sm text-muted-foreground mt-3 p-3 bg-muted/50 rounded">
                            {article.abstract}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedAbstract(expandedAbstract === article.id ? null : article.id)}
                          >
                            {expandedAbstract === article.id ? t('search.hideAbstract') : t('search.viewAbstract')}
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="gap-1">
                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                              {t('search.view')}
                            </a>
                          </Button>
                          {article.pdfUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={article.pdfUrl} target="_blank" rel="noopener noreferrer">
                                PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
