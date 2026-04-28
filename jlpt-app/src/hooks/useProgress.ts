import { useState, useEffect } from 'react';
import type { Progress, JLPTLevel } from '../types';

const STORAGE_KEY = 'jlpt_progress';

const defaultProgress = (): Progress => ({
  N5: { completedArticleIds: [] },
  N4: { completedArticleIds: [] },
  N3: { completedArticleIds: [] },
  N2: { completedArticleIds: [] },
  N1: { completedArticleIds: [] },
});

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultProgress();
    } catch {
      return defaultProgress();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const markCompleted = (articleId: string, level: JLPTLevel) => {
    setProgress(prev => {
      if (prev[level].completedArticleIds.includes(articleId)) return prev;
      return {
        ...prev,
        [level]: {
          completedArticleIds: [...prev[level].completedArticleIds, articleId],
        },
      };
    });
  };

  const isCompleted = (articleId: string, level: JLPTLevel) =>
    progress[level].completedArticleIds.includes(articleId);

  const getCompletedCount = (level: JLPTLevel, totalCount: number) => ({
    completed: progress[level].completedArticleIds.length,
    total: totalCount,
  });

  return { progress, markCompleted, isCompleted, getCompletedCount };
}
