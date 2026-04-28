import type { Vocabulary } from '../types';

export function VocabularyPanel({ vocabulary }: { vocabulary: Vocabulary[] }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm">重點單字</span>
        <span className="text-sm text-gray-400 font-normal">{vocabulary.length} 個</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {vocabulary.map((v, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xl font-bold text-gray-800">{v.kanji}</span>
              <span className="text-sm text-gray-400">【{v.furigana}】</span>
            </div>
            <p className="text-blue-600 font-medium text-sm mb-2">{v.meaning}</p>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-sm text-gray-700">{v.example}</p>
              <p className="text-xs text-gray-400 mt-1">{v.exampleTranslation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
