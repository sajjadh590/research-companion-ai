import { ExternalLink, FileText, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Article } from '@/types/research';

interface ArticleSourceBadgeProps {
  article: Article;
  showLinks?: boolean;
  size?: 'sm' | 'md';
}

const sourceColors: Record<string, string> = {
  pubmed: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  openalex: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  semantic_scholar: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  arxiv: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
};

const sourceLabels: Record<string, string> = {
  pubmed: 'PubMed',
  openalex: 'OpenAlex',
  semantic_scholar: 'Semantic Scholar',
  arxiv: 'arXiv',
};

/**
 * Get PubMed ID from article
 */
function getPubMedId(article: Article): string | null {
  if (article.source === 'pubmed' && article.sourceId) {
    return article.sourceId;
  }
  // Try to extract from URL
  if (article.url?.includes('pubmed.ncbi.nlm.nih.gov')) {
    const match = article.url.match(/\/(\d+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Get DOI link
 */
function getDOILink(doi: string): string {
  if (doi.startsWith('http')) return doi;
  return `https://doi.org/${doi.replace(/^doi:?\s*/i, '')}`;
}

/**
 * Get PubMed link
 */
function getPubMedLink(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}`;
}

export function ArticleSourceBadge({ article, showLinks = true, size = 'md' }: ArticleSourceBadgeProps) {
  const pmid = getPubMedId(article);
  const hasDoi = article.doi && article.doi.length > 0;
  const sourceColor = sourceColors[article.source] || 'bg-muted text-muted-foreground border-border';
  const sourceLabel = sourceLabels[article.source] || article.source;
  
  const badgeSize = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const buttonSize = size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm';

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        {/* Source Badge */}
        <Badge variant="outline" className={`${sourceColor} ${badgeSize} font-medium`}>
          {sourceLabel}
        </Badge>
        
        {showLinks && (
          <>
            {/* DOI Link */}
            {hasDoi && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${buttonSize} gap-1 hover:bg-primary/10`}
                    asChild
                  >
                    <a
                      href={getDOILink(article.doi)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className={iconSize} />
                      DOI
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Open DOI: {article.doi}</p>
                  <p className="text-xs text-muted-foreground mt-1">Verify this source</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* PubMed ID Link */}
            {pmid && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${buttonSize} gap-1 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30`}
                    asChild
                  >
                    <a
                      href={getPubMedLink(pmid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className={iconSize} />
                      PMID: {pmid}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Open in PubMed</p>
                  <p className="text-xs text-muted-foreground mt-1">View full article details</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* External Link (if no DOI or PMID) */}
            {!hasDoi && !pmid && article.url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${buttonSize} gap-1`}
                    asChild
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className={iconSize} />
                      View Source
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Open source article</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        
        {/* Open Access indicator */}
        {article.isOpenAccess && (
          <Badge className="bg-success/20 text-success border-success/30 text-xs">
            Open Access
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact inline source link for tables
 */
export function ArticleSourceLink({ article, showPmid = true }: { article: Article; showPmid?: boolean }) {
  const pmid = getPubMedId(article);
  const hasDoi = article.doi && article.doi.length > 0;
  
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {hasDoi && (
        <a
          href={getDOILink(article.doi)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          DOI
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
      {showPmid && pmid && (
        <a
          href={getPubMedLink(pmid)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          PMID:{pmid}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}
