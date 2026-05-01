import type { Verb } from '../data/verbs';

export type FormName = 'te' | 'ta' | 'nai' | 'masu' | 'ba' | 'meirei' | 'ishi';

export interface FormInfo {
  name: FormName;
  label: string;
  labelJp: string;
  usage: string;
  color: string;
}

export const FORMS: FormInfo[] = [
  { name: 'te',     label: 'て形',  labelJp: '接続形',  usage: '〜てください / 〜ている / 〜てから',   color: 'indigo' },
  { name: 'ta',     label: 'た形',  labelJp: '過去形',  usage: '〜た（過去）/ 〜たことがある',           color: 'violet' },
  { name: 'nai',    label: 'ない形', labelJp: '否定形',  usage: '〜ない / 〜ないでください',              color: 'rose' },
  { name: 'masu',   label: 'ます形', labelJp: '丁寧形',  usage: '〜ます / 〜ません / 〜ました',           color: 'emerald' },
  { name: 'ba',     label: 'ば形',  labelJp: '仮定形',  usage: '〜ばよかった / 〜ば〜ほど',              color: 'cyan' },
  { name: 'meirei', label: '命令形', labelJp: '命令形',  usage: '強い命令（〜しろ！）',                   color: 'orange' },
  { name: 'ishi',   label: '意志形', labelJp: '意志形',  usage: '〜よう（意志・勧誘）',                   color: 'purple' },
];

export interface ConjugationResult {
  te: string;
  ta: string;
  nai: string;
  masu: string;
  ba: string;
  meirei: string;
  ishi: string;
  stemKana: string;
}

// Maps the last kana character of a godan verb to its conjugation suffixes
const GODAN_MAP: Record<string, {
  te: string; ta: string;
  naiStem: string; masuStem: string; baStem: string; meireiBaStem: string; ishiStem: string;
}> = {
  'う': { te: 'って', ta: 'った', naiStem: 'わ', masuStem: 'い', baStem: 'え', meireiBaStem: 'え', ishiStem: 'お' },
  'く': { te: 'いて', ta: 'いた', naiStem: 'か', masuStem: 'き', baStem: 'け', meireiBaStem: 'け', ishiStem: 'こ' },
  'ぐ': { te: 'いで', ta: 'いだ', naiStem: 'が', masuStem: 'ぎ', baStem: 'げ', meireiBaStem: 'げ', ishiStem: 'ご' },
  'す': { te: 'して', ta: 'した', naiStem: 'さ', masuStem: 'し', baStem: 'せ', meireiBaStem: 'せ', ishiStem: 'そ' },
  'つ': { te: 'って', ta: 'った', naiStem: 'た', masuStem: 'ち', baStem: 'て', meireiBaStem: 'て', ishiStem: 'と' },
  'ぬ': { te: 'んで', ta: 'んだ', naiStem: 'な', masuStem: 'に', baStem: 'ね', meireiBaStem: 'ね', ishiStem: 'の' },
  'ぶ': { te: 'んで', ta: 'んだ', naiStem: 'ば', masuStem: 'び', baStem: 'べ', meireiBaStem: 'べ', ishiStem: 'ぼ' },
  'む': { te: 'んで', ta: 'んだ', naiStem: 'ま', masuStem: 'み', baStem: 'め', meireiBaStem: 'め', ishiStem: 'も' },
  'る': { te: 'って', ta: 'った', naiStem: 'ら', masuStem: 'り', baStem: 'れ', meireiBaStem: 'れ', ishiStem: 'ろ' },
};

export function conjugate(verb: Verb): ConjugationResult {
  if (verb.group === 'irregular') {
    if (verb.id === 'suru') {
      return { stemKana: '', te: 'して', ta: 'した', nai: 'しない', masu: 'します', ba: 'すれば', meirei: 'しろ', ishi: 'しよう' };
    }
    // kuru
    return { stemKana: '', te: 'きて', ta: 'きた', nai: 'こない', masu: 'きます', ba: 'くれば', meirei: 'こい', ishi: 'こよう' };
  }

  if (verb.group === 'ichidan') {
    const stem = verb.kana.slice(0, -1);
    return {
      stemKana: stem,
      te:     stem + 'て',
      ta:     stem + 'た',
      nai:    stem + 'ない',
      masu:   stem + 'ます',
      ba:     stem + 'れば',
      meirei: stem + 'ろ',
      ishi:   stem + 'よう',
    };
  }

  // Godan
  const stem = verb.kana.slice(0, -1);
  const last = verb.kana.slice(-1);

  // 行く special te/ta form
  if (verb.special === 'iku') {
    const m = GODAN_MAP['く'];
    return {
      stemKana: stem,
      te:     stem + 'って',
      ta:     stem + 'った',
      nai:    stem + m.naiStem + 'ない',
      masu:   stem + m.masuStem + 'ます',
      ba:     stem + m.baStem + 'ば',
      meirei: stem + m.meireiBaStem,
      ishi:   stem + m.ishiStem + 'う',
    };
  }

  const m = GODAN_MAP[last];
  return {
    stemKana: stem,
    te:     stem + m.te,
    ta:     stem + m.ta,
    nai:    stem + m.naiStem + 'ない',
    masu:   stem + m.masuStem + 'ます',
    ba:     stem + m.baStem + 'ば',
    meirei: stem + m.meireiBaStem,
    ishi:   stem + m.ishiStem + 'う',
  };
}

export function getGroupLabel(group: Verb['group']): string {
  return { ichidan: '一段動詞', godan: '五段動詞', irregular: '不規則動詞' }[group];
}

export function getGroupRule(verb: Verb): string {
  if (verb.group === 'ichidan') {
    return `語幹「${verb.kana.slice(0, -1)}」+語尾 （去掉「る」，接上各形式語尾）`;
  }
  if (verb.group === 'godan') {
    const last = verb.kana.slice(-1);
    const endings: Record<string, string> = {
      'う': 'う段→わ/い/う/え/お',
      'く': 'く→か/き/く/け/こ',
      'ぐ': 'ぐ→が/ぎ/ぐ/げ/ご',
      'す': 'す→さ/し/す/せ/そ',
      'つ': 'つ→た/ち/つ/て/と',
      'ぬ': 'ぬ→な/に/ぬ/ね/の',
      'ぶ': 'ぶ→ば/び/ぶ/べ/ぼ',
      'む': 'む→ま/み/む/め/も',
      'る': 'る→ら/り/る/れ/ろ',
    };
    return `五段活用（${endings[last] || last}）`;
  }
  return '不規則変化 — 需要死背';
}

export function randomForm(): FormName {
  const forms: FormName[] = ['te', 'ta', 'nai', 'masu', 'ba', 'meirei', 'ishi'];
  return forms[Math.floor(Math.random() * forms.length)];
}
