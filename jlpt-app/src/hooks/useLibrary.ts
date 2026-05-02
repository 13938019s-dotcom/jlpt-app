import { useState, useEffect, useCallback } from 'react';
import type { SavedVocabulary, SavedGrammar, Vocabulary, GrammarPoint, JLPTLevel } from '../types';

const VOCAB_KEY = 'jlpt_saved_vocab';
const GRAMMAR_KEY = 'jlpt_saved_grammar';

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); }
  catch { return []; }
}

export function useLibrary() {
  const [savedVocab, setSavedVocab] = useState<SavedVocabulary[]>(() => load(VOCAB_KEY));
  const [savedGrammar, setSavedGrammar] = useState<SavedGrammar[]>(() => load(GRAMMAR_KEY));

  useEffect(() => { localStorage.setItem(VOCAB_KEY, JSON.stringify(savedVocab)); }, [savedVocab]);
  useEffect(() => { localStorage.setItem(GRAMMAR_KEY, JSON.stringify(savedGrammar)); }, [savedGrammar]);

  const saveVocab = useCallback((vocab: Vocabulary, articleTitle: string, level: JLPTLevel) => {
    const id = `${vocab.kanji}::${articleTitle}`;
    setSavedVocab(prev =>
      prev.some(v => v.id === id) ? prev
        : [...prev, { ...vocab, id, savedAt: new Date().toISOString(), articleTitle, level }]
    );
  }, []);

  const removeVocab = useCallback((id: string) => {
    setSavedVocab(prev => prev.filter(v => v.id !== id));
  }, []);

  const isVocabSaved = useCallback(
    (kanji: string, articleTitle: string) =>
      savedVocab.some(v => v.id === `${kanji}::${articleTitle}`),
    [savedVocab]
  );

  const saveGrammar = useCallback((grammar: GrammarPoint, articleTitle: string, level: JLPTLevel) => {
    const id = `${grammar.pattern}::${articleTitle}`;
    setSavedGrammar(prev =>
      prev.some(g => g.id === id) ? prev
        : [...prev, { ...grammar, id, savedAt: new Date().toISOString(), articleTitle, level }]
    );
  }, []);

  const removeGrammar = useCallback((id: string) => {
    setSavedGrammar(prev => prev.filter(g => g.id !== id));
  }, []);

  const isGrammarSaved = useCallback(
    (pattern: string, articleTitle: string) =>
      savedGrammar.some(g => g.id === `${pattern}::${articleTitle}`),
    [savedGrammar]
  );

  return {
    savedVocab,
    savedGrammar,
    saveVocab,
    removeVocab,
    isVocabSaved,
    saveGrammar,
    removeGrammar,
    isGrammarSaved,
  };
}
