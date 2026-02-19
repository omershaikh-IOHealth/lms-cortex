// frontend/app/lms/trainer/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—';
const fmtTime = (t) => t ? t.slice(0,5) : '—';

const STATUS_STYLES = {
  scheduled:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled:  'bg-red-100 text-red-500',
};

export default function TrainerDashboard() {
  const [sessions,     setSessions]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [enrollments,  setEnrollments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState({});
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const loadSessions = async () => {
    try {
      const r = await apiFetch('/api/trainer/sessions');
      const d = await r.json();
      if (r.ok) setSessions(d);
    } finally { setLoading(false); }
  };

  const loadEnrollments = async (sessionId) => {
    const r = await apiFetch(`/api/trainer/sessions/${sessionId}/enrollments`);
    const d = await r.json();
    if (r.ok) setEnrollments(d);
  };

  useEffect(() => { loadSessions(); }, []);

  const selectSession = async (s) => {
    setSelected(s);
    setEnrollments([]);
    setError('');
    setSuccess('');
    await loadEnrollments(s.id);
  };

  const markAttendance = async (userId, status) => {
    setSaving(p => ({ ...p, [userId]: true }));
    setError(''); setSuccess('');
    try {
      const r = await apiFetch(`/api/trainer/sessions/${selected.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ attendances: [{ user_id: userId, status }] }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setEnrollments(prev => prev.map(e => e.user_id === userId ? { ...e, attendance_status: status } : e));
      setSuccess('Attendance updated');
      setTimeout(() => setSuccess(''), 2000);
      await loadSessions();
    } catch (e) { setError(e.message); }
    finally { setSaving(p => ({ ...p, [userId]: false })); }
  };

  const markAll = async (status) => {
    setError(''); setSuccess('');
    const attendances = enrollments.map(e => ({ user_id: e.user_id, status }));
    try {
      const r = await apiFetch(`/api/trainer/sessions/${selected.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ attendances }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setEnrollments(prev => prev.map(e => ({ ...e, attendance_status: status })));
      setSuccess(`All marked as ${status}`);
      setTimeout(() => setSuccess(''), 2000);
      await loadSessions();
    } catch (e) { setError(e.message); }
  };

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const past     = sessions.filter(s => s.status !== 'scheduled');

  return (
    <div className="flex h-full">

      {/* ── Sessions sidebar ─────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="p-4 border-b border-cortex-border">
          <h1 className="font-semibold text-cortex-text text-sm">My Sessions</h1>
          <p className="text-xs text-cortex-muted mt-0.5">Sessions assigned to you</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && <div className="text-cortex-muted text-sm text-center py-12">Loading…</div>}

          {!loading && sessions.length === 0 && (
            <div className="text-cortex-muted text-sm text-center py-12">
              <div className="text-4xl mb-2">📅</div>
              No sessions assigned yet
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-cortex-muted uppercase tracking-wider px-1 mb-2">Upcoming</div>
              <div className="space-y-2">
                {upcoming.map(s => (
                  <SessionCard key={s.id} s={s} selected={selected} onClick={() => selectSession(s)} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-cortex-muted uppercase tracking-wider px-1 mb-2">Past</div>
              <div className="space-y-2">
                {past.map(s => (
                  <SessionCard key={s.id} s={s} selected={selected} onClick={() => selectSession(s)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-cortex-bg">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-5xl mb-3">👈</div>
              <div className="text-sm">Select a session to manage attendance</div>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            {/* Session header */}
            <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-5 mb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-cortex-text">{selected.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selected.status] || ''}`}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="text-cortex-muted text-sm mt-1">
                    {fmt(selected.scheduled_date)} · {fmtTime(selected.start_time)} – {fmtTime(selected.end_time)}
                    {selected.location && <> · 📍 {selected.location}</>}
                  </div>
                  {selected.description && (
                    <div className="text-cortex-muted text-sm mt-2">{selected.description}</div>
                  )}
                </div>
                {/* Stats */}
                <div className="flex gap-4 flex-shrink-0 text-center">
                  <div>
                    <div className="text-xl font-bold text-cortex-text">{selected.enrolled_count}</div>
                    <div className="text-xs text-cortex-muted">Enrolled</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-500">{selected.present_count}</div>
                    <div className="text-xs text-cortex-muted">Present</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-red-500">{selected.absent_count}</div>
                    <div className="text-xs text-cortex-muted">Absent</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback */}
            {error   && <div className="mb-4 bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-2.5 text-sm">{error}</div>}
            {success && <div className="mb-4 bg-green-900/30 border border-green-800 text-green-400 rounded-lg px-4 py-2.5 text-sm">{success}</div>}

            {/* Attendance table */}
            <div className="bg-cortex-surface border border-cortex-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-cortex-border flex items-center justify-between">
                <h3 className="font-semibold text-cortex-text text-sm">
                  Attendance ({enrollments.length} enrolled)
                </h3>
                {enrollments.length > 0 && selected.status === 'scheduled' && (
                  <div className="flex gap-2">
                    <button onClick={() => markAll('present')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition font-medium">
                      Mark All Present
                    </button>
                    <button onClick={() => markAll('absent')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition font-medium">
                      Mark All Absent
                    </button>
                  </div>
                )}
              </div>

              {enrollments.length === 0 ? (
                <div className="px-5 py-12 text-center text-cortex-muted text-sm">No learners enrolled</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cortex-border bg-cortex-bg">
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-cortex-muted">Learner</th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-cortex-muted">Type</th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-cortex-muted">Status</th>
                      {selected.status === 'scheduled' && (
                        <th className="px-5 py-2.5 text-right text-xs font-medium text-cortex-muted">Mark</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cortex-border">
                    {enrollments.map(e => (
                      <tr key={e.user_id} className="hover:bg-cortex-bg transition">
                        <td className="px-5 py-3">
                          <div className="font-medium text-cortex-text">{e.display_name || e.email}</div>
                          <div className="text-xs text-cortex-muted">{e.email}</div>
                          {e.staff_id && <div className="text-xs text-cortex-muted">ID: {e.staff_id}</div>}
                        </td>
                        <td className="px-5 py-3 text-cortex-muted text-xs">{e.learner_type_name || '—'}</td>
                        <td className="px-5 py-3">
                          <AttendanceBadge status={e.attendance_status} />
                        </td>
                        {selected.status === 'scheduled' && (
                          <td className="px-5 py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => markAttendance(e.user_id, 'present')}
                                disabled={saving[e.user_id] || e.attendance_status === 'present'}
                                className="text-xs px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white transition">
                                Present
                              </button>
                              <button
                                onClick={() => markAttendance(e.user_id, 'absent')}
                                disabled={saving[e.user_id] || e.attendance_status === 'absent'}
                                className="text-xs px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white transition">
                                Absent
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ s, selected, onClick }) {
  const STATUS_DOT = {
    scheduled: 'bg-blue-500',
    completed: 'bg-green-500',
    cancelled: 'bg-red-500',
  };
  const isSelected = selected?.id === s.id;
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition ${
        isSelected
          ? 'border-cortex-accent bg-cortex-accent/10'
          : 'border-cortex-border hover:border-cortex-accent/40 hover:bg-cortex-bg'
      }`}>
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[s.status] || 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-cortex-text text-sm truncate">{s.title}</div>
          <div className="text-xs text-cortex-muted mt-0.5">
            {new Date(s.scheduled_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })} · {s.start_time?.slice(0,5)}
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-cortex-muted">
            <span>👥 {s.enrolled_count}</span>
            <span className="text-green-500">✓ {s.present_count}</span>
            <span className="text-red-400">✗ {s.absent_count}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function AttendanceBadge({ status }) {
  const styles = {
    enrolled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    present:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    absent:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[status] || styles.enrolled}`}>
      {status}
    </span>
  );
}