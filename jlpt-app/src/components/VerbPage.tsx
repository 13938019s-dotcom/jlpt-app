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

const OVERVIEW_ROWS: { form: string; formName: FormName; godan: string; ichidan: string; suru: string; kuru: string }[] = [
  { form: 'て形',  formName: 'te',     godan: '書いて',   ichidan: '食べて',   suru: 'して',   kuru: 'きて'   },
  { form: 'た形',  formName: 'ta',     godan: '書いた',   ichidan: '食べた',   suru: 'した',   kuru: 'きた'   },
  { form: 'ない形', formName: 'nai',   godan: '書かない', ichidan: '食べない', suru: 'しない', kuru: 'こない' },
  { form: 'ます形', formName: 'masu',  godan: '書きます', ichidan: '食べます', suru: 'します', kuru: 'きます' },
  { form: 'ば形',  formName: 'ba',     godan: '書けば',   ichidan: '食べれば', suru: 'すれば', kuru: 'くれば' },
  { form: '命令形', formName: 'meirei', godan: '書け',    ichidan: '食べろ',   suru: 'しろ',   kuru: 'こい'   },
  { form: '意志形', formName: 'ishi',  godan: '書こう',   ichidan: '食べよう', suru: 'しよう', kuru: 'こよう' },
];

interface GodanRow { ending: string; change: string; example: string; result: string; }
interface GuideSection {
  formName: FormName;
  segmentHint?: string;
  ichidanRule: string;
  ichidanExample: { kanji: string; result: string };
  godanRows: GodanRow[];
  mnemonic?: string[];
  exceptions?: { label: string; correct: string; wrong?: string; note: string }[];
  usageExamples?: { jp: string; zh: string }[];
  irregularResults: { verb: string; meaning: string; result: string }[];
}

const GUIDE: GuideSection[] = [
  {
    formName: 'te',
    ichidanRule: '去掉「る」，直接加「て」',
    ichidanExample: { kanji: '食べる', result: '食べて' },
    godanRows: [
      { ending: 'う・つ・る', change: '→ って（促音便）', example: '買う・待つ・帰る', result: '買って・待って・帰って' },
      { ending: 'む・ぶ・ぬ', change: '→ んで（鼻音便）', example: '飲む・遊ぶ・死ぬ', result: '飲んで・遊んで・死んで' },
      { ending: 'く',         change: '→ いて（い音便）', example: '書く',             result: '書いて' },
      { ending: 'ぐ',         change: '→ いで（い音便）', example: '泳ぐ',             result: '泳いで' },
      { ending: 'す',         change: '→ して',           example: '話す',             result: '話して' },
    ],
    mnemonic: [
      'う・つ・る　→　って（促音）',
      'む・ぶ・ぬ　→　んで（鼻音）',
      'く　→　いて　／　ぐ　→　いで',
      'す　→　して',
    ],
    exceptions: [
      { label: '行く（いく）', correct: '行って', wrong: '行いて', note: '字尾是「く」，照規則應為「いて」，但「行く」例外，必須背起來！' },
    ],
    usageExamples: [
      { jp: 'ちょっと待ってください。', zh: '請稍等一下。（待つ→待って＋ください）' },
      { jp: '今、ご飯を食べています。', zh: '我現在正在吃飯。（食べる→食べて＋いる）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'して' },
      { verb: 'くる', meaning: '來', result: 'きて' },
    ],
  },
  {
    formName: 'ta',
    segmentHint: 'て形と完全同じ！「て→た」「で→だ」に換えるだけ',
    ichidanRule: '去掉「る」，加「た」',
    ichidanExample: { kanji: '食べる', result: '食べた' },
    godanRows: [
      { ending: 'う・つ・る', change: '→ った', example: '買う・待つ・帰る', result: '買った・待った・帰った' },
      { ending: 'む・ぶ・ぬ', change: '→ んだ', example: '飲む・遊ぶ・死ぬ', result: '飲んだ・遊んだ・死んだ' },
      { ending: 'く',         change: '→ いた', example: '書く',             result: '書いた' },
      { ending: 'ぐ',         change: '→ いだ', example: '泳ぐ',             result: '泳いだ' },
      { ending: 'す',         change: '→ した', example: '話す',             result: '話した' },
    ],
    exceptions: [
      { label: '行く（いく）', correct: '行った', wrong: '行いた', note: '同て形例外：行って→行った，記住成對即可。' },
    ],
    usageExamples: [
      { jp: '昨日、映画を見た。', zh: '昨天看了電影。（見る→見た）' },
      { jp: '日本に行ったことがありますか？', zh: '你曾經去過日本嗎？（行く→行った＋ことがある）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'した' },
      { verb: 'くる', meaning: '來', result: 'きた' },
    ],
  },
  {
    formName: 'nai',
    segmentHint: '五段動詞：語尾變「あ段」音，再加「ない」',
    ichidanRule: '去掉「る」，加「ない」',
    ichidanExample: { kanji: '食べる', result: '食べない' },
    godanRows: [
      { ending: 'う', change: 'わ＋ない ⚠️', example: '買う・会う', result: '買わない・会わない' },
      { ending: 'く', change: 'か＋ない',     example: '書く',       result: '書かない' },
      { ending: 'ぐ', change: 'が＋ない',     example: '泳ぐ',       result: '泳がない' },
      { ending: 'す', change: 'さ＋ない',     example: '話す',       result: '話さない' },
      { ending: 'つ', change: 'た＋ない',     example: '待つ',       result: '待たない' },
      { ending: 'ぬ', change: 'な＋ない',     example: '死ぬ',       result: '死なない' },
      { ending: 'ぶ', change: 'ば＋ない',     example: '遊ぶ',       result: '遊ばない' },
      { ending: 'む', change: 'ま＋ない',     example: '飲む',       result: '飲まない' },
      { ending: 'る', change: 'ら＋ない',     example: '帰る',       result: '帰らない' },
    ],
    exceptions: [
      { label: '「う」結尾 → わない', correct: '買わない', wrong: '買あない', note: '「う」的あ段音是「わ」而非「あ」。う・あ・う・え・お 的あ段是「わ」行！' },
      { label: 'ある（有）→ ない', correct: 'ない', wrong: 'あらない', note: '最特殊！「ある」的否定直接是「ない（沒有）」，完全不規則，一定要背！' },
    ],
    usageExamples: [
      { jp: 'ここで写真を撮らないでください。', zh: '請不要在這裡拍照。（取る→取らない＋でください）' },
      { jp: 'まだ宿題をしていない。', zh: '功課還沒做。（する→していない）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'しない' },
      { verb: 'くる', meaning: '來', result: 'こない（注意：發音從くる→こない！）' },
    ],
  },
  {
    formName: 'masu',
    segmentHint: '五段動詞：語尾變「い段」音，再加「ます」',
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
    usageExamples: [
      { jp: '毎日、日本語を勉強します。', zh: '我每天學日文。（する→します）' },
      { jp: 'すみません、少し待ちます。', zh: '不好意思，請稍等。（待つ→待ちます）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'します' },
      { verb: 'くる', meaning: '來', result: 'きます' },
    ],
  },
  {
    formName: 'ba',
    segmentHint: '五段動詞：語尾變「え段」音，再加「ば」',
    ichidanRule: '去掉「る」，加「れば」（注意一段比五段多一個「れ」！）',
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
    usageExamples: [
      { jp: 'もっと練習すればよかった。', zh: '早知道多練習就好了。（すれば＋よかった）' },
      { jp: '安ければ、買います。', zh: '如果便宜的話就買。（安い→安ければ）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'すれば' },
      { verb: 'くる', meaning: '來', result: 'くれば' },
    ],
  },
  {
    formName: 'meirei',
    segmentHint: '五段動詞：語尾直接改為「え段」音（和ば形一樣，但不加「ば」）',
    ichidanRule: '去掉「る」，加「ろ」（語氣強烈！日常請求改用「〜てください」）',
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
    exceptions: [
      { label: '日常禮貌說法', correct: '〜てください', note: '命令形語氣很強硬，日常對話通常改用「〜てください」。例：食べてください（請吃）而非食べろ。' },
    ],
    usageExamples: [
      { jp: '早く来い！（くる→こい）', zh: '快點來！（こい 是 くる 的命令形，很特殊）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'しろ' },
      { verb: 'くる', meaning: '來', result: 'こい（特殊！非くれ）' },
    ],
  },
  {
    formName: 'ishi',
    segmentHint: '五段動詞：語尾變「お段」音，再加「う」',
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
    usageExamples: [
      { jp: 'ちょっと休もう。', zh: '休息一下吧。（休む→休もう，邀請語氣）' },
      { jp: '日本に行こうと思っています。', zh: '我打算要去日本。（行く→行こう＋と思っている）' },
    ],
    irregularResults: [
      { verb: 'する', meaning: '做', result: 'しよう' },
      { verb: 'くる', meaning: '來', result: 'こよう' },
    ],
  },
];

function ConjugationGuide() {
  return (
    <div className="space-y-5">

      {/* ── STEP 1: 三大類型 ── */}
      <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
        <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-3">Step 1 — 先搞清楚動詞類型</div>
        <div className="space-y-2">
          {[
            {
              dot: 'bg-green-500', badge: '最簡單 ✓', badgeColor: 'bg-green-100 text-green-700',
              label: '一段動詞',
              rule: '不管變哪種形，一律「去掉る，直接加語尾」。',
              ex: '食べる・見る・起きる・寝る',
            },
            {
              dot: 'bg-blue-500', badge: '依段變化', badgeColor: 'bg-blue-100 text-blue-700',
              label: '五段動詞',
              rule: '語尾在「あいうえお」五個段落之間移動，是「五段」名稱的由來。',
              ex: '書く・飲む・話す・買う・帰る',
            },
            {
              dot: 'bg-amber-500', badge: '只有兩個', badgeColor: 'bg-amber-100 text-amber-700',
              label: '不規則動詞',
              rule: '「する」和「くる」各自有獨特變化，只能死背。',
              ex: 'する（做）・くる（來）',
            },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2.5 bg-white rounded-xl p-3">
              <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${item.dot}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-black text-gray-800 text-sm">{item.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${item.badgeColor}`}>{item.badge}</span>
                </div>
                <p className="text-xs text-gray-600 mb-0.5">{item.rule}</p>
                <p className="text-xs text-gray-400">例：{item.ex}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
          <span className="font-bold">⚠️ 辨認「る」結尾的動詞：</span>
          若「る」前一個假名屬於い段（き・み・い等）或え段（べ・ね・け等），大多是一段動詞。
          但有例外（帰る・走る・切る是五段），不確定時以APP的分類標示為準。
        </div>
      </div>

      {/* ── STEP 2: あいうえお五段系統 ── */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
        <div className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-2">Step 2 — 五段動詞的核心：あいうえお對應表</div>
        <p className="text-xs text-blue-800 mb-3">五段動詞根據活用形不同，語尾音會移到對應的「段」，再接後綴。以「書く（かく）」為例：</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="text-left pb-1.5 pr-2 font-bold text-blue-700">段</th>
                <th className="text-center pb-1.5 px-1 font-bold text-rose-600">あ段</th>
                <th className="text-center pb-1.5 px-1 font-bold text-emerald-600">い段</th>
                <th className="text-center pb-1.5 px-1 font-bold text-gray-500">う段</th>
                <th className="text-center pb-1.5 px-1 font-bold text-cyan-600">え段</th>
                <th className="text-center pb-1.5 px-1 font-bold text-purple-600">お段</th>
              </tr>
            </thead>
            <tbody className="text-center">
              <tr className="border-b border-blue-100">
                <td className="text-left py-1.5 pr-2 font-bold text-blue-700">用途</td>
                <td className="px-1 py-1.5 text-rose-600 font-semibold">ない形</td>
                <td className="px-1 py-1.5 text-emerald-600 font-semibold">ます形</td>
                <td className="px-1 py-1.5 text-gray-500">辭書形</td>
                <td className="px-1 py-1.5 text-cyan-600 font-semibold">ば形・命令形</td>
                <td className="px-1 py-1.5 text-purple-600 font-semibold">意志形</td>
              </tr>
              <tr>
                <td className="text-left py-1.5 pr-2 font-bold text-blue-700">書く</td>
                <td className="px-1 py-1.5 font-bold text-gray-700">書か</td>
                <td className="px-1 py-1.5 font-bold text-gray-700">書き</td>
                <td className="px-1 py-1.5 font-bold text-gray-400">書く</td>
                <td className="px-1 py-1.5 font-bold text-gray-700">書け</td>
                <td className="px-1 py-1.5 font-bold text-gray-700">書こ</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-blue-700 mt-2">※ て形・た形はこの五段表から外れる「音便」という特別なルール。</p>
      </div>

      {/* ── STEP 3: 一覽表 ── */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Step 3 — 七種活用形一覽比對</div>
          <p className="text-xs text-gray-400">以「書く（五段）」和「食べる（一段）」為代表</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2 font-semibold text-gray-400">活用形</th>
                <th className="text-left px-3 py-2 font-semibold text-blue-600">五段 書く</th>
                <th className="text-left px-3 py-2 font-semibold text-green-600">一段 食べる</th>
                <th className="text-left px-3 py-2 font-semibold text-amber-600">する</th>
                <th className="text-left px-3 py-2 font-semibold text-amber-600">くる</th>
              </tr>
            </thead>
            <tbody>
              {OVERVIEW_ROWS.map((row, i) => {
                const form = FORMS.find(f => f.name === row.formName)!;
                return (
                  <tr key={row.form} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${FORM_COLORS[form.color]}`}>{row.form}</span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.godan}</td>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.ichidan}</td>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.suru}</td>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.kuru}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STEP 4: 逐一說明 ── */}
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">Step 4 — 逐一學習各活用形規則</div>

      {GUIDE.map(guide => {
        const form = FORMS.find(f => f.name === guide.formName)!;
        const colorText = FORM_COLORS[form.color];
        const colorBg = FORM_BG[form.color];
        return (
          <div key={guide.formName} className="rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className={`px-4 py-3 border-b border-gray-100 ${colorBg}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-black text-xl ${colorText}`}>{form.label}</span>
                <span className="text-gray-500 text-sm">{form.labelJp}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{form.usage}</p>
              {guide.segmentHint && (
                <div className="mt-2 bg-white/70 rounded-lg px-2.5 py-1.5 text-xs text-blue-700 font-semibold">
                  💡 {guide.segmentHint}
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* 一段 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-green-700">一段動詞（最簡單）</span>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
                  <span className="text-gray-700 font-medium">{guide.ichidanRule}</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-bold text-gray-800">{guide.ichidanExample.kanji}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-bold text-base ${colorText}`}>{guide.ichidanExample.result}</span>
                </div>
              </div>

              {/* 口訣（て形） */}
              {guide.mnemonic && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-indigo-600 mb-2">🎵 口訣——先背這個！</div>
                  <div className="space-y-1">
                    {guide.mnemonic.map((line, i) => (
                      <div key={i} className="text-sm font-bold text-indigo-800 tracking-wide">{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* 五段 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-blue-700">五段動詞</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                        <th className="text-left px-2 py-1.5 font-semibold">字尾</th>
                        <th className="text-left px-2 py-1.5 font-semibold">変化方式</th>
                        <th className="text-left px-2 py-1.5 font-semibold">例詞</th>
                        <th className="text-left px-2 py-1.5 font-semibold">活用後</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guide.godanRows.map((row, i) => (
                        <tr key={row.ending} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-2 font-bold text-blue-600 whitespace-nowrap">{row.ending}</td>
                          <td className="px-2 py-2 text-gray-600">{row.change}</td>
                          <td className="px-2 py-2 text-gray-700">{row.example}</td>
                          <td className={`px-2 py-2 font-bold ${colorText}`}>{row.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 例外 */}
              {guide.exceptions && guide.exceptions.length > 0 && (
                <div className="space-y-2">
                  {guide.exceptions.map(ex => (
                    <div key={ex.label} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-bold text-amber-700 mb-1">⚠️ 例外：{ex.label}</div>
                      {ex.wrong && (
                        <div className="text-xs mb-0.5">
                          <span className="text-red-400 line-through mr-1">{ex.wrong}</span>
                          <span className="text-gray-400 mr-1">✗　→　✓</span>
                          <span className="font-bold text-amber-800">{ex.correct}</span>
                        </div>
                      )}
                      <div className="text-xs text-amber-700">{ex.note}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 不規則 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-700">不規則動詞（死背）</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {guide.irregularResults.map(ir => (
                    <div key={ir.verb} className="bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm flex-wrap">
                      <span className="font-bold text-gray-800">{ir.verb}</span>
                      <span className="text-gray-400 text-xs">（{ir.meaning}）</span>
                      <span className="text-gray-400">→</span>
                      <span className={`font-bold ${colorText}`}>{ir.result}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 使用例句 */}
              {guide.usageExamples && guide.usageExamples.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="text-xs font-bold text-gray-400 mb-2">使用例句</div>
                  <div className="space-y-2">
                    {guide.usageExamples.map(ex => (
                      <div key={ex.jp}>
                        <div className="text-sm font-medium text-gray-800">{ex.jp}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{ex.zh}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
