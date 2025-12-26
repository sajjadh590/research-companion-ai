-- Create research_projects table
CREATE TABLE public.research_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved_articles table
CREATE TABLE public.saved_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors JSONB,
  abstract TEXT,
  publication_date TEXT,
  journal TEXT,
  doi TEXT,
  url TEXT,
  citations_count INTEGER,
  pdf_url TEXT,
  tags TEXT[],
  notes TEXT,
  is_included BOOLEAN DEFAULT true,
  screening_status TEXT DEFAULT 'pending' CHECK (screening_status IN ('pending', 'included', 'excluded', 'maybe')),
  exclusion_reason TEXT,
  risk_of_bias JSONB,
  extracted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meta_analysis_data table
CREATE TABLE public.meta_analysis_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.saved_articles(id) ON DELETE CASCADE,
  study_name TEXT NOT NULL,
  effect_size DECIMAL,
  effect_size_type TEXT,
  standard_error DECIMAL,
  variance DECIMAL,
  sample_size_treatment INTEGER,
  sample_size_control INTEGER,
  mean_treatment DECIMAL,
  sd_treatment DECIMAL,
  mean_control DECIMAL,
  sd_control DECIMAL,
  events_treatment INTEGER,
  events_control INTEGER,
  weight DECIMAL,
  subgroup TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_analysis_results table
CREATE TABLE public.ai_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.saved_articles(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  template_format TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public access for now as no auth)
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_analysis_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Create public access policies (since no auth is required per user request)
CREATE POLICY "Public access for research_projects" ON public.research_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for saved_articles" ON public.saved_articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for meta_analysis_data" ON public.meta_analysis_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for ai_analysis_results" ON public.ai_analysis_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for proposals" ON public.proposals FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_saved_articles_project ON public.saved_articles(project_id);
CREATE INDEX idx_saved_articles_source ON public.saved_articles(source, source_id);
CREATE INDEX idx_meta_analysis_project ON public.meta_analysis_data(project_id);
CREATE INDEX idx_ai_analysis_project ON public.ai_analysis_results(project_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_research_projects_updated_at
  BEFORE UPDATE ON public.research_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();