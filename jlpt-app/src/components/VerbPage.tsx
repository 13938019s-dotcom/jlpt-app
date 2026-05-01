import { useState, useMemo, useRef, useEffect } from 'react';
import { verbs, type Verb, type VerbGroup, type VerbLevel } from '../data/verbs';
import { conjugate, FORMS, getGroupLabel, getGroupRule, randomForm, type FormName } from '../utils/conjugate';

type View = 'list' | 'detail' | 'quiz';

const GROUP_COLORS: Record<VerbGroup, { bg: string; text: string; border: string; dot: string }> = {
  ichidan:   { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500' },
  godan:     { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  irregular: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500' },
};

const FORM_COLORS: Record<string, string> = {
  indigo:  'text-indigo-600',
  violet:  'text-violet-600',
  rose:    'text-rose-600',
  emerald: 'text-emerald-600',
  cyan:    'text-cyan-600',
  orange:  'text-orange-600',
  purple:  'text-purple-600',
};

const FORM_BG: Record<string, string> = {
  indigo:  'bg-indigo-50 border-indigo-200',
  violet:  'bg-violet-50 border-violet-200',
  rose:    'bg-rose-50 border-rose-200',
  emerald: 'bg-emerald-50 border-emerald-200',
  cyan:    'bg-cyan-50 border-cyan-200',
  orange:  'bg-orange-50 border-orange-200',
  purple:  'bg-purple-50 border-purple-200',
};

function GroupBadge({ group }: { group: VerbGroup }) {
  const c = GROUP_COLORS[group];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {getGroupLabel(group)}
    </span>
  );
}

function LevelBadge({ level }: { level: VerbLevel }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
      {level}
    </span>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function ConjugationTable({ verb }: { verb: Verb }) {
  const conj = conjugate(verb);
  const results: Record<FormName, string> = {
    te: conj.te, ta: conj.ta, nai: conj.nai,
    masu: conj.masu, ba: conj.ba, meirei: conj.meirei, ishi: conj.ishi,
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs">
            <th className="text-left px-4 py-2 font-semibold w-20">形式</th>
            <th className="text-left px-4 py-2 font-semibold">変化形</th>
            <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">主な用法</th>
          </tr>
        </thead>
        <tbody>
          {FORMS.map((f, i) => {
            const result = results[f.name];
            const stem = conj.stemKana;
            const ending = result.startsWith(stem) && stem ? result.slice(stem.length) : result;
            const displayStem = result.startsWith(stem) && stem ? stem : '';
            return (
              <tr key={f.name} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-4 py-3">
                  <span className={`font-bold ${FORM_COLORS[f.color]}`}>{f.label}</span>
                  <div className="text-xs text-gray-400">{f.labelJp}</div>
                </td>
                <td className="px-4 py-3 font-medium text-base">
                  <span className="text-gray-700">{displayStem}</span>
                  <span className={`font-bold ${FORM_COLORS[f.color]}`}>{ending}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{f.usage}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailView({ verb, onBack, onQuiz }: { verb: Verb; onBack: () => void; onQuiz: () => void }) {
  const gc = GROUP_COLORS[verb.group];
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 flex items-center gap-1 text-sm transition-colors">
          ← 返回列表
        </button>
      </div>

      <div className={`rounded-2xl border-2 ${gc.border} ${gc.bg} p-5 mb-2`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-3xl font-black text-gray-900">{verb.kanji}</div>
            <div className="text-lg text-gray-500 mt-0.5">{verb.kana}</div>
            <div className="text-base font-medium text-gray-700 mt-1">{verb.meaning}</div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <GroupBadge group={verb.group} />
            <LevelBadge level={verb.level} />
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 bg-white/60 rounded-xl px-3 py-2">
          <span className="font-semibold">変化規則：</span>{getGroupRule(verb)}
        </div>
      </div>

      <ConjugationTable verb={verb} />

      <button
        onClick={onQuiz}
        className="mt-4 w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm"
      >
        この動詞でクイズ練習
      </button>
    </div>
  );
}

// ─── Quiz View ───────────────────────────────────────────────────────────────

function QuizView({ quizVerbs, onBack }: { quizVerbs: Verb[]; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [formName, setFormName] = useState<FormName>(() => randomForm());
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [index, formName]);

  const verb = quizVerbs[index % quizVerbs.length];
  const conj = conjugate(verb);
  const correctAnswer: Record<FormName, string> = {
    te: conj.te, ta: conj.ta, nai: conj.nai,
    masu: conj.masu, ba: conj.ba, meirei: conj.meirei, ishi: conj.ishi,
  };
  const correct = correctAnswer[formName];
  const formInfo = FORMS.find(f => f.name === formName)!;

  const handleSubmit = () => {
    if (revealed) return;
    const ok = answer.trim() === correct;
    setIsCorrect(ok);
    setRevealed(true);
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => {
    setIndex(i => i + 1);
    setFormName(randomForm());
    setAnswer('');
    setRevealed(false);
    setIsCorrect(null);
  };

  const accuracy = score.total > 0 ? Math.round((score.right / score.total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 text-sm transition-colors">
          ← 返回
        </button>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">正解 <span className="font-bold text-emerald-600">{score.right}</span> / {score.total}</span>
          {score.total > 0 && (
            <span className={`font-bold ${accuracy >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>{accuracy}%</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-6 mb-5">
        <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
          問題 #{score.total + 1}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl font-black text-gray-900">{verb.kanji}</span>
          <div>
            <div className="text-gray-500 text-sm">{verb.kana}</div>
            <div className="text-gray-600 text-sm">{verb.meaning}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GroupBadge group={verb.group} />
          <LevelBadge level={verb.level} />
        </div>
        <div className={`mt-4 text-lg font-bold ${FORM_COLORS[formInfo.color]}`}>
          「{verb.kanji}」の <span className="underline decoration-2">{formInfo.label}</span> は？
        </div>
      </div>

      {!revealed ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && answer && handleSubmit()}
            placeholder="ひらがなで入力..."
            className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-lg font-medium"
          />
          <button
            onClick={handleSubmit}
            disabled={!answer}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            確認
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
            {isCorrect ? (
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                <span>✓</span>
                <span>正解！{correct}</span>
              </div>
            ) : (
              <div>
                <div className="text-rose-600 font-bold mb-1">✗ 不正解</div>
                <div className="text-gray-700">
                  あなたの答え：<span className="line-through text-gray-400">{answer}</span>
                </div>
                <div className="text-gray-900 font-bold mt-1">
                  正解：<span className="text-rose-700 text-lg">{correct}</span>
                </div>
              </div>
            )}
          </div>

          {/* Show full conjugation table as reference */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="text-xs font-semibold text-gray-400 mb-2">全変化形</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {FORMS.map(f => {
                const res = { te: conj.te, ta: conj.ta, nai: conj.nai, masu: conj.masu, ba: conj.ba, meirei: conj.meirei, ishi: conj.ishi }[f.name];
                return (
                  <div key={f.name} className={`rounded-lg px-2 py-1.5 border text-xs ${f.name === formName ? FORM_BG[formInfo.color] : 'bg-white border-gray-100'}`}>
                    <div className={`font-bold ${f.name === formName ? FORM_COLORS[formInfo.color] : 'text-gray-500'}`}>{f.label}</div>
                    <div className={`font-medium ${f.name === formName ? 'text-gray-900' : 'text-gray-600'}`}>{res}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            次の問題 →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

function VerbList({ onSelect }: { onSelect: (v: Verb) => void }) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | VerbGroup>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | VerbLevel>('all');

  const filtered = useMemo(() => verbs.filter(v => {
    if (groupFilter !== 'all' && v.group !== groupFilter) return false;
    if (levelFilter !== 'all' && v.level !== levelFilter) return false;
    if (search) {
      const s = search.trim();
      return v.kanji.includes(s) || v.kana.includes(s) || v.meaning.includes(s);
    }
    return true;
  }), [search, groupFilter, levelFilter]);

  const counts = useMemo(() => ({
    all: verbs.length,
    ichidan: verbs.filter(v => v.group === 'ichidan').length,
    godan: verbs.filter(v => v.group === 'godan').length,
    irregular: verbs.filter(v => v.group === 'irregular').length,
  }), []);

  type GroupOption = 'all' | VerbGroup;
  type LevelOption = 'all' | VerbLevel;

  const groupOptions: { value: GroupOption; label: string }[] = [
    { value: 'all', label: `全部 (${counts.all})` },
    { value: 'ichidan', label: `一段 (${counts.ichidan})` },
    { value: 'godan', label: `五段 (${counts.godan})` },
    { value: 'irregular', label: `不規則 (${counts.irregular})` },
  ];

  const levelOptions: { value: LevelOption; label: string }[] = [
    { value: 'all', label: '全程度' },
    { value: 'N5', label: 'N5' },
    { value: 'N4', label: 'N4' },
    { value: 'N3', label: 'N3' },
  ];

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋動詞（漢字・假名・中文）"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:outline-none text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {groupOptions.map(o => (
          <button
            key={o.value}
            onClick={() => setGroupFilter(o.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              groupFilter === o.value
                ? o.value === 'all' ? 'bg-gray-800 text-white border-gray-800'
                  : `${GROUP_COLORS[o.value as VerbGroup].bg} ${GROUP_COLORS[o.value as VerbGroup].text} ${GROUP_COLORS[o.value as VerbGroup].border}`
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {o.label}
          </button>
        ))}
        <div className="w-px bg-gray-200 self-stretch mx-1" />
        {levelOptions.map(o => (
          <button
            key={o.value}
            onClick={() => setLevelFilter(o.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              levelFilter === o.value
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="text-xs text-gray-400 mb-3">{filtered.length} 個動詞</div>

      {/* Verb cards */}
      <div className="space-y-2">
        {filtered.map(verb => {
          const gc = GROUP_COLORS[verb.group];
          return (
            <button
              key={verb.id}
              onClick={() => onSelect(verb)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3"
            >
              <div className={`w-1 self-stretch rounded-full ${gc.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">{verb.kanji}</span>
                  <span className="text-sm text-gray-400">{verb.kana}</span>
                </div>
                <div className="text-sm text-gray-500 truncate">{verb.meaning}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <GroupBadge group={verb.group} />
                <LevelBadge level={verb.level} />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">找不到符合的動詞</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function VerbPage() {
  const [view, setView] = useState<View>('list');
  const [selectedVerb, setSelectedVerb] = useState<Verb | null>(null);
  const [quizVerbs, setQuizVerbs] = useState<Verb[]>([]);

  const startQuiz = (sourceVerbs?: Verb[]) => {
    const pool = sourceVerbs ?? verbs;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setQuizVerbs(shuffled);
    setView('quiz');
  };

  if (view === 'detail' && selectedVerb) {
    return (
      <DetailView
        verb={selectedVerb}
        onBack={() => setView('list')}
        onQuiz={() => startQuiz([selectedVerb])}
      />
    );
  }

  if (view === 'quiz') {
    return <QuizView quizVerbs={quizVerbs} onBack={() => setView('list')} />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">動詞変化</h2>
          <p className="text-sm text-gray-400 mt-0.5">て形・た形・ない形・ます形・ば形・命令形・意志形</p>
        </div>
        <button
          onClick={() => startQuiz()}
          className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-sm"
        >
          全動詞クイズ
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-5 p-3 bg-gray-50 rounded-xl">
        {(['ichidan', 'godan', 'irregular'] as VerbGroup[]).map(g => (
          <div key={g} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full ${GROUP_COLORS[g].dot}`} />
            {getGroupLabel(g)}
          </div>
        ))}
      </div>

      <VerbList onSelect={v => { setSelectedVerb(v); setView('detail'); }} />
    </div>
  );
}
