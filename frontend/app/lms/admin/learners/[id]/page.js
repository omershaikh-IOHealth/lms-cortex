// frontend/app/lms/admin/learners/[id]/page.js
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

const fmtSec = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDatetime = (d) => d ? new Date(d).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ATTEND_STYLES = {
  enrolled: 'bg-cortex-border/60 text-cortex-muted',
  present:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  absent:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function LearnerProfilePage() {
  const { id } = useParams();
  const router  = useRouter();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState('overview'); // overview | videos | physical | sessions

  useEffect(() => {
    apiFetch(`/api/lms/admin/progress/users/${id}`)
      .then(r => r?.json())
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading profile…
    </div>
  );
  if (!data) return <div className="p-8 text-red-500">Learner not found.</div>;

  const { user, progress, topLessons, sessions, totalAssigned, physicalTrainings } = data;

  const completedCount     = progress.filter(p => p.completed).length;
  const inProgressCount    = progress.filter(p => !p.completed && p.percent_watched > 0).length;
  const totalWatchSecs     = progress.reduce((a, p) => a + (p.total_watch_seconds || 0), 0);
  const physicalAttended   = physicalTrainings.filter(t => t.attendance_status === 'present').length;
  const physicalTotal      = physicalTrainings.length;
  const completionPct      = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'videos',    label: `Videos (${progress.length})` },
    { id: 'physical',  label: `Physical Training (${physicalTotal})` },
    { id: 'sessions',  label: `Sessions (${sessions.length})` },
  ];

  return (
    <div className="p-6 max-w-6xl">
      {/* Back */}
      <Link href="/lms/admin/learners"
        className="inline-flex items-center gap-1.5 text-sm text-cortex-muted hover:text-cortex-text mb-5 transition">
        ← Back to Learners
      </Link>

      {/* ── Profile header ──────────────────────────────────────────────────── */}
      <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-6 mb-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {(user.display_name || user.email)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-cortex-text">{user.display_name || user.email}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-500'}`}>
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="text-cortex-muted text-sm mt-0.5">{user.email}</div>
          <div className="flex gap-4 mt-2 text-sm text-cortex-muted">
            {user.learner_type && <span>🏷 {user.learner_type}</span>}
            <span>Joined {fmtDate(user.created_at)}</span>
          </div>
        </div>
        <Link href={`/lms/admin/analytics?user=${id}`}
          className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-text hover:bg-cortex-bg transition flex-shrink-0">
          View Analytics →
        </Link>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Curriculum Progress', value: `${completionPct}%`, sub: `${completedCount} / ${totalAssigned} lessons`, color: 'text-cortex-accent' },
          { label: 'Watch Time',          value: fmtSec(totalWatchSecs), sub: `${completedCount} completed`, color: 'text-green-600' },
          { label: 'In Progress',         value: inProgressCount, sub: 'lessons started', color: 'text-yellow-500' },
          { label: 'Physical Training',   value: `${physicalAttended}/${physicalTotal}`, sub: 'sessions attended', color: 'text-cortex-text' },
        ].map(m => (
          <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-cortex-muted text-xs mt-0.5">{m.sub}</div>
            <div className="text-cortex-muted text-xs font-medium mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-cortex-text font-medium">Curriculum Completion</span>
          <span className="text-cortex-muted">{completionPct}%</span>
        </div>
        <div className="h-2.5 bg-cortex-bg rounded-full overflow-hidden">
          <div className="h-full bg-cortex-accent rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-cortex-muted">
          <span className="text-green-600">■ {completedCount} Completed</span>
          <span className="text-yellow-500">■ {inProgressCount} In Progress</span>
          <span>■ {totalAssigned - completedCount - inProgressCount} Not Started</span>
        </div>
      </div>

      {/* Top 3 Lessons */}
      {topLessons.length > 0 && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-cortex-text text-sm mb-3">🏆 Top 3 Most Watched Lessons</h3>
          <div className="space-y-3">
            {topLessons.map((l, i) => (
              <div key={l.lesson_id} className="flex items-center gap-3">
                <span className="text-cortex-muted text-sm font-bold w-5 flex-shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-cortex-text font-medium truncate">{l.lesson_title}</div>
                  <div className="text-xs text-cortex-muted">{l.section_title} · {l.course_title}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-cortex-text">{l.watch_count}×</div>
                  <div className="text-xs text-cortex-muted">{fmtSec(l.total_watch_seconds || 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === t.id ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Video Watch History ──────────────────────────────────────────── */}
      {tab === 'videos' && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Lesson</th>
                <th className="px-5 py-3 font-medium">Course</th>
                <th className="px-5 py-3 font-medium text-right">Watch Count</th>
                <th className="px-5 py-3 font-medium text-right">% Watched</th>
                <th className="px-5 py-3 font-medium text-right">Watch Time</th>
                <th className="px-5 py-3 font-medium text-right">Status</th>
                <th className="px-5 py-3 font-medium text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {progress.map(p => (
                <tr key={p.lesson_id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3 text-cortex-text font-medium max-w-xs">
                    <div className="truncate">{p.lesson_title}</div>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">
                    <div className="truncate">{p.course_title}</div>
                    <div className="truncate">{p.section_title}</div>
                  </td>
                  <td className="px-5 py-3 text-cortex-text text-right font-semibold">{p.watch_count || 0}×</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                          style={{ width: `${p.percent_watched}%` }} />
                      </div>
                      <span className="text-cortex-muted text-xs">{p.percent_watched}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-right text-xs">{fmtSec(p.total_watch_seconds || 0)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-cortex-border text-cortex-muted'}`}>
                      {p.completed ? 'Complete' : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-right text-xs">{fmtDatetime(p.last_activity_at)}</td>
                </tr>
              ))}
              {progress.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-cortex-muted">No video activity yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Physical Training ────────────────────────────────────────────── */}
      {tab === 'physical' && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          {physicalTrainings.length === 0 ? (
            <div className="p-12 text-center text-cortex-muted">No physical training sessions assigned</div>
          ) : (
            <div className="divide-y divide-cortex-border">
              {physicalTrainings.map(t => (
                <div key={t.session_id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-12 h-12 rounded-xl bg-cortex-bg border border-cortex-border flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-cortex-muted uppercase leading-none">
                      {new Date(t.scheduled_date).toLocaleDateString('en-AE', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-cortex-text leading-tight">
                      {new Date(t.scheduled_date).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-cortex-text">{t.title}</div>
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {t.start_time} – {t.end_time}
                      {t.location && <> · 📍 {t.location}</>}
                      {t.trainer_name && <> · 👤 {t.trainer_name}</>}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-cortex-muted">
                      {t.acknowledged_at && <span className="text-cortex-accent">✓ Acknowledged {fmtDate(t.acknowledged_at)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${ATTEND_STYLES[t.attendance_status]}`}>
                    {t.attendance_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Sessions (event log) ─────────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Lesson</th>
                <th className="px-5 py-3 font-medium">Started</th>
                <th className="px-5 py-3 font-medium text-right">Active Time</th>
                <th className="px-5 py-3 font-medium text-right">Duration</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3 text-cortex-text">{s.lesson_title}</td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{fmtDatetime(s.session_started_at)}</td>
                  <td className="px-5 py-3 text-right text-cortex-muted text-xs">{fmtSec(s.total_active_seconds || 0)}</td>
                  <td className="px-5 py-3 text-right text-cortex-muted text-xs">
                    {s.session_ended_at ? fmtSec(Math.round((new Date(s.session_ended_at) - new Date(s.session_started_at)) / 1000)) : 'Active'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/lms/admin/analytics?user=${id}&session=${s.id}`}
                      className="text-xs text-cortex-accent hover:underline">
                      Timeline →
                    </Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">No sessions recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Overview (summary table already in header + cards) ──────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
            <h3 className="font-semibold text-cortex-text text-sm mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {progress.slice(0, 8).map(p => (
                <div key={p.lesson_id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-cortex-text truncate">{p.lesson_title}</div>
                    <div className="text-xs text-cortex-muted">{p.course_title}</div>
                  </div>
                  <div className="w-24">
                    <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-cortex-accent'}`}
                        style={{ width: `${p.percent_watched}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-cortex-muted w-8 text-right">{p.percent_watched}%</span>
                </div>
              ))}
              {progress.length === 0 && <div className="text-cortex-muted text-sm">No activity yet</div>}
            </div>
          </div>

          {physicalTrainings.filter(t => new Date(t.scheduled_date) >= new Date()).length > 0 && (
            <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5">
              <h3 className="font-semibold text-cortex-text text-sm mb-3">Upcoming Physical Trainings</h3>
              {physicalTrainings.filter(t => new Date(t.scheduled_date) >= new Date()).slice(0, 3).map(t => (
                <div key={t.session_id} className="flex items-center gap-3 py-2">
                  <span className="text-xl">📅</span>
                  <div>
                    <div className="text-sm text-cortex-text font-medium">{t.title}</div>
                    <div className="text-xs text-cortex-muted">{fmtDate(t.scheduled_date)} · {t.start_time}{t.location && ` · ${t.location}`}</div>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${ATTEND_STYLES[t.attendance_status]}`}>
                    {t.attendance_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}