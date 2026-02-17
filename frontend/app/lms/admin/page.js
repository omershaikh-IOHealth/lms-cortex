// frontend/app/lms/admin/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

export default function LMSAdminPage() {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/lms/admin/progress/users')
      .then(r => r?.json())
      .then(data => { if (data) setLearners(data); })
      .finally(() => setLoading(false));
  }, []);

  const totalCompleted = learners.reduce((a, l) => a + (l.completed_lessons || 0), 0);
  const totalWatchHours = Math.round(learners.reduce((a, l) => a + (l.total_watch_seconds || 0), 0) / 3600 * 10) / 10;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">LMS Overview</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Learners',    value: learners.length,    color: 'blue' },
          { label: 'Lessons Completed', value: totalCompleted,     color: 'green' },
          { label: 'Watch Hours',       value: totalWatchHours,    color: 'purple' },
          { label: 'Active This Week',  value: learners.filter(l => {
            const lastActive = new Date(l.last_active);
            return !isNaN(lastActive) && (Date.now() - lastActive) < 7*24*3600*1000;
          }).length, color: 'orange' },
        ].map(m => (
          <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-gray-400 text-sm">{m.label}</div>
            <div className="text-3xl font-bold text-white mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Learner progress table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-white font-semibold">Learner Progress</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3">Learner</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-right px-5 py-3">Completed</th>
                <th className="text-right px-5 py-3">Started</th>
                <th className="text-right px-5 py-3">Watch Time</th>
                <th className="text-right px-5 py-3">Avg %</th>
                <th className="text-right px-5 py-3">Last Active</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {learners.map(l => (
                <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <div className="text-white">{l.display_name || 'Unnamed'}</div>
                    <div className="text-gray-500 text-xs">{l.email}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-300">{l.learner_type || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-green-400 font-medium">{l.completed_lessons}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{l.started_lessons}</td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {Math.round((l.total_watch_seconds || 0) / 60)}m
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {l.avg_percent_watched ? `${l.avg_percent_watched}%` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 text-xs">
                    {l.last_active ? new Date(l.last_active).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/lms/admin/analytics?user=${l.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {!learners.length && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">No learners yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
