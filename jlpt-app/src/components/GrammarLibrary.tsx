import { useState, useMemo } from 'react';
import type { SavedGrammar, JLPTLevel } from '../types';
import { useSpeech } from '../hooks/useSpeech';

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface Props {
  savedGrammar: SavedGrammar[];
  onRemove: (id: string) => void;
}

export function GrammarLibrary({ savedGrammar, onRemove }: Props) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | JLPTLevel>('all');
  const { speak } = useSpeech();

  const filtered = useMemo(() => savedGrammar.filter(g => {
    if (levelFilter !== 'all' && g.level !== levelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return g.pattern.includes(s) || g.explanation.includes(s) || g.example.includes(s);
    }
    return true;
  }), [savedGrammar, search, levelFilter]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">文法紀錄庫</h2>
        <p className="text-sm text-gray-400 mt-0.5">已儲存 {savedGrammar.length} 個文法</p>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋文法句型・解說・例句"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:outline-none text-sm"
        />
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', ...LEVELS] as const).map(l => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              levelFilter === l
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {l === 'all' ? `全部 (${savedGrammar.length})` : `${l} (${savedGrammar.filter(g => g.level === l).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {savedGrammar.length === 0 ? (
            <>
              <div className="text-5xl mb-4">🔖</div>
              <p className="font-semibold text-gray-500">還沒有儲存任何文法</p>
              <p className="text-sm mt-2">閱讀文章時，點擊文法卡右側的 🔖 即可儲存</p>
            </>
          ) : (
            <p>找不到符合的文法</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((g, i) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="font-bold text-orange-700 text-base flex-1">{g.pattern}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">{g.level}</span>
                <button
                  onClick={() => onRemove(g.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none shrink-0"
                  title="從紀錄庫移除"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-600 text-sm mb-3 leading-relaxed">{g.explanation}</p>
              <div className="bg-orange-50 rounded-lg p-3 border-l-4 border-orange-300">
                <div className="flex items-start gap-2">
                  <p className="text-sm text-gray-700 font-medium flex-1">{g.example}</p>
                  <button
                    onClick={() => speak(g.example)}
                    className="text-gray-400 hover:text-orange-500 transition-colors p-0.5 shrink-0"
                    title="點擊發音"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z" />
                      <path d="M13.829 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{g.exampleTranslation}</p>
              </div>
              <p className="text-xs text-gray-300 mt-2 truncate">來自：{g.articleTitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
