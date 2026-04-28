import { useState, useMemo } from 'react';
import type { JLPTLevel, Article } from './types';
import { presetArticles } from './data/articles';
import { useProgress } from './hooks/useProgress';
import { generateArticle } from './services/generateArticle';
import { LevelSelector } from './components/LevelSelector';
import { ArticleCard } from './components/ArticleCard';
import { ArticleReader } from './components/ArticleReader';

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function App() {
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [aiArticles, setAiArticles] = useState<Article[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { progress, markCompleted, isCompleted, getCompletedCount } = useProgress();

  const articlesByLevel = useMemo(() => {
    const all = [...presetArticles, ...aiArticles];
    return LEVELS.reduce((acc, level) => {
      acc[level] = all.filter(a => a.level === level);
      return acc;
    }, {} as Record<JLPTLevel, Article[]>);
  }, [aiArticles]);

  const completedCounts = useMemo(
    () =>
      LEVELS.reduce((acc, level) => {
        acc[level] = getCompletedCount(level, articlesByLevel[level].length);
        return acc;
      }, {} as Record<JLPTLevel, { completed: number; total: number }>),
    [progress, articlesByLevel]
  );

  const currentArticles = articlesByLevel[selectedLevel];
  const allCompleted =
    currentArticles.length > 0 &&
    currentArticles.every(a => isCompleted(a.id, selectedLevel));

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const article = await generateArticle(selectedLevel);
      setAiArticles(prev => [...prev, article]);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'AI 生成失敗，請重試。');
    } finally {
      setGenerating(false);
    }
  };

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <ArticleReader
          article={selectedArticle}
          isCompleted={isCompleted(selectedArticle.id, selectedArticle.level)}
          onComplete={() => markCompleted(selectedArticle.id, selectedArticle.level)}
          onBack={() => setSelectedArticle(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white font-black text-lg">
            N
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">JLPT 分級閱讀</h1>
            <p className="text-xs text-gray-400">日語能力試驗・閱讀學習</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Level Selector */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            選擇程度
          </h2>
          <LevelSelector
            selected={selectedLevel}
            onChange={setSelectedLevel}
            completedCounts={completedCounts}
          />
        </section>

        {/* Articles */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              {selectedLevel} 文章
            </h2>
            <span className="text-sm text-gray-500">
              {completedCounts[selectedLevel].completed} / {completedCounts[selectedLevel].total} 完成
            </span>
          </div>

          <div className="grid gap-3 mb-6">
            {currentArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                isCompleted={isCompleted(article.id, selectedLevel)}
                onClick={() => setSelectedArticle(article)}
              />
            ))}
          </div>

          {/* AI Generate Section */}
          <div
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              allCompleted
                ? 'border-purple-300 bg-purple-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {allCompleted ? (
              <>
                <p className="text-purple-700 font-bold mb-1">
                  已完成所有 {selectedLevel} 文章！
                </p>
                <p className="text-purple-500 text-sm mb-4">
                  使用 AI 生成更多 {selectedLevel} 程度的練習文章
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-1">完成以上文章後</p>
                <p className="text-gray-400 text-sm mb-4">可使用 AI 生成更多練習文章</p>
              </>
            )}

            {generateError && (
              <p className="text-red-500 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">
                {generateError}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={!allCompleted || generating}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                allCompleted
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
                  AI 生成中…
                </span>
              ) : (
                `AI 生成 ${selectedLevel} 文章`
              )}
            </button>
          </div>
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-gray-300">
        Made by zoenozomi
      </footer>
    </div>
  );
}
