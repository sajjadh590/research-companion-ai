import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Article } from '@/types/research';

interface SelectedArticlesContextType {
  // Selected articles list
  selectedArticles: Article[];
  
  // Add articles (merges with existing, avoids duplicates)
  addArticles: (articles: Article[]) => void;
  
  // Remove articles by ID
  removeArticles: (articleIds: string[]) => void;
  
  // Clear all selected articles
  clearArticles: () => void;
  
  // Check if an article is selected
  isSelected: (articleId: string) => boolean;
  
  // Toggle selection
  toggleSelection: (article: Article) => void;
  
  // Get count
  count: number;
}

const SelectedArticlesContext = createContext<SelectedArticlesContextType | undefined>(undefined);

const STORAGE_KEY = 'research-copilot-selected-articles';

export function SelectedArticlesProvider({ children }: { children: ReactNode }) {
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedArticles(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load selected articles from session:', error);
    }
  }, []);

  // Save to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedArticles));
    } catch (error) {
      console.error('Failed to save selected articles to session:', error);
    }
  }, [selectedArticles]);

  const addArticles = (articles: Article[]) => {
    setSelectedArticles(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newArticles = articles.filter(a => !existingIds.has(a.id));
      return [...prev, ...newArticles];
    });
  };

  const removeArticles = (articleIds: string[]) => {
    const idsToRemove = new Set(articleIds);
    setSelectedArticles(prev => prev.filter(a => !idsToRemove.has(a.id)));
  };

  const clearArticles = () => {
    setSelectedArticles([]);
  };

  const isSelected = (articleId: string) => {
    return selectedArticles.some(a => a.id === articleId);
  };

  const toggleSelection = (article: Article) => {
    if (isSelected(article.id)) {
      removeArticles([article.id]);
    } else {
      addArticles([article]);
    }
  };

  return (
    <SelectedArticlesContext.Provider
      value={{
        selectedArticles,
        addArticles,
        removeArticles,
        clearArticles,
        isSelected,
        toggleSelection,
        count: selectedArticles.length,
      }}
    >
      {children}
    </SelectedArticlesContext.Provider>
  );
}

export function useSelectedArticles() {
  const context = useContext(SelectedArticlesContext);
  if (!context) {
    throw new Error('useSelectedArticles must be used within a SelectedArticlesProvider');
  }
  return context;
}
