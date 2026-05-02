import { useState, useMemo, useRef, useEffect } from 'react';
import { verbs, type Verb, type VerbGroup, type VerbLevel } from '../data/verbs';
import { conjugate, FORMS, getGroupLabel, getGroupRule, randomForm, type FormName } from '../utils/conjugate';

type View = 'list' | 'detail' | 'quiz' | 'guide';

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

// ─── Conjugation Guide ───────────────────────────────────────────────────────

interface GodanRow { ending: string; change: string; example: string; result: string; }
interface GuideSection {
  ichidanRule: string;
  ichidanExample: { kanji: string; result: string };
  godanRows: GodanRow[];
  godanNote?: string;
  irregularResults: { verb: string; meaning: string; result: string }[];
}

const GUIDE: Record<FormName, GuideSection> = {
  te: {
    ichidanRule: '去掉「る」，加「て」',
    ichidanExample: { kanji: '食べる', result: '食べて' },
    godanRows: [
      { ending: 'う', change: '→ って', example: '買う', result: '買って' },
      { ending: 'く', change: '→ いて', example: '書く', result: '書いて' },
      { ending: 'ぐ', change: '→ いで', example: '泳ぐ', result: '泳いで' },
      { ending: 'す', change: '→ して', example: '話す', result: '話して' },
      { ending: 'つ', change: '→ って', example: '待つ', result: '待って' },
      { ending: 'ぬ', change: '→ んで', example: '死ぬ', result: '死んで' },
      { ending: 'ぶ', change: '→ んで', example: '遊ぶ', result: '遊んで' },
      { ending: 'む', change: '→ んで', example: '飲む', result: '飲んで' },
      { ending: 'る', change: '→ って', example: '帰る', result: '帰って' },
    ],
    godanNote: '※ 行く（いく）例外：行って（非行いて）',
    irregularResults: [{ verb: 'する', meaning: '做', result: 'して' }, { verb: 'くる', meaning: '來', result: 'きて' }],
  },
  ta: {
    ichidanRule: '去掉「る」，加「た」',
    ichidanExample: { kanji: '食べる', result: '食べた' },
    godanRows: [
      { ending: 'う', change: '→ った', example: '買う', result: '買った' },
      { ending: 'く', change: '→ いた', example: '書く', result: '書いた' },
      { ending: 'ぐ', change: '→ いだ', example: '泳ぐ', result: '泳いだ' },
      { ending: 'す', change: '→ した', example: '話す', result: '話した' },
      { ending: 'つ', change: '→ った', example: '待つ', result: '待った' },
      { ending: 'ぬ', change: '→ んだ', example: '死ぬ', result: '死んだ' },
      { ending: 'ぶ', change: '→ んだ', example: '遊ぶ', result: '遊んだ' },
      { ending: 'む', change: '→ んだ', example: '飲む', result: '飲んだ' },
      { ending: 'る', change: '→ った', example: '帰る', result: '帰った' },
    ],
    godanNote: '※ 行く（いく）例外：行った（非行いた）。た形與て形模式完全相同。',
    irregularResults: [{ verb: 'する', meaning: '做', result: 'した' }, { verb: 'くる', meaning: '來', result: 'きた' }],
  },
  nai: {
    ichidanRule: '去掉「る」，加「ない」',
    ichidanExample: { kanji: '食べる', result: '食べない' },
    godanRows: [
      { ending: 'う', change: 'わ＋ない', example: '買う', result: '買わない' },
      { ending: 'く', change: 'か＋ない', example: '書く', result: '書かない' },
      { ending: 'ぐ', change: 'が＋ない', example: '泳ぐ', result: '泳がない' },
      { ending: 'す', change: 'さ＋ない', example: '話す', result: '話さない' },
      { ending: 'つ', change: 'た＋ない', example: '待つ', result: '待たない' },
      { ending: 'ぬ', change: 'な＋ない', example: '死ぬ', result: '死なない' },
      { ending: 'ぶ', change: 'ば＋ない', example: '遊ぶ', result: '遊ばない' },
      { ending: 'む', change: 'ま＋ない', example: '飲む', result: '飲まない' },
      { ending: 'る', change: 'ら＋ない', example: '帰る', result: '帰らない' },
    ],
    godanNote: '※「う」的否定幹是「わ」而非「う」，為五段動詞唯一例外。',
    irregularResults: [{ verb: 'する', meaning: '做', result: 'しない' }, { verb: 'くる', meaning: '來', result: 'こない' }],
  },
  masu: {
    ichidanRule: '去掉「る」，加「ます」',
    ichidanExample: { kanji: '食べる', result: '食べます' },
    godanRows: [
      { ending: 'う', change: 'い＋ます', example: '買う', result: '買います' },
      { ending: 'く', change: 'き＋ます', example: '書く', result: '書きます' },
      { ending: 'ぐ', change: 'ぎ＋ます', example: '泳ぐ', result: '泳ぎます' },
      { ending: 'す', change: 'し＋ます', example: '話す', result: '話します' },
      { ending: 'つ', change: 'ち＋ます', example: '待つ', result: '待ちます' },
      { ending: 'ぬ', change: 'に＋ます', example: '死ぬ', result: '死にます' },
      { ending: 'ぶ', change: 'び＋ます', example: '遊ぶ', result: '遊びます' },
      { ending: 'む', change: 'み＋ます', example: '飲む', result: '飲みます' },
      { ending: 'る', change: 'り＋ます', example: '帰る', result: '帰ります' },
    ],
    irregularResults: [{ verb: 'する', meaning: '做', result: 'します' }, { verb: 'くる', meaning: '來', result: 'きます' }],
  },
  ba: {
    ichidanRule: '去掉「る」，加「れば」',
    ichidanExample: { kanji: '食べる', result: '食べれば' },
    godanRows: [
      { ending: 'う', change: 'え＋ば', example: '買う', result: '買えば' },
      { ending: 'く', change: 'け＋ば', example: '書く', result: '書けば' },
      { ending: 'ぐ', change: 'げ＋ば', example: '泳ぐ', result: '泳げば' },
      { ending: 'す', change: 'せ＋ば', example: '話す', result: '話せば' },
      { ending: 'つ', change: 'て＋ば', example: '待つ', result: '待てば' },
      { ending: 'ぬ', change: 'ね＋ば', example: '死ぬ', result: '死ねば' },
      { ending: 'ぶ', change: 'べ＋ば', example: '遊ぶ', result: '遊べば' },
      { ending: 'む', change: 'め＋ば', example: '飲む', result: '飲めば' },
      { ending: 'る', change: 'れ＋ば', example: '帰る', result: '帰れば' },
    ],
    irregularResults: [{ verb: 'する', meaning: '做', result: 'すれば' }, { verb: 'くる', meaning: '來', result: 'くれば' }],
  },
  meirei: {
    ichidanRule: '去掉「る」，加「ろ」（強烈命令）',
    ichidanExample: { kanji: '食べる', result: '食べろ' },
    godanRows: [
      { ending: 'う', change: '→ え', example: '買う', result: '買え' },
      { ending: 'く', change: '→ け', example: '書く', result: '書け' },
      { ending: 'ぐ', change: '→ げ', example: '泳ぐ', result: '泳げ' },
      { ending: 'す', change: '→ せ', example: '話す', result: '話せ' },
      { ending: 'つ', change: '→ て', example: '待つ', result: '待て' },
      { ending: 'ぬ', change: '→ ね', example: '死ぬ', result: '死ね' },
      { ending: 'ぶ', change: '→ べ', example: '遊ぶ', result: '遊べ' },
      { ending: 'む', change: '→ め', example: '飲む', result: '飲め' },
      { ending: 'る', change: '→ れ', example: '帰る', result: '帰れ' },
    ],
    godanNote: '※ 命令形語尾直接變え行，不再加「ば」。',
    irregularResults: [{ verb: 'する', meaning: '做', result: 'しろ' }, { verb: 'くる', meaning: '來', result: 'こい' }],
  },
  ishi: {
    ichidanRule: '去掉「る」，加「よう」',
    ichidanExample: { kanji: '食べる', result: '食べよう' },
    godanRows: [
      { ending: 'う', change: 'お＋う', example: '買う', result: '買おう' },
      { ending: 'く', change: 'こ＋う', example: '書く', result: '書こう' },
      { ending: 'ぐ', change: 'ご＋う', example: '泳ぐ', result: '泳ごう' },
      { ending: 'す', change: 'そ＋う', example: '話す', result: '話そう' },
      { ending: 'つ', change: 'と＋う', example: '待つ', result: '待とう' },
      { ending: 'ぬ', change: 'の＋う', example: '死ぬ', result: '死のう' },
      { ending: 'ぶ', change: 'ぼ＋う', example: '遊ぶ', result: '遊ぼう' },
      { ending: 'む', change: 'も＋う', example: '飲む', result: '飲もう' },
      { ending: 'る', change: 'ろ＋う', example: '帰る', result: '帰ろう' },
    ],
    irregularResults: [{ verb: 'する', meaning: '做', result: 'しよう' }, { verb: 'くる', meaning: '來', result: 'こよう' }],
  },
};

