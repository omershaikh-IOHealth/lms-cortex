// frontend/app/lms/admin/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

const StatCard = ({ label, value, trend, icon, colorClass }) => (
  <div className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${colorClass} bg-opacity-10 shadow-inner group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
  </div>
);

export default function LMSAdminPage() {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState([]);
  const [incLoading, setIncLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState({});

  useEffect(() => {
    apiFetch('/api/lms/admin/progress/users')
      .then(r => r?.json())
      .then(data => { if (data) setLearners(data); })
      .finally(() => setLoading(false));

    apiFetch('/api/lms/admin/progress/incomplete')
      .then(r => r?.json())
      .then(data => { if (Array.isArray(data)) setIncomplete(data); })
      .finally(() => setIncLoading(false));
  }, []);

  const toggleExpand = useCallback(async (userId) => {
    setExpanded(prev => ({ ...prev, [userId]: !prev[userId] }));
    if (!details[userId] && !detailsLoading[userId]) {
      setDetailsLoading(prev => ({ ...prev, [userId]: true }));
      try {
        const res = await apiFetch(`/api/lms/admin/progress/incomplete/${userId}`);
        const data = await res?.json();
        if (data) setDetails(prev => ({ ...prev, [userId]: data }));
      } finally {
        setDetailsLoading(prev => ({ ...prev, [userId]: false }));
      }
    }
  }, [details, detailsLoading]);

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Learner Type', 'Progress (%)', 'Completed Lessons', 'Watch Hours', 'Last Active'],
      ...learners.map(l => [
        l.display_name || '',
        l.email,
        l.learner_type || 'General',
        l.avg_percent_watched || 0,
        l.completed_lessons || 0,
        Math.round((l.total_watch_seconds || 0) / 3600 * 10) / 10,
        l.last_active ? new Date(l.last_active).toLocaleDateString('en-AE') : 'Never',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learner-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCompleted = learners.reduce((a, l) => a + (l.completed_lessons || 0), 0);
  const totalWatchHours = Math.round(learners.reduce((a, l) => a + (l.total_watch_seconds || 0), 0) / 3600 * 10) / 10;
  const activeThisWeek = learners.filter(l => {
    const d = new Date(l.last_active);
    return !isNaN(d) && (Date.now() - d) < 7 * 24 * 3600 * 1000;
  }).length;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-slate-500 mt-1 font-medium">Real-time performance metrics across all departments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} disabled={loading || learners.length === 0} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Report
          </button>
          <Link href="/lms/admin/users" className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
            Manage Users
          </Link>
        </div>
      </section>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Learners" value={learners.length} trend={12} icon="👥" colorClass="bg-blue-500 text-blue-600" />
        <StatCard label="Lessons Completed" value={totalCompleted} trend={8} icon="✅" colorClass="bg-green-500 text-green-600" />
        <StatCard label="Total Watch Hours" value={`${totalWatchHours}h`} trend={-3} icon="⏱️" colorClass="bg-purple-500 text-purple-600" />
        <StatCard label="Learners with Gaps" value={incLoading ? '…' : incomplete.length} icon="⚠️" colorClass="bg-amber-500 text-amber-600" />
      </div>

      {/* Main Content: Learner Progress Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Learner Performance</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Top 20 active learners</p>
          </div>
          <Link href="/lms/admin/learners" className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-colors">
            Full Directory →
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing data...</span>
          </div>
        ) : learners.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="text-4xl">🌑</div>
            <div className="text-slate-400 font-medium">No active learners found in the system.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Learner</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Department</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Progress</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Last Active</th>
                  <th className="px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {learners.slice(0, 20).map(l => {
                  const lastActive = l.last_active ? new Date(l.last_active) : null;
                  const daysAgo = lastActive ? Math.floor((Date.now() - lastActive) / 86400000) : null;
                  return (
                    <tr key={l.id} className="group hover:bg-slate-50/80 transition-all duration-200">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-black text-slate-500 shadow-sm group-hover:from-blue-500 group-hover:to-blue-600 group-hover:text-white transition-all duration-300">
                            {(l.display_name || l.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{l.display_name || l.email}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-white transition-colors uppercase tracking-tight">
                          {l.learner_type || 'General'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-slate-900 rounded-full transition-all duration-1000 group-hover:bg-blue-600" style={{ width: `${l.avg_percent_watched || 0}%` }} />
                          </div>
                          <span className="text-xs font-black text-slate-700">{l.avg_percent_watched || 0}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="text-[11px] font-bold text-slate-600">
                          {daysAgo === null ? 'Never' : daysAgo === 0 ? 'Active Now' : `${daysAgo}d ago`}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Link href={`/lms/admin/learners/${l.id}`}
                          className="p-2 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incomplete Learners Section */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Learners with Gaps
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Incomplete lessons or unattended past sessions
            </p>
          </div>
          {!incLoading && (
            <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700">
              {incomplete.length} learner{incomplete.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {incLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Checking completion gaps…</span>
          </div>
        ) : incomplete.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <div className="text-slate-500 font-bold">All learners are on track!</div>
            <div className="text-xs text-slate-400">No incomplete lessons or unattended sessions found.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomplete.map(l => {
              const isOpen = expanded[l.id];
              const userDetails = details[l.id];
              const isLoadingDetails = detailsLoading[l.id];
              const lastActive = l.last_active ? new Date(l.last_active) : null;
              const daysAgo = lastActive ? Math.floor((Date.now() - lastActive) / 86400000) : null;

              return (
                <div key={l.id}>
                  {/* Row */}
                  <button
                    onClick={() => toggleExpand(l.id)}
                    className="w-full text-left flex items-center gap-4 px-8 py-5 hover:bg-slate-50/80 transition-all duration-150 group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-sm font-black text-amber-600 shadow-sm flex-shrink-0 group-hover:from-amber-400 group-hover:to-orange-400 group-hover:text-white transition-all duration-300">
                      {(l.display_name || l.email)[0].toUpperCase()}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{l.display_name || l.email}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{l.email}</div>
                    </div>

                    {/* Learner type badge */}
                    <span className="hidden sm:block text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg uppercase tracking-tight flex-shrink-0">
                      {l.learner_type || 'General'}
                    </span>

                    {/* Lesson progress */}
                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all ${l.lesson_pct >= 75 ? 'bg-amber-400' : l.lesson_pct >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                          style={{ width: `${l.lesson_pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-slate-700 w-10 text-right">{l.lesson_pct}%</span>
                    </div>

                    {/* Gap badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {l.incomplete_lessons > 0 && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100">
                          {l.incomplete_lessons} lesson{l.incomplete_lessons !== 1 ? 's' : ''} left
                        </span>
                      )}
                      {l.unattended_sessions > 0 && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                          {l.unattended_sessions} session{l.unattended_sessions !== 1 ? 's' : ''} missed
                        </span>
                      )}
                    </div>

                    {/* Last active */}
                    <div className="hidden lg:block text-[11px] font-bold text-slate-400 text-right flex-shrink-0 w-20">
                      {daysAgo === null ? 'Never' : daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                    </div>

                    {/* Chevron */}
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>

                  {/* Expanded drilldown */}
                  {isOpen && (
                    <div className="bg-slate-50/60 border-t border-slate-100 px-8 py-6 space-y-6">
                      {isLoadingDetails ? (
                        <div className="flex items-center gap-3 text-slate-400 text-sm font-bold">
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-amber-400 rounded-full animate-spin" />
                          Loading details…
                        </div>
                      ) : !userDetails ? (
                        <div className="text-slate-400 text-sm">No details available.</div>
                      ) : (
                        <>
                          {/* Incomplete Lessons */}
                          {userDetails.incomplete_lessons?.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                                Incomplete Lessons ({userDetails.incomplete_lessons.length})
                              </h4>
                              <div className="space-y-1.5">
                                {userDetails.incomplete_lessons.map(lesson => (
                                  <div key={lesson.lesson_id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-100 shadow-sm">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lesson.percent_watched > 0 ? 'bg-amber-400' : 'bg-red-300'}`} />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{lesson.course_title} /</span>
                                      <span className="text-sm font-bold text-slate-800 ml-1">{lesson.lesson_title}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 flex-shrink-0">
                                      {lesson.percent_watched > 0 ? `${Math.round(lesson.percent_watched)}% watched` : 'Not started'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unattended Sessions */}
                          {userDetails.unattended_sessions?.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                Missed Sessions ({userDetails.unattended_sessions.length})
                              </h4>
                              <div className="space-y-1.5">
                                {userDetails.unattended_sessions.map(s => (
                                  <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-slate-100 shadow-sm">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-bold text-slate-800">{s.title}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 flex-shrink-0">
                                      {new Date(s.scheduled_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${
                                      s.session_mode === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {s.session_mode === 'online' ? 'Online' : 'In Person'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {userDetails.incomplete_lessons?.length === 0 && userDetails.unattended_sessions?.length === 0 && (
                            <div className="text-slate-400 text-sm font-medium">All caught up — data may be stale.</div>
                          )}
                        </>
                      )}

                      {/* Link to learner profile */}
                      <div className="pt-1">
                        <Link href={`/lms/admin/learners/${l.id}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1">
                          View full learner profile
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
