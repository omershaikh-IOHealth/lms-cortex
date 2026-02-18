// frontend/app/lms/learn/progress/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

const fmtSec = (s) => {
  const m = Math.floor((s || 0) / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function MyProgressPage() {
  const { user }   = useAuth();
  const [curriculum, setCurriculum] = useState({ courses: [] });
  const [progress,   setProgress]   = useState([]);   // flat lesson progress rows
  const [schedule,   setSchedule]   = useState([]);   // physical sessions
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/lms/me/curriculum').then(r => r?.json()),
      apiFetch('/api/lms/me/progress').then(r => r?.json()),
      apiFetch('/api/lms/me/schedule').then(r => r?.json()),
    ]).then(([cur, prog, sched]) => {
      if (cur)   setCurriculum(cur);
      if (prog)  setProgress(Array.isArray(prog) ? prog : []);
      if (sched) setSchedule(Array.isArray(sched) ? sched : []);
    }).finally(() => setLoading(false));
  }, []);

  const progressMap = new Map(progress.map(p => [p.lesson_id, p]));

  const allLessons      = curriculum.courses.flatMap(c => c.sections.flatMap(s => s.lessons));
  const completedCount  = allLessons.filter(l => l.completed).length;
  const inProgressCount = allLessons.filter(l => !l.completed && l.percent_watched > 0).length;
  const totalWatchSecs  = progress.reduce((a, p) => a + (p.total_watch_seconds || 0), 0);
  const pct = allLessons.length > 0 ? Math.round(completedCount / allLessons.length * 100) : 0;

  const physAttended = schedule.filter(s => s.attendance_status === 'present').length;
  const physTotal    = schedule.length;

  // Circumference for ring
  const R  = 36;
  const C  = 2 * Math.PI * R;
  const ring = C - (pct / 100) * C;

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading your progress…
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-cortex-text">My Progress</h1>
        <p className="text-cortex-muted text-sm mt-0.5">{user?.display_name || user?.email}</p>
      </div>

      {/* ── Top KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Completion ring */}
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-5 flex flex-col items-center justify-center col-span-1">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgb(var(--cortex-border))" strokeWidth="8"/>
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgb(var(--cortex-accent))" strokeWidth="8"
              strokeDasharray={C} strokeDashoffset={ring}
              strokeLinecap="round" transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
            <text x="44" y="48" textAnchor="middle" fontSize="15" fontWeight="700" fill="rgb(var(--cortex-text))">{pct}%</text>
          </svg>
          <div className="text-xs text-cortex-muted mt-1 text-center">Overall Complete</div>
        </div>

        {[
          { label: 'Completed',      value: completedCount,  sub: 'lessons', color: 'text-green-600' },
          { label: 'In Progress',    value: inProgressCount, sub: 'lessons', color: 'text-cortex-accent' },
          { label: 'Watch Time',     value: fmtSec(totalWatchSecs), sub: 'total', color: 'text-purple-500' },
        ].map(m => (
          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-2xl p-5 flex flex-col justify-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{m.sub}</div>
            <div className="text-xs font-medium text-cortex-muted mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Physical Training badge ───────────────────────────────────────────── */}
      {physTotal > 0 && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏋️</span>
            <div>
              <div className="text-sm font-semibold text-cortex-text">Physical Training</div>
              <div className="text-xs text-cortex-muted">{physAttended} of {physTotal} sessions attended</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-cortex-bg rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${physTotal > 0 ? (physAttended / physTotal) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-cortex-muted">{physTotal > 0 ? Math.round((physAttended / physTotal) * 100) : 0}%</span>
          </div>
          <Link href="/lms/learn/schedule" className="text-xs text-cortex-accent hover:underline ml-4">View Schedule →</Link>
        </div>
      )}

      {/* ── Per-course breakdown ──────────────────────────────────────────────── */}
      {curriculum.courses.length === 0 ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
          <div className="text-4xl mb-3">📚</div>
          <div className="text-sm">No curriculum assigned yet.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {curriculum.courses.map(course => {
            const courseLessons  = course.sections.flatMap(s => s.lessons);
            const courseDone     = courseLessons.filter(l => l.completed).length;
            const coursePct      = courseLessons.length > 0 ? Math.round(courseDone / courseLessons.length * 100) : 0;
            const courseWatchSec = courseLessons.reduce((a, l) => a + (progressMap.get(l.id)?.total_watch_seconds || 0), 0);

            return (
              <div key={course.id} className="bg-cortex-surface border border-cortex-border rounded-2xl overflow-hidden">
                {/* Course header */}
                <div className="px-5 py-4 border-b border-cortex-border flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-cortex-text">{course.title}</div>
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {courseDone}/{courseLessons.length} lessons · {fmtSec(courseWatchSec)} watched
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-2 bg-cortex-bg rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${coursePct === 100 ? 'bg-green-500' : 'bg-cortex-accent'}`}
                        style={{ width: `${coursePct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-cortex-muted w-8 text-right">{coursePct}%</span>
                  </div>
                </div>

                {/* Per-lesson rows */}
                <div className="divide-y divide-cortex-border">
                  {course.sections.map(section => (
                    <div key={section.id}>
                      {/* Section label */}
                      <div className="px-5 py-2 bg-cortex-bg">
                        <span className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">{section.title}</span>
                      </div>
                      {section.lessons.map(lesson => {
                        const p = progressMap.get(lesson.id);
                        const watched   = p?.percent_watched || 0;
                        const completed = p?.completed || lesson.completed;
                        const watchSecs = p?.total_watch_seconds || 0;
                        const lastActive = p?.last_activity_at;

                        return (
                          <div key={lesson.id} className="flex items-center gap-4 px-5 py-3 hover:bg-cortex-bg/50 transition">
                            {/* Status dot */}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${completed ? 'bg-green-500' : watched > 0 ? 'bg-cortex-accent' : 'bg-cortex-border'}`} />

                            {/* Title */}
                            <div className="flex-1 min-w-0">
                              <Link href={`/lms/learn/lesson?id=${lesson.id}`}
                                className="text-sm text-cortex-text hover:text-cortex-accent transition truncate block">
                                {lesson.title}
                              </Link>
                              <div className="flex gap-3 mt-0.5 text-xs text-cortex-muted">
                                {watchSecs > 0 && <span>{fmtSec(watchSecs)} watched</span>}
                                {p?.watch_count > 1 && <span>{p.watch_count}× viewed</span>}
                                {lastActive && <span>Last: {fmtDate(lastActive)}</span>}
                              </div>
                            </div>

                            {/* Progress bar + pct */}
                            <div className="flex items-center gap-2 flex-shrink-0 w-36">
                              <div className="flex-1 h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                                  style={{ width: `${watched}%` }} />
                              </div>
                              <span className="text-xs text-cortex-muted w-7 text-right">{watched}%</span>
                            </div>

                            {/* Status badge */}
                            <div className="flex-shrink-0 w-20 text-right">
                              {completed ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Done</span>
                              ) : watched > 0 ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cortex-accent/10 text-cortex-accent font-medium">In progress</span>
                              ) : (
                                <span className="text-xs text-cortex-muted">Not started</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}