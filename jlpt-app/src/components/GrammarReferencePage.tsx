import { useState } from 'react';
import type { JLPTLevel } from '../types';
import { grammarPools } from '../data/grammarPools';

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_COLORS: Record<JLPTLevel, {
  bg: string; border: string; text: string;
  activeBg: string; activeBorder: string; activeText: string;
  badge: string; badgeText: string;
  patternBg: string; patternText: string;
}> = {
  N5: {
    bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600',
    activeBg: 'bg-green-500', activeBorder: 'border-green-500', activeText: 'text-white',
    badge: 'bg-green-100', badgeText: 'text-green-700',
    patternBg: 'bg-green-50', patternText: 'text-green-800',
  },
  N4: {
    bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600',
    activeBg: 'bg-sky-500', activeBorder: 'border-sky-500', activeText: 'text-white',
    badge: 'bg-sky-100', badgeText: 'text-sky-700',
    patternBg: 'bg-sky-50', patternText: 'text-sky-800',
  },
  N3: {
    bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600',
    activeBg: 'bg-violet-500', activeBorder: 'border-violet-500', activeText: 'text-white',
    badge: 'bg-violet-100', badgeText: 'text-violet-700',
    patternBg: 'bg-violet-50', patternText: 'text-violet-800',
  },
  N2: {
    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600',
    activeBg: 'bg-orange-500', activeBorder: 'border-orange-500', activeText: 'text-white',
    badge: 'bg-orange-100', badgeText: 'text-orange-700',
    patternBg: 'bg-orange-50', patternText: 'text-orange-800',
  },
  N1: {
    bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600',
    activeBg: 'bg-rose-500', activeBorder: 'border-rose-500', activeText: 'text-white',
    badge: 'bg-rose-100', badgeText: 'text-rose-700',
    patternBg: 'bg-rose-50', patternText: 'text-rose-800',
  },
};

const LEVEL_LABELS: Record<JLPTLevel, string> = {
  N5: '入門',
  N4: '初級',
  N3: '中級',
  N2: '中上級',
  N1: '上級',
};

export function GrammarReferencePage() {
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const c = LEVEL_COLORS[selectedLevel];
  const items = grammarPools[selectedLevel];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">文法一覧</h2>
        <p className="text-sm text-gray-400 mt-0.5">各級別文法・例句對照表（N5 → N1）</p>
      </div>

      {/* Level Selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {LEVELS.map(level => {
          const lc = LEVEL_COLORS[level];
          const active = selectedLevel === level;
          return (
            <button
              key={level}
              onClick={() => { setSelectedLevel(level); setExpandedIndex(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                active
                  ? `${lc.activeBg} ${lc.activeBorder} ${lc.activeText} shadow-sm`
                  : `bg-white ${lc.border} ${lc.text} hover:${lc.bg}`
              }`}
            >
              <span>{level}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : `${lc.badge} ${lc.badgeText}`
              }`}>
                {LEVEL_LABELS[level]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grammar Count Info */}
      <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl ${c.bg} border ${c.border}`}>
        <span className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>
          {selectedLevel} 文法
        </span>
        <span className="text-gray-300 text-xs">|</span>
        <span className="text-xs text-gray-500">{items.length} 個句型・全部附例句</span>
      </div>

      {/* Grammar List */}
      <div className="space-y-2">
        {items.map((item, i) => {
          const isOpen = expandedIndex === i;
          return (
            <button
              key={i}
              onClick={() => setExpandedIndex(isOpen ? null : i)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden"
            >
              {/* Row Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Number */}
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${c.badge} ${c.badgeText}`}>
                  {i + 1}
                </span>

                {/* Pattern */}
                <div className="flex-1 min-w-0">
                  <span className={`font-black text-base ${c.patternText}`}>{item.pattern}</span>
                  {!isOpen && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.explanation}</p>
                  )}
                </div>

                {/* Chevron */}
                <span className={`shrink-0 text-gray-300 transition-transform text-sm ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>

              {/* Expanded Content */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                  {/* Explanation */}
                  <div className={`rounded-xl px-3 py-2.5 ${c.bg} border ${c.border}`}>
                    <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${c.text}`}>意思・用法</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.explanation}</p>
                  </div>

                  {/* Example */}
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">例句</div>
                    <p className="text-base font-medium text-gray-900 leading-relaxed">{item.example}</p>
                    <p className="text-sm text-gray-400 mt-1">{item.exampleTranslation}</p>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-6 text-center text-xs text-gray-300">
        共 {LEVELS.reduce((s, l) => s + grammarPools[l].length, 0)} 個文法 · N5–N1 全部收錄
      </div>
    </div>
  );
}
