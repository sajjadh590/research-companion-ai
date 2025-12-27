import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Loader2, User, Bot, FileUp, FileText, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/types/research';
import { parsePDF, type PDFParseResult } from '@/lib/pdfParser';

interface ArticleChatDialogProps {
  articles: Article[];
  trigger?: React.ReactNode;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UploadedPDF {
  name: string;
  content: PDFParseResult;
}

export function ArticleChatDialog({ articles, trigger }: ArticleChatDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([]);
  const [isParsingPDF, setIsParsingPDF] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: t('chat.welcome', { count: articles.length })
      }]);
    }
  }, [open, articles.length, t]);

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsingPDF(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') {
          toast({ title: 'Invalid file', description: 'Please upload PDF files only', variant: 'destructive' });
          continue;
        }

        const parsed = await parsePDF(file);
        
        setUploadedPDFs(prev => [...prev, { name: file.name, content: parsed }]);
        toast({ title: 'PDF Parsed', description: `Extracted ${parsed.pageCount} pages from ${file.name}` });
      }
    } catch (error) {
      console.error('PDF parsing error:', error);
      toast({ title: 'PDF Error', description: 'Failed to parse PDF. Try a different file.', variant: 'destructive' });
    } finally {
      setIsParsingPDF(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePDF = (index: number) => {
    setUploadedPDFs(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context from articles + uploaded PDFs
      const pdfContext = uploadedPDFs.map(pdf => {
        const sections = pdf.content.sections;
        let text = `\n\n--- PDF: ${pdf.name} ---\n`;
        if (sections.abstract) text += `Abstract: ${sections.abstract}\n`;
        if (sections.methods) text += `Methods: ${sections.methods}\n`;
        if (sections.results) text += `Results: ${sections.results}\n`;
        if (sections.conclusions) text += `Conclusions: ${sections.conclusions}\n`;
        if (pdf.content.tables.length > 0) {
          text += `\nExtracted Tables:\n${pdf.content.tables.join('\n\n')}`;
        }
        return text;
      }).join('\n');

      const { data, error } = await supabase.functions.invoke('chat-with-articles', {
        body: {
          question: userMessage,
          articles: articles.map(a => ({ 
            title: a.title, 
            abstract: a.abstract,
            authors: a.authors.map(au => au.name).join(', '),
            journal: a.journal,
            year: a.publicationDate
          })),
          pdfContext: pdfContext || undefined,
          history: messages.slice(-6),
          language: i18n.language
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({ title: t('common.error'), description: t('chat.error'), variant: 'destructive' });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: t('chat.error')
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm">
            <MessageCircle className="w-4 h-4 mr-1" />
            {t('chat.title')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('chat.chatWith')} {articles.length} {t('chat.articles')}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Uploaded PDFs */}
        {uploadedPDFs.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {uploadedPDFs.map((pdf, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {pdf.name.slice(0, 20)}...
                <button onClick={() => removePDF(index)} className="ml-1 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-border">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePDFUpload}
            accept=".pdf"
            multiple
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingPDF}
            title="Upload PDF for analysis"
          >
            {isParsingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
