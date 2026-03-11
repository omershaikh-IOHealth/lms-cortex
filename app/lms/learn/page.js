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

function ProgressRing({ pct, size = 48, stroke = 3.5, color = 'var(--cortex-accent)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} className="drop-shadow-sm">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-800" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </svg>
  );
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-125 active:scale-110"
        >
          <svg width="28" height="28" viewBox="0 0 24 24"
            fill={(hover || value) >= n ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= n ? '#f59e0b' : '#cbd5e1'}
            strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function LearnPage() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState({ courses: [], coming_soon: [] });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [ratingModal, setRatingModal] = useState(null); // { courseId, courseTitle, existing }
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);
  const [courseRatings, setCourseRatings] = useState({}); // courseId → rating

  useEffect(() => {
    apiFetch('/api/lms/me/curriculum')
      .then(r => r?.json())
      .then(d => {
        const data = d && d.courses ? d : { courses: [], coming_soon: [] };
        setCurriculum(data);
        // Fetch existing course ratings
        data.courses?.forEach(c => {
          apiFetch(`/api/lms/feedback?reference_type=course&reference_id=${c.id}`)
            .then(r => r?.json())
            .then(fb => { if (fb?.rating) setCourseRatings(prev => ({ ...prev, [c.id]: fb })); })
            .catch(() => {});
        });
      })
      .catch(e => console.error('curriculum error:', e))
      .finally(() => setLoading(false));
  }, []);

  const openRating = (course) => {
    const existing = courseRatings[course.id];
    setRatingModal({ courseId: course.id, courseTitle: course.title });
    setRatingValue(existing?.rating || 0);
    setRatingComment(existing?.comment || '');
  };

  const submitRating = async () => {
    if (!ratingValue || !ratingModal) return;
    setRatingSaving(true);
    try {
      const res = await apiFetch('/api/lms/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_type: 'course', reference_id: ratingModal.courseId, rating: ratingValue, comment: ratingComment }),
      });
      const data = await res?.json();
      if (data?.id) {
        setCourseRatings(prev => ({ ...prev, [ratingModal.courseId]: data }));
        setRatingModal(null);
      }
    } finally {
      setRatingSaving(false);
    }
  };

  const allLessons = (curriculum.courses || []).flatMap(c => (c.sections || []).flatMap(s => s.lessons || []));
  const completedCount = allLessons.filter(l => l.completed).length;
  const inProgressCount = allLessons.filter(l => !l.completed && l.percent_watched > 0).length;
  const pct = allLessons.length > 0 ? Math.round(completedCount / allLessons.length * 100) : 0;

  // Mocking "Popular in Department" and "Recent Activity" for visual completeness
  const popularCourses = (curriculum.courses || []).slice(0, 3);
  const recentActivity = [
    { type: 'lesson_complete', title: 'Hygiene Standards', time: '2 hours ago' },
    { type: 'quiz_passed', title: 'Patient Privacy 101', time: 'Yesterday' },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <div className="w-12 h-12 border-4 border-cortex-accent border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-slate-400 font-medium tracking-wide">Preparing your learning path...</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* ── Welcome Header ── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back, {user?.display_name || user?.email.split('@')[0]}</h1>
          <p className="text-slate-500 mt-2 text-lg">You've completed <span className="text-cortex-accent font-bold">{pct}%</span> of your assigned training. Keep it up!</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-cortex-text shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-cortex-text shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Content Area (Left 2/3) ── */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Current Focus / Resume Learning */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Current Focus</h2>
            </div>
            {curriculum.courses.length > 0 ? (
              <div className={`group border rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 relative overflow-hidden ${
                pct === 100
                  ? 'bg-green-50 border-green-200 hover:shadow-green-500/10'
                  : 'bg-white border-slate-200 hover:shadow-blue-500/5'
              }`}>
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl transition-colors ${
                  pct === 100 ? 'bg-green-500/10 group-hover:bg-green-500/20' : 'bg-cortex-accent/5 group-hover:bg-cortex-accent/10'
                }`} />

                <div className="relative flex flex-col md:flex-row gap-8 items-center">
                  <div className="relative flex-shrink-0">
                    <ProgressRing pct={pct} size={120} stroke={8} color={pct === 100 ? '#22c55e' : 'var(--cortex-accent)'} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {pct === 100 ? (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <>
                          <span className="text-2xl font-black text-slate-900 leading-none">{pct}%</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left">
                    {pct === 100 ? (
                      <>
                        <h3 className="text-2xl font-bold text-green-700 mb-2">You're all caught up! 🎉</h3>
                        <p className="text-green-600/80 mb-4 text-sm leading-relaxed max-w-md">You've completed all your assigned training. Check back when new courses are assigned to you.</p>
                        <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-6 py-3 rounded-2xl font-bold text-sm border border-green-200">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          All Courses Complete
                        </span>
                      </>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Continue your learning path</h3>
                        <p className="text-slate-500 mb-6 text-sm leading-relaxed max-w-md">You're doing great! Finish the remaining lessons to get your certifications and stay compliant.</p>
                        <Link href={`/lms/learn/lesson?id=${allLessons.find(l => !l.completed)?.id || ''}`}
                          className="inline-flex items-center gap-2 bg-cortex-accent text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-cortex-accent/30 active:scale-95">
                          Resume Next Lesson
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center">
                <div className="text-4xl mb-4">🌿</div>
                <h3 className="text-lg font-bold text-slate-900">Your canvas is clear</h3>
                <p className="text-slate-400 text-sm mt-1">No courses assigned yet. You'll see them here once assigned.</p>
              </div>
            )}
          </section>

          {/* Coming Soon Courses */}
          {(curriculum.coming_soon || []).length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Coming Soon</h2>
                <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full font-bold">Preview</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(curriculum.coming_soon || []).map(course => (
                  <div key={course.id} className="relative p-5 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 border-dashed overflow-hidden">
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] font-black px-2.5 py-1 bg-violet-600 text-white rounded-full uppercase tracking-wider">Coming Soon</span>
                    </div>
                    <div className="flex items-center gap-3 pr-20">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg flex-shrink-0">
                        {course.category === 'Medical' ? '🏥' : course.category === 'Safety' ? '🛡️' : '📚'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-700 truncate">{course.title}</h4>
                        {course.category && <span className="text-[10px] text-slate-400 uppercase font-bold">{course.category}</span>}
                      </div>
                    </div>
                    {course.description && <p className="mt-2 text-xs text-slate-400 line-clamp-2">{course.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Course Library / Grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">My Curriculum</h2>
            </div>
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
              {curriculum.courses.map(course => {
                const courseLessons = (course.sections || []).flatMap(s => s.lessons || []);
                const courseDone    = courseLessons.filter(l => l.completed).length;
                const coursePct     = courseLessons.length > 0 ? Math.round(courseDone / courseLessons.length * 100) : 0;
                const nextLesson    = courseLessons.find(l => !l.completed) || courseLessons[0];
                const hasQuiz       = !!course.quiz_id;
                const quizPassed    = course.quiz_passed;

                return (
                  <div key={course.id} className={`group bg-white border border-slate-200 transition-all duration-300 hover:border-cortex-accent hover:shadow-lg ${
                    viewMode === 'grid' ? 'p-5 rounded-3xl flex flex-col gap-3' : 'p-4 rounded-2xl flex items-center justify-between gap-3'
                  }`}>
                    <Link href={`/lms/learn/lesson?id=${nextLesson?.id || ''}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        <ProgressRing pct={coursePct} size={48} stroke={4} color={coursePct === 100 ? '#22c55e' : 'var(--cortex-accent)'} />
                        {coursePct === 100 && (
                          <div className="absolute inset-0 flex items-center justify-center animate-scale-in">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 truncate group-hover:text-cortex-accent transition-colors">{course.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded">{course.category || 'Core'}</span>
                          <span className="text-xs text-slate-400">{courseDone}/{courseLessons.length} lessons</span>
                          {hasQuiz && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${quizPassed ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                              {quizPassed ? '✓ Quiz Passed' : '● Quiz'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className={`flex items-center gap-2 flex-shrink-0 ${viewMode === 'grid' ? 'self-end' : ''}`}>
                      {hasQuiz && (
                        <Link href={`/lms/learn/quiz?id=${course.quiz_id}`}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all ${
                            quizPassed
                              ? 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
                              : 'border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100'
                          }`}>
                          {quizPassed ? 'Retake Quiz' : 'Take Quiz'}
                        </Link>
                      )}
                      {coursePct > 0 && (
                        <button onClick={() => openRating(course)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold border transition-all border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
                          title="Rate this course">
                          <svg width="12" height="12" viewBox="0 0 24 24"
                            fill={courseRatings[course.id] ? '#f59e0b' : 'none'}
                            stroke="#f59e0b" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          {courseRatings[course.id] ? `${courseRatings[course.id].rating}/5` : 'Rate'}
                        </button>
                      )}
                      {viewMode === 'list' && (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${coursePct}%`, background: coursePct === 100 ? '#22c55e' : 'var(--cortex-accent)' }} />
                          </div>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 group-hover:translate-x-1 transition-transform"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Sidebar Stats & Recommendations (Right 1/3) ── */}
        <div className="space-y-10">
          
          {/* Recent Activity */}
          <section>
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Recent Activity</h2>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              {recentActivity.map((act, i) => (
                <div key={i} className="flex gap-4 relative">
                  {i !== recentActivity.length - 1 && <div className="absolute left-[11px] top-7 bottom-[-24px] w-[2px] bg-slate-100" />}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    act.type === 'quiz_passed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {act.type === 'quiz_passed' ? (
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{act.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{act.type === 'quiz_passed' ? 'Passed Quiz' : 'Completed Lesson'} • {act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Stats summary */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Your Stats</h2>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              {[
                { label: 'Lessons Done', value: completedCount, icon: '✅', color: 'text-green-600' },
                { label: 'In Progress', value: inProgressCount, icon: '▶️', color: 'text-blue-600' },
                { label: 'Remaining', value: allLessons.length - completedCount - inProgressCount, icon: '📋', color: 'text-slate-400' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                  <span className={`text-sm font-black ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* ── Course Rating Modal ── */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRatingModal(null)}>
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Rate this course</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{ratingModal.courseTitle}</p>
              </div>
              <button onClick={() => setRatingModal(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex justify-center">
              <StarRating value={ratingValue} onChange={setRatingValue} />
            </div>
            <textarea
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              placeholder="Share your thoughts (optional)..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 resize-none"
            />
            <button
              onClick={submitRating}
              disabled={!ratingValue || ratingSaving}
              className="w-full bg-amber-400 text-white font-black py-3 rounded-2xl hover:bg-amber-500 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-200"
            >
              {ratingSaving ? 'Saving...' : courseRatings[ratingModal.courseId] ? 'Update Rating' : 'Submit Rating'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
