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

  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/lms/trainer/sessions').then(r => r?.json());
    if (d) {
      setSessions(d);
      if (!selected && d.length > 0) setSelected(d[0]);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (selected) {
      apiFetch(`/api/lms/trainer/sessions/${selected.id}/enrollments`)
        .then(r => r?.json())
        .then(d => { if (d) setEnrollments(d); });
    }
  }, [selected?.id]);

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

  // Mocking "Actionable Backlog" for visual completeness
  const backlog = [
    { id: 1, title: 'Advanced Nursing Ethics', type: 'Assignment', learner: 'Sarah Chen', due: '2h ago' },
    { id: 2, title: 'Patient Safety Protocol', type: 'Quiz Review', learner: 'James Miller', due: '5h ago' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in h-[calc(100vh-12rem)]">
      <div className="flex h-full gap-8">
        
        {/* ── Left Column: Navigation & Backlog ── */}
        <div className="w-80 flex flex-col gap-6 h-full">
          
          {/* Actionable Backlog */}
          <section className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Actionable Backlog</h2>
            <div className="space-y-3">
              {backlog.map(item => (
                <div key={item.id} className="group p-3 rounded-2xl bg-slate-50 border border-transparent hover:border-blue-200 hover:bg-white transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight bg-blue-50 px-2 py-0.5 rounded-lg">{item.type}</span>
                    <span className="text-[10px] font-bold text-red-400">{item.due}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-medium">Review: {item.learner}</div>
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
              {viewMode === 'list' ? (
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
                         <div key={i} className={`h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
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
               <p className="font-bold uppercase tracking-widest text-xs">Select a workspace to begin</p>
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
                   {[['attendance', 'Learner Directory'], ['chat', 'Internal Comms']].map(([id, label]) => (
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
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Personnel List</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {enrollments.map(e => (
                            <div key={e.user_id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[1.5rem] hover:shadow-md transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                  {(e.display_name || e.email)[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-900 truncate">{e.display_name || e.email}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">{e.learner_type_name || 'Staff'}</div>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                                e.attendance_status === 'present' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {e.attendance_status || 'Pending'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'chat' && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                       <div className="text-6xl mb-4 grayscale opacity-10">💬</div>
                       <h3 className="text-lg font-black text-slate-900 tracking-tight">Comms Hub</h3>
                       <p className="text-slate-400 text-sm max-w-sm font-medium">Internal messaging for this session is being synchronized. Connect with learners in real-time.</p>
                       <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all">Enable Live Chat</button>
                    </div>
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
