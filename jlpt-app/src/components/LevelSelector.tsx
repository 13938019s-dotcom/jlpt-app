import type { JLPTLevel } from '../types';

const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

const levelColors: Record<JLPTLevel, { bg: string; selected: string; hover: string; text: string }> = {
  N5: { bg: 'bg-green-50', selected: 'bg-green-500 text-white shadow-green-200', hover: 'hover:bg-green-100', text: 'text-green-700' },
  N4: { bg: 'bg-blue-50', selected: 'bg-blue-500 text-white shadow-blue-200', hover: 'hover:bg-blue-100', text: 'text-blue-700' },
  N3: { bg: 'bg-yellow-50', selected: 'bg-yellow-500 text-white shadow-yellow-200', hover: 'hover:bg-yellow-100', text: 'text-yellow-700' },
  N2: { bg: 'bg-orange-50', selected: 'bg-orange-500 text-white shadow-orange-200', hover: 'hover:bg-orange-100', text: 'text-orange-700' },
  N1: { bg: 'bg-red-50', selected: 'bg-red-500 text-white shadow-red-200', hover: 'hover:bg-red-100', text: 'text-red-700' },
};

const levelDesc: Record<JLPTLevel, string> = {
  N5: '入門',
  N4: '初級',
  N3: '中級',
  N2: '中高級',
  N1: '高級',
};

interface Props {
  selected: JLPTLevel;
  onChange: (level: JLPTLevel) => void;
  completedCounts: Record<JLPTLevel, { completed: number; total: number }>;
}

export function LevelSelector({ selected, onChange, completedCounts }: Props) {
  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {levels.map(level => {
        const c = levelColors[level];
        const isSelected = selected === level;
        const { completed, total } = completedCounts[level];
        return (
          <button
            key={level}
            onClick={() => onChange(level)}
            className={`relative flex flex-col items-center rounded-2xl px-6 py-4 min-w-[90px] transition-all duration-200 border-2 shadow-sm ${
              isSelected
                ? `${c.selected} border-transparent shadow-lg scale-105`
                : `${c.bg} border-transparent ${c.hover} ${c.text}`
            }`}
          >
            <span className="text-2xl font-black">{level}</span>
            <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'opacity-60'}`}>
              {levelDesc[level]}
            </span>
            <div className={`mt-2 text-xs font-medium ${isSelected ? 'text-white/90' : 'opacity-70'}`}>
              {completed}/{total} 完成
            </div>
            {completed === total && total > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
