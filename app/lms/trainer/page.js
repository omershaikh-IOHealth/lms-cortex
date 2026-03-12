// app/lms/trainer/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';

const STATUS_STYLES = {
  scheduled: 'bg-blue-50 text-blue-600 border-blue-100',
  ongoing:   'bg-amber-50 text-amber-600 border-amber-100',
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  cancelled: 'bg-slate-50 text-slate-400 border-slate-100',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const sessionDateStr = (s) => String(s.scheduled_date).slice(0, 10);

function buildMonthGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  return cells;
}

export default function TrainerPage() {
  const { user } = useAuth();
  const [sessions,     setSessions]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [enrollments,  setEnrollments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState('attendance');
  const [viewMode,     setViewMode]     = useState('list');
  const [calMonth,     setCalMonth]     = useState(() => new Date());
  const [savingIds,    setSavingIds]    = useState(new Set());

  // Chat state
  const [chatEnabled,  setChatEnabled]  = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatSending,  setChatSending]  = useState(false);
  const chatPollRef  = useRef(null);
  const chatBottomRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/lms/trainer/sessions').then(r => r?.json());
    if (d) {
      setSessions(d);
      if (!selected && d.length > 0) setSelected(d[0]);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadEnrollments = useCallback(async (sessionId) => {
    const d = await apiFetch(`/api/lms/trainer/sessions/${sessionId}/enrollments`).then(r => r?.json());
    if (d) setEnrollments(d);
  }, []);

  useEffect(() => {
    if (selected) loadEnrollments(selected.id);
  }, [selected?.id]);

  // Reset chat when session changes
  useEffect(() => {
    setChatEnabled(false);
    setChatMessages([]);
    setChatInput('');
    clearInterval(chatPollRef.current);
  }, [selected?.id]);

  useEffect(() => () => clearInterval(chatPollRef.current), []);

  const loadChatMessages = useCallback(async (sessionId) => {
    const d = await apiFetch(`/api/lms/sessions/${sessionId}/messages`).then(r => r?.json());
    if (Array.isArray(d)) {
      setChatMessages(d);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  const enableChat = () => {
    if (!selected) return;
    setChatEnabled(true);
    loadChatMessages(selected.id);
    clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => loadChatMessages(selected.id), 10_000);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatSending || !selected) return;
    setChatSending(true);
    await apiFetch(`/api/lms/sessions/${selected.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: chatInput.trim() }),
    });
    setChatInput('');
    await loadChatMessages(selected.id);
    setChatSending(false);
  };

  const markAttendance = async (userId, status) => {
    if (!selected) return;
    setSavingIds(prev => new Set(prev).add(userId));
    await apiFetch(`/api/lms/trainer/sessions/${selected.id}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ attendances: [{ user_id: userId, status }] }),
    });
    await loadEnrollments(selected.id);
    setSavingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Instructor Console...</span>
    </div>
  );

  const calYear  = calMonth.getFullYear();
  const calMon   = calMonth.getMonth();
  const cells    = buildMonthGrid(calYear, calMon);
  const monthLabel = calMonth.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in h-[calc(100vh-12rem)]">
      <div className="flex h-full gap-8">

        {/* ── Left Column: Navigation & Sessions ── */}
        <div className="w-80 flex flex-col gap-6 h-full">

          {/* Quick Stats */}
          <section className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Session Overview</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Sessions', value: sessions.length },
                { label: 'Upcoming', value: sessions.filter(s => (s.computed_status || s.status) === 'scheduled').length },
                { label: 'Ongoing', value: sessions.filter(s => (s.computed_status || s.status) === 'ongoing').length },
                { label: 'Completed', value: sessions.filter(s => (s.computed_status || s.status) === 'completed').length },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-50 rounded-2xl p-3">
                  <div className="text-xl font-black text-slate-900">{stat.value}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Session Selector Sidebar */}
          <section className="flex-1 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">My Sessions</h2>
              <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-400'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
              {sessions.length === 0 ? (
                <div className="text-center text-slate-400 text-xs font-bold py-8">No sessions assigned</div>
              ) : viewMode === 'list' ? (
                sessions.map(s => (
                  <button key={s.id} onClick={() => setSelected(s)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                      selected?.id === s.id ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200 text-white translate-x-1' : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'
                    }`}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selected?.id === s.id ? 'text-white/70' : 'text-slate-400'}`}>
                      {fmt(s.scheduled_date)}
                    </div>
                    <div className="text-sm font-bold truncate leading-tight mb-2">{s.title}</div>
                    <div className={`flex items-center gap-2 text-[10px] font-bold ${selected?.id === s.id ? 'text-white/80' : 'text-slate-500'}`}>
                      <span>🕒 {s.start_time}</span>
                      <span>👥 {s.enrolled_count || 0} enrolled</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="animate-fade-in">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="text-slate-400 hover:text-slate-900 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg></button>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tighter">{monthLabel}</span>
                    <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="text-slate-400 hover:text-slate-900 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const dateStr = `${calYear}-${String(calMon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const hasSessions = sessions.some(s => sessionDateStr(s) === dateStr);
                      const isSelected = selected && sessionDateStr(selected) === dateStr;
                      return (
                        <div key={i} onClick={() => {
                          const s = sessions.find(s => sessionDateStr(s) === dateStr);
                          if (s) setSelected(s);
                        }} className={`h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                          isSelected ? 'bg-blue-600 text-white shadow-md' : hasSessions ? 'bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100' : 'text-slate-300'
                        }`}>{day}</div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Right Column: Detail View ── */}
        <div className="flex-1 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/30">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <div className="text-6xl mb-6 grayscale opacity-20 animate-bounce">📅</div>
              <p className="font-bold uppercase tracking-widest text-xs">Select a session to begin</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <header className="p-10 border-b border-slate-100 bg-slate-50/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${STATUS_STYLES[selected.computed_status || selected.status]}`}>
                      {selected.computed_status || selected.status}
                    </span>
                    <span className="text-xs font-bold text-slate-400">· ID: #{selected.id.toString().padStart(4, '0')}</span>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight mb-4 max-w-2xl">{selected.title}</h1>
                  <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">📅</span>
                      {fmt(selected.scheduled_date)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">🕒</span>
                      {selected.start_time} – {selected.end_time}
                    </div>
                    {selected.location && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">📍</span>
                        {selected.location}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* Detail Tabs & Body */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-10 py-6 flex items-center gap-8 border-b border-slate-100 bg-white sticky top-0 z-10">
                  {[['attendance', 'Learner Directory'], ['chat', 'Session Chat']].map(([id, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)} className={`text-xs font-black uppercase tracking-[0.2em] pb-2 transition-all relative ${
                      activeTab === id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                      {label}
                      {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full animate-scale-in" />}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                  {activeTab === 'attendance' && (
                    <div className="space-y-10">
                      {/* Attendance Analytics */}
                      <div className="grid grid-cols-4 gap-6">
                        {[
                          { label: 'Enrolled', value: enrollments.length, color: 'bg-slate-900' },
                          { label: 'Present', value: enrollments.filter(e => e.attendance_status === 'present').length, color: 'bg-emerald-500' },
                          { label: 'Absent', value: enrollments.filter(e => e.attendance_status === 'absent').length, color: 'bg-rose-500' },
                          { label: 'Pending', value: enrollments.filter(e => !e.attendance_status || e.attendance_status === 'enrolled').length, color: 'bg-blue-500' },
                        ].map(stat => (
                          <div key={stat.label} className="bg-slate-50 border border-slate-100 p-6 rounded-3xl">
                            <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Learner List */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Personnel List</h3>
                          <span className="text-[10px] font-bold text-slate-400">Click Present / Absent to mark attendance</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {enrollments.length === 0 ? (
                            <div className="col-span-2 text-center text-slate-400 text-sm font-bold py-10">No learners enrolled in this session</div>
                          ) : enrollments.map(e => {
                            const isPresent = e.attendance_status === 'present';
                            const isAbsent  = e.attendance_status === 'absent';
                            const saving    = savingIds.has(e.user_id);
                            const acked     = !!e.acknowledged_at;
                            return (
                              <div key={e.user_id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-md transition-all group">
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all flex-shrink-0">
                                    {(e.display_name || e.email)[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900 truncate">{e.display_name || e.email}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">{e.learner_type_name || 'Staff'}</span>
                                      {acked && (
                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md uppercase tracking-tight">Ack'd</span>
                                      )}
                                      {!acked && (
                                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md uppercase tracking-tight">Not Ack'd</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {saving ? (
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => markAttendance(e.user_id, isPresent ? 'enrolled' : 'present')}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${
                                          isPresent
                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                            : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                        }`}
                                      >
                                        Present
                                      </button>
                                      <button
                                        onClick={() => markAttendance(e.user_id, isAbsent ? 'enrolled' : 'absent')}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${
                                          isAbsent
                                            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                            : 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50'
                                        }`}
                                      >
                                        Absent
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'chat' && (
                    !chatEnabled ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl mb-2">💬</div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Session Chat</h3>
                        <p className="text-slate-400 text-sm max-w-sm font-medium">Connect with enrolled learners in real-time. Messages are scoped to this session only.</p>
                        <button
                          onClick={enableChat}
                          className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all"
                        >
                          Open Live Chat
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 26rem)' }}>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 scrollbar-hide">
                          {chatMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-slate-400 text-sm font-medium">No messages yet — be the first to say something</div>
                          ) : chatMessages.map(m => {
                            const isMe = m.user_id === user?.id;
                            return (
                              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs rounded-2xl px-4 py-2.5 ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                                  {!isMe && (
                                    <div className="text-[10px] font-black text-slate-400 mb-1 uppercase">{m.display_name || m.email}</div>
                                  )}
                                  <div className="text-sm font-medium">{m.message}</div>
                                  <div className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {new Date(m.created_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef} />
                        </div>
                        {/* Input */}
                        <div className="flex gap-3 flex-shrink-0">
                          <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                            placeholder="Type a message…"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim() || chatSending}
                            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-blue-200"
                          >
                            {chatSending ? '…' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
