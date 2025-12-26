import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Edit, Check, Download, FileText, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { generateProposal } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  isApproved: boolean;
  isEditing: boolean;
}

const sectionTypes = [
  { value: 'introduction', label: 'Introduction', labelFa: 'مقدمه' },
  { value: 'literature_review', label: 'Literature Review', labelFa: 'مرور ادبیات' },
  { value: 'objectives', label: 'Objectives & Hypotheses', labelFa: 'اهداف و فرضیات' },
  { value: 'methodology', label: 'Methodology', labelFa: 'روش‌شناسی' },
  { value: 'timeline', label: 'Timeline', labelFa: 'زمان‌بندی' },
  { value: 'references', label: 'References', labelFa: 'منابع' },
];

export default function ProposalPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = ['fa', 'ar'].includes(i18n.language);

  const [topic, setTopic] = useState('');
  const [researchQuestions, setResearchQuestions] = useState<string[]>(['']);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSection, setCurrentSection] = useState('introduction');

  const addQuestion = () => {
    setResearchQuestions([...researchQuestions, '']);
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...researchQuestions];
    updated[index] = value;
    setResearchQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (researchQuestions.length > 1) {
      setResearchQuestions(researchQuestions.filter((_, i) => i !== index));
    }
  };

  const generateSection = async (sectionType: string) => {
    if (!topic.trim()) {
      toast({ title: 'Error', description: 'Please enter a research topic', variant: 'destructive' });
      return;
    }

    const validQuestions = researchQuestions.filter(q => q.trim());
    if (validQuestions.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one research question', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const previousSections: Record<string, string> = {};
      sections.filter(s => s.isApproved).forEach(s => {
        previousSections[s.type] = s.content;
      });

      const result = await generateProposal({
        topic,
        researchQuestions: validQuestions,
        articles: [], // Could be populated from library
        section: sectionType as 'introduction' | 'literature_review' | 'methodology' | 'objectives' | 'timeline' | 'references',
        language: i18n.language,
        previousSections,
      });

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }

      const sectionLabel = sectionTypes.find(s => s.value === sectionType);
      const newSection: ProposalSection = {
        id: crypto.randomUUID(),
        type: sectionType,
        title: isRTL ? sectionLabel?.labelFa || sectionType : sectionLabel?.label || sectionType,
        content: result.content,
        isApproved: false,
        isEditing: false,
      };

      // Replace existing section of same type or add new
      const existingIndex = sections.findIndex(s => s.type === sectionType);
      if (existingIndex >= 0) {
        const updated = [...sections];
        updated[existingIndex] = newSection;
        setSections(updated);
      } else {
        setSections([...sections, newSection]);
      }

      toast({ title: 'Success', description: 'Section generated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate section', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleEdit = (id: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, isEditing: !s.isEditing } : s
    ));
  };

  const updateContent = (id: string, content: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, content } : s
    ));
  };

  const approveSection = (id: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, isApproved: true, isEditing: false } : s
    ));
    toast({ title: 'Approved', description: 'Section marked as approved' });
  };

  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const exportProposal = (format: 'md' | 'txt') => {
    const content = sections
      .sort((a, b) => {
        const order = sectionTypes.map(s => s.value);
        return order.indexOf(a.type) - order.indexOf(b.type);
      })
      .map(s => `# ${s.title}\n\n${s.content}`)
      .join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal.${format}`;
    a.click();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('proposal.title')}</h1>
          <p className="text-muted-foreground mt-1">Generate research proposals with AI assistance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Research Topic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Topic / Title</Label>
                  <Textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter your research topic..."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Research Questions</Label>
                    <Button variant="ghost" size="sm" onClick={addQuestion}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {researchQuestions.map((q, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={q}
                          onChange={(e) => updateQuestion(i, e.target.value)}
                          placeholder={`Question ${i + 1}`}
                        />
                        {researchQuestions.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeQuestion(i)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Sections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={currentSection} onValueChange={setCurrentSection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {isRTL ? type.labelFa : type.label}
                        {sections.find(s => s.type === type.value)?.isApproved && ' ✓'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => generateSection(currentSection)} 
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Section'}
                </Button>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportProposal('md')}
                    disabled={sections.length === 0}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Markdown
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportProposal('txt')}
                    disabled={sections.length === 0}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Text
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2 space-y-4">
            {sections.length === 0 ? (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sections generated yet</p>
                  <p className="text-sm">Enter your topic and generate sections</p>
                </div>
              </Card>
            ) : (
              sections
                .sort((a, b) => {
                  const order = sectionTypes.map(s => s.value);
                  return order.indexOf(a.type) - order.indexOf(b.type);
                })
                .map(section => (
                  <Card key={section.id} className={section.isApproved ? 'border-success' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                          {section.isApproved && (
                            <Badge className="bg-success text-success-foreground">Approved</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleEdit(section.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {!section.isApproved && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => approveSection(section.id)}
                            >
                              <Check className="w-4 h-4 text-success" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteSection(section.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {section.isEditing ? (
                        <Textarea
                          value={section.content}
                          onChange={(e) => updateContent(section.id, e.target.value)}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                          {section.content}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
