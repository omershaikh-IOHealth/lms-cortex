// frontend/app/lms/trainer/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, useAuth } from '@/lib/auth';

export default function TrainerDashboard() {
  const { user } = useAuth();
  const [learners, setLearners] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/lms/admin/progress/users').then(r => r?.json()),
      apiFetch('/api/lms/admin/physical-sessions').then(r => r?.json()),
      apiFetch('/api/lms/admin/calendar').then(r => r?.json()),
    ]).then(([l, s, e]) => {
      if (l) setLearners(l);
      if (s) setSessions(s);
      if (e) setEvents(e);
      setLoading(false);
    });
  }, []);

  const upcomingSessions = sessions
    .filter(s => s.status === 'scheduled' || s.computed_status === 'scheduled')
    .slice(0, 5);
  const totalLearners = learners.length;
  const totalCompleted = learners.reduce((a, l) => a + (l.completed_lessons || 0), 0);
  const totalWatchHours = Math.round(learners.reduce((a, l) => a + (l.total_watch_seconds || 0), 0) / 3600 * 10) / 10;
  const upcomingEvents = events
    .filter(e => new Date(e.event_date) >= new Date(new Date().toDateString()))
    .slice(0, 5);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="text-cortex-muted">Loading dashboard...</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-cortex-text">Trainer Dashboard</h1>
        <p className="text-cortex-muted text-sm mt-0.5">
          Welcome back, {user?.display_name || user?.name || 'Trainer'}
          {user?.departments?.length > 0 && <span> — {user.departments.join(', ')}</span>}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Learners', value: totalLearners, color: 'border-l-cortex-accent', text: 'text-cortex-accent' },
          { label: 'Lessons Completed', value: totalCompleted, color: 'border-l-green-500', text: 'text-green-500' },
          { label: 'Watch Hours', value: totalWatchHours, color: 'border-l-purple-500', text: 'text-purple-500' },
          { label: 'Upcoming Sessions', value: upcomingSessions.length, color: 'border-l-yellow-500', text: 'text-yellow-500' },
        ].map(m => (
          <div key={m.label} className={`bg-cortex-surface border border-cortex-border border-l-4 ${m.color} rounded-xl p-4`}>
            <div className="text-cortex-muted text-xs font-medium mb-1">{m.label}</div>
            <div className={`text-2xl font-bold ${m.text}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Physical Sessions */}
        <div className="bg-cortex-surface border border-cortex-border rounded-xl">
          <div className="px-5 py-4 border-b border-cortex-border flex items-center justify-between">
            <h2 className="font-semibold text-cortex-text text-sm">Upcoming Training Sessions</h2>
            <Link href="/lms/admin/physical-training" className="text-xs text-cortex-accent hover:underline">Manage</Link>
          </div>
          <div className="p-4 space-y-2">
            {upcomingSessions.length === 0 ? (
              <div className="text-cortex-muted text-sm text-center py-6">No upcoming sessions</div>
            ) : upcomingSessions.map(s => (
              <div key={s.id} className="bg-cortex-bg rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-cortex-text font-medium text-sm">{s.title}</div>
                    <div className="text-cortex-muted text-xs mt-0.5">
                      {new Date(s.scheduled_date).toLocaleDateString()} | {s.start_time} - {s.end_time}
                    </div>
                    {s.location && <div className="text-cortex-muted text-xs">{s.location}</div>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    {s.enrolled_count || 0} enrolled
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Calendar Events */}
        <div className="bg-cortex-surface border border-cortex-border rounded-xl">
          <div className="px-5 py-4 border-b border-cortex-border flex items-center justify-between">
            <h2 className="font-semibold text-cortex-text text-sm">Upcoming Calendar Events</h2>
            <Link href="/lms/admin/calendar" className="text-xs text-cortex-accent hover:underline">View Calendar</Link>
          </div>
          <div className="p-4 space-y-2">
            {upcomingEvents.length === 0 ? (
              <div className="text-cortex-muted text-sm text-center py-6">No upcoming events</div>
            ) : upcomingEvents.map(e => (
              <div key={e.id} className="bg-cortex-bg rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-cortex-text font-medium text-sm">{e.title}</div>
                    <div className="text-cortex-muted text-xs mt-0.5">
                      {new Date(e.event_date).toLocaleDateString()} | {e.start_time} - {e.end_time}
                    </div>
                    {e.department && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 mt-1 inline-block">{e.department}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    e.event_type === 'training' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {e.event_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Learner Progress Overview */}
        <div className="bg-cortex-surface border border-cortex-border rounded-xl lg:col-span-2">
          <div className="px-5 py-4 border-b border-cortex-border flex items-center justify-between">
            <h2 className="font-semibold text-cortex-text text-sm">Learner Progress</h2>
            <Link href="/lms/admin/analytics" className="text-xs text-cortex-accent hover:underline">Full Analytics</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Learner</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium text-right">Watch Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {learners.slice(0, 10).map(l => (
                <tr key={l.id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3">
                    <div className="font-medium text-cortex-text">{l.display_name || l.email}</div>
                    <div className="text-xs text-cortex-muted">{l.staff_id || l.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(l.departments || []).map(d => (
                        <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{d}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{l.learner_type || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                        <div className="h-full bg-cortex-accent rounded-full" style={{ width: `${l.avg_percent_watched || 0}%` }} />
                      </div>
                      <span className="text-xs text-cortex-muted">{l.completed_lessons} done</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-cortex-muted text-xs">
                    {Math.round((l.total_watch_seconds || 0) / 60)}m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Content Management', href: '/lms/admin/content', desc: 'Manage courses and lessons' },
          { label: 'Physical Training', href: '/lms/admin/physical-training', desc: 'Schedule training sessions' },
          { label: 'Calendar', href: '/lms/admin/calendar', desc: 'View and create events' },
          { label: 'Analytics', href: '/lms/admin/analytics', desc: 'Detailed learner analytics' },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="bg-cortex-surface border border-cortex-border rounded-xl p-4 hover:border-cortex-accent/50 transition">
            <div className="text-cortex-text font-medium text-sm">{link.label}</div>
            <div className="text-cortex-muted text-xs mt-1">{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
