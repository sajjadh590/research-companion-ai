import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, createErrorResponse } from "../_shared/utils.ts";
import { API_CONFIG, buildPubMedUrl, getSemanticScholarHeaders, getOpenAlexHeaders } from "../_shared/config.ts";

interface SearchParams {
  query: string;
  sources: string[];
  yearFrom?: number;
  yearTo?: number;
  maxResults?: number;
  openAccessOnly?: boolean;
}

interface Article {
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

// Search PubMed (uses API key if configured for 10 req/sec instead of 3)
async function searchPubMed(query: string, maxResults: number, yearFrom?: number, yearTo?: number): Promise<Article[]> {
  try {
    let searchQuery = query;
    if (yearFrom && yearTo) {
      searchQuery += ` AND ${yearFrom}:${yearTo}[dp]`;
    }
    
    // Build URL with optional API key for higher rate limits
    const searchUrl = buildPubMedUrl('esearch.fcgi', {
      db: 'pubmed',
      term: searchQuery,
      retmax: maxResults.toString(),
      retmode: 'json',
    });
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];
    
    // Build fetch URL with optional API key
    const fetchUrl = buildPubMedUrl('efetch.fcgi', {
      db: 'pubmed',
      id: ids.join(','),
      retmode: 'xml',
    });
    
    const fetchRes = await fetch(fetchUrl);
    const xmlText = await fetchRes.text();
    
    const articles: Article[] = [];
    const articleMatches = xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    
    for (const articleXml of articleMatches) {
      const pmid = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || '';
      const title = articleXml.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/)?.[1] || '';
      const abstractText = articleXml.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/)?.[1] || '';
      const journal = articleXml.match(/<Title>([^<]+)<\/Title>/)?.[1] || '';
      const year = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d+)<\/Year>/)?.[1] || '';
      const doi = articleXml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)?.[1] || '';
      
      const authorMatches = articleXml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];
      const authors = authorMatches.map(auth => {
        const lastName = auth.match(/<LastName>([^<]+)<\/LastName>/)?.[1] || '';
        const foreName = auth.match(/<ForeName>([^<]+)<\/ForeName>/)?.[1] || '';
        return { name: `${foreName} ${lastName}`.trim() };
      }).filter(a => a.name);
      
      articles.push({
        id: `pubmed-${pmid}`,
        source: 'PubMed',
        sourceId: pmid,
        title,
        authors,
        abstract: abstractText,
        publicationDate: year,
        journal,
        doi,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        citationsCount: 0,
        pdfUrl: null,
        isOpenAccess: false,
      });
    }
    
    return articles;
  } catch (error) {
    console.error('PubMed search error:', error);
    return [];
  }
}

// Search OpenAlex (uses configured email for polite pool access)
async function searchOpenAlex(query: string, maxResults: number, yearFrom?: number, yearTo?: number, openAccessOnly?: boolean): Promise<Article[]> {
  try {
    let url = `${API_CONFIG.openAlex.baseUrl}/works?search=${encodeURIComponent(query)}&per_page=${maxResults}`;
    
    const filters: string[] = [];
    if (yearFrom) filters.push(`from_publication_date:${yearFrom}-01-01`);
    if (yearTo) filters.push(`to_publication_date:${yearTo}-12-31`);
    if (openAccessOnly) filters.push(`is_oa:true`);
    
    if (filters.length > 0) {
      url += `&filter=${filters.join(',')}`;
    }
    
    const res = await fetch(url, {
      headers: getOpenAlexHeaders()
    });
    const data = await res.json();
    
    return (data.results || []).map((work: any) => ({
      id: `openalex-${work.id.replace('https://openalex.org/', '')}`,
      source: 'OpenAlex',
      sourceId: work.id,
      title: work.title || '',
      authors: (work.authorships || []).map((a: any) => ({ name: a.author?.display_name || '' })),
      abstract: work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : '',
      publicationDate: work.publication_year?.toString() || '',
      journal: work.primary_location?.source?.display_name || '',
      doi: work.doi?.replace('https://doi.org/', '') || '',
      url: work.doi || work.id,
      citationsCount: work.cited_by_count || 0,
      pdfUrl: work.open_access?.oa_url || null,
      isOpenAccess: work.open_access?.is_oa || false,
    }));
  } catch (error) {
    console.error('OpenAlex search error:', error);
    return [];
  }
}

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map(w => w[1]).join(' ');
}

