'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

function QuizPageInner() {
  const params  = useSearchParams();
  const quizId  = params.get('id');
  const router  = useRouter();

  const [quiz,      setQuiz]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [answers,   setAnswers]   = useState({}); // { questionId: optionId | optionId[] }
  const [submitted, setSubmitted] = useState(false);
  const [result,    setResult]    = useState(null); // { score, passed, correct_options }
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!quizId) return;
    apiFetch(`/api/lms/quiz/${quizId}`).then(r => r?.json()).then(d => {
      setQuiz(d);
      setLoading(false);
    });
  }, [quizId]);

  const alreadyPassed = quiz?.attempts?.some(a => a.passed);
  const attemptsUsed  = quiz?.attempts?.length || 0;
  const attemptsLeft  = quiz ? quiz.max_attempts - attemptsUsed : 0;

  const selectOption = (questionId, optionId, isMulti) => {
    setAnswers(prev => {
      if (isMulti) {
        const cur = prev[questionId] || [];
        const arr = Array.isArray(cur) ? cur : [cur];
        return {
          ...prev,
          [questionId]: arr.includes(optionId) ? arr.filter(id => id !== optionId) : [...arr, optionId],
        };
      }
      return { ...prev, [questionId]: optionId };
    });
  };

  const submit = async () => {
    setError('');
    const unanswered = quiz.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) { setError('Please answer all questions before submitting.'); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch(`/api/lms/quiz/${quizId}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
      setSubmitted(true);
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const optionState = (question, option) => {
    if (!submitted || !result) return 'default';
    const isCorrect = (result.correct_options?.[question.id] || []).includes(String(option.id));
    const selectedArr = Array.isArray(answers[question.id])
      ? answers[question.id].map(String)
      : answers[question.id] ? [String(answers[question.id])] : [];
    const wasSelected = selectedArr.includes(String(option.id));
    if (isCorrect) return 'correct';
    if (wasSelected && !isCorrect) return 'wrong';
    return 'default';
  };

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading quiz…
    </div>
  );

  if (!quiz) return (
    <div className="p-8 text-cortex-muted">Quiz not found.</div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-cortex-muted hover:text-cortex-text mb-6 transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-cortex-text">{quiz.title}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-cortex-muted">
          <span>Pass mark: {quiz.pass_threshold}%</span>
          <span>·</span>
          <span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
          {!submitted && (
            <>
              <span>·</span>
              <span>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</span>
            </>
          )}
        </div>
      </div>

      {alreadyPassed && !submitted && (
        <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          You have already passed this quiz. You can retake it for practice.
        </div>
      )}

      {/* Result banner */}
      {submitted && result && (
        <div className={`mb-6 rounded-xl p-5 border ${result.passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${result.passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {result.score}%
            </div>
            <div>
              <div className={`font-semibold text-base ${result.passed ? 'text-green-500' : 'text-red-500'}`}>
                {result.passed ? 'Passed!' : 'Not passed'}
              </div>
              <div className="text-cortex-muted text-sm">
                {result.passed
                  ? 'Congratulations! You\'ve passed the quiz.'
                  : `You need ${quiz.pass_threshold}% to pass. ${attemptsLeft - 1 > 0 ? `You have ${attemptsLeft - 1} attempt${attemptsLeft - 1 !== 1 ? 's' : ''} remaining.` : 'No attempts remaining.'}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {quiz.questions.map((q, qi) => (
          <div key={q.id} className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <div className="text-sm font-medium text-cortex-text mb-3">
              <span className="text-cortex-muted mr-2">{qi + 1}.</span>
              {q.question_text}
            </div>
            <div className="space-y-2">
              {q.options.map(opt => {
                const state = optionState(q, opt);
                const isMulti = q.question_type === 'multi';
                const selectedArr = Array.isArray(answers[q.id]) ? answers[q.id].map(String) : answers[q.id] ? [String(answers[q.id])] : [];
                const isSelected = selectedArr.includes(String(opt.id));

                const baseClass = 'flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg border text-sm transition';
                const stateClass =
                  submitted
                    ? state === 'correct' ? 'border-green-500 bg-green-500/10 text-green-600'
                      : state === 'wrong'   ? 'border-red-500 bg-red-500/10 text-red-600'
                      : 'border-cortex-border text-cortex-muted'
                    : isSelected
                      ? 'border-cortex-accent bg-cortex-accent/10 text-cortex-accent'
                      : 'border-cortex-border text-cortex-text hover:border-cortex-muted';

                return (
                  <button
                    key={opt.id}
                    disabled={submitted}
                    onClick={() => selectOption(q.id, opt.id, isMulti)}
                    className={`${baseClass} ${stateClass}`}
                  >
                    <span className={`w-4 h-4 rounded-${isMulti ? 'sm' : 'full'} border-2 flex-shrink-0 flex items-center justify-center ${
                      submitted
                        ? state === 'correct' ? 'border-green-500 bg-green-500' : state === 'wrong' ? 'border-red-500 bg-red-500' : 'border-cortex-border'
                        : isSelected ? 'border-cortex-accent bg-cortex-accent' : 'border-cortex-border'
                    }`}>
                      {(isSelected || (submitted && state === 'correct')) && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                          {isMulti ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="4" fill="white" stroke="none"/>}
                        </svg>
                      )}
                    </span>
                    {opt.option_text}
                    {submitted && state === 'correct' && (
                      <span className="ml-auto text-xs text-green-500 font-medium">Correct</span>
                    )}
                    {submitted && state === 'wrong' && (
                      <span className="ml-auto text-xs text-red-500 font-medium">Wrong</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 text-cortex-danger text-sm bg-cortex-danger/10 border border-cortex-danger rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={submitting || attemptsLeft <= 0}
            className="px-6 py-2.5 rounded-lg bg-cortex-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting…' : 'Submit Quiz'}
          </button>
        ) : (
          <>
            {!result?.passed && attemptsLeft > 1 && (
              <button
                onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setError(''); }}
                className="px-6 py-2.5 rounded-lg bg-cortex-accent text-white text-sm font-medium hover:opacity-90 transition"
              >
                Retry Quiz
              </button>
            )}
            <button
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg border border-cortex-border text-cortex-muted text-sm hover:bg-cortex-bg transition"
            >
              Back to Course
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="p-8 text-cortex-muted">Loading quiz…</div>}>
      <QuizPageInner />
    </Suspense>
  );
}
