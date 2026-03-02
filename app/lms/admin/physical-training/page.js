// app/lms/admin/physical-training/page.js
'use client';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, useAuth } from '@/lib/auth';
import NewBadge from '@/components/NewBadge';

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];
const HOUR_H = 56; // px per hour in week/day view

const EMPTY_FORM = {
  title: '', description: '', location: '', facility: '', trainer_id: '',
  scheduled_date: '', start_time: '', end_time: '',
  max_capacity: '', session_mode: 'in_person',
};

const ATTEND_STYLES = {
  enrolled: 'bg-cortex-border text-cortex-muted',
  present:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  absent:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

// ── Date helpers ───────────────────────────────────────────────────────────
const pad  = (n) => String(n).padStart(2, '0');
const fmtDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDateLong  = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-AE',
  { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';

const parseTimeMin = (t) => { const [h,m] = (t||'00:00').split(':').map(Number); return h*60+m; };
const fmtTimeShort = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${ap}`;
};

const isSameDay = (a, b) =>
  a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const isToday   = (d) => isSameDay(d, new Date());
const addDays   = (d, n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };

const startOfWeek  = (d) => { const r=new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth()+1, 0);

function getMonthCalDays(date) {
  const first = startOfMonth(date);
  const last  = endOfMonth(date);
  const start = startOfWeek(first);
  const days  = [];
  let cur = new Date(start);
  while (cur <= last || days.length % 7 !== 0) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
    if (days.length > 42) break;
  }
  return days;
}
const getWeekDays  = (date) => Array.from({length:7}, (_,i) => addDays(startOfWeek(date), i));

// ── Session colour helper ──────────────────────────────────────────────────
const sessionColor = (s) => {
  if (s.status === 'cancelled') return {
    bg:'bg-cortex-border/60', border:'border-cortex-border', text:'text-cortex-muted', dot:'bg-cortex-muted' };
  if (s.status === 'completed') return {
    bg:'bg-green-100 dark:bg-green-900/30', border:'border-green-300 dark:border-green-700',
    text:'text-green-700 dark:text-green-400', dot:'bg-green-500' };
  if (s.status === 'ongoing') return {
    bg:'bg-yellow-100 dark:bg-yellow-900/30', border:'border-yellow-300 dark:border-yellow-700',
    text:'text-yellow-700 dark:text-yellow-400', dot:'bg-yellow-500' };
  if (s.session_mode === 'online') return {
    bg:'bg-blue-100 dark:bg-blue-900/30', border:'border-blue-300 dark:border-blue-700',
    text:'text-blue-700 dark:text-blue-400', dot:'bg-blue-500' };
  return {
    bg:'bg-cortex-accent/10', border:'border-cortex-accent/30',
    text:'text-cortex-accent', dot:'bg-cortex-accent' };
};

const ackStatus = (e) => {
  if (!e.acknowledged_at) return 'pending';
  if (e.last_session_updated_at && new Date(e.acknowledged_at) < new Date(e.last_session_updated_at)) return 'needs-reack';
  return 'acked';
};

const isPast = (s) => new Date(s.scheduled_date + 'T00:00:00') < new Date(new Date().toDateString());

// ── Entry point ────────────────────────────────────────────────────────────
export default function TrainingSessionsPage() {
  return <Suspense><TrainingSessionsInner /></Suspense>;
}

function TrainingSessionsInner() {
  const { user } = useAuth();
  const searchParams   = useSearchParams();
  const googleConnected = searchParams.get('google_connected') === '1';
  const googleError     = searchParams.get('google_error');
  const [googleBanner, setGoogleBanner] = useState(googleConnected || !!googleError);

  // ── Remote data ──────────────────────────────────────────────────────────
  const [sessions,     setSessions]     = useState([]);
  const [trainers,     setTrainers]     = useState([]);
  const [learnerTypes, setLearnerTypes] = useState([]);
  const [allLearners,  setAllLearners]  = useState([]);

  // ── Calendar state ───────────────────────────────────────────────────────
  const [calView, setCalView] = useState('month');
  const [calDate, setCalDate] = useState(new Date());

  // ── Session detail ───────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState(null);
  const [detailOpen,  setDetailOpen]  = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [activeTab,   setActiveTab]   = useState('attendance');

  // ── Modals & forms ───────────────────────────────────────────────────────
  const [modal,       setModal]       = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [resetForm,   setResetForm]   = useState({ scheduled_date:'', start_time:'', end_time:'' });
  const [enrollMode,  setEnrollMode]  = useState('type');
  const [enrollTypeId,   setEnrollTypeId]   = useState('');
  const [enrollUserIds,  setEnrollUserIds]  = useState([]);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [meetError,      setMeetError]      = useState('');
  const [attendSaving,   setAttendSaving]   = useState({});

  // ── Session feedback ─────────────────────────────────────────────────────
  const [sessionFeedback, setSessionFeedback] = useState(null);

  // ── Chat ─────────────────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState([]);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);
  const chatPollRef   = useRef(null);

  // ── Week/day view scroll ref ──────────────────────────────────────────────
  const timeScrollRef = useRef(null);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/lms/admin/physical-sessions').then(r => r?.json());
    if (d) {
      setSessions(d);
      setSelected(prev => prev ? (d.find(s => s.id === prev.id) || prev) : null);
    }
  }, []);

  const loadEnrollments = useCallback(async (id) => {
    const d = await apiFetch(`/api/lms/admin/physical-sessions/${id}/enrollments`).then(r => r?.json());
    if (d) setEnrollments(d);
  }, []);

  const loadMessages = useCallback(async (id) => {
    const d = await apiFetch(`/api/lms/sessions/${id}/messages`).then(r => r?.json());
    if (Array.isArray(d)) {
      setMessages(d);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    apiFetch('/api/lms/admin/physical-sessions/meta/trainers').then(r=>r?.json()).then(d=>{ if(d) setTrainers(d); });
    apiFetch('/api/lms/admin/learner-types').then(r=>r?.json()).then(d=>{ if(d) setLearnerTypes(d.filter(t=>t.is_active)); });
    apiFetch('/api/lms/admin/learners').then(r=>r?.json()).then(d=>{ if(d) setAllLearners(d); });
  }, []);

  useEffect(() => {
    if (selected) { loadEnrollments(selected.id); setActiveTab('attendance'); setMessages([]); setSessionFeedback(null); setMeetError(''); clearInterval(chatPollRef.current); }
  }, [selected?.id]);

  useEffect(() => {
    clearInterval(chatPollRef.current);
    if (activeTab === 'chat' && selected) {
      setChatLoading(true);
      loadMessages(selected.id).finally(() => setChatLoading(false));
      chatPollRef.current = setInterval(() => loadMessages(selected.id), 10_000);
    }
    if (activeTab === 'feedback' && selected && !sessionFeedback) {
      apiFetch(`/api/lms/admin/analytics/feedback?reference_type=session`)
        .then(r => r?.json())
        .then(data => {
          if (Array.isArray(data)) {
            const match = data.find(f => f.session_id === selected.id);
            setSessionFeedback(match || null);
          }
        });
    }
    return () => clearInterval(chatPollRef.current);
  }, [activeTab, selected?.id]);

  // Scroll to 7 AM when switching to time-based views
  useEffect(() => {
    if ((calView === 'week' || calView === 'day') && timeScrollRef.current) {
      timeScrollRef.current.scrollTop = HOUR_H * 7;
    }
  }, [calView]);

  // ── Calendar navigation ───────────────────────────────────────────────────
  const goToday = () => setCalDate(new Date());
  const goPrev  = () => setCalDate(d => {
    const r = new Date(d);
    if (calView==='month') r.setMonth(r.getMonth()-1);
    else if (calView==='week') r.setDate(r.getDate()-7);
    else r.setDate(r.getDate()-1);
    return r;
  });
  const goNext  = () => setCalDate(d => {
    const r = new Date(d);
    if (calView==='month') r.setMonth(r.getMonth()+1);
    else if (calView==='week') r.setDate(r.getDate()+7);
    else r.setDate(r.getDate()+1);
    return r;
  });

  const calTitle = () => {
    if (calView==='month') return `${MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
    if (calView==='week') {
      const s = startOfWeek(calDate), e = addDays(s, 6);
      if (s.getMonth()===e.getMonth())
        return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
      return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return `${DAYS_SHORT[calDate.getDay()]}, ${MONTHS[calDate.getMonth()]} ${calDate.getDate()}, ${calDate.getFullYear()}`;
  };

  const sessionsForDay = (day) => {
    const key = fmtDateInput(day);
    return sessions.filter(s => s.scheduled_date?.slice(0,10) === key);
  };

  // ── Detail panel ──────────────────────────────────────────────────────────
  const openDetail = (session) => { setSelected(session); setDetailOpen(true); };
  const closeDetail = () => {
    setDetailOpen(false); setSelected(null); setEnrollments([]); setMessages([]);
    clearInterval(chatPollRef.current);
  };

  // ── Create / Edit ─────────────────────────────────────────────────────────
  const openCreate = (overrides = {}) => {
    setForm({ ...EMPTY_FORM, ...overrides }); setError(''); setModal('create');
  };
  const openCreateAtDate     = (day) => openCreate({ scheduled_date: fmtDateInput(day) });
  const openCreateAtDateTime = (day, hour) => openCreate({
    scheduled_date: fmtDateInput(day),
    start_time: `${pad(hour)}:00`,
    end_time:   `${pad(Math.min(hour+1,23))}:00`,
  });

  const openEdit = () => {
    if (!selected) return;
    setForm({
      title: selected.title, description: selected.description || '',
      location: selected.location || '', facility: selected.facility || '',
      trainer_id: selected.trainer_id || '',
      scheduled_date: selected.scheduled_date?.slice(0,10) || '',
      start_time: selected.start_time || '', end_time: selected.end_time || '',
      max_capacity: selected.max_capacity || '',
      session_mode: selected.session_mode || 'in_person',
    });
    setError(''); setModal('edit');
  };

  const saveSession = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      setError('End time must be after start time.'); setSaving(false); return;
    }
    try {
      const isEdit = modal === 'edit';
      const url    = isEdit ? `/api/lms/admin/physical-sessions/${selected.id}` : '/api/lms/admin/physical-sessions';
      const r      = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) });
      const data   = await r.json();
      if (!r.ok) throw new Error(data.error);
      setModal(null); await loadSessions();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const cancelSession = async () => {
    if (!selected) return;
    await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/cancel`, { method:'PATCH', body:'{}' });
    await loadSessions();
  };

  const deleteSession = async () => {
    if (!selected) return;
    setSaving(true);
    await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}`, { method:'DELETE' });
    closeDetail(); setModal(null); setSaving(false); await loadSessions();
  };

  const generateMeetLink = async () => {
    if (!selected) return; setGeneratingMeet(true); setMeetError('');
    try {
      const r = await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/generate-meet`, { method:'POST', body:'{}' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await loadSessions();
    } catch (err) { setMeetError(err.message); }
    finally { setGeneratingMeet(false); }
  };

  const resetSession = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const r = await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/reset`, {
        method: 'PATCH',
        body: JSON.stringify({
          scheduled_date: resetForm.scheduled_date || undefined,
          start_time:     resetForm.start_time     || undefined,
          end_time:       resetForm.end_time        || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setModal(null); await loadSessions();
      if (selected) await loadEnrollments(selected.id);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // ── Enroll ────────────────────────────────────────────────────────────────
  const doEnroll = async () => {
    setError(''); setSaving(true);
    try {
      const body = enrollMode==='type'
        ? { learner_type_id: Number(enrollTypeId) }
        : { user_ids: enrollUserIds };
      const r = await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/enroll`,
        { method:'POST', body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setModal(null); setEnrollTypeId(''); setEnrollUserIds([]);
      await Promise.all([loadSessions(), loadEnrollments(selected.id)]);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const removeEnrollment = async (userId) => {
    await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/enrollments/${userId}`, { method:'DELETE' });
    await Promise.all([loadSessions(), loadEnrollments(selected.id)]);
  };

  // ── Attendance ────────────────────────────────────────────────────────────
  const markAttendance = async (userId, status) => {
    setAttendSaving(p => ({ ...p, [userId]: true }));
    await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/attendance`,
      { method:'PUT', body: JSON.stringify({ attendances:[{ user_id: userId, status }] }) });
    await Promise.all([loadEnrollments(selected.id), loadSessions()]);
    setAttendSaving(p => ({ ...p, [userId]: false }));
  };

  const markAllAttendance = async (status) => {
    const attendances = enrollments.map(e => ({ user_id: e.user_id, status }));
    await apiFetch(`/api/lms/admin/physical-sessions/${selected.id}/attendance`,
      { method:'PUT', body: JSON.stringify({ attendances }) });
    await Promise.all([loadEnrollments(selected.id), loadSessions()]);
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatSending || !selected) return;
    setChatSending(true);
    await apiFetch(`/api/lms/sessions/${selected.id}/messages`,
      { method:'POST', body: JSON.stringify({ message: chatInput.trim() }) });
    setChatInput(''); await loadMessages(selected.id); setChatSending(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isCancelled = selected?.status === 'cancelled';
  const isPastSel   = selected ? isPast(selected) : false;

  // ── Session chip (month view) ─────────────────────────────────────────────
  const SessionChip = ({ s }) => {
    const col = sessionColor(s);
    return (
      <button
        onClick={e => { e.stopPropagation(); openDetail(s); }}
        className={`w-full text-left rounded px-1.5 py-0.5 border text-[11px] font-medium truncate transition hover:opacity-75 ${col.bg} ${col.border} ${col.text}`}
      >
        <span className="mr-1 opacity-70">{fmtTimeShort(s.start_time)}</span>
        {s.session_mode === 'online' ? '💻' : '🏢'} {s.title}
      </button>
    );
  };

  // ── Current time line (week/day) ──────────────────────────────────────────
  const NowLine = () => {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return (
      <div style={{top: (mins / 60) * HOUR_H}} className="absolute w-full z-20 pointer-events-none">
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0 shadow" />
          <div className="flex-1 h-px bg-red-500 shadow" />
        </div>
      </div>
    );
  };

  // ── MONTH VIEW ────────────────────────────────────────────────────────────
  const MonthView = () => {
    const calDays  = getMonthCalDays(calDate);
    const curMonth = calDate.getMonth();
    return (
      <div className="flex-1 overflow-auto flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-cortex-border flex-shrink-0">
          {DAYS_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-cortex-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows:'minmax(110px,1fr)' }}>
          {calDays.map((day, i) => {
            const daySessions = sessionsForDay(day);
            const other = day.getMonth() !== curMonth;
            const today = isToday(day);
            return (
              <div
                key={i}
                onClick={() => openCreateAtDate(day)}
                className={`border-b border-r border-cortex-border p-1.5 cursor-pointer hover:bg-cortex-accent/5 transition group ${other ? 'bg-cortex-bg/40' : ''}`}
              >
                <div className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-1 font-semibold transition ${
                  today ? 'bg-cortex-accent text-white' : other ? 'text-cortex-muted/40' : 'text-cortex-text group-hover:text-cortex-accent'
                }`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {daySessions.slice(0, 3).map(s => <SessionChip key={s.id} s={s} />)}
                  {daySessions.length > 3 && (
                    <button
                      onClick={e => { e.stopPropagation(); setCalView('day'); setCalDate(new Date(day)); }}
                      className="text-[10px] text-cortex-muted hover:text-cortex-accent pl-1 transition">
                      +{daySessions.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────
  const WeekView = () => {
    const weekDays = getWeekDays(calDate);
    const hours    = Array.from({length:24}, (_,i) => i);
    return (
      <div className="flex-1 overflow-auto min-h-0" ref={timeScrollRef}>
        <div className="min-w-[640px] flex flex-col">
          {/* Day headers */}
          <div className="flex border-b border-cortex-border sticky top-0 bg-cortex-surface z-10 flex-shrink-0">
            <div className="w-14 flex-shrink-0" />
            {weekDays.map((day, i) => (
              <div key={i} className={`flex-1 text-center py-2 border-l border-cortex-border ${isToday(day) ? 'bg-cortex-accent/5' : ''}`}>
                <div className="text-[11px] text-cortex-muted">{DAYS_SHORT[day.getDay()]}</div>
                <div
                  onClick={() => { setCalDate(new Date(day)); setCalView('day'); }}
                  className={`text-sm font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition hover:opacity-80 ${
                    isToday(day) ? 'bg-cortex-accent text-white' : 'text-cortex-text hover:bg-cortex-bg'
                  }`}>
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>
          {/* Time grid */}
          <div className="flex relative" style={{height: HOUR_H * 24}}>
            {/* Hour gutter */}
            <div className="w-14 flex-shrink-0 relative">
              {hours.map(h => (
                <div key={h} style={{height: HOUR_H}} className="relative border-b border-cortex-border/20">
                  {h > 0 && (
                    <span className="absolute -top-2 right-2 text-[10px] text-cortex-muted">
                      {h < 12 ? `${h} AM` : h===12 ? '12 PM' : `${h-12} PM`}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Columns */}
            {weekDays.map((day, di) => (
              <div key={di} className="flex-1 border-l border-cortex-border relative">
                {/* Hour slots */}
                {hours.map(h => (
                  <div
                    key={h}
                    style={{top: h * HOUR_H, height: HOUR_H}}
                    className="absolute w-full border-b border-cortex-border/15 hover:bg-cortex-accent/5 cursor-pointer transition"
                    onClick={() => openCreateAtDateTime(day, h)}
                  />
                ))}
                {/* Now line */}
                {isToday(day) && <NowLine />}
                {/* Session blocks */}
                {sessionsForDay(day).map(s => {
                  const startMin = parseTimeMin(s.start_time);
                  const endMin   = parseTimeMin(s.end_time);
                  const top    = (startMin / 60) * HOUR_H;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_H, 22);
                  const col    = sessionColor(s);
                  return (
                    <button
                      key={s.id}
                      style={{top: top+1, height: height-2, left: 2, right: 2}}
                      className={`absolute rounded-lg border px-1.5 text-left overflow-hidden hover:opacity-80 transition z-10 ${col.bg} ${col.border} ${col.text}`}
                      onClick={e => { e.stopPropagation(); openDetail(s); }}
                    >
                      <div className="text-[11px] font-semibold leading-tight truncate">
                        {s.session_mode==='online' ? '💻 ' : '🏢 '}{s.title}
                      </div>
                      {height > 32 && (
                        <div className="text-[10px] opacity-70">{fmtTimeShort(s.start_time)} – {fmtTimeShort(s.end_time)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── DAY VIEW ──────────────────────────────────────────────────────────────
  const DayView = () => {
    const daySessions = sessionsForDay(calDate);
    const hours = Array.from({length:24}, (_,i) => i);
    return (
      <div className="flex-1 overflow-auto min-h-0" ref={timeScrollRef}>
        <div className="flex" style={{height: HOUR_H * 24}}>
          {/* Hour gutter */}
          <div className="w-16 flex-shrink-0 relative">
            {hours.map(h => (
              <div key={h} style={{height: HOUR_H}} className="relative border-b border-cortex-border/20">
                {h > 0 && (
                  <span className="absolute -top-2 right-2 text-[10px] text-cortex-muted">
                    {h < 12 ? `${h} AM` : h===12 ? '12 PM' : `${h-12} PM`}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Day column */}
          <div className="flex-1 border-l border-cortex-border relative">
            {hours.map(h => (
              <div
                key={h}
                style={{top: h*HOUR_H, height: HOUR_H}}
                className="absolute w-full border-b border-cortex-border/15 hover:bg-cortex-accent/5 cursor-pointer transition"
                onClick={() => openCreateAtDateTime(calDate, h)}
              />
            ))}
            {isToday(calDate) && <NowLine />}
            {daySessions.map(s => {
              const startMin = parseTimeMin(s.start_time);
              const endMin   = parseTimeMin(s.end_time);
              const top    = (startMin / 60) * HOUR_H;
              const height = Math.max(((endMin - startMin) / 60) * HOUR_H, 28);
              const col    = sessionColor(s);
              return (
                <button
                  key={s.id}
                  style={{top: top+1, height: height-2, left: 6, right: 6}}
                  className={`absolute rounded-xl border px-3 text-left overflow-hidden hover:opacity-80 transition z-10 ${col.bg} ${col.border} ${col.text}`}
                  onClick={e => { e.stopPropagation(); openDetail(s); }}
                >
                  <div className="text-sm font-semibold">{s.session_mode==='online' ? '💻 ' : '🏢 '}{s.title}</div>
                  <div className="text-xs opacity-70">{fmtTimeShort(s.start_time)} – {fmtTimeShort(s.end_time)}</div>
                  {s.trainer_name && <div className="text-xs opacity-70">👤 {s.trainer_name}</div>}
                  {height > 60 && s.location && <div className="text-xs opacity-60">📍 {s.location}</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Google banner */}
      {googleBanner && (
        <div className={`flex-shrink-0 border-b px-4 py-2 text-sm flex items-center justify-between ${
          googleError
            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
        }`}>
          {googleError
            ? <span>❌ Google Calendar connection failed ({googleError}). Check server logs.</span>
            : <span>✅ Google Calendar connected! New sessions will automatically get a Meet link.</span>
          }
          <button onClick={() => setGoogleBanner(false)} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Calendar toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-cortex-border bg-cortex-surface gap-4">
        {/* Left: nav + title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={goPrev}
            className="p-1.5 rounded-lg hover:bg-cortex-bg border border-cortex-border text-cortex-text transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-cortex-bg border border-cortex-border text-cortex-text transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-text transition">
            Today
          </button>
          <h2 className="text-base font-bold text-cortex-text truncate">{calTitle()}</h2>
        </div>

        {/* Right: view toggle + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 mr-1 text-[11px] text-cortex-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cortex-accent inline-block"/>In Person</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Online</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Done</span>
          </div>

          {/* View toggle */}
          <div className="flex border border-cortex-border rounded-lg overflow-hidden text-sm">
            {[['month','Month'],['week','Week'],['day','Day']].map(([v,l]) => (
              <button key={v} onClick={() => setCalView(v)}
                className={`px-3 py-1.5 transition ${calView===v ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:bg-cortex-bg'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Google connect */}
          <a href="/api/auth/google/connect"
            className="hidden sm:flex items-center gap-1.5 text-xs text-cortex-muted hover:text-cortex-text transition border border-cortex-border rounded-lg px-2.5 py-1.5">
            <svg width="12" height="12" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google Cal
          </a>

          <button onClick={() => openCreate()}
            className="bg-cortex-accent text-white text-sm px-4 py-1.5 rounded-lg hover:opacity-90 transition font-medium whitespace-nowrap">
            + New Session
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {calView === 'month' && <MonthView />}
      {calView === 'week'  && <WeekView />}
      {calView === 'day'   && <DayView  />}

      {/* ════ SESSION DETAIL DRAWER ═══════════════════════════════════════════ */}
      {detailOpen && selected && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={closeDetail} />
          {/* Drawer */}
          <div className="w-full max-w-xl bg-cortex-surface flex flex-col shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-cortex-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      selected.session_mode==='online'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-cortex-border text-cortex-muted'
                    }`}>
                      {selected.session_mode==='online' ? '💻 Online' : '🏢 In Person'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      selected.status==='cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      selected.status==='completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      selected.status==='ongoing'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-cortex-accent/15 text-cortex-accent'
                    }`}>
                      {selected.status}
                    </span>
                    {isPastSel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cortex-border text-cortex-muted font-semibold">PAST</span>}
                  </div>
                  <h2 className="text-lg font-bold text-cortex-text leading-tight">{selected.title}</h2>
                  <div className="text-sm text-cortex-muted mt-1">
                    📅 {fmtDateLong(selected.scheduled_date)} &middot; {fmtTimeShort(selected.start_time)} – {fmtTimeShort(selected.end_time)}
                  </div>
                  {selected.location && <div className="text-sm text-cortex-muted">📍 {selected.location}</div>}
                  {selected.facility && <div className="text-sm text-cortex-muted">🏥 {selected.facility}</div>}
                  {selected.trainer_name && <div className="text-sm text-cortex-muted">👤 {selected.trainer_name}</div>}
                  {selected.description && <div className="text-sm text-cortex-muted mt-2 leading-relaxed">{selected.description}</div>}
                </div>
                <button onClick={closeDetail} className="text-cortex-muted hover:text-cortex-text p-1 transition flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Meet / Calendar links */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {selected.google_meet_link ? (
                  <a href={selected.google_meet_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition font-medium">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                    Join Google Meet
                  </a>
                ) : (
                  <button onClick={generateMeetLink} disabled={generatingMeet}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:border-green-500 hover:text-green-600 disabled:opacity-50 transition">
                    {generatingMeet ? '⏳ Generating…' : '📹 Generate Meet Link'}
                  </button>
                )}
                {selected.google_calendar_link && (
                  <a href={selected.google_calendar_link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:bg-cortex-bg transition">
                    📅 View in Calendar
                  </a>
                )}
              </div>
              {meetError && <div className="mt-1 text-xs text-red-500">{meetError}</div>}

              {/* Action buttons */}
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {!isCancelled && (
                  <>
                    <button onClick={openEdit}
                      className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-text hover:bg-cortex-bg transition">
                      Edit
                    </button>
                    <button onClick={() => { setEnrollMode('type'); setEnrollTypeId(''); setEnrollUserIds([]); setError(''); setModal('enroll'); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 transition">
                      + Enroll
                    </button>
                    <button onClick={() => {
                      setResetForm({ scheduled_date: selected.scheduled_date?.slice(0,10)||'', start_time: selected.start_time||'', end_time: selected.end_time||'' });
                      setError(''); setModal('reset');
                    }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-yellow-400 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition">
                      ↺ Reset
                    </button>
                    <button onClick={cancelSession}
                      className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:bg-cortex-bg transition">
                      Cancel
                    </button>
                  </>
                )}
                {isCancelled && (
                  <button onClick={() => { setResetForm({ scheduled_date:'', start_time:'', end_time:'' }); setError(''); setModal('reset'); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-cortex-accent text-cortex-accent hover:bg-cortex-accent/10 transition">
                    ↺ Reschedule
                  </button>
                )}
                <button onClick={() => setModal('delete_confirm')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  🗑 Delete
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex-shrink-0 grid grid-cols-4 gap-2 px-5 py-3 border-b border-cortex-border">
              {[
                { label:'Enrolled',     value: selected.enrolled_count     || 0, color:'text-cortex-text' },
                { label:'Acknowledged', value: selected.acknowledged_count  || 0, color:'text-cortex-accent' },
                { label:'Present',      value: selected.present_count       || 0, color:'text-green-600 dark:text-green-400' },
                { label:'Absent',       value: selected.absent_count        || 0, color:'text-red-500' },
              ].map(m => (
                <div key={m.label} className="bg-cortex-bg border border-cortex-border rounded-xl p-2.5 text-center">
                  <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-cortex-muted">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex gap-1 px-5 py-2.5 border-b border-cortex-border">
              {[['attendance','👥 Attendance'],['feedback','⭐ Feedback'],['chat','💬 Chat']].map(([v,l]) => (
                <button key={v} onClick={() => setActiveTab(v)}
                  className={`relative px-4 py-1.5 rounded-lg text-sm transition font-medium ${activeTab===v ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:bg-cortex-bg border border-cortex-border'}`}>
                  {l}
                  {v === 'feedback' && <NewBadge description="New: Session feedback tab — view star ratings and comments submitted by attendees for this session." />}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto">

              {/* Attendance tab */}
              {activeTab === 'attendance' && (
                <div>
                  <div className="px-5 py-3 border-b border-cortex-border flex items-center justify-between sticky top-0 bg-cortex-surface z-10">
                    <span className="text-sm font-semibold text-cortex-text">Attendance ({enrollments.length})</span>
                    {enrollments.length > 0 && !isCancelled && (
                      <div className="flex gap-1.5">
                        <button onClick={() => markAllAttendance('present')}
                          className="text-xs px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:opacity-80 transition">
                          All Present
                        </button>
                        <button onClick={() => markAllAttendance('absent')}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 hover:opacity-80 transition">
                          All Absent
                        </button>
                      </div>
                    )}
                  </div>
                  {enrollments.length === 0 ? (
                    <div className="p-8 text-center text-cortex-muted text-sm">No learners enrolled yet</div>
                  ) : (
                    <div className="divide-y divide-cortex-border">
                      {enrollments.map(e => {
                        const ack = ackStatus(e);
                        return (
                          <div key={e.user_id} className="flex items-center gap-3 px-5 py-3">
                            <div className="w-8 h-8 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {(e.display_name || e.email)[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-cortex-text truncate">{e.display_name || e.email}</div>
                              <div className="text-xs text-cortex-muted flex gap-2 flex-wrap">
                                <span>{e.email}</span>
                                {e.learner_type_name && <span>· {e.learner_type_name}</span>}
                              </div>
                            </div>
                            {/* Ack pill */}
                            <div className="flex-shrink-0">
                              {ack==='acked' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Ack'd</span>}
                              {ack==='needs-reack' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">Re-ack</span>}
                              {ack==='pending' && <span className="text-xs px-2 py-0.5 rounded-full bg-cortex-border text-cortex-muted font-medium">Pending</span>}
                            </div>
                            {/* Attendance controls */}
                            {!isCancelled && (
                              <div className="flex gap-1 flex-shrink-0">
                                {[['present','✓'],['enrolled','○'],['absent','✗']].map(([st, lbl]) => (
                                  <button key={st} disabled={!!attendSaving[e.user_id]}
                                    onClick={() => markAttendance(e.user_id, st)}
                                    title={st}
                                    className={`w-7 h-7 rounded-lg text-sm transition font-bold ${
                                      e.attendance_status===st
                                        ? ATTEND_STYLES[st]
                                        : 'border border-cortex-border text-cortex-muted hover:bg-cortex-bg'
                                    }`}>
                                    {lbl}
                                  </button>
                                ))}
                                <button onClick={() => removeEnrollment(e.user_id)}
                                  className="w-7 h-7 rounded-lg border border-cortex-border text-cortex-muted hover:text-red-500 hover:border-red-300 transition text-sm">
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback tab */}
              {activeTab === 'feedback' && (
                <div className="p-5">
                  {sessionFeedback === undefined ? (
                    <div className="text-center py-10 text-cortex-muted text-sm">
                      <div className="w-5 h-5 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      Loading feedback…
                    </div>
                  ) : !sessionFeedback ? (
                    <div className="text-center py-10 text-cortex-muted text-sm">
                      <div className="text-3xl mb-2">⭐</div>
                      No feedback submitted for this session yet.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Average rating */}
                      <div className="bg-cortex-bg border border-cortex-border rounded-xl p-4 flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-cortex-text">{sessionFeedback.avg_rating}</div>
                          <div className="text-[11px] text-cortex-muted mt-0.5">/ 5.0</div>
                        </div>
                        <div className="flex-1">
                          {[5,4,3,2,1].map(star => {
                            const count = sessionFeedback[`${['','one','two','three','four','five'][star]}_star`] || 0;
                            const pct = sessionFeedback.response_count > 0 ? Math.round(count / sessionFeedback.response_count * 100) : 0;
                            return (
                              <div key={star} className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-cortex-muted w-4">{star}★</span>
                                <div className="flex-1 h-2 bg-cortex-border rounded-full overflow-hidden">
                                  <div className="h-2 bg-yellow-400 rounded-full transition-all" style={{width:`${pct}%`}} />
                                </div>
                                <span className="text-xs text-cortex-muted w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-center text-xs text-cortex-muted">
                          <div className="text-lg font-semibold text-cortex-text">{sessionFeedback.response_count}</div>
                          responses
                        </div>
                      </div>

                      {/* Comments */}
                      {sessionFeedback.comments?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">Written Comments</h4>
                          <div className="space-y-2">
                            {JSON.parse(typeof sessionFeedback.comments === 'string' ? sessionFeedback.comments : JSON.stringify(sessionFeedback.comments)).map((c, i) => (
                              <div key={i} className="bg-cortex-bg border border-cortex-border rounded-xl p-3.5">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-xs font-bold">
                                    {(c.user || '?')[0].toUpperCase()}
                                  </div>
                                  <span className="text-xs font-medium text-cortex-text">{c.user || 'Anonymous'}</span>
                                  <span className="text-yellow-500 text-xs ml-auto">{'★'.repeat(c.rating)}</span>
                                </div>
                                <p className="text-sm text-cortex-text leading-relaxed">{c.comment}</p>
                                <div className="text-[11px] text-cortex-muted mt-1">
                                  {c.created_at ? new Date(c.created_at).toLocaleDateString('en-AE', { day:'numeric', month:'short', year:'numeric' }) : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Chat tab */}
              {activeTab === 'chat' && (
                <div className="flex flex-col" style={{minHeight:'400px'}}>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatLoading ? (
                      <div className="text-center text-cortex-muted text-sm py-8">Loading messages…</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-cortex-muted text-sm py-8">No messages yet. Start the conversation!</div>
                    ) : (
                      messages.map(m => {
                        const isMe = m.user_id === user?.id;
                        return (
                          <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-cortex-accent text-white' : 'bg-cortex-bg border border-cortex-border text-cortex-text'}`}>
                              {!isMe && <div className="text-[11px] font-semibold mb-1 text-cortex-accent">{m.display_name || m.email}</div>}
                              <div className="text-sm">{m.message}</div>
                              <div className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-cortex-muted'}`}>
                                {new Date(m.created_at).toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  <div className="flex-shrink-0 px-4 py-3 border-t border-cortex-border flex gap-2">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendChatMessage()}
                      placeholder="Type a message…"
                      className="flex-1 bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                    <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending}
                      className="px-4 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                      {chatSending ? '…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODALS ═════════════════════════════════════════════════════════ */}

      {/* Create / Edit modal */}
      {(modal==='create' || modal==='edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">
                {modal==='create' ? '+ New Training Session' : '✏️ Edit Session'}
              </h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={saveSession} className="p-6 space-y-4">

              {/* Session type toggle */}
              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-2">Session Type *</label>
                <div className="flex gap-2">
                  {[{ value:'in_person', label:'🏢 In Person' },{ value:'online', label:'💻 Online' }].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(p => ({ ...p, session_mode: opt.value }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition border-2 ${
                        form.session_mode===opt.value
                          ? 'bg-cortex-accent text-white border-cortex-accent shadow-sm'
                          : 'border-cortex-border text-cortex-muted hover:border-cortex-accent/40'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p, title:e.target.value}))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="e.g. RCM Module – Doctors Batch A" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Date *</label>
                  <input type="date" value={form.scheduled_date}
                    onChange={e => setForm(p=>({...p, scheduled_date:e.target.value}))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Max Capacity</label>
                  <input type="number" value={form.max_capacity}
                    onChange={e => setForm(p=>({...p, max_capacity:e.target.value}))} min="1"
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Unlimited" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Start Time *</label>
                  <input type="time" value={form.start_time}
                    onChange={e => {
                      const st = e.target.value;
                      setForm(p => ({ ...p, start_time: st, end_time: p.end_time && p.end_time <= st ? '' : p.end_time }));
                    }} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">End Time *</label>
                  <input type="time" value={form.end_time}
                    onChange={e => setForm(p=>({...p, end_time:e.target.value}))} required
                    min={form.start_time || undefined}
                    className={`w-full bg-cortex-bg border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent ${
                      form.end_time && form.start_time && form.end_time <= form.start_time
                        ? 'border-red-400' : 'border-cortex-border'
                    }`} />
                  {form.end_time && form.start_time && form.end_time <= form.start_time && (
                    <p className="text-red-500 text-[11px] mt-1">Must be after start time</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">
                    {form.session_mode==='online' ? 'Meeting Link (optional)' : 'Location'}
                  </label>
                  <input value={form.location} onChange={e => setForm(p=>({...p, location:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder={form.session_mode==='online'
                      ? 'Zoom / Teams link, or leave blank for auto Google Meet'
                      : 'e.g. Training Room 3, Building B'} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5 flex items-center gap-1.5">🏥 Facility <span className="relative inline-block"><NewBadge description="New: Facility field — track which building or site the session is held in (e.g. Main Hospital, Simulation Lab)." /></span></label>
                  <input value={form.facility} onChange={e => setForm(p=>({...p, facility:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="e.g. Main Hospital, Clinic A" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Trainer</label>
                <select value={form.trainer_id} onChange={e => setForm(p=>({...p, trainer_id:e.target.value}))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="">— Unassigned —</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.display_name || t.email}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Description / Notes</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p, description:e.target.value}))} rows={3}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none"
                  placeholder="Agenda, prerequisites, or additional details for attendees…" />
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  disabled={saving || (form.end_time && form.start_time && form.end_time <= form.start_time)}
                  className="flex-1 bg-cortex-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : modal==='create' ? 'Create Session' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2.5 rounded-xl text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset modal */}
      {modal === 'reset' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">↺ Reset / Reschedule</h2>
              <p className="text-xs text-cortex-muted mt-0.5">Clears all attendance marks and resets status to Scheduled.</p>
            </div>
            <form onSubmit={resetSession} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">New Date (blank = keep current)</label>
                <input type="date" value={resetForm.scheduled_date}
                  onChange={e => setResetForm(p=>({...p, scheduled_date:e.target.value}))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">New Start Time</label>
                  <input type="time" value={resetForm.start_time}
                    onChange={e => setResetForm(p=>({...p, start_time:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">New End Time</label>
                  <input type="time" value={resetForm.end_time}
                    onChange={e => setResetForm(p=>({...p, end_time:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Resetting…' : '↺ Reset Session'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {modal === 'delete_confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑</div>
              <h2 className="font-semibold text-cortex-text text-lg">Delete Session?</h2>
              <p className="text-sm text-cortex-muted mt-2">
                This will permanently delete <strong className="text-cortex-text">"{selected?.title}"</strong> and all {selected?.enrolled_count || 0} enrollments.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={deleteSession} disabled={saving}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition">
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll modal */}
      {modal === 'enroll' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Add Learners</h2>
              <p className="text-xs text-cortex-muted mt-0.5 truncate">{selected?.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                {['type','individual'].map(m => (
                  <button key={m} onClick={() => setEnrollMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm transition font-medium ${enrollMode===m ? 'bg-cortex-accent text-white' : 'border border-cortex-border text-cortex-muted hover:bg-cortex-bg'}`}>
                    {m==='type' ? 'By Learner Type' : 'Individual'}
                  </button>
                ))}
              </div>
              {enrollMode === 'type' ? (
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Learner Type</label>
                  <select value={enrollTypeId} onChange={e => setEnrollTypeId(e.target.value)}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— Select type —</option>
                    {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.learner_count} learners)</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">
                    Select Learners ({enrollUserIds.length} selected)
                  </label>
                  <div className="max-h-52 overflow-y-auto border border-cortex-border rounded-lg divide-y divide-cortex-border">
                    {allLearners.map(l => (
                      <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-cortex-bg cursor-pointer">
                        <input type="checkbox" checked={enrollUserIds.includes(l.id)}
                          onChange={e => {
                            if (e.target.checked) setEnrollUserIds(p => [...p, l.id]);
                            else setEnrollUserIds(p => p.filter(id => id!==l.id));
                          }} className="accent-cortex-accent" />
                        <div>
                          <div className="text-sm text-cortex-text">{l.display_name || l.email}</div>
                          <div className="text-xs text-cortex-muted">{l.learner_type || l.email}</div>
                        </div>
                      </label>
                    ))}
                    {allLearners.length === 0 && <div className="p-4 text-center text-cortex-muted text-sm">No learners found</div>}
                  </div>
                </div>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3">
                <button onClick={doEnroll}
                  disabled={saving || (enrollMode==='type' ? !enrollTypeId : enrollUserIds.length===0)}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Enrolling…' : 'Enroll'}
                </button>
                <button onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
