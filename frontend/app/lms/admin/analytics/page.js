// frontend/app/lms/admin/analytics/page.js
'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

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
  const [learners, setLearners] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
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

  const loadUser = async (user) => {
    setSelectedUser(user);
    setSelectedSession(null);
    setTimeline(null);
    const d = await apiFetch(`/api/lms/admin/progress/users/${user.id}`).then(r => r?.json());
    if (d) setUserDetail(d);
  };

  const loadSession = async (session) => {
    setSelectedSession(session);
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
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, timeline]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics & Timeline Replay</h1>

      <div className="flex gap-6 h-full">
        {/* User list */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 px-2 mb-2 font-medium uppercase tracking-wider">Learners</div>
            {learners.map(l => (
              <button key={l.id} onClick={() => loadUser(l)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition mb-0.5 ${selectedUser?.id === l.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
                <div className="truncate">{l.display_name || l.email}</div>
                <div className="text-xs opacity-60">{l.learner_type || 'No type'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 space-y-4">
          {!selectedUser ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
              Select a learner to view analytics
            </div>
          ) : !userDetail ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              {/* User summary */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-3">{userDetail.user?.display_name} — Progress Summary</h2>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Lessons Completed', value: userDetail.progress.filter(p => p.completed).length },
                    { label: 'In Progress', value: userDetail.progress.filter(p => !p.completed).length },
                    { label: 'Total Watch Time', value: `${Math.round(userDetail.progress.reduce((a,p)=>a+(p.total_watch_seconds||0),0)/60)}m` },
                    { label: 'Sessions', value: userDetail.sessions.length },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-white">{m.value}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Per-lesson progress */}
                <div className="space-y-2">
                  {userDetail.progress.map(p => (
                    <div key={p.lesson_id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300">{p.lesson_title}</span>
                          <span className="text-gray-400">{p.percent_watched}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${p.percent_watched}%` }} />
                        </div>
                      </div>
                      {p.completed && <span className="text-green-500 text-xs">✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions list */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-3">Sessions</h3>
                <div className="space-y-1.5">
                  {userDetail.sessions.map(s => (
                    <button key={s.id} onClick={() => loadSession(s)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition ${selectedSession?.id === s.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                      <div className="flex justify-between">
                        <span>{new Date(s.session_started_at).toLocaleString()}</span>
                        <span className="text-xs opacity-70">{s.total_active_seconds}s active</span>
                      </div>
                    </button>
                  ))}
                  {!userDetail.sessions.length && <div className="text-gray-500 text-sm">No sessions yet</div>}
                </div>
              </div>

              {/* Timeline replay */}
              {timeline && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-semibold">Session Timeline Replay</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm">{playhead + 1} / {timeline.events.length}</span>
                      <button onClick={() => { setPlayhead(0); setPlaying(false); }}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs transition">↩ Reset</button>
                      <button onClick={() => setPlaying(p => !p)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition">
                        {playing ? '⏸ Pause' : '▶ Play'}
                      </button>
                    </div>
                  </div>

                  {/* Scrubber */}
                  <input type="range" min={0} max={timeline.events.length - 1} value={playhead}
                    onChange={e => setPlayhead(Number(e.target.value))}
                    className="w-full mb-4 accent-blue-500" />

                  {/* Current event highlight */}
                  {timeline.events[playhead] && (() => {
                    const ev = timeline.events[playhead];
                    const meta = EVENT_LABELS[ev.event_type] || { icon: '•', color: 'gray' };
                    return (
                      <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <span className="text-white font-medium">{ev.event_type}</span>
                          <span className="text-gray-400 text-xs ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
                        </div>
                        {Object.keys(ev.event_payload || {}).length > 0 && (
                          <pre className="text-xs text-gray-400 mt-2 overflow-x-auto">{JSON.stringify(ev.event_payload, null, 2)}</pre>
                        )}
                      </div>
                    );
                  })()}

                  {/* Event stream */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {timeline.events.slice(0, playhead + 1).map((ev, i) => {
                      const meta = EVENT_LABELS[ev.event_type] || { icon: '•' };
                      return (
                        <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${i === playhead ? 'bg-blue-900/50 text-white' : 'text-gray-500'}`}>
                          <span>{meta.icon}</span>
                          <span>{ev.event_type}</span>
                          <span className="ml-auto">{new Date(ev.client_ts).toLocaleTimeString()}</span>
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
    </div>
  );
}
