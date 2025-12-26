import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/types/research';

interface SaveToLibraryDialogProps {
  articles: Article[];
  trigger?: React.ReactNode;
  onSaved?: () => void;
}

interface Project {
  id: string;
  title: string;
  topic: string;
}

export function SaveToLibraryDialog({ articles, trigger, onSaved }: SaveToLibraryDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectTopic, setNewProjectTopic] = useState('');

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .select('id, title, topic')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
      if (data && data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewProject = async () => {
    if (!newProjectTitle.trim() || !newProjectTopic.trim()) {
      toast({ title: 'Error', description: 'Please fill in title and topic', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .insert({
          title: newProjectTitle,
          topic: newProjectTopic,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      setSelectedProjectId(data.id);
      setShowNewProject(false);
      setNewProjectTitle('');
      setNewProjectTopic('');
      toast({ title: 'Success', description: 'Project created' });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveArticles = async () => {
    if (!selectedProjectId) {
      toast({ title: 'Error', description: 'Please select a project', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const articlesToSave = articles.map(article => ({
        project_id: selectedProjectId,
        source: article.source,
        source_id: article.id,
        title: article.title,
        authors: article.authors,
        abstract: article.abstract,
        publication_date: article.publicationDate,
        journal: article.journal,
        doi: article.doi,
        url: article.url,
        pdf_url: article.pdfUrl,
        citations_count: article.citationsCount,
      }));

      const { error } = await supabase
        .from('saved_articles')
        .upsert(articlesToSave, { onConflict: 'source,source_id' });

      if (error) throw error;

      toast({ 
        title: 'Saved', 
        description: `${articles.length} article(s) saved to library` 
      });
      setOpen(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving articles:', error);
      toast({ title: 'Error', description: 'Failed to save articles', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Bookmark className="w-4 h-4 mr-1" />
            Save ({articles.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Saving {articles.length} article(s) to your library
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : showNewProject ? (
            <div className="space-y-3">
              <div>
                <Label>Project Title</Label>
                <Input
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Enter project title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Research Topic</Label>
                <Input
                  value={newProjectTopic}
                  onChange={(e) => setNewProjectTopic(e.target.value)}
                  placeholder="Enter research topic"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNewProject(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={createNewProject} disabled={isSaving} className="flex-1">
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>Select Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowNewProject(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Project
              </Button>

              <Button 
                onClick={saveArticles} 
                disabled={isSaving || !selectedProjectId}
                className="w-full"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save to Library
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
