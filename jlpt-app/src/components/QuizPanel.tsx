import { useState } from 'react';
import type { Question } from '../types';

interface Props {
  questions: Question[];
  onAllCorrect: () => void;
}

export function QuizPanel({ questions, onAllCorrect }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [alreadyNotified, setAlreadyNotified] = useState(false);

  const handleSelect = (qi: number, optIdx: number) => {
    if (submitted) return;
    setAnswers(prev => prev.map((a, i) => (i === qi ? optIdx : a)));
  };

  const handleSubmit = () => {
    if (answers.some(a => a === null)) return;
    setSubmitted(true);
    const allCorrect = questions.every((q, i) => answers[i] === q.answerIndex);
    if (allCorrect && !alreadyNotified) {
      setAlreadyNotified(true);
      onAllCorrect();
    }
  };

  const handleRetry = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  };

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.answerIndex).length
    : null;

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="bg-purple-100 text-purple-700 rounded-lg px-3 py-1 text-sm">閱讀理解</span>
        <span className="text-sm text-gray-400 font-normal">{questions.length} 題</span>
      </h2>

      <div className="grid gap-5">
        {questions.map((q, qi) => {
          const selected = answers[qi];
          const isCorrect = submitted && selected === q.answerIndex;
          const isWrong = submitted && selected !== null && selected !== q.answerIndex;
          return (
            <div
              key={qi}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-colors ${
                isCorrect ? 'border-emerald-300 bg-emerald-50' : isWrong ? 'border-red-200 bg-red-50' : 'border-gray-100'
              }`}
            >
              <p className="font-medium text-gray-800 mb-3">
                <span className="text-purple-600 font-bold mr-2">Q{qi + 1}.</span>
                {q.question}
              </p>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const isSelected = selected === oi;
                  const isAnswer = q.answerIndex === oi;
                  let cls =
                    'w-full text-left px-4 py-2.5 rounded-lg text-sm border-2 transition-all duration-150 ';
                  if (!submitted) {
                    cls += isSelected
                      ? 'border-purple-400 bg-purple-50 text-purple-800 font-medium'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700';
                  } else {
                    if (isAnswer) cls += 'border-emerald-400 bg-emerald-100 text-emerald-800 font-bold';
                    else if (isSelected) cls += 'border-red-400 bg-red-100 text-red-700 line-through';
                    else cls += 'border-gray-200 text-gray-400';
                  }
                  return (
                    <button key={oi} className={cls} onClick={() => handleSelect(qi, oi)}>
                      <span className="font-bold mr-2 text-gray-400">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      {opt}
                      {submitted && isAnswer && (
                        <span className="ml-2 text-emerald-600">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={answers.some(a => a === null)}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            提交答案
          </button>
        ) : (
          <>
            <div
              className={`text-lg font-bold ${
                score === questions.length ? 'text-emerald-600' : 'text-orange-600'
              }`}
            >
              得分：{score} / {questions.length}
              {score === questions.length && <span className="ml-2">🎉 全部正確！</span>}
            </div>
            <button
              onClick={handleRetry}
              className="px-4 py-2 border-2 border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
            >
              重新作答
            </button>
          </>
        )}
      </div>
    </div>
  );
}