function ConjugationGuide() {
  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
        <h3 className="font-black text-indigo-800 text-base mb-3">日語動詞三大類型</h3>
        <div className="space-y-2">
          {[
            { dot: 'bg-green-500', label: '一段動詞（Ichidan）', desc: '字尾為「る」，去掉る後直接加語尾，最規則。' },
            { dot: 'bg-blue-500',  label: '五段動詞（Godan）',   desc: '字尾為う・く・ぐ・す・つ・ぬ・ぶ・む・る，依行變化語尾。' },
            { dot: 'bg-amber-500', label: '不規則動詞（Irregular）', desc: '只有「する」和「くる」兩個，需要死背。' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
              <div className="text-sm">
                <span className="font-bold text-gray-800">{item.label}</span>
                <span className="text-gray-500 ml-2 text-xs">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-indigo-600 bg-indigo-100 rounded-lg px-3 py-2">
          ⚠️ 字尾為「る」的動詞不一定是一段動詞（如「帰る」是五段）。辨認方式：字尾前若為い段或え段假名，大多為一段；否則多為五段。
        </p>
      </div>

      {/* One card per form */}
      {FORMS.map(form => {
        const guide = GUIDE[form.name];
        const colorText = FORM_COLORS[form.color];
        const colorBg = FORM_BG[form.color];
        return (
          <div key={form.name} className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className={`px-4 py-3 border-b border-gray-100 ${colorBg}`}>
              <div className="flex items-center gap-2">
                <span className={`font-black text-lg ${colorText}`}>{form.label}</span>
                <span className="text-gray-500 text-sm">{form.labelJp}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{form.usage}</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Ichidan */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-green-700">一段動詞</span>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
                  <span className="text-gray-600">{guide.ichidanRule}</span>
                  <span className="text-gray-300">—</span>
                  <span className="font-bold text-gray-800">{guide.ichidanExample.kanji}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-bold ${colorText}`}>{guide.ichidanExample.result}</span>
                </div>
              </div>
              {/* Godan */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-blue-700">五段動詞</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                        <th className="text-left px-2 py-1.5 font-semibold w-8">字尾</th>
                        <th className="text-left px-2 py-1.5 font-semibold">変化</th>
                        <th className="text-left px-2 py-1.5 font-semibold">例詞</th>
                        <th className="text-left px-2 py-1.5 font-semibold">結果</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guide.godanRows.map((row, i) => (
                        <tr key={row.ending} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 font-bold text-blue-600">{row.ending}</td>
                          <td className="px-2 py-1.5 text-gray-500">{row.change}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.example}</td>
                          <td className={`px-2 py-1.5 font-bold ${colorText}`}>{row.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {guide.godanNote && (
                  <p className="text-xs text-amber-600 mt-1.5 pl-1">{guide.godanNote}</p>
                )}
              </div>
              {/* Irregular */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-700">不規則動詞</span>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {guide.irregularResults.map(ir => (
                    <div key={ir.verb} className="bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-2 text-sm">
                      <span className="font-bold text-gray-800">{ir.verb}</span>
                      <span className="text-gray-400 text-xs">（{ir.meaning}）</span>
                      <span className="text-gray-400">→</span>
                      <span className={`font-bold ${colorText}`}>{ir.result}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
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

  if (view === 'guide') {
    return (
      <div>
        <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-700 flex items-center gap-1 text-sm transition-colors mb-6">
          ← 返回列表
        </button>
        <h2 className="text-xl font-black text-gray-900 mb-1">動詞活用形指南</h2>
        <p className="text-sm text-gray-400 mb-5">て形・た形・ない形・ます形・ば形・命令形・意志形</p>
        <ConjugationGuide />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">動詞変化</h2>
          <p className="text-sm text-gray-400 mt-0.5">て形・た形・ない形・ます形・ば形・命令形・意志形</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('guide')}
            className="px-3 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs"
          >
            活用指南
          </button>
          <button
            onClick={() => startQuiz()}
            className="px-3 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-xs shadow-sm"
          >
            全動詞クイズ
          </button>
        </div>
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
