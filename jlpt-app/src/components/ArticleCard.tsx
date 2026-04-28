import type { Article } from '../types';
import { LevelBadge } from './LevelBadge';

interface Props {
  article: Article;
  isCompleted: boolean;
  onClick: () => void;
}

export function ArticleCard({ article, isCompleted, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isCompleted
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <LevelBadge level={article.level} />
            {article.isAIGenerated && (
              <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                AI 生成
              </span>
            )}
            {isCompleted && (
              <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                已完成
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-800 text-lg leading-snug">{article.title}</h3>
          <p className="mt-2 text-gray-500 text-sm line-clamp-2">{article.content}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-gray-400 text-xs">{article.vocabulary.length} 單字</span>
          <span className="text-gray-400 text-xs">{article.grammar.length} 文法</span>
          <span className="text-gray-400 text-xs">{article.questions.length} 題目</span>
        </div>
      </div>
    </button>
  );
}
