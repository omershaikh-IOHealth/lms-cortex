// frontend/app/lms/learn/progress/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

const fmtDuration = (s) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

const ProgressBar = ({ pct, color = 'bg-cortex-accent' }) => (
  <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
  </div>
);

export default function ProgressPage() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // all | completed | in-progress | not-started

  useEffect(() => {
    apiFetch('/api/lms/me/progress')
      .then(r => r?.json())
      .then(d => setLessons(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed   = lessons.filter(l => l.completed);
  const inProgress  = lessons.filter(l => !l.completed && (l.percent_watched || 0) > 0);
  const notStarted  = lessons.filter(l => !l.completed && (l.percent_watched || 0) === 0);
  const overallPct  = lessons.length ? Math.round(completed.length / lessons.length * 100) : 0;

  const filtered = filter === 'completed'   ? completed
                 : filter === 'in-progress' ? inProgress
                 : filter === 'not-started' ? notStarted
                 : lessons;

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading progress…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-cortex-text">My Progress</h1>
        <p className="text-cortex-muted text-sm mt-0.5">Track your learning across all lessons</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',       value: lessons.length,   color: 'text-cortex-text',   bg: '' },
          { label: 'Completed',   value: completed.length, color: 'text-green-600',      bg: 'bg-green-50 dark:bg-green-900/10' },
          { label: 'In Progress', value: inProgress.length,color: 'text-cortex-accent',  bg: '' },
          { label: 'Not Started', value: notStarted.length,color: 'text-cortex-muted',   bg: '' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} bg-cortex-surface border border-cortex-border rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Overall bar */}
      {lessons.length > 0 && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-cortex-text font-medium">Overall Completion</span>
            <span className="text-cortex-muted">{overallPct}%</span>
          </div>
          <div className="h-2.5 bg-cortex-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-cortex-accent rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-cortex-surface border border-cortex-border rounded-lg p-1 w-fit">
        {[
          { key: 'all',         label: 'All' },
          { key: 'completed',   label: 'Completed' },
          { key: 'in-progress', label: 'In Progress' },
          { key: 'not-started', label: 'Not Started' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-cortex-accent text-white shadow-sm'
                : 'text-cortex-muted hover:text-cortex-text'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lesson list */}
      {!filtered.length ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-10 text-center text-cortex-muted text-sm">
          No lessons in this category.
        </div>
      ) : (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          {filtered.map((lesson, i) => {
            const pct     = lesson.percent_watched || 0;
            const isDone  = lesson.completed;
            const barColor = isDone ? 'bg-green-500' : 'bg-cortex-accent';

            return (
              <Link
                key={lesson.lesson_id}
                href={`/lms/learn/lesson?id=${lesson.lesson_id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-cortex-bg transition group ${
                  i > 0 ? 'border-t border-cortex-border' : ''
                }`}>

                {/* Status dot */}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isDone  ? 'border-green-500 bg-green-500'
                  : pct > 0 ? 'border-cortex-accent bg-cortex-accent/10'
                  : 'border-cortex-border bg-cortex-bg'
                }`}>
                  {isDone ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : pct > 0 ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cortex-accent">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cortex-border">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm text-cortex-text group-hover:text-cortex-accent transition truncate font-medium">
                      {lesson.title}
                    </span>
                    <span className={`text-xs font-semibold flex-shrink-0 ${isDone ? 'text-green-600' : pct > 0 ? 'text-cortex-accent' : 'text-cortex-muted'}`}>
                      {isDone ? 'Completed' : pct > 0 ? `${pct}%` : 'Not started'}
                    </span>
                  </div>
                  <ProgressBar pct={isDone ? 100 : pct} color={barColor} />
                  <div className="flex items-center gap-3 mt-1.5">
                    {lesson.duration_seconds && (
                      <span className="text-xs text-cortex-muted">{fmtDuration(lesson.duration_seconds)}</span>
                    )}
                    {lesson.last_watched_at && (
                      <span className="text-xs text-cortex-muted">
                        Last watched {new Date(lesson.last_watched_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-cortex-muted flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}