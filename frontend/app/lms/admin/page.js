// frontend/app/lms/admin/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

export default function LMSAdminPage() {
  const [learners, setLearners]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    apiFetch('/api/lms/admin/progress/users')
      .then(r => r?.json())
      .then(data => { if (data) setLearners(data); })
      .finally(() => setLoading(false));
  }, []);

  const totalCompleted  = learners.reduce((a, l) => a + (l.completed_lessons || 0), 0);
  const totalWatchHours = Math.round(learners.reduce((a, l) => a + (l.total_watch_seconds || 0), 0) / 3600 * 10) / 10;
  const activeThisWeek  = learners.filter(l => {
    const d = new Date(l.last_active);
    return !isNaN(d) && (Date.now() - d) < 7 * 24 * 3600 * 1000;
  }).length;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-cortex-text mb-6">LMS Overview</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Learners',    value: learners.length, color: 'text-cortex-accent',  border: 'border-l-cortex-accent' },
          { label: 'Lessons Completed', value: totalCompleted,  color: 'text-green-500',       border: 'border-l-green-500' },
          { label: 'Watch Hours',       value: totalWatchHours, color: 'text-purple-500',      border: 'border-l-purple-500' },
          { label: 'Active This Week',  value: activeThisWeek,  color: 'text-cortex-warning',  border: 'border-l-cortex-warning' },
        ].map(m => (
          <div key={m.label} className={`bg-cortex-surface border border-cortex-border border-l-4 ${m.border} rounded-xl p-5`}>
            <div className="text-cortex-muted text-xs font-medium mb-1">{m.label}</div>
            <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Learner progress table */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cortex-border flex items-center justify-between">
          <h2 className="font-semibold text-cortex-text text-sm">Learner Progress</h2>
          <Link href="/lms/admin/learners" className="text-xs text-cortex-accent hover:underline">View all →</Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-cortex-muted text-sm">Loading…</div>
        ) : learners.length === 0 ? (
          <div className="p-12 text-center text-cortex-muted text-sm">No learners yet. <Link href="/lms/admin/learners" className="text-cortex-accent hover:underline">Add one →</Link></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Learner</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium text-right">Watch Time</th>
                <th className="px-5 py-3 font-medium text-right">Last Active</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {learners.slice(0, 20).map(l => {
                const lastActive = l.last_active ? new Date(l.last_active) : null;
                const daysAgo    = lastActive ? Math.floor((Date.now() - lastActive) / 86400000) : null;
                return (
                  <tr key={l.id} className="hover:bg-cortex-bg transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(l.display_name || l.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-cortex-text">{l.display_name || l.email}</div>
                          <div className="text-xs text-cortex-muted">{l.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-cortex-muted text-xs">{l.learner_type || '—'}</td>
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
                    <td className="px-5 py-3 text-right text-cortex-muted text-xs">
                      {daysAgo === null ? '—' : daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/lms/admin/learners/${l.id}`}
                        className="text-xs text-cortex-accent hover:underline">Profile →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}