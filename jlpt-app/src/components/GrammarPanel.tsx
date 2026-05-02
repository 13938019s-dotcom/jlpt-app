import type { GrammarPoint } from '../types';

interface Props {
  grammar: GrammarPoint[];
  onSave?: (grammar: GrammarPoint) => void;
  isSaved?: (pattern: string) => boolean;
}

export function GrammarPanel({ grammar, onSave, isSaved }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="bg-orange-100 text-orange-700 rounded-lg px-3 py-1 text-sm">重點文法</span>
        <span className="text-sm text-gray-400 font-normal">{grammar.length} 項</span>
        {onSave && <span className="text-xs text-gray-300 font-normal ml-1">點 🔖 儲存到文法庫</span>}
      </h2>
      <div className="grid gap-4">
        {grammar.map((g, i) => {
          const saved = isSaved?.(g.pattern) ?? false;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="font-bold text-orange-700 text-base flex-1">{g.pattern}</span>
                {onSave && (
                  <button
                    onClick={() => onSave(g)}
                    title={saved ? '已儲存到文法庫' : '儲存到文法庫'}
                    className={`text-base leading-none transition-colors shrink-0 ${
                      saved ? 'text-orange-400' : 'text-gray-200 hover:text-orange-300'
                    }`}
                  >
                    🔖
                  </button>
                )}
              </div>
              <p className="text-gray-600 text-sm mb-3 leading-relaxed">{g.explanation}</p>
              <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-300">
                <p className="text-sm text-gray-700 font-medium">{g.example}</p>
                <p className="text-xs text-gray-500 mt-1">{g.exampleTranslation}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