// Search Semantic Scholar (uses API key if configured for stable rate limits)
async function searchSemanticScholar(query: string, maxResults: number, yearFrom?: number, yearTo?: number, openAccessOnly?: boolean): Promise<Article[]> {
  try {
    let url = `${API_CONFIG.semanticScholar.baseUrl}/paper/search?query=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 100)}&fields=paperId,title,abstract,authors,year,venue,citationCount,openAccessPdf,externalIds`;
    
    if (yearFrom && yearTo) {
      url += `&year=${yearFrom}-${yearTo}`;
    }
    if (openAccessOnly) {
      url += `&openAccessPdf`;
    }
    
    // Use API key headers if configured
    const res = await fetch(url, {
      headers: getSemanticScholarHeaders()
    });
    const data = await res.json();
    
    return (data.data || []).map((paper: any) => ({
      id: `s2-${paper.paperId}`,
      source: 'Semantic Scholar',
      sourceId: paper.paperId,
      title: paper.title || '',
      authors: (paper.authors || []).map((a: any) => ({ name: a.name || '' })),
      abstract: paper.abstract || '',
      publicationDate: paper.year?.toString() || '',
      journal: paper.venue || '',
      doi: paper.externalIds?.DOI || '',
      url: `https://www.semanticscholar.org/paper/${paper.paperId}`,
      citationsCount: paper.citationCount || 0,
      pdfUrl: paper.openAccessPdf?.url || null,
      isOpenAccess: !!paper.openAccessPdf,
    }));
  } catch (error) {
    console.error('Semantic Scholar search error:', error);
    return [];
  }
}

// Search arXiv (no API key available)
async function searchArxiv(query: string, maxResults: number): Promise<Article[]> {
  try {
    const url = `${API_CONFIG.arxiv.baseUrl}/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`;
    const res = await fetch(url);
    const xmlText = await res.text();
    
    const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    
    return entries.map(entry => {
      const id = entry.match(/<id>([^<]+)<\/id>/)?.[1]?.split('/abs/')?.[1] || '';
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(/\n/g, ' ').trim() || '';
      const summary = entry.match(/<summary>([^<]+)<\/summary>/)?.[1]?.replace(/\n/g, ' ').trim() || '';
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]?.slice(0, 4) || '';
      
      const authorMatches = entry.match(/<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g) || [];
      const authors = authorMatches.map(a => ({ name: a.match(/<name>([^<]+)<\/name>/)?.[1] || '' }));
      
      return {
        id: `arxiv-${id}`,
        source: 'arXiv',
        sourceId: id,
        title,
        authors,
        abstract: summary,
        publicationDate: published,
        journal: 'arXiv Preprint',
        doi: '',
        url: `https://arxiv.org/abs/${id}`,
        citationsCount: 0,
        pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
        isOpenAccess: true,
      };
    });
  } catch (error) {
    console.error('arXiv search error:', error);
    return [];
  }
}

// Remove duplicates based on DOI or title similarity
function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Map<string, Article>();
  
  for (const article of articles) {
    const key = article.doi || article.title.toLowerCase().slice(0, 50);
    if (!seen.has(key)) {
      seen.set(key, article);
    } else {
      const existing = seen.get(key)!;
      if ((article.citationsCount > existing.citationsCount) || (article.pdfUrl && !existing.pdfUrl)) {
        seen.set(key, { ...existing, ...article, citationsCount: Math.max(article.citationsCount, existing.citationsCount) });
      }
    }
  }
  
  return Array.from(seen.values());
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Search is public - no authentication required for basic search
    const { query, sources, yearFrom, yearTo, maxResults = 20, openAccessOnly = false }: SearchParams = await req.json();
    
    // Input validation
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (query.length > 500) {
      return new Response(JSON.stringify({ error: 'Query too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one source is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validSources = ['pubmed', 'openalex', 'semantic_scholar', 'arxiv'];
    const filteredSources = sources.filter(s => validSources.includes(s));
    if (filteredSources.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid sources' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Searching for: "${query}" in sources: ${filteredSources.join(', ')}`);
    
    const perSource = Math.ceil(Math.min(maxResults, 100) / filteredSources.length);
    const searchPromises: Promise<Article[]>[] = [];
    
    if (filteredSources.includes('pubmed')) {
      searchPromises.push(searchPubMed(query, perSource, yearFrom, yearTo));
    }
    if (filteredSources.includes('openalex')) {
      searchPromises.push(searchOpenAlex(query, perSource, yearFrom, yearTo, openAccessOnly));
    }
    if (filteredSources.includes('semantic_scholar')) {
      searchPromises.push(searchSemanticScholar(query, perSource, yearFrom, yearTo, openAccessOnly));
    }
    if (filteredSources.includes('arxiv')) {
      searchPromises.push(searchArxiv(query, perSource));
    }
    
    const results = await Promise.all(searchPromises);
    const allArticles = results.flat();
    const dedupedArticles = deduplicateArticles(allArticles);
    
    dedupedArticles.sort((a, b) => b.citationsCount - a.citationsCount);
    
    console.log(`Found ${dedupedArticles.length} unique articles`);
    
    return new Response(JSON.stringify({ articles: dedupedArticles.slice(0, Math.min(maxResults, 100)) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(corsHeaders, error, 'Search failed. Please try again.');
  }
});
