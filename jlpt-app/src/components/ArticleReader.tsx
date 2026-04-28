import { useState } from 'react';
import type { Article } from '../types';
import { LevelBadge } from './LevelBadge';
import { VocabularyPanel } from './VocabularyPanel';
import { GrammarPanel } from './GrammarPanel';
import { QuizPanel } from './QuizPanel';

type Tab = 'article' | 'vocabulary' | 'grammar' | 'quiz';

interface Props {
  article: Article;
  isCompleted: boolean;
  onComplete: () => void;
  onBack: () => void;
}

export function ArticleReader({ article, isCompleted, onComplete, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('article');

  const tabs: { key: Tab; label: string; color: string }[] = [
    { key: 'article', label: '文章', color: 'text-gray-700' },
    { key: 'vocabulary', label: '單字', color: 'text-blue-600' },
    { key: 'grammar', label: '文法', color: 'text-orange-600' },
    { key: 'quiz', label: '測驗', color: 'text-purple-600' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
        <LevelBadge level={article.level} size="lg" />
        {article.isAIGenerated && (
          <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1 rounded-full">
            AI 生成
          </span>
        )}
        {isCompleted && (
          <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
            ✓ 已完成
          </span>
        )}
      </div>

      <h1 className="text-2xl font-black text-gray-900 mb-6">{article.title}</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? `border-current ${t.color}`
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {tab === 'article' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <p className="text-gray-800 leading-[2.2] text-base tracking-wide whitespace-pre-wrap">
              {article.content}
            </p>
            {!isCompleted && (
              <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setTab('vocabulary')}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  開始學習單字 →
                </button>
              </div>
            )}
          </div>
        )}
        {tab === 'vocabulary' && (
          <div>
            <VocabularyPanel vocabulary={article.vocabulary} />
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTab('grammar')}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
              >
                學習文法 →
              </button>
            </div>
          </div>
        )}
        {tab === 'grammar' && (
          <div>
            <GrammarPanel grammar={article.grammar} />
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTab('quiz')}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors"
              >
                開始測驗 →
              </button>
            </div>
          </div>
        )}
        {tab === 'quiz' && (
          <QuizPanel
            questions={article.questions}
            onAllCorrect={() => {
              if (!isCompleted) onComplete();
            }}
          />
        )}
      </div>
    </div>
  );
}
