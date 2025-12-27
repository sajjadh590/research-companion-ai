-- Add user_id column to research_projects
ALTER TABLE public.research_projects 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Public access for research_projects" ON public.research_projects;

-- Create RLS policies for user ownership
CREATE POLICY "Users can view their own projects" 
ON public.research_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.research_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.research_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.research_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Also add user_id to saved_articles for ownership
ALTER TABLE public.saved_articles 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Public access for saved_articles" ON public.saved_articles;

-- Create RLS policies for saved_articles
CREATE POLICY "Users can view their own articles" 
ON public.saved_articles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own articles" 
ON public.saved_articles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own articles" 
ON public.saved_articles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own articles" 
ON public.saved_articles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add user_id to other related tables
ALTER TABLE public.proposals 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public access for proposals" ON public.proposals;

CREATE POLICY "Users can view their own proposals" 
ON public.proposals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals" 
ON public.proposals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals" 
ON public.proposals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals" 
ON public.proposals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add user_id to meta_analysis_data
ALTER TABLE public.meta_analysis_data 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public access for meta_analysis_data" ON public.meta_analysis_data;

CREATE POLICY "Users can view their own meta analysis data" 
ON public.meta_analysis_data 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meta analysis data" 
ON public.meta_analysis_data 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta analysis data" 
ON public.meta_analysis_data 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta analysis data" 
ON public.meta_analysis_data 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add user_id to ai_analysis_results
ALTER TABLE public.ai_analysis_results 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public access for ai_analysis_results" ON public.ai_analysis_results;

CREATE POLICY "Users can view their own AI analysis results" 
ON public.ai_analysis_results 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI analysis results" 
ON public.ai_analysis_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI analysis results" 
ON public.ai_analysis_results 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI analysis results" 
ON public.ai_analysis_results 
FOR DELETE 
USING (auth.uid() = user_id);