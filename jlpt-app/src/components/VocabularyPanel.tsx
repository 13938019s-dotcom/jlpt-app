import type { Vocabulary } from '../types';
import { useSpeech } from '../hooks/useSpeech';

function SpeakButton({ text, small = false }: { text: string; small?: boolean }) {
  const { speak } = useSpeech();
  return (
    <button
      onClick={() => speak(text)}
      className={`text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0 ${small ? 'p-0.5' : 'p-1'}`}
      title="點擊發音"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'}>
        <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z" />
        <path d="M13.829 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
      </svg>
    </button>
  );
}

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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-bold text-gray-800">{v.kanji}</span>
              <span className="text-sm text-gray-400">【{v.furigana}】</span>
              <SpeakButton text={v.kanji} />
            </div>
            <p className="text-blue-600 font-medium text-sm mb-2">{v.meaning}</p>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-start gap-1">
                <p className="text-sm text-gray-700 flex-1">{v.example}</p>
                <SpeakButton text={v.example} small />
              </div>
              <p className="text-xs text-gray-400 mt-1">{v.exampleTranslation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
