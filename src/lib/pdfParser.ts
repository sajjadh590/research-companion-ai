/**
 * Client-side PDF Parser using pdf.js
 * Extracts text and attempts to preserve table structure as Markdown
 * 100% client-side - no server costs
 */

// PDF.js will be loaded from CDN to avoid bundling issues
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

let pdfjsLib: any = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  
  try {
    pdfjsLib = await import(/* @vite-ignore */ PDFJS_CDN);
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    return pdfjsLib;
  } catch (error) {
    console.error('Failed to load PDF.js:', error);
    throw new Error('PDF parsing library failed to load');
  }
}

export interface PDFParseResult {
  text: string;
  tables: string[]; // Markdown-formatted tables
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
  sections: {
    abstract?: string;
    methods?: string;
    results?: string;
    conclusions?: string;
  };
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

interface TextContent {
  items: TextItem[];
}

/**
 * Parse a PDF file and extract text with structure preservation
 */
export async function parsePDF(file: File): Promise<PDFParseResult> {
  const pdfjs = await loadPdfJs();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const metadata = await pdf.getMetadata().catch(() => ({}));
  const pageCount = pdf.numPages;
  
  let fullText = '';
  const allTables: string[] = [];
  
  // Process each page
  for (let i = 1; i <= Math.min(pageCount, 50); i++) { // Limit to 50 pages
    const page = await pdf.getPage(i);
    const textContent: TextContent = await page.getTextContent();
    
    const { pageText, tables } = processPageContent(textContent);
    fullText += `\n--- Page ${i} ---\n${pageText}`;
    allTables.push(...tables);
  }
  
  // Extract common sections from medical papers
  const sections = extractSections(fullText);
  
  return {
    text: fullText.trim(),
    tables: allTables,
    pageCount,
    metadata: {
      title: metadata.info?.Title,
      author: metadata.info?.Author,
      subject: metadata.info?.Subject,
    },
    sections,
  };
}

/**
 * Process text content from a single page
 * Attempts to detect and format tables
 */
function processPageContent(textContent: TextContent): { pageText: string; tables: string[] } {
  const items = textContent.items.filter((item): item is TextItem => 'str' in item);
  
  if (items.length === 0) {
    return { pageText: '', tables: [] };
  }
  
  // Group items by Y position (rows)
  const rows = new Map<number, TextItem[]>();
  
  items.forEach(item => {
    const y = Math.round(item.transform[5]); // Y position
    if (!rows.has(y)) {
      rows.set(y, []);
    }
    rows.get(y)!.push(item);
  });
  
  // Sort rows by Y position (top to bottom)
  const sortedYPositions = Array.from(rows.keys()).sort((a, b) => b - a);
  
  // Build text and detect potential tables
  const lines: string[] = [];
  const potentialTableRows: string[][] = [];
  let inTable = false;
  
  sortedYPositions.forEach(y => {
    const rowItems = rows.get(y)!;
    // Sort items left to right
    rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
    
    // Detect if this might be a table row (multiple spaced items)
    const xPositions = rowItems.map(item => item.transform[4]);
    const hasRegularSpacing = detectRegularSpacing(xPositions);
    
    if (hasRegularSpacing && rowItems.length >= 2) {
      // Likely a table row
      const cells = rowItems.map(item => item.str.trim()).filter(s => s);
      if (cells.length >= 2) {
        potentialTableRows.push(cells);
        inTable = true;
      }
    } else {
      // Regular text
      if (inTable && potentialTableRows.length >= 2) {
        // End of table - format it
        const tableMarkdown = formatTableAsMarkdown(potentialTableRows);
        lines.push(tableMarkdown);
        potentialTableRows.length = 0;
      }
      inTable = false;
      
      const lineText = rowItems.map(item => item.str).join(' ').trim();
      if (lineText) {
        lines.push(lineText);
      }
    }
  });
  
  // Handle any remaining table rows
  if (potentialTableRows.length >= 2) {
    const tableMarkdown = formatTableAsMarkdown(potentialTableRows);
    lines.push(tableMarkdown);
  }
  
  // Extract tables from the page
  const tables: string[] = [];
  const tableRegex = /\|.*\|[\s\S]*?\|.*\|(?:\n|$)/g;
  const pageText = lines.join('\n');
  
  let match;
  while ((match = tableRegex.exec(pageText)) !== null) {
    tables.push(match[0].trim());
  }
  
  return { pageText, tables };
}

/**
 * Detect if X positions have regular spacing (likely a table)
 */
function detectRegularSpacing(xPositions: number[]): boolean {
  if (xPositions.length < 2) return false;
  
  const sorted = [...xPositions].sort((a, b) => a - b);
  const gaps: number[] = [];
  
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }
  
  // Check if gaps are relatively uniform (within 50% variance)
  if (gaps.length === 0) return false;
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, b) => a + Math.abs(b - avgGap), 0) / gaps.length;
  
  return avgGap > 30 && variance < avgGap * 0.5; // Minimum 30px gap, low variance
}

/**
 * Format detected table rows as Markdown
 */
function formatTableAsMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '';
  
  // Normalize column count
  const maxCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map(row => {
    while (row.length < maxCols) row.push('');
    return row;
  });
  
  // Build markdown table
  const lines: string[] = [];
  
  // Header row
  lines.push('| ' + normalizedRows[0].join(' | ') + ' |');
  
  // Separator
  lines.push('| ' + normalizedRows[0].map(() => '---').join(' | ') + ' |');
  
  // Data rows
  for (let i = 1; i < normalizedRows.length; i++) {
    lines.push('| ' + normalizedRows[i].join(' | ') + ' |');
  }
  
  return '\n' + lines.join('\n') + '\n';
}

/**
 * Extract common sections from medical/research papers
 */
function extractSections(text: string): PDFParseResult['sections'] {
  const sections: PDFParseResult['sections'] = {};
  
  // Common section patterns
  const patterns = {
    abstract: /(?:abstract|summary)[:\s]*\n?([\s\S]*?)(?=\n(?:introduction|background|keywords|methods|$))/i,
    methods: /(?:methods?|materials? and methods?|methodology)[:\s]*\n?([\s\S]*?)(?=\n(?:results?|findings?|discussion|$))/i,
    results: /(?:results?|findings?)[:\s]*\n?([\s\S]*?)(?=\n(?:discussion|conclusions?|$))/i,
    conclusions: /(?:conclusions?|summary|discussion)[:\s]*\n?([\s\S]*?)(?=\n(?:references?|acknowledgements?|conflicts?|$))/i,
  };
  
  for (const [section, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const content = match[1].trim().slice(0, 2000); // Limit length
      if (content.length > 50) { // Only include if substantial
        sections[section as keyof typeof sections] = content;
      }
    }
  }
  
  return sections;
}

/**
 * Parse a PDF from URL (for articles with PDF links)
 */
export async function parsePDFFromURL(url: string): Promise<PDFParseResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }
  
  const blob = await response.blob();
  const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
  
  return parsePDF(file);
}

/**
 * Simple text extraction without table detection (faster)
 */
export async function extractTextSimple(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const textParts: string[] = [];
  
  for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }
  
  return textParts.join('\n\n');
}
