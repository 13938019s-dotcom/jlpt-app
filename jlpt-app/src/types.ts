export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface Vocabulary {
  kanji: string;
  furigana: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
}

export interface GrammarPoint {
  pattern: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
}

export interface Question {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface Article {
  id: string;
  level: JLPTLevel;
  title: string;
  content: string;
  vocabulary: Vocabulary[];
  grammar: GrammarPoint[];
  questions: Question[];
  isAIGenerated?: boolean;
}

export interface LevelProgress {
  completedArticleIds: string[];
}

export type Progress = Record<JLPTLevel, LevelProgress>;
