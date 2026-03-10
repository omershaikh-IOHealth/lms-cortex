// frontend/app/lms/learn/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

const fmtDuration = (s) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// Circular progress ring for course cards
function ProgressRing({ pct, size = 52, stroke = 4, color = '#6366f1' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-cortex-border" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
    </svg>
  );
}

export default function LearnPage() {
  const { user }     = useAuth();
  const [curriculum, setCurriculum] = useState({ courses: [] });
  const [loading, setLoading]       = useState(true);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [viewMode, setViewMode]     = useState('list'); // 'list' | 'grid'

  useEffect(() => {
    apiFetch('/api/lms/me/curriculum').then(r => r?.json()).then(d => {
      const safe = d && d.courses ? d : { courses: [] };
      setCurriculum(safe);
      const exp = {};
      (safe.courses || []).forEach(c => { exp[c.id] = true; });
      setExpandedCourses(exp);
    }).catch(e => console.error('curriculum error:', e))
    .finally(() => setLoading(false));
  }, []);

  const allLessons     = (curriculum.courses || []).flatMap(c => (c.sections || []).flatMap(s => s.lessons || []));
  const completedCount = allLessons.filter(l => l.completed).length;
  const inProgressCount = allLessons.filter(l => !l.completed && l.percent_watched > 0).length;
  const pct            = allLessons.length > 0 ? Math.round(completedCount / allLessons.length * 100) : 0;

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading your curriculum…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">My Learning</h1>
          <p className="text-cortex-muted text-sm mt-0.5">Welcome back, {user?.display_name || user?.email}</p>
        </div>
        <div className="flex items-center gap-1 bg-cortex-surface border border-cortex-border rounded-lg p-0.5">
          <button onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition ${viewMode === 'list' ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:text-cortex-text'}`}
            title="List view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:text-cortex-text'}`}
            title="Grid view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Lessons',  value: allLessons.length,  color: 'text-cortex-text' },
          { label: 'Completed',      value: completedCount,     color: 'text-green-600' },
          { label: 'In Progress',    value: inProgressCount,    color: 'text-cortex-accent' },
        ].map(m => (
          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      {allLessons.length > 0 && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-cortex-text font-medium">Overall Progress</span>
            <span className="text-cortex-muted">{pct}%</span>
          </div>
          <div className="h-2 bg-cortex-bg rounded-full overflow-hidden">
            <div className="h-full bg-cortex-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Curriculum */}
      {!(curriculum.courses || []).length ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
          <div className="text-4xl mb-3">🎓</div>
          <div className="text-sm">No training assigned yet. Contact your training team.</div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid view ── */
        <div className="grid grid-cols-2 gap-4">
          {curriculum.courses.map(course => {
            const courseLessons = (course.sections || []).flatMap(s => s.lessons || []);
            const courseDone    = courseLessons.filter(l => l.completed).length;
            const coursePct     = courseLessons.length > 0 ? Math.round(courseDone / courseLessons.length * 100) : 0;
            const inProg        = courseLessons.some(l => l.percent_watched > 0 && !l.completed);
            const nextLesson    = courseLessons.find(l => !l.completed);

            return (
              <div key={course.id} className="bg-cortex-surface border border-cortex-border rounded-xl p-5 flex flex-col gap-4 hover:border-cortex-accent/50 transition">
                {/* Top row: progress ring + title */}
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <ProgressRing pct={coursePct} size={56} stroke={4}
                      color={coursePct === 100 ? '#22c55e' : '#6366f1'} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-cortex-text">{coursePct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-cortex-text text-sm leading-tight">{course.title}</div>
                    <div className="flex items-center flex-wrap gap-1 mt-1.5">
                      {course.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-cortex-border text-cortex-muted font-medium uppercase tracking-wide">
                          {course.category}
                        </span>
                      )}
                      {course.difficulty && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                          course.difficulty === 'beginner' ? 'bg-green-500/10 text-green-500' :
                          course.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>{course.difficulty}</span>
                      )}
                    </div>
                    <div className="text-xs text-cortex-muted mt-1">{courseDone}/{courseLessons.length} lessons</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${coursePct === 100 ? 'bg-green-500' : 'bg-cortex-accent'}`}
                    style={{ width: `${coursePct}%` }} />
                </div>

                {/* Status + CTA */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    coursePct === 100 && (!course.quiz_id || course.quiz_passed)
                      ? 'text-green-500'
                      : inProg ? 'text-cortex-accent'
                      : 'text-cortex-muted'
                  }`}>
                    {coursePct === 100 && (!course.quiz_id || course.quiz_passed) ? '✓ Complete'
                      : course.quiz_id && coursePct === 100 && !course.quiz_passed ? '📝 Quiz pending'
                      : inProg ? 'In progress' : 'Not started'}
                  </span>
                  {course.quiz_id && coursePct === 100 && !course.quiz_passed ? (
                    <Link href={`/lms/learn/quiz?id=${course.quiz_id}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 transition">
                      Take Quiz
                    </Link>
                  ) : nextLesson ? (
                    <Link href={`/lms/learn/lesson?id=${nextLesson.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-accent hover:border-cortex-accent/50 transition">
                      {courseDone === 0 ? 'Start' : 'Continue'} →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="space-y-4">
          {curriculum.courses.map(course => {
            const courseLessons  = (course.sections || []).flatMap(s => s.lessons || []);
            const courseDone     = courseLessons.filter(l => l.completed).length;
            const courseExpanded = expandedCourses[course.id];

            return (
              <div key={course.id} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                {/* Quiz CTA banner */}
                {course.quiz_id && courseDone > 0 && courseDone === courseLessons.length && !course.quiz_passed && (
                  <div className="mx-4 mt-3 mb-0 flex items-center gap-3 bg-cortex-accent/10 border border-cortex-accent/30 rounded-xl px-4 py-3">
                    <span className="text-2xl">📝</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-cortex-accent">Quiz required to complete this course</div>
                      <div className="text-xs text-cortex-muted mt-0.5">Pass mark: {course.pass_threshold}%</div>
                    </div>
                    <Link href={`/lms/learn/quiz?id=${course.quiz_id}`}
                      className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-cortex-accent text-white text-xs font-medium hover:opacity-90 transition">
                      Take Quiz
                    </Link>
                  </div>
                )}
                {course.quiz_id && course.quiz_passed && (
                  <div className="mx-4 mt-3 mb-0 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    <span className="text-xs font-medium text-green-500">Quiz passed — course complete!</span>
                  </div>
                )}

                <button
                  onClick={() => setExpandedCourses(p => ({ ...p, [course.id]: !p[course.id] }))}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-cortex-bg transition">
                  <div>
                    <div className="font-semibold text-cortex-text">{course.title}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {course.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-cortex-border text-cortex-muted font-medium uppercase tracking-wide">
                          {course.category}
                        </span>
                      )}
                      {course.difficulty && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                          course.difficulty === 'beginner' ? 'bg-green-500/10 text-green-500' :
                          course.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {course.difficulty}
                        </span>
                      )}
                      <span className="text-xs text-cortex-muted">
                        {courseDone}/{courseLessons.length} lessons completed
                      </span>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-cortex-muted transition-transform ${courseExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {courseExpanded && course.sections.map(section => (
                  <div key={section.id} className="border-t border-cortex-border">
                    <div className="px-5 py-2.5 bg-cortex-bg text-xs font-semibold text-cortex-muted uppercase tracking-wider">
                      {section.title}
                    </div>
                    {section.lessons.map(lesson => (
                      <Link key={lesson.id} href={`/lms/learn/lesson?id=${lesson.id}`}
                        className="flex items-center gap-3 px-5 py-3 border-t border-cortex-border hover:bg-cortex-bg transition group">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          lesson.completed ? 'border-green-500 bg-green-500' : lesson.percent_watched > 0 ? 'border-cortex-accent' : 'border-cortex-border'
                        }`}>
                          {lesson.completed && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-cortex-text group-hover:text-cortex-accent transition truncate">{lesson.title}</div>
                            {lesson.is_new && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cortex-accent text-white flex-shrink-0 leading-none">NEW</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {lesson.duration_seconds && <span className="text-xs text-cortex-muted">{fmtDuration(lesson.duration_seconds)}</span>}
                            {lesson.percent_watched > 0 && !lesson.completed && (
                              <span className="text-xs text-cortex-accent">{lesson.percent_watched}% watched</span>
                            )}
                          </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className="text-cortex-muted flex-shrink-0">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}