import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FolderOpen, FileText, Trash2, Search, ExternalLink } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  status: string;
  language: string;
  created_at: string;
  article_count?: number;
}

interface SavedArticle {
  id: string;
  title: string;
  source: string;
  authors: { name: string }[] | null;
  abstract: string | null;
  publication_date: string | null;
  journal: string | null;
  doi: string | null;
  url: string | null;
  citations_count: number | null;
  screening_status: string | null;
  tags: string[] | null;
}

export default function LibraryPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = ['fa', 'ar'].includes(i18n.language);

  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', topic: '', description: '' });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadArticles(selectedProject);
    } else {
      loadAllArticles();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadArticles = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('saved_articles')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(article => ({
        ...article,
        authors: article.authors as { name: string }[] | null,
        tags: article.tags as string[] | null,
      }));
      
      setArticles(typedData);
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const loadAllArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const typedData = (data || []).map(article => ({
        ...article,
        authors: article.authors as { name: string }[] | null,
        tags: article.tags as string[] | null,
      }));
      
      setArticles(typedData);
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const createProject = async () => {
    if (!newProject.title.trim() || !newProject.topic.trim()) {
      toast({ title: 'Error', description: 'Please fill in title and topic', variant: 'destructive' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('research_projects')
        .insert({
          title: newProject.title,
          topic: newProject.topic,
          description: newProject.description || null,
          language: i18n.language,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      setNewProject({ title: '', topic: '', description: '' });
      setNewProjectOpen(false);
      toast({ title: 'Success', description: 'Project created' });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('research_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== id));
      if (selectedProject === id) setSelectedProject(null);
      toast({ title: 'Deleted', description: 'Project deleted' });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
    }
  };

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.abstract?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'included': return 'bg-success text-success-foreground';
      case 'excluded': return 'bg-destructive text-destructive-foreground';
      case 'maybe': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('library.title')}</h1>
            <p className="text-muted-foreground mt-1">Manage your research projects and saved articles</p>
          </div>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('library.newProject')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('library.newProject')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder="Project title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Research Topic</Label>
                  <Input
                    value={newProject.topic}
                    onChange={(e) => setNewProject({ ...newProject, topic: e.target.value })}
                    placeholder="Main research topic"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Brief description"
                    className="mt-1"
                  />
                </div>
                <Button onClick={createProject} className="w-full">
                  Create Project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList>
            <TabsTrigger value="projects">
              <FolderOpen className="w-4 h-4 mr-2" />
              {t('library.projects')} ({projects.length})
            </TabsTrigger>
            <TabsTrigger value="articles">
              <FileText className="w-4 h-4 mr-2" />
              {t('library.articles')} ({articles.length})
            </TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects">
            {projects.length === 0 ? (
              <Card className="h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No projects yet</p>
                  <Button variant="link" onClick={() => setNewProjectOpen(true)}>
                    Create your first project
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <Card 
                    key={project.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProject === project.id ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedProject(project.id === selectedProject ? null : project.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      <CardDescription>{project.topic}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <Badge variant="outline">{project.status}</Badge>
                        <span>{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="pl-10"
                />
              </div>
              {selectedProject && (
                <Button variant="outline" onClick={() => setSelectedProject(null)}>
                  Show All
                </Button>
              )}
            </div>

            {filteredArticles.length === 0 ? (
              <Card className="h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('library.empty')}</p>
                  <p className="text-sm">{t('library.addArticles')}</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map(article => (
                  <Card key={article.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground leading-tight">{article.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {article.authors?.slice(0, 3).map(a => a.name).join(', ')}
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <Badge variant="outline">{article.source}</Badge>
                            {article.screening_status && (
                              <Badge className={getStatusColor(article.screening_status)}>
                                {article.screening_status}
                              </Badge>
                            )}
                            {article.journal && (
                              <span className="text-xs text-muted-foreground">{article.journal}</span>
                            )}
                            {article.publication_date && (
                              <span className="text-xs text-muted-foreground">{article.publication_date}</span>
                            )}
                          </div>
                        </div>
                        {article.url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
