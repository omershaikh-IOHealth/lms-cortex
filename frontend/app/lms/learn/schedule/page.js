// frontend/app/lms/learn/schedule/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const STATUS_STYLES = {
  scheduled:  { dot: 'bg-blue-500',   label: 'Upcoming',   pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ongoing:    { dot: 'bg-yellow-500', label: 'Happening Now', pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed:  { dot: 'bg-gray-400',   label: 'Completed',  pill: 'bg-cortex-border text-cortex-muted' },
  cancelled:  { dot: 'bg-red-400',    label: 'Cancelled',  pill: 'bg-red-100 text-red-500' },
};

const ATTEND_LABEL = {
  enrolled: '—',
  present:  '✓ Present',
  absent:   '✗ Absent',
};

const fmtDate  = (d) => new Date(d).toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const isUpcoming = (s) => new Date(s.scheduled_date) >= new Date(new Date().toDateString());

export default function SchedulePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [acking, setAcking]     = useState({});
  const [filter, setFilter]     = useState('upcoming'); // 'upcoming' | 'past' | 'all'

  const load = () =>
    apiFetch('/api/lms/me/schedule').then(r => r?.json()).then(d => { if (d) setSessions(d); }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const acknowledge = async (sessionId) => {
    setAcking(p => ({ ...p, [sessionId]: true }));
    await apiFetch(`/api/lms/me/schedule/${sessionId}/acknowledge`, { method: 'PATCH', body: JSON.stringify({}) });
    await load();
    setAcking(p => ({ ...p, [sessionId]: false }));
  };

  const filtered = sessions.filter(s => {
    if (filter === 'upcoming') return s.session_status !== 'cancelled' && isUpcoming(s);
    if (filter === 'past')     return s.session_status === 'completed' || !isUpcoming(s);
    return true;
  });

  const upcomingCount  = sessions.filter(s => s.session_status !== 'cancelled' && isUpcoming(s)).length;
  const unacknowledged = sessions.filter(s => !s.acknowledged_at && s.session_status === 'scheduled').length;

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading schedule…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cortex-text">My Training Schedule</h1>
        <p className="text-cortex-muted text-sm mt-1">Physical training sessions assigned to you by the training team.</p>
      </div>

      {/* Alert for unacknowledged */}
      {unacknowledged > 0 && (
        <div className="bg-cortex-accent/10 border border-cortex-accent/30 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <div className="text-sm font-semibold text-cortex-text">
              {unacknowledged} new session{unacknowledged > 1 ? 's' : ''} need your acknowledgement
            </div>
            <div className="text-xs text-cortex-muted">Please confirm you've seen the schedule below.</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Upcoming',  value: upcomingCount, color: 'text-cortex-accent' },
          { label: 'Attended',  value: sessions.filter(s => s.attendance_status === 'present').length, color: 'text-green-600' },
          { label: 'Missed',    value: sessions.filter(s => s.attendance_status === 'absent').length, color: 'text-red-500' },
        ].map(m => (
          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 mb-5 w-fit">
        {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-lg text-sm transition ${filter === v ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
          <div className="text-4xl mb-3">📅</div>
          <div className="text-sm">No sessions in this view</div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(s => {
            const st     = STATUS_STYLES[s.session_status] || STATUS_STYLES.scheduled;
            const isNew  = !s.acknowledged_at && s.session_status === 'scheduled';
            return (
              <div key={s.session_id}
                className={`bg-cortex-surface border rounded-2xl p-5 transition ${isNew ? 'border-cortex-accent ring-1 ring-cortex-accent/30' : 'border-cortex-border'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.pill}`}>{st.label}</span>
                      {s.attendance_status !== 'enrolled' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.attendance_status === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-500'}`}>
                          {ATTEND_LABEL[s.attendance_status]}
                        </span>
                      )}
                    </div>
                    <h3 className="text-cortex-text font-semibold text-base">{s.title}</h3>
                  </div>
                  {isNew && (
                    <button
                      onClick={() => acknowledge(s.session_id)}
                      disabled={acking[s.session_id]}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 disabled:opacity-50 transition font-medium">
                      {acking[s.session_id] ? '…' : '✓ Acknowledge'}
                    </button>
                  )}
                  {s.acknowledged_at && (
                    <span className="flex-shrink-0 text-xs text-cortex-accent">✓ Acknowledged</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2 text-cortex-muted">
                    <span>📅</span>
                    <span>{fmtDate(s.scheduled_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-cortex-muted">
                    <span>⏰</span>
                    <span>{s.start_time} – {s.end_time}</span>
                  </div>
                  {s.location && (
                    <div className="flex items-center gap-2 text-cortex-muted col-span-2">
                      <span>📍</span>
                      <span>{s.location}</span>
                    </div>
                  )}
                  {s.trainer_name && (
                    <div className="flex items-center gap-2 text-cortex-muted">
                      <span>👤</span>
                      <span>Trainer: {s.trainer_name}</span>
                    </div>
                  )}
                </div>

                {s.description && (
                  <div className="mt-3 pt-3 border-t border-cortex-border text-sm text-cortex-muted">
                    {s.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}