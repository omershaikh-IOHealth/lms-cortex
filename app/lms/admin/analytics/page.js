// app/lms/admin/analytics/page.js
'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import NewBadge from '@/components/NewBadge';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const EVENT_LABELS = {
  video_play:                { icon: '▶️', label: 'Video Play' },
  video_pause:               { icon: '⏸', label: 'Video Pause' },
  video_seek:                { icon: '⏩', label: 'Video Seek' },
  video_progress_heartbeat:  { icon: '💓', label: 'Watch Progress' },
  manual_view_heartbeat:     { icon: '📖', label: 'Reading' },
  idle_start:                { icon: '😴', label: 'Idle Start' },
  idle_end:                  { icon: '⚡', label: 'Idle End' },
  lesson_complete:           { icon: '🏆', label: 'Completed' },
  page_view:                 { icon: '👁', label: 'Page View' },
};

const CHART_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const fmtSecs = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? '';
        const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  return <Suspense><AnalyticsInner /></Suspense>;
}

function AnalyticsInner() {
  const searchParams    = useSearchParams();
  const preselectedUser = searchParams.get('user');

  // ── Filter state ──────────────────────────────────────────────────────────
  const [companies,     setCompanies]     = useState([]);
  const [departments,   setDepartments]   = useState([]);
  const [trainers,      setTrainers]      = useState([]);
  const [filterOrg,     setFilterOrg]     = useState('');
  const [filterDept,    setFilterDept]    = useState('');
  const [filterFrom,    setFilterFrom]    = useState('');
  const [filterTo,      setFilterTo]      = useState('');
  const [filterFacility,setFilterFacility]= useState('');
  const [filterTrainer, setFilterTrainer] = useState('');

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview ──────────────────────────────────────────────────────────────
  const [overview,        setOverview]        = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // ── Session analytics ─────────────────────────────────────────────────────
  const [sessions,          setSessions]          = useState([]);
  const [sessionsLoading,   setSessionsLoading]   = useState(false);
  const [selectedSession,   setSelectedSession]   = useState(null);
  const [expandedAttendees, setExpandedAttendees] = useState(null);

  // ── Completion analytics ──────────────────────────────────────────────────
  const [completion,        setCompletion]        = useState(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  // ── Feedback analytics ────────────────────────────────────────────────────
  const [feedback,        setFeedback]        = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackType,    setFeedbackType]    = useState('session');
  const [expandedFb,      setExpandedFb]      = useState(null);

  // ── Learner analytics ─────────────────────────────────────────────────────
  const [learners,     setLearners]     = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail,   setUserDetail]   = useState(null);
  const [selectedLS,   setSelectedLS]   = useState(null);
  const [timeline,     setTimeline]     = useState(null);
  const [playhead,     setPlayhead]     = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const intervalRef = useRef(null);

  // ── Load filter options ───────────────────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/lms/admin/companies').then(r => r?.json()).then(d => { if (d) setCompanies(d); });
    apiFetch('/api/lms/admin/departments').then(r => r?.json()).then(d => { if (d) setDepartments(d); });
    apiFetch('/api/lms/admin/physical-sessions/meta/trainers').then(r => r?.json()).then(d => { if (d) setTrainers(d); });
    apiFetch('/api/lms/admin/progress/users').then(r => r?.json()).then(d => {
      if (d) {
        setLearners(d);
        if (preselectedUser) {
          const found = d.find(l => l.id === preselectedUser);
          if (found) loadUser(found);
        }
      }
    });
  }, []);

  // ── Build filter query string ─────────────────────────────────────────────
  const filterQuery = useCallback((extra = {}) => {
    const p = new URLSearchParams();
    if (filterOrg)      p.set('company_id',    filterOrg);
    if (filterDept)     p.set('department_id', filterDept);
    if (filterFrom)     p.set('date_from',     filterFrom);
    if (filterTo)       p.set('date_to',       filterTo);
    if (filterFacility) p.set('facility',      filterFacility);
    if (filterTrainer)  p.set('trainer_id',    filterTrainer);
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString() ? '?' + p.toString() : '';
  }, [filterOrg, filterDept, filterFrom, filterTo, filterFacility, filterTrainer]);

  // ── Load overview ─────────────────────────────────────────────────────────
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    const d = await apiFetch(`/api/lms/admin/analytics/overview${filterQuery()}`).then(r => r?.json());
    if (d) setOverview(d);
    setOverviewLoading(false);
  }, [filterQuery]);

  // ── Load sessions ─────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    const d = await apiFetch(`/api/lms/admin/analytics/sessions${filterQuery()}`).then(r => r?.json());
    if (d) setSessions(Array.isArray(d) ? d : []);
    setSessionsLoading(false);
  }, [filterQuery]);

  // ── Load completion ───────────────────────────────────────────────────────
  const loadCompletion = useCallback(async () => {
    setCompletionLoading(true);
    const d = await apiFetch(`/api/lms/admin/analytics/completion${filterQuery()}`).then(r => r?.json());
    if (d) setCompletion(d);
    setCompletionLoading(false);
  }, [filterQuery]);

  // ── Load feedback ─────────────────────────────────────────────────────────
  const loadFeedback = useCallback(async (type) => {
    setFeedbackLoading(true);
    const q = new URLSearchParams({ reference_type: type || feedbackType });
    if (filterOrg)  q.set('company_id', filterOrg);
    if (filterDept) q.set('department_id', filterDept);
    const d = await apiFetch(`/api/lms/admin/analytics/feedback?${q}`).then(r => r?.json());
    if (Array.isArray(d)) setFeedback(d);
    setFeedbackLoading(false);
  }, [filterOrg, filterDept, feedbackType]);

  // ── Reload when filters change ────────────────────────────────────────────
  useEffect(() => {
    loadOverview();
    if (activeTab === 'sessions')    loadSessions();
    if (activeTab === 'completion')  loadCompletion();
    if (activeTab === 'feedback')    loadFeedback();
  }, [filterOrg, filterDept, filterFrom, filterTo, filterFacility, filterTrainer]);

  // ── Reload when tab changes ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'overview')                       loadOverview();
    if (activeTab === 'sessions'  && sessions.length === 0)   loadSessions();
    if (activeTab === 'completion'&& !completion)       loadCompletion();
    if (activeTab === 'feedback')                       loadFeedback();
  }, [activeTab]);

  // ── Learner detail ────────────────────────────────────────────────────────
  const loadUser = async (user) => {
    setSelectedUser(user); setSelectedLS(null); setTimeline(null);
    const d = await apiFetch(`/api/lms/admin/progress/users/${user.id}`).then(r => r?.json());
    if (d) setUserDetail(d);
  };

  const loadTimeline = async (session) => {
    setSelectedLS(session);
    const d = await apiFetch(`/api/lms/admin/sessions/${session.id}/timeline`).then(r => r?.json());
    if (d) { setTimeline(d); setPlayhead(0); setPlaying(false); }
  };

  useEffect(() => {
    if (playing && timeline) {
      intervalRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= timeline.events.length - 1) { setPlaying(false); return p; }
          return p + 1;
        });
      }, 600);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [playing, timeline]);

  // ── Dept options (filtered by org) ────────────────────────────────────────
  const deptOptions    = departments.filter(d => !d.parent_id && (!filterOrg || !d.company_id || String(d.company_id) === filterOrg));
  const subDeptOptions = filterDept ? departments.filter(d => String(d.parent_id) === filterDept) : [];

  // ── RENDER ────────────────────────────────────────────────────────────────
  const TABS = [
    ['overview',   'Overview'],
    ['sessions',   'Sessions'],
    ['completion', 'Completion'],
    ['learners',   'Learners'],
    ['feedback',   'Feedback'],
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-cortex-border bg-cortex-surface">
        {/* Top row: title + filters */}
        <div className="flex items-center justify-between px-6 py-3 gap-4 flex-wrap">
          <h1 className="text-lg font-bold text-cortex-text flex-shrink-0">Analytics</h1>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-xs text-cortex-muted font-medium">Filters<NewBadge description="New: Filter analytics by organisation, department, trainer, facility, and date range." /></span>
            {/* Org filter */}
            <select value={filterOrg} onChange={e => { setFilterOrg(e.target.value); setFilterDept(''); }}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Organizations</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>

            {/* Dept filter */}
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Departments</option>
              {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              {subDeptOptions.map(d => <option key={d.id} value={d.id}>  {d.name}</option>)}
            </select>

            {/* Trainer filter */}
            <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Trainers</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.display_name || t.email}</option>)}
            </select>

            {/* Date range */}
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="From" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="To" />

            {/* Facility */}
            <input type="text" value={filterFacility} onChange={e => setFilterFacility(e.target.value)}
              placeholder="Facility..."
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent w-32" />

            {/* Clear */}
            {(filterOrg || filterDept || filterFrom || filterTo || filterFacility || filterTrainer) && (
              <button onClick={() => {
                setFilterOrg(''); setFilterDept(''); setFilterFrom('');
                setFilterTo(''); setFilterFacility(''); setFilterTrainer('');
              }} className="text-xs text-cortex-muted hover:text-cortex-danger px-2 py-1.5 rounded-lg border border-cortex-border hover:border-cortex-danger transition">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tab row */}
        <div className="flex px-6 gap-0 border-t border-cortex-border overflow-x-auto">
          {TABS.map(([v, l]) => (
            <button key={v} onClick={() => setActiveTab(v)}
              className={`inline-flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === v
                  ? 'border-cortex-accent text-cortex-accent'
                  : 'border-transparent text-cortex-muted hover:text-cortex-text hover:border-cortex-border'
              }`}>
              {l}
              {v === 'completion' && <NewBadge description="New: Completion tab — view lesson completion rates per course and per learner type, plus average watch time." />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading && <div className="text-center text-cortex-muted py-12">Loading overview...</div>}
            {overview && (
              <>
                {/* KPI grid — row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users',       value: overview.users.total_users,       color: 'text-cortex-text',   sub: `${overview.users.learners} learners · ${overview.users.trainers} trainers` },
                    { label: 'Training Sessions', value: overview.sessions.total_sessions, color: 'text-cortex-accent', sub: `${overview.sessions.upcoming_sessions} upcoming` },
                    { label: 'Avg Attendance',    value: `${overview.sessions.avg_attendance_pct}%`, color: 'text-green-600 dark:text-green-400', sub: 'across all sessions' },
                    { label: 'Total Watch Time',  value: fmtSecs(Number(overview.progress.total_watch_seconds) || 0), color: 'text-blue-600 dark:text-blue-400', sub: `${overview.progress.completions} completions` },
                  ].map(m => (
                    <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-sm font-medium text-cortex-text mt-1">{m.label}</div>
                      <div className="text-xs text-cortex-muted mt-0.5">{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* KPI grid — row 2 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Online Sessions',    value: overview.sessions.online_sessions,    color: 'text-blue-500' },
                    { label: 'In-Person Sessions', value: overview.sessions.inperson_sessions,  color: 'text-cortex-accent' },
                    { label: 'Completed Sessions', value: overview.sessions.completed_sessions, color: 'text-green-600' },
                    { label: 'Total Lessons',      value: overview.content.total_lessons,       color: 'text-cortex-text' },
                  ].map(m => (
                    <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4">
                      <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sessions per month */}
                  {overview.sessionsByMonth && overview.sessionsByMonth.length > 0 && (
                    <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <h3 className="font-semibold text-cortex-text mb-4 text-sm">Sessions per Month (last 12 months)</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={overview.sessionsByMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#6366f1' }} />
                          <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Session mode pie */}
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Session Mode Distribution</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Online',    value: Number(overview.sessions.online_sessions)   || 0 },
                            { name: 'In-Person', value: Number(overview.sessions.inperson_sessions) || 0 },
                          ]}
                          cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                          dataKey="value" nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          <Cell fill="#6366f1" />
                          <Cell fill="#06b6d4" />
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trainer leaderboard */}
                {overview.trainerLeaderboard && overview.trainerLeaderboard.length > 0 && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Top Trainers by Sessions</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={overview.trainerLeaderboard} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="trainer_name" tick={{ fontSize: 11, fill: '#cbd5e1' }} tickLine={false} axisLine={false} width={110} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                        <Bar dataKey="session_count" name="Sessions" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="avg_attendance_pct" name="Avg Attendance %" fill="#10b981" radius={[0, 4, 4, 0]} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* User activity + completion summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4">User Activity Breakdown</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Active Users',       value: overview.users.active_users },
                        { label: 'Lesson Completions', value: overview.progress.completions },
                        { label: 'Progress Records',   value: overview.progress.progress_records },
                      ].map(m => (
                        <div key={m.label} className="text-center bg-cortex-bg border border-cortex-border rounded-xl p-4">
                          <div className="text-2xl font-bold text-cortex-text">{m.value}</div>
                          <div className="text-xs text-cortex-muted mt-1">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {overview.completionByLearnerType && overview.completionByLearnerType.length > 0 && (
                    <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <h3 className="font-semibold text-cortex-text mb-4 text-sm">Completion by Learner Type</h3>
                      <div className="space-y-2">
                        {overview.completionByLearnerType.map(lt => (
                          <div key={lt.learner_type_id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-cortex-text truncate">{lt.learner_type_name}</span>
                              <span className="text-cortex-muted flex-shrink-0 ml-2">{lt.completed}/{lt.total_assigned} ({lt.completion_pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-cortex-accent"
                                style={{ width: `${lt.completion_pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {/* Export CSV */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const flat = sessions.map(s => ({
                    id:             s.id,
                    title:          s.title,
                    scheduled_date: s.scheduled_date,
                    start_time:     s.start_time,
                    end_time:       s.end_time,
                    location:       s.location,
                    facility:       s.facility,
                    session_mode:   s.session_mode,
                    status:         s.status,
                    trainer:        s.trainer_name,
                    enrolled:       s.enrolled,
                    present:        s.present,
                    absent:         s.absent,
                    not_marked:     s.not_marked,
                    attendance_pct: s.attendance_pct,
                  }));
                  downloadCSV(flat, `sessions-${new Date().toISOString().slice(0, 10)}.csv`);
                }}
                disabled={sessions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-cortex-border text-cortex-muted hover:text-cortex-text hover:border-cortex-accent rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            </div>

            {sessionsLoading && <div className="text-center text-cortex-muted py-12">Loading sessions...</div>}
            {!sessionsLoading && sessions.length === 0 && (
              <div className="text-center text-cortex-muted py-12">No sessions found for the selected filters.</div>
            )}

            {sessions.map(s => {
              const isSelected    = selectedSession?.id === s.id;
              const attendeesOpen = expandedAttendees === s.id;
              const attendees     = Array.isArray(s.attendees) ? s.attendees : [];
              return (
                <div key={s.id} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                  {/* Session header row */}
                  <button
                    onClick={() => setSelectedSession(isSelected ? null : s)}
                    className="w-full text-left px-5 py-4 hover:bg-cortex-bg/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-cortex-text">{s.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.session_mode === 'online'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-cortex-border text-cortex-muted'
                          }`}>
                            {s.session_mode === 'online' ? 'Online' : 'In Person'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.status === 'completed' ? 'bg-green-100 text-green-700' :
                            s.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-cortex-accent/15 text-cortex-accent'
                          }`}>{s.status}</span>
                        </div>
                        <div className="text-xs text-cortex-muted flex flex-wrap gap-x-2">
                          <span>{new Date(s.scheduled_date + 'T00:00:00').toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</span>
                          {s.trainer_name && <span>Trainer: {s.trainer_name}</span>}
                          {s.location    && <span>Location: {s.location}</span>}
                          {s.facility    && <span>Facility: {s.facility}</span>}
                        </div>
                      </div>

                      {/* Attendance mini-stats */}
                      <div className="flex items-center gap-5 flex-shrink-0">
                        <div className="text-center">
                          <div className="text-lg font-bold text-cortex-text">{s.enrolled}</div>
                          <div className="text-[10px] text-cortex-muted">Enrolled</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{s.present}</div>
                          <div className="text-[10px] text-cortex-muted">Present</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-500">{s.absent}</div>
                          <div className="text-[10px] text-cortex-muted">Absent</div>
                        </div>
                        <div className="text-center min-w-[52px]">
                          <div className="relative w-12 h-12 mx-auto">
                            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-cortex-border" />
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
                                strokeDasharray={`${s.attendance_pct} ${100 - s.attendance_pct}`}
                                strokeLinecap="round"
                                className={s.attendance_pct >= 75 ? 'text-green-500' : s.attendance_pct >= 50 ? 'text-yellow-500' : 'text-red-500'} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-bold text-cortex-text">{s.attendance_pct}%</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-cortex-muted mt-0.5">Attendance</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-cortex-muted transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="border-t border-cortex-border bg-cortex-bg/30 px-5 py-4 space-y-4">
                      {/* Stat cards */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: 'Enrolled',     value: s.enrolled,     color: 'text-cortex-text' },
                          { label: 'Present',      value: s.present,      color: 'text-green-600' },
                          { label: 'Absent',       value: s.absent,       color: 'text-red-500' },
                          { label: 'Not Marked',   value: s.not_marked,   color: 'text-yellow-600' },
                          { label: 'Acknowledged', value: s.acknowledged, color: 'text-cortex-accent' },
                        ].map(m => (
                          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-3 text-center">
                            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                            <div className="text-[10px] text-cortex-muted">{m.label}</div>
                          </div>
                        ))}
                      </div>

                      {s.description && (
                        <div className="text-sm text-cortex-muted bg-cortex-surface border border-cortex-border rounded-xl p-3">
                          <span className="font-medium text-cortex-text text-xs block mb-1">Description</span>
                          {s.description}
                        </div>
                      )}
                      {s.enrolled > 0 && (
                        <div className="text-sm text-cortex-muted">
                          <span className="text-cortex-text font-medium">Absentee rate: </span>
                          {Math.round(s.absent / s.enrolled * 100)}%
                          {s.not_marked > 0 && <> · <span className="text-yellow-600">{s.not_marked} not yet marked</span></>}
                        </div>
                      )}

                      {/* Attendees toggle */}
                      {attendees.length > 0 && (
                        <div>
                          <button
                            onClick={() => setExpandedAttendees(attendeesOpen ? null : s.id)}
                            className="flex items-center gap-2 text-sm font-medium text-cortex-text hover:text-cortex-accent transition mb-2"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${attendeesOpen ? 'rotate-180' : ''}`}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            {attendeesOpen ? 'Hide' : 'Show'} Attendees ({attendees.length})
                          </button>

                          {attendeesOpen && (
                            <div className="overflow-x-auto rounded-xl border border-cortex-border">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-cortex-bg border-b border-cortex-border text-cortex-muted">
                                    <th className="text-left px-3 py-2 font-medium">Name</th>
                                    <th className="text-left px-3 py-2 font-medium">Organization</th>
                                    <th className="text-left px-3 py-2 font-medium">Department</th>
                                    <th className="text-left px-3 py-2 font-medium">Sub-Dept</th>
                                    <th className="text-left px-3 py-2 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendees.map((a, i) => (
                                    <tr key={i} className={`border-b border-cortex-border last:border-0 ${i % 2 === 0 ? 'bg-cortex-surface' : 'bg-cortex-bg/40'}`}>
                                      <td className="px-3 py-2 text-cortex-text font-medium">{a.display_name || '—'}</td>
                                      <td className="px-3 py-2 text-cortex-muted">{a.company_name || '—'}</td>
                                      <td className="px-3 py-2 text-cortex-muted">{a.dept_name || '—'}</td>
                                      <td className="px-3 py-2 text-cortex-muted">{a.sub_dept_name || '—'}</td>
                                      <td className="px-3 py-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                          a.attendance_status === 'present'  ? 'bg-green-100 text-green-700' :
                                          a.attendance_status === 'absent'   ? 'bg-red-100 text-red-600' :
                                          'bg-cortex-border text-cortex-muted'
                                        }`}>
                                          {a.attendance_status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── COMPLETION TAB ────────────────────────────────────────────────── */}
        {activeTab === 'completion' && (
          <div className="space-y-6">
            {completionLoading && <div className="text-center text-cortex-muted py-12">Loading completion data...</div>}
            {completion && (
              <>
                {/* Completion % per course — horizontal bar */}
                {completion.byCourse && completion.byCourse.length > 0 && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Completion Rate by Course</h3>
                    <ResponsiveContainer width="100%" height={Math.max(completion.byCourse.length * 36 + 30, 200)}>
                      <BarChart
                        data={completion.byCourse}
                        layout="vertical"
                        margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                      >
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                          tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="course_title" tick={{ fontSize: 11, fill: '#cbd5e1' }}
                          tickLine={false} axisLine={false} width={140} />
                        <Tooltip
                          formatter={(v, n, p) => [`${v}% (${p.payload.completions}/${p.payload.total_lessons} lessons)`, 'Completion']}
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                        />
                        <Bar dataKey="completion_pct" name="Completion %" radius={[0, 4, 4, 0]}>
                          {completion.byCourse.map((entry, index) => (
                            <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Completion % per learner type */}
                {completion.byLearnerType && completion.byLearnerType.length > 0 && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Completion Rate by Learner Type</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={completion.byLearnerType}
                        margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="learner_type_name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`}
                          tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(v, n, p) => [`${v}% (${p.payload.completed}/${p.payload.total_assigned})`, 'Completion']}
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                        />
                        <Bar dataKey="completion_pct" name="Completion %" radius={[4, 4, 0, 0]}>
                          {completion.byLearnerType.map((entry, index) => (
                            <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Avg watch time per course */}
                {completion.avgWatchTimeByCourse && completion.avgWatchTimeByCourse.length > 0 && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Avg Watch Time per Course</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={completion.avgWatchTimeByCourse}
                        margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="course_title" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => fmtSecs(v)}
                          tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={v => [fmtSecs(v), 'Avg Watch Time']}
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                        />
                        <Bar dataKey="avg_watch_seconds" name="Avg Watch Time" radius={[4, 4, 0, 0]}>
                          {completion.avgWatchTimeByCourse.map((entry, index) => (
                            <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Summary table */}
                {completion.byCourse && completion.byCourse.length > 0 && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-4 text-sm">Course Completion Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-cortex-border text-cortex-muted">
                            <th className="text-left pb-2 font-medium">Course</th>
                            <th className="text-right pb-2 font-medium">Lessons</th>
                            <th className="text-right pb-2 font-medium">Completions</th>
                            <th className="text-right pb-2 font-medium">Rate</th>
                            <th className="pb-2 w-32"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {completion.byCourse.map(c => (
                            <tr key={c.course_id} className="border-b border-cortex-border last:border-0">
                              <td className="py-2 text-cortex-text font-medium pr-4">{c.course_title}</td>
                              <td className="py-2 text-cortex-muted text-right pr-4">{c.total_lessons}</td>
                              <td className="py-2 text-cortex-muted text-right pr-4">{c.completions}</td>
                              <td className="py-2 text-right pr-4">
                                <span className={`font-semibold ${c.completion_pct >= 70 ? 'text-green-500' : c.completion_pct >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  {c.completion_pct}%
                                </span>
                              </td>
                              <td className="py-2">
                                <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-cortex-accent transition-all"
                                    style={{ width: `${c.completion_pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!completion.byCourse || completion.byCourse.length === 0) &&
                 (!completion.byLearnerType || completion.byLearnerType.length === 0) && (
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                    No completion data found for the selected filters.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── LEARNERS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'learners' && (
          <div className="flex gap-5">
            {/* Learner list */}
            <div className="w-52 flex-shrink-0">
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-2 sticky top-0">
                <div className="text-[10px] text-cortex-muted px-2 mb-2 font-semibold uppercase tracking-wider">Learners ({learners.length})</div>
                <div className="max-h-[70vh] overflow-y-auto space-y-0.5">
                  {learners.map(l => (
                    <button key={l.id} onClick={() => loadUser(l)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedUser?.id === l.id ? 'bg-cortex-accent text-white' : 'text-cortex-text hover:bg-cortex-bg'}`}>
                      <div className="truncate font-medium">{l.display_name || l.email}</div>
                      <div className="text-[11px] opacity-60 truncate">{l.learner_type || 'No type'}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 space-y-4 min-w-0">
              {!selectedUser ? (
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                  Select a learner to view their activity
                </div>
              ) : !userDetail ? (
                <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                  Loading...
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h2 className="font-bold text-cortex-text mb-4">
                      {userDetail.user?.display_name || userDetail.user?.email} — Progress Summary
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[
                        { label: 'Lessons Completed', value: userDetail.progress.filter(p => p.completed).length,                                              color: 'text-green-600' },
                        { label: 'In Progress',       value: userDetail.progress.filter(p => !p.completed && p.percent_watched > 0).length,                    color: 'text-yellow-600' },
                        { label: 'Total Watch Time',  value: fmtSecs(userDetail.progress.reduce((a, p) => a + (p.total_watch_seconds || 0), 0)),               color: 'text-cortex-accent' },
                        { label: 'Learning Sessions', value: userDetail.sessions.length,                                                                        color: 'text-cortex-text' },
                      ].map(m => (
                        <div key={m.label} className="bg-cortex-bg border border-cortex-border rounded-xl p-3 text-center">
                          <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                          <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Per-lesson bars */}
                    <div className="space-y-2.5">
                      {userDetail.progress.map(p => (
                        <div key={p.lesson_id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-cortex-text truncate mr-2">{p.lesson_title}</span>
                            <span className="text-cortex-muted flex-shrink-0 flex items-center gap-2">
                              {fmtSecs(p.total_watch_seconds || 0)} watched · {p.watch_count}x · {p.percent_watched}%
                              {p.completed && <span className="text-green-500 font-bold">✓</span>}
                            </span>
                          </div>
                          <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                              style={{ width: `${p.percent_watched}%` }} />
                          </div>
                        </div>
                      ))}
                      {userDetail.progress.length === 0 && (
                        <div className="text-cortex-muted text-sm">No lesson activity yet</div>
                      )}
                    </div>
                  </div>

                  {/* Learning sessions */}
                  <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                    <h3 className="font-semibold text-cortex-text mb-3">Learning Sessions ({userDetail.sessions.length})</h3>
                    <div className="space-y-1.5">
                      {userDetail.sessions.map(s => (
                        <button key={s.id} onClick={() => loadTimeline(s)}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition ${selectedLS?.id === s.id ? 'bg-cortex-accent text-white' : 'bg-cortex-bg text-cortex-text hover:bg-cortex-border'}`}>
                          <div className="flex justify-between items-center">
                            <span>{new Date(s.session_started_at).toLocaleString('en-AE')}</span>
                            <span className="text-xs opacity-70">{fmtSecs(s.total_active_seconds || 0)} active</span>
                          </div>
                        </button>
                      ))}
                      {!userDetail.sessions.length && <div className="text-cortex-muted text-sm">No sessions yet</div>}
                    </div>
                  </div>

                  {/* Timeline replay */}
                  {timeline && (
                    <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-cortex-text">Session Timeline Replay</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-cortex-muted text-sm">{playhead + 1} / {timeline.events.length}</span>
                          <button onClick={() => { setPlayhead(0); setPlaying(false); }}
                            className="border border-cortex-border px-2.5 py-1 rounded-lg text-xs text-cortex-text hover:bg-cortex-bg transition">
                            Reset
                          </button>
                          <button onClick={() => setPlaying(p => !p)}
                            className="bg-cortex-accent text-white px-2.5 py-1 rounded-lg text-xs hover:opacity-90 transition">
                            {playing ? 'Pause' : 'Play'}
                          </button>
                        </div>
                      </div>

                      <input type="range" min={0} max={timeline.events.length - 1} value={playhead}
                        onChange={e => setPlayhead(Number(e.target.value))}
                        className="w-full mb-4 accent-cortex-accent" />

                      {timeline.events[playhead] && (() => {
                        const ev   = timeline.events[playhead];
                        const meta = EVENT_LABELS[ev.event_type] || { icon: '•', label: ev.event_type };
                        return (
                          <div className="bg-cortex-bg rounded-xl p-3 mb-4 border border-cortex-border">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{meta.icon}</span>
                              <span className="text-cortex-text font-semibold text-sm">{meta.label}</span>
                              <span className="text-cortex-muted text-xs ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                            </div>
                            {Object.keys(ev.event_payload || {}).length > 0 && (
                              <pre className="text-xs text-cortex-muted mt-2 overflow-x-auto bg-cortex-surface rounded p-2">
                                {JSON.stringify(ev.event_payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-0.5 max-h-52 overflow-y-auto">
                        {timeline.events.slice(0, playhead + 1).map((ev, i) => {
                          const meta = EVENT_LABELS[ev.event_type] || { icon: '•' };
                          return (
                            <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded-lg ${i === playhead ? 'bg-cortex-accent/20 text-cortex-text font-semibold' : 'text-cortex-muted'}`}>
                              <span>{meta.icon}</span>
                              <span>{ev.event_type}</span>
                              <span className="ml-auto opacity-60">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── FEEDBACK TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {/* Sub-tabs: session vs course */}
            <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 w-fit">
              {[['session', 'Sessions'], ['course', 'Courses']].map(([v, l]) => (
                <button key={v} onClick={() => { setFeedbackType(v); loadFeedback(v); }}
                  className={`px-4 py-1.5 rounded-lg text-sm transition ${feedbackType === v ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Rating chart */}
            {!feedbackLoading && feedback.length > 0 && (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
                <h3 className="font-semibold text-cortex-text mb-4 text-sm">Avg Ratings by {feedbackType === 'session' ? 'Session' : 'Course'}</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={feedback.slice(0, 15).map(fb => ({
                      name:       feedbackType === 'session' ? fb.session_title : fb.course_title,
                      avg_rating: Number(fb.avg_rating) || 0,
                      responses:  fb.response_count,
                    }))}
                    margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                      interval={0} angle={-25} textAnchor="end" height={48} />
                    <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v, n, p) => [`${v} / 5 (${p.payload.responses} responses)`, 'Avg Rating']}
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                      cursor={{ fill: 'rgba(245,158,11,0.08)' }}
                    />
                    <Bar dataKey="avg_rating" name="Avg Rating" radius={[4, 4, 0, 0]}>
                      {feedback.slice(0, 15).map((entry, index) => (
                        <Cell key={index} fill={Number(entry.avg_rating) < 3 ? '#ef4444' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {feedbackLoading && <div className="text-center text-cortex-muted py-12">Loading feedback...</div>}
            {!feedbackLoading && feedback.length === 0 && (
              <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
                <div className="text-4xl mb-3">⭐</div>
                <div className="text-sm">No feedback collected yet for {feedbackType === 'session' ? 'training sessions' : 'courses'}.</div>
              </div>
            )}

            {feedback.map(fb => {
              const key      = feedbackType === 'session' ? fb.session_id : fb.course_id;
              const title    = feedbackType === 'session' ? fb.session_title : fb.course_title;
              const isExpanded = expandedFb === key;
              const avg      = Number(fb.avg_rating) || 0;
              const total    = fb.response_count;
              const isLowRated = avg < 3 && total > 0;

              return (
                <div key={key} className={`bg-cortex-surface border rounded-xl overflow-hidden transition ${isLowRated ? 'border-red-500/60' : 'border-cortex-border'}`}>
                  <button
                    onClick={() => setExpandedFb(isExpanded ? null : key)}
                    className="w-full text-left px-5 py-4 hover:bg-cortex-bg/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-cortex-text truncate">{title}</span>
                          {isLowRated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex-shrink-0">Low Rating</span>
                          )}
                        </div>
                        {feedbackType === 'session' && fb.scheduled_date && (
                          <div className="text-xs text-cortex-muted mt-0.5">
                            {new Date(fb.scheduled_date + 'T00:00:00').toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        {/* Star display */}
                        <div className="flex flex-col items-center">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={avg >= star ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            ))}
                          </div>
                          <div className="text-xs text-amber-500 font-semibold mt-0.5">{avg.toFixed(1)} / 5</div>
                        </div>

                        {/* Response count */}
                        <div className="text-center">
                          <div className="text-lg font-bold text-cortex-text">{total}</div>
                          <div className="text-[10px] text-cortex-muted">responses</div>
                        </div>

                        {/* Rating distribution mini bars */}
                        <div className="flex flex-col gap-0.5 w-24">
                          {[5, 4, 3, 2, 1].map(star => {
                            const count = fb[`${['', 'one', 'two', 'three', 'four', 'five'][star]}_star`] || 0;
                            const pct   = total > 0 ? Math.round(count / total * 100) : 0;
                            return (
                              <div key={star} className="flex items-center gap-1">
                                <span className="text-[10px] text-cortex-muted w-2">{star}</span>
                                <div className="flex-1 h-1.5 bg-cortex-border rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-cortex-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded: comments list */}
                  {isExpanded && fb.comments && fb.comments.length > 0 && (
                    <div className="border-t border-cortex-border bg-cortex-bg/30 px-5 py-4">
                      <div className="text-xs font-semibold text-cortex-muted mb-3 uppercase tracking-wider">Written Comments</div>
                      <div className="space-y-3">
                        {fb.comments.map((c, i) => (
                          <div key={i} className="bg-cortex-surface border border-cortex-border rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-cortex-accent/20 text-cortex-accent text-xs flex items-center justify-center font-bold">
                                  {(c.user || '?')[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-cortex-text">{c.user || 'Anonymous'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <svg key={star} width="12" height="12" viewBox="0 0 24 24" fill={c.rating >= star ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                  ))}
                                </div>
                                <span className="text-[10px] text-cortex-muted">
                                  {new Date(c.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-cortex-text">{c.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && (!fb.comments || fb.comments.length === 0) && (
                    <div className="border-t border-cortex-border px-5 py-4 text-sm text-cortex-muted">
                      No written comments — ratings only.
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
