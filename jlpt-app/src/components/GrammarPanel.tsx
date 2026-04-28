import type { GrammarPoint } from '../types';

export function GrammarPanel({ grammar }: { grammar: GrammarPoint[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="bg-orange-100 text-orange-700 rounded-lg px-3 py-1 text-sm">重點文法</span>
        <span className="text-sm text-gray-400 font-normal">{grammar.length} 項</span>
      </h2>
      <div className="grid gap-4">
        {grammar.map((g, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                {i + 1}
              </span>
              <span className="font-bold text-orange-700 text-base">{g.pattern}</span>
            </div>
            <p className="text-gray-600 text-sm mb-3 leading-relaxed">{g.explanation}</p>
            <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-300">
              <p className="text-sm text-gray-700 font-medium">{g.example}</p>
              <p className="text-xs text-gray-500 mt-1">{g.exampleTranslation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
