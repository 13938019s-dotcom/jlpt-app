import type { Article, JLPTLevel } from '../types';

export async function generateArticle(level: JLPTLevel): Promise<Article> {
  const res = await fetch('/api/generate-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'AI 生成失敗，請重試。');
  }

  return data as Article;
}
