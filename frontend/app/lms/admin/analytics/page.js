// frontend/app/lms/admin/analytics/page.js
'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

const EVENT_LABELS = {
  page_view: { icon: '👁', color: 'blue' },
  click: { icon: '🖱', color: 'gray' },
  scroll: { icon: '📜', color: 'gray' },
  video_play: { icon: '▶️', color: 'green' },
  video_pause: { icon: '⏸', color: 'yellow' },
  video_seek: { icon: '⏩', color: 'purple' },
  video_progress_heartbeat: { icon: '💓', color: 'pink' },
  manual_view_heartbeat: { icon: '📖', color: 'blue' },
  idle_start: { icon: '😴', color: 'orange' },
  idle_end: { icon: '⚡', color: 'green' },
  lesson_complete: { icon: '🏆', color: 'yellow' },
};

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const preselectedUser = searchParams.get('user');
  const [tab, setTab] = useState('overview'); // 'overview' | 'learners' | 'timeline'
  const [learners, setLearners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [learnerTypes, setLearnerTypes] = useState([]);

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [filterType, setFilterType] = useState('');

  // User detail
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  // Load reference data
  useEffect(() => {
    Promise.all([
      apiFetch('/api/lms/admin/departments').then(r => r?.json()),
      apiFetch('/api/lms/admin/specialties').then(r => r?.json()),
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
    ]).then(([d, s, t]) => {
      if (d) setDepartments(d);
      if (s) setSpecialties(s);
      if (t) setLearnerTypes(t);
    });
  }, []);

  // Load learners with filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterDept) params.set('department', filterDept);
    if (filterSpec) params.set('specialty', filterSpec);
    if (filterType) params.set('learner_type', filterType);
    const qs = params.toString() ? `?${params}` : '';
    apiFetch(`/api/lms/admin/progress/users${qs}`).then(r => r?.json()).then(d => {
      if (d) {
        setLearners(d);
        if (preselectedUser && !selectedUser) {
          const found = d.find(l => l.id === preselectedUser);
          if (found) { loadUser(found); setTab('learners'); }
        }
      }
    });
  }, [filterDept, filterSpec, filterType]);

  // Load summary analytics
  useEffect(() => {
    apiFetch('/api/lms/admin/analytics/summary').then(r => r?.json()).then(d => {
      if (d) setSummary(d);
    });
  }, []);

  const loadUser = async (user) => {
    setSelectedUser(user);
    setSelectedSession(null);
    setTimeline(null);
    setTab('learners');
    const d = await apiFetch(`/api/lms/admin/progress/users/${user.id}`).then(r => r?.json());
    if (d) setUserDetail(d);
  };

  const loadSession = async (session) => {
    setSelectedSession(session);
    setTab('timeline');
    const d = await apiFetch(`/api/lms/admin/sessions/${session.id}/timeline`).then(r => r?.json());
    if (d) { setTimeline(d); setPlayhead(0); setPlaying(false); }
  };

  // Timeline playback
  useEffect(() => {
    if (playing && timeline) {
      intervalRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= timeline.events.length - 1) { setPlaying(false); return p; }
          return p + 1;
        });
      }, 600);
    } else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [playing, timeline]);

  // Aggregate stats
  const totalLearners = learners.length;
  const totalCompleted = learners.reduce((a, l) => a + (l.completed_lessons || 0), 0);
  const totalWatchHours = Math.round(learners.reduce((a, l) => a + (l.total_watch_seconds || 0), 0) / 3600 * 10) / 10;
  const avgProgress = learners.length ? Math.round(learners.reduce((a, l) => a + (parseFloat(l.avg_percent_watched) || 0), 0) / learners.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cortex-text">Analytics Dashboard</h1>
        <div className="flex gap-1 bg-cortex-surface border border-cortex-border rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'learners', label: 'Learner Details' },
            { id: 'timeline', label: 'Timeline Replay' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === t.id ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:text-cortex-text'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={filterSpec} onChange={e => setFilterSpec(e.target.value)}
          className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm">
          <option value="">All Specialties</option>
          {specialties.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm">
          <option value="">All User Types</option>
          {learnerTypes.filter(t => t.is_active).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
        {(filterDept || filterSpec || filterType) && (
          <button onClick={() => { setFilterDept(''); setFilterSpec(''); setFilterType(''); }}
            className="text-xs text-cortex-accent hover:underline px-2">
            Clear Filters
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Learners',    value: totalLearners, color: 'border-l-cortex-accent',  text: 'text-cortex-accent' },
          { label: 'Lessons Completed', value: totalCompleted, color: 'border-l-green-500',      text: 'text-green-500' },
          { label: 'Watch Hours',       value: totalWatchHours, color: 'border-l-purple-500',    text: 'text-purple-500' },
          { label: 'Avg. Progress',     value: `${avgProgress}%`, color: 'border-l-yellow-500', text: 'text-yellow-500' },
        ].map(m => (
          <div key={m.label} className={`bg-cortex-surface border border-cortex-border border-l-4 ${m.color} rounded-xl p-4`}>
            <div className="text-cortex-muted text-xs font-medium mb-1">{m.label}</div>
            <div className={`text-2xl font-bold ${m.text}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'overview' && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Breakdown */}
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <h3 className="text-cortex-text font-semibold mb-4 text-sm">Learners by Department</h3>
            {summary.byDepartment?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={summary.byDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Bar dataKey="learner_count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Learners" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-cortex-muted text-sm text-center py-8">No department data yet</div>}
          </div>

          {/* User Type Distribution */}
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <h3 className="text-cortex-text font-semibold mb-4 text-sm">Distribution by User Type</h3>
            {summary.byLearnerType?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={summary.byLearnerType.filter(t => t.learner_type)}
                    dataKey="learner_count" nameKey="learner_type"
                    cx="50%" cy="50%" outerRadius={90} label={({ learner_type, learner_count }) => `${learner_type || 'Unset'}: ${learner_count}`}>
                    {summary.byLearnerType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-cortex-muted text-sm text-center py-8">No user type data yet</div>}
          </div>

          {/* Course Completion */}
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <h3 className="text-cortex-text font-semibold mb-4 text-sm">Course Progress</h3>
            {summary.byCourse?.length > 0 ? (
              <div className="space-y-3">
                {summary.byCourse.map(c => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-cortex-text truncate mr-2">{c.course_title}</span>
                      <span className="text-cortex-muted flex-shrink-0">{c.active_learners} learners | {c.avg_progress || 0}% avg</span>
                    </div>
                    <div className="h-2 bg-cortex-bg rounded-full overflow-hidden">
                      <div className="h-full bg-cortex-accent rounded-full" style={{ width: `${c.avg_progress || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-cortex-muted text-sm text-center py-8">No course data yet</div>}
          </div>

          {/* Weekly Activity Trend */}
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <h3 className="text-cortex-text font-semibold mb-4 text-sm">Weekly Activity (Last 8 Weeks)</h3>
            {summary.weeklyActivity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={summary.weeklyActivity.map(w => ({
                  ...w,
                  week: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  hours: Math.round(w.watch_seconds / 3600 * 10) / 10,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="active_learners" stroke="#3b82f6" name="Active Learners" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="hours" stroke="#22c55e" name="Watch Hours" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="text-cortex-muted text-sm text-center py-8">No activity data yet</div>}
          </div>

          {/* Department Watch Time */}
          {summary.byDepartment?.length > 0 && (
            <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5 lg:col-span-2">
              <h3 className="text-cortex-text font-semibold mb-4 text-sm">Watch Hours by Department</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={summary.byDepartment.map(d => ({ ...d, hours: Math.round(d.total_watch_seconds / 3600 * 10) / 10 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Watch Hours" />
                  <Bar dataKey="completed_lessons" fill="#22c55e" radius={[4, 4, 0, 0]} name="Lessons Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Learner Details ── */}
      {tab === 'learners' && (
        <div className="flex gap-6">
          {/* User list */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-cortex-surface border border-cortex-border rounded-xl p-3 max-h-[70vh] overflow-y-auto">
              <div className="text-xs text-cortex-muted px-2 mb-2 font-medium uppercase tracking-wider">
                Learners ({learners.length})
              </div>
              {learners.map(l => (
                <button key={l.id} onClick={() => loadUser(l)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition mb-0.5 ${
                    selectedUser?.id === l.id ? 'bg-cortex-accent text-white' : 'text-cortex-text hover:bg-cortex-bg'
                  }`}>
                  <div className="truncate font-medium">{l.display_name || l.email}</div>
                  <div className="text-xs opacity-60 flex gap-2">
                    <span>{l.learner_type || 'No type'}</span>
                    {l.staff_id && <span>| {l.staff_id}</span>}
                  </div>
                  {l.departments?.length > 0 && (
                    <div className="text-xs opacity-50 truncate mt-0.5">{l.departments.join(', ')}</div>
                  )}
                </button>
              ))}
              {learners.length === 0 && <div className="text-cortex-muted text-sm px-2 py-6 text-center">No learners match filters</div>}
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex-1 space-y-4">
            {!selectedUser ? (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                Select a learner to view detailed analytics
              </div>
            ) : !userDetail ? (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">Loading...</div>
            ) : (
              <>
                {/* User info header */}
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-lg font-bold">
                      {(userDetail.user?.display_name || userDetail.user?.email)?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-cortex-text font-semibold text-lg">{userDetail.user?.display_name}</h2>
                      <div className="text-cortex-muted text-xs flex gap-3">
                        <span>{userDetail.user?.email}</span>
                        {userDetail.user?.staff_id && <span>Staff ID: {userDetail.user.staff_id}</span>}
                      </div>
                      {userDetail.user?.departments?.length > 0 && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {userDetail.user.departments.map(d => (
                            <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{d}</span>
                          ))}
                          {userDetail.user.specialties?.map(s => (
                            <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Lessons Completed', value: userDetail.progress.filter(p => p.completed).length },
                      { label: 'In Progress', value: userDetail.progress.filter(p => !p.completed).length },
                      { label: 'Total Watch Time', value: `${Math.round(userDetail.progress.reduce((a,p)=>a+(p.total_watch_seconds||0),0)/60)}m` },
                      { label: 'Sessions', value: userDetail.sessions.length },
                    ].map(m => (
                      <div key={m.label} className="bg-cortex-bg rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-cortex-text">{m.value}</div>
                        <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-lesson progress */}
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                  <h3 className="text-cortex-text font-semibold mb-3 text-sm">Lesson Progress</h3>
                  <div className="space-y-2">
                    {userDetail.progress.map(p => (
                      <div key={p.lesson_id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-cortex-text">{p.lesson_title}</span>
                            <span className="text-cortex-muted">{p.percent_watched}%</span>
                          </div>
                          <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                              style={{ width: `${p.percent_watched}%` }} />
                          </div>
                        </div>
                        {p.completed && <span className="text-green-500 text-xs font-bold">Done</span>}
                      </div>
                    ))}
                    {userDetail.progress.length === 0 && <div className="text-cortex-muted text-sm">No progress yet</div>}
                  </div>
                </div>

                {/* Sessions */}
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                  <h3 className="text-cortex-text font-semibold mb-3 text-sm">Learning Sessions</h3>
                  <div className="space-y-1.5">
                    {userDetail.sessions.map(s => (
                      <button key={s.id} onClick={() => loadSession(s)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition ${
                          selectedSession?.id === s.id ? 'bg-cortex-accent text-white' : 'bg-cortex-bg text-cortex-text hover:bg-cortex-border/30'
                        }`}>
                        <div className="flex justify-between">
                          <span>{s.lesson_title}</span>
                          <span className="text-xs opacity-70">{s.total_active_seconds}s active</span>
                        </div>
                        <div className="text-xs opacity-60">{new Date(s.session_started_at).toLocaleString()}</div>
                      </button>
                    ))}
                    {!userDetail.sessions.length && <div className="text-cortex-muted text-sm">No sessions yet</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Timeline Replay ── */}
      {tab === 'timeline' && (
        <div className="space-y-4">
          {!timeline ? (
            <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
              Select a learner and session from the Learner Details tab to replay their timeline
            </div>
          ) : (
            <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-cortex-text font-semibold">Session Timeline Replay</h3>
                  {timeline.session && (
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {timeline.session.display_name} — {timeline.session.lesson_title}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cortex-muted text-sm">{playhead + 1} / {timeline.events.length}</span>
                  <button onClick={() => { setPlayhead(0); setPlaying(false); }}
                    className="bg-cortex-bg border border-cortex-border hover:bg-cortex-border/30 text-cortex-text px-3 py-1 rounded text-xs transition">
                    Reset
                  </button>
                  <button onClick={() => setPlaying(p => !p)}
                    className="bg-cortex-accent hover:opacity-90 text-white px-3 py-1 rounded text-xs transition">
                    {playing ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>

              <input type="range" min={0} max={Math.max(timeline.events.length - 1, 0)} value={playhead}
                onChange={e => setPlayhead(Number(e.target.value))}
                className="w-full mb-4 accent-cortex-accent" />

              {timeline.events[playhead] && (() => {
                const ev = timeline.events[playhead];
                const meta = EVENT_LABELS[ev.event_type] || { icon: '•', color: 'gray' };
                return (
                  <div className="bg-cortex-bg rounded-lg p-3 mb-4 border border-cortex-border">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-cortex-text font-medium">{ev.event_type}</span>
                      <span className="text-cortex-muted text-xs ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                    </div>
                    {Object.keys(ev.event_payload || {}).length > 0 && (
                      <pre className="text-xs text-cortex-muted mt-2 overflow-x-auto">{JSON.stringify(ev.event_payload, null, 2)}</pre>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {timeline.events.slice(0, playhead + 1).map((ev, i) => {
                  const meta = EVENT_LABELS[ev.event_type] || { icon: '•' };
                  return (
                    <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                      i === playhead ? 'bg-cortex-accent/20 text-cortex-text' : 'text-cortex-muted'
                    }`}>
                      <span>{meta.icon}</span>
                      <span>{ev.event_type}</span>
                      <span className="ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learner Progress Table (always visible at bottom) */}
      {tab === 'overview' && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-cortex-border">
            <h3 className="text-cortex-text font-semibold text-sm">All Learners</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Learner</th>
                <th className="px-5 py-3 font-medium">Staff ID</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Departments</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium text-right">Watch Time</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {learners.map(l => (
                <tr key={l.id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3">
                    <div className="font-medium text-cortex-text">{l.display_name || l.email}</div>
                    <div className="text-xs text-cortex-muted">{l.email}</div>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{l.staff_id || '—'}</td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{l.learner_type || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(l.departments || []).map(d => (
                        <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{d}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                        <div className="h-full bg-cortex-accent rounded-full" style={{ width: `${l.avg_percent_watched || 0}%` }} />
                      </div>
                      <span className="text-xs text-cortex-muted">{l.completed_lessons} done</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-cortex-muted text-xs">
                    {Math.round((l.total_watch_seconds || 0) / 60)}m
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => loadUser(l)}
                      className="text-xs text-cortex-accent hover:underline">
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
