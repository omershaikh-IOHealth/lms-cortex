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

export default function LearnPage() {
  const { user }     = useAuth();
  const [curriculum, setCurriculum] = useState({ courses: [] });
  const [loading, setLoading]       = useState(true);
  const [expandedCourses, setExpandedCourses] = useState({});

  useEffect(() => {
    apiFetch('/api/lms/me/curriculum').then(r => r?.json()).then(d => {
      console.log('curriculum API response:', d); // remove after debugging
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-cortex-text">My Learning</h1>
        <p className="text-cortex-muted text-sm mt-0.5">Welcome back, {user?.display_name || user?.email}</p>
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

      {/* Curriculum tree */}
      {!(curriculum.courses || []).length ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
          <div className="text-4xl mb-3">🎓</div>
          <div className="text-sm">No training assigned yet. Contact your training team.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {curriculum.courses.map(course => {
            const courseLessons  = (course.sections || []).flatMap(s => s.lessons || []);
            const courseDone     = courseLessons.filter(l => l.completed).length;
            const courseExpanded = expandedCourses[course.id];

            return (
              <div key={course.id} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCourses(p => ({ ...p, [course.id]: !p[course.id] }))}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-cortex-bg transition">
                  <div>
                    <div className="font-semibold text-cortex-text">{course.title}</div>
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {courseDone}/{courseLessons.length} lessons completed
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
                          <div className="text-sm text-cortex-text group-hover:text-cortex-accent transition truncate">{lesson.title}</div>
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