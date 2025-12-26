import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TableProperties, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/types/research';

interface StudyComparisonDialogProps {
  articles: Article[];
  trigger?: React.ReactNode;
}

interface ComparisonData {
  title: string;
  population: string;
  intervention: string;
  comparison: string;
  outcome: string;
  design: string;
  sampleSize: string;
  keyFindings: string;
}

export function StudyComparisonDialog({ articles, trigger }: StudyComparisonDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);

  const generateComparison = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('compare-studies', {
        body: {
          articles: articles.map(a => ({
            title: a.title,
            abstract: a.abstract,
            authors: a.authors.map(au => au.name).join(', '),
          }))
        }
      });

      if (error) throw error;

      setComparisonData(data.comparison);
    } catch (error) {
      console.error('Comparison error:', error);
      toast({ title: 'Error', description: 'Failed to generate comparison', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const exportTable = () => {
    const headers = ['Title', 'Population', 'Intervention', 'Comparison', 'Outcome', 'Design', 'Sample Size', 'Key Findings'];
    const rows = comparisonData.map(d => [
      d.title,
      d.population,
      d.intervention,
      d.comparison,
      d.outcome,
      d.design,
      d.sampleSize,
      d.keyFindings,
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm">
            <TableProperties className="w-4 h-4 mr-1" />
            Compare Studies
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableProperties className="w-5 h-5" />
            Study Comparison Table ({articles.length} studies)
          </DialogTitle>
        </DialogHeader>

        {comparisonData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <TableProperties className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              AI will analyze {articles.length} articles and extract key characteristics for comparison
            </p>
            <Button onClick={generateComparison} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                'Generate Comparison Table'
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={exportTable}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Study</TableHead>
                    <TableHead className="min-w-[120px]">Population</TableHead>
                    <TableHead className="min-w-[120px]">Intervention</TableHead>
                    <TableHead className="min-w-[120px]">Comparison</TableHead>
                    <TableHead className="min-w-[120px]">Outcome</TableHead>
                    <TableHead className="min-w-[100px]">Design</TableHead>
                    <TableHead className="min-w-[80px]">N</TableHead>
                    <TableHead className="min-w-[200px]">Key Findings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((study, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-sm">{study.title}</TableCell>
                      <TableCell className="text-sm">{study.population}</TableCell>
                      <TableCell className="text-sm">{study.intervention}</TableCell>
                      <TableCell className="text-sm">{study.comparison}</TableCell>
                      <TableCell className="text-sm">{study.outcome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{study.design}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{study.sampleSize}</TableCell>
                      <TableCell className="text-sm">{study.keyFindings}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
