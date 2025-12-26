import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Quote, Copy, Check, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/types/research';

interface CitationGeneratorDialogProps {
  articles: Article[];
  trigger?: React.ReactNode;
}

type CitationStyle = 'apa' | 'vancouver' | 'harvard' | 'mla' | 'chicago';

export function CitationGeneratorDialog({ articles, trigger }: CitationGeneratorDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [style, setStyle] = useState<CitationStyle>('apa');

  const formatAuthors = (authors: { name: string }[], style: CitationStyle): string => {
    if (authors.length === 0) return 'Unknown Author';
    
    const formatName = (name: string, style: CitationStyle) => {
      const parts = name.split(' ');
      if (parts.length === 1) return name;
      
      const lastName = parts[parts.length - 1];
      const firstNames = parts.slice(0, -1);
      
      switch (style) {
        case 'apa':
        case 'harvard':
          return `${lastName}, ${firstNames.map(n => n[0] + '.').join(' ')}`;
        case 'vancouver':
          return `${lastName} ${firstNames.map(n => n[0]).join('')}`;
        case 'mla':
          return authors.indexOf({ name }) === 0 
            ? `${lastName}, ${firstNames.join(' ')}`
            : `${firstNames.join(' ')} ${lastName}`;
        case 'chicago':
          return `${lastName}, ${firstNames.join(' ')}`;
        default:
          return name;
      }
    };

    if (style === 'vancouver') {
      if (authors.length > 6) {
        return authors.slice(0, 6).map(a => formatName(a.name, style)).join(', ') + ', et al';
      }
      return authors.map(a => formatName(a.name, style)).join(', ');
    }

    if (authors.length === 1) {
      return formatName(authors[0].name, style);
    }
    
    if (authors.length === 2) {
      return `${formatName(authors[0].name, style)} & ${formatName(authors[1].name, style)}`;
    }
    
    if (authors.length > 7) {
      return `${formatName(authors[0].name, style)} et al.`;
    }

    const allButLast = authors.slice(0, -1).map(a => formatName(a.name, style)).join(', ');
    const last = formatName(authors[authors.length - 1].name, style);
    return `${allButLast}, & ${last}`;
  };

  const getYear = (date: string | null): string => {
    if (!date) return 'n.d.';
    const match = date.match(/\d{4}/);
    return match ? match[0] : 'n.d.';
  };

  const generateCitation = (article: Article, style: CitationStyle): string => {
    const authors = formatAuthors(article.authors, style);
    const year = getYear(article.publicationDate);
    const title = article.title;
    const journal = article.journal || 'Unknown Journal';
    const doi = article.doi ? `https://doi.org/${article.doi}` : '';

    switch (style) {
      case 'apa':
        return `${authors} (${year}). ${title}. ${journal}. ${doi}`;
      
      case 'vancouver':
        return `${authors}. ${title}. ${journal}. ${year}. ${doi ? `Available from: ${doi}` : ''}`;
      
      case 'harvard':
        return `${authors} (${year}) '${title}', ${journal}. ${doi ? `Available at: ${doi}` : ''}`;
      
      case 'mla':
        return `${authors}. "${title}." ${journal}, ${year}. ${doi ? `${doi}` : ''}`;
      
      case 'chicago':
        return `${authors}. "${title}." ${journal} (${year}). ${doi}`;
      
      default:
        return `${authors} (${year}). ${title}. ${journal}.`;
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: t('common.copied'), description: '' });
  };

  const exportAll = () => {
    const citations = articles.map(a => generateCitation(a, style)).join('\n\n');
    const blob = new Blob([citations], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citations-${style}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const styleLabels: Record<CitationStyle, string> = {
    apa: 'APA 7th',
    vancouver: 'Vancouver',
    harvard: 'Harvard',
    mla: 'MLA 9th',
    chicago: 'Chicago',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm">
            <Quote className="w-4 h-4 mr-1" />
            {t('citation.title')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Quote className="w-5 h-5" />
            {t('citation.title')} ({articles.length})
          </DialogTitle>
        </DialogHeader>

        <Tabs value={style} onValueChange={(v) => setStyle(v as CitationStyle)}>
          <div className="flex items-center justify-between">
            <TabsList>
              {Object.entries(styleLabels).map(([key, label]) => (
                <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
              ))}
            </TabsList>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download className="w-4 h-4 mr-1" />
              {t('citation.exportTxt')}
            </Button>
          </div>

          {Object.keys(styleLabels).map((s) => (
            <TabsContent key={s} value={s}>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {articles.map((article, index) => {
                    const citation = generateCitation(article, s as CitationStyle);
                    return (
                      <div
                        key={article.id}
                        className="p-3 rounded-lg bg-muted/50 border border-border group"
                      >
                        <p className="text-sm text-foreground leading-relaxed">
                          {citation}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(citation, index)}
                        >
                          {copiedIndex === index ? (
                            <><Check className="w-3 h-3 mr-1" /> {t('common.copied')}</>
                          ) : (
                            <><Copy className="w-3 h-3 mr-1" /> {t('common.copy')}</>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
