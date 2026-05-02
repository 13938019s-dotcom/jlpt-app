import { useState, useMemo } from 'react';
import type { SavedVocabulary, JLPTLevel } from '../types';
import { useSpeech } from '../hooks/useSpeech';

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

function SpeakButton({ text }: { text: string }) {
  const { speak } = useSpeech();
  return (
    <button onClick={() => speak(text)} className="text-gray-400 hover:text-blue-500 transition-colors p-1 flex-shrink-0" title="點擊發音">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z" />
        <path d="M13.829 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
      </svg>
    </button>
  );
}

interface Props {
  savedVocab: SavedVocabulary[];
  onRemove: (id: string) => void;
}

export function VocabularyLibrary({ savedVocab, onRemove }: Props) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | JLPTLevel>('all');

  const filtered = useMemo(() => savedVocab.filter(v => {
    if (levelFilter !== 'all' && v.level !== levelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.kanji.includes(s) || v.furigana.includes(s) || v.meaning.includes(s);
    }
    return true;
  }), [savedVocab, search, levelFilter]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">單字紀錄庫</h2>
        <p className="text-sm text-gray-400 mt-0.5">已儲存 {savedVocab.length} 個單字</p>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋單字・假名・中文意思"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none text-sm"
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
            {l === 'all' ? `全部 (${savedVocab.length})` : `${l} (${savedVocab.filter(v => v.level === l).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {savedVocab.length === 0 ? (
            <>
              <div className="text-5xl mb-4">★</div>
              <p className="font-semibold text-gray-500">還沒有儲存任何單字</p>
              <p className="text-sm mt-2">閱讀文章時，點擊單字卡右上角的 ★ 即可儲存</p>
            </>
          ) : (
            <p>找不到符合的單字</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold text-gray-800">{v.kanji}</span>
                <span className="text-sm text-gray-400">【{v.furigana}】</span>
                <SpeakButton text={v.kanji} />
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{v.level}</span>
                  <button
                    onClick={() => onRemove(v.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                    title="從紀錄庫移除"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p className="text-blue-600 font-medium text-sm mb-2">{v.meaning}</p>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="flex items-start gap-1">
                  <p className="text-sm text-gray-700 flex-1">{v.example}</p>
                  <SpeakButton text={v.example} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{v.exampleTranslation}</p>
              </div>
              <p className="text-xs text-gray-300 mt-2 truncate">來自：{v.articleTitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
