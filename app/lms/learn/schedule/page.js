// frontend/app/lms/learn/schedule/page.js
'use client';
import { useEffect, useState, useRef } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';
import NewBadge from '@/components/NewBadge';

const STATUS_STYLES = {
  scheduled: { dot: 'bg-blue-500',    label: 'Upcoming',       pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ongoing:   { dot: 'bg-yellow-500',  label: 'Happening Now',  pill: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { dot: 'bg-gray-400',    label: 'Completed',      pill: 'bg-cortex-border text-cortex-muted' },
  cancelled: { dot: 'bg-red-400',     label: 'Cancelled',      pill: 'bg-red-100 text-red-500' },
};

const ATTEND_LABEL = { enrolled: '—', present: '✓ Present', absent: '✗ Missed' };
const ATTEND_STYLE = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  absent:  'bg-red-100 text-red-500',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const isPast   = (s) => new Date(s.scheduled_date) < new Date(new Date().toDateString());

const needsAck = (s) =>
  !s.acknowledged_at ||
  (s.last_session_updated_at && new Date(s.acknowledged_at) < new Date(s.last_session_updated_at));

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              fill={(hover || value) >= star ? '#f59e0b' : 'none'}
              stroke={(hover || value) >= star ? '#f59e0b' : 'currentColor'}
              className={(hover || value) >= star ? '' : 'text-cortex-border'}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ─── Inline Feedback Panel ────────────────────────────────────────────────────
function InlineFeedbackPanel({ session, existing, onSubmitted, onClose }) {
  const [rating,      setRating]      = useState(existing?.rating  || 0);
  const [comment,     setComment]     = useState(existing?.comment  || '');
  const [reqType,     setReqType]     = useState(existing?.request_type || '');
  const [reqDetail,   setReqDetail]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  const submit = async () => {
    if (!rating) { setError('Please select a rating first.'); return; }
    setSaving(true); setError('');
    try {
      const r = await apiFetch('/api/lms/feedback', {
        method: 'POST',
        body: JSON.stringify({
          reference_type: 'session',
          reference_id: session.session_id,
          rating, comment,
          request_type: reqType || null,
          request_detail: reqDetail || null,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSubmitted(true);
      onSubmitted(session.session_id, rating, reqType);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (submitted) {
    return (
      <div className="bg-cortex-bg border border-cortex-border rounded-xl p-4 text-center">
        <div className="text-green-500 text-lg mb-1">✓ Thank you for your feedback!</div>
        <div className="text-amber-500 text-sm">{'★'.repeat(rating)}{'☆'.repeat(5-rating)}</div>
      </div>
    );
  }

  return (
    <div className="bg-cortex-bg border border-cortex-border rounded-xl p-4 space-y-4">
      {/* Rating */}
      <div>
        <div className="text-xs font-semibold text-cortex-muted mb-2">How was this session?</div>
        <div className="flex items-center gap-3">
          <StarRating value={rating} onChange={setRating} size={28} />
          {rating > 0 && <span className="text-sm font-medium text-amber-500">{labels[rating]}</span>}
        </div>
      </div>

      {/* Comment box */}
      <div>
        <div className="text-xs font-semibold text-cortex-muted mb-1.5">Comments</div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Share your thoughts, suggestions, or anything helpful for the trainer…"
          className="w-full bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none"
        />
        <div className="text-[11px] text-cortex-muted text-right">{comment.length}/1000</div>
      </div>

      {/* Request section */}
      <div>
        <div className="text-xs font-semibold text-cortex-muted mb-2">Send a Request <span className="font-normal">(optional)</span></div>
        <div className="flex gap-2 flex-wrap mb-2">
          {[['new_video','📹 New Video'],['clarification','❓ Clarification'],['new_feature','✨ New Feature']].map(([v,l]) => (
            <button key={v} type="button"
              onClick={() => setReqType(reqType === v ? '' : v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                reqType === v
                  ? 'bg-cortex-accent text-white border-cortex-accent'
                  : 'border-cortex-border text-cortex-muted hover:border-cortex-accent hover:text-cortex-accent'
              }`}>
              {l}
            </button>
          ))}
        </div>
        {reqType && (
          <textarea
            value={reqDetail}
            onChange={e => setReqDetail(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              reqType === 'new_video' ? "Describe what topic or content you'd like a video on…" :
              reqType === 'clarification' ? "What needs more explanation or detail?" :
              "Describe the feature or improvement you'd like to see…"
            }
            className="w-full bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none"
          />
        )}
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !rating}
          className="flex-1 px-4 py-2 bg-cortex-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
          {saving ? 'Submitting…' : 'Submit Feedback'}
        </button>
        <button onClick={onClose}
          className="px-4 py-2 border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface rounded-lg text-sm transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [acking, setAcking]     = useState({});
  const [filter, setFilter]     = useState('upcoming');
  const [topicFilter, setTopicFilter] = useState('');

  // Feedback state
  const [openFeedback, setOpenFeedback] = useState(new Set()); // set of session_ids with open panel
  const [myFeedback,   setMyFeedback]   = useState({});        // { [sessionId]: { rating } }

  // Chat state per session
  const [openChat, setOpenChat] = useState(null); // session_id
  const [messages, setMessages] = useState({});   // { [sessionId]: [] }
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatPollRef = useRef(null);
  const chatBottomRef = useRef(null);

  const load = () =>
    apiFetch('/api/lms/me/schedule').then(r => r?.json()).then(d => { if (d) setSessions(d); }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // Load my feedback for past-attended sessions after sessions load
  useEffect(() => {
    const presentPast = sessions.filter(s => isPast(s) && s.attendance_status === 'present');
    if (presentPast.length === 0) return;
    Promise.all(
      presentPast.map(s =>
        apiFetch(`/api/lms/feedback?reference_type=session&reference_id=${s.session_id}`)
          .then(r => r?.json())
          .then(d => d ? [s.session_id, d] : null)
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { if (r) map[r[0]] = r[1]; });
      setMyFeedback(map);
    });
  }, [sessions]);

  const acknowledge = async (sessionId) => {
    setAcking(p => ({ ...p, [sessionId]: 'acking' }));
    await apiFetch(`/api/lms/me/schedule/${sessionId}/acknowledge`, { method: 'PATCH', body: JSON.stringify({}) });
    await load();
    setAcking(p => ({ ...p, [sessionId]: false }));
  };

  const unacknowledge = async (sessionId) => {
    setAcking(p => ({ ...p, [sessionId]: 'unacking' }));
    await apiFetch(`/api/lms/me/schedule/${sessionId}/acknowledge`, { method: 'DELETE' });
    await load();
    setAcking(p => ({ ...p, [sessionId]: false }));
  };

  const loadChatMessages = async (sessionId) => {
    const d = await apiFetch(`/api/lms/sessions/${sessionId}/messages`).then(r => r?.json());
    if (Array.isArray(d)) {
      setMessages(p => ({ ...p, [sessionId]: d }));
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const toggleChat = (sessionId) => {
    clearInterval(chatPollRef.current);
    if (openChat === sessionId) {
      setOpenChat(null);
    } else {
      setOpenChat(sessionId);
      setChatInput('');
      loadChatMessages(sessionId);
      chatPollRef.current = setInterval(() => loadChatMessages(sessionId), 10_000);
    }
  };

  useEffect(() => () => clearInterval(chatPollRef.current), []);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatSending || !openChat) return;
    setChatSending(true);
    await apiFetch(`/api/lms/sessions/${openChat}/messages`, {
      method: 'POST', body: JSON.stringify({ message: chatInput.trim() })
    });
    setChatInput('');
    await loadChatMessages(openChat);
    setChatSending(false);
  };

  const handleFeedbackSubmitted = (sessionId, rating, reqType) => {
    setMyFeedback(p => ({ ...p, [sessionId]: { rating, request_type: reqType } }));
    // Keep panel open to show the "thank you" state, then auto-close after 2s
    setTimeout(() => setOpenFeedback(p => { const n = new Set(p); n.delete(sessionId); return n; }), 2000);
  };

  const toggleFeedback = (sessionId) => setOpenFeedback(p => {
    const n = new Set(p);
    n.has(sessionId) ? n.delete(sessionId) : n.add(sessionId);
    return n;
  });

  const filtered = sessions.filter(s => {
    const past = isPast(s);
    if (filter === 'upcoming' && (s.session_status === 'cancelled' || past)) return false;
    if (filter === 'past'     && !(s.session_status === 'completed' || past)) return false;
    if (topicFilter.trim()) {
      const q = topicFilter.toLowerCase();
      if (!s.title?.toLowerCase().includes(q) && !s.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const upcomingCount  = sessions.filter(s => s.session_status !== 'cancelled' && !isPast(s)).length;
  const unacknowledged = sessions.filter(s => !isPast(s) && s.session_status === 'scheduled' && needsAck(s)).length;

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

      {unacknowledged > 0 && (
        <div className="bg-cortex-accent/10 border border-cortex-accent/30 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <div className="text-sm font-semibold text-cortex-text">
              {unacknowledged} session{unacknowledged > 1 ? 's' : ''} need{unacknowledged === 1 ? 's' : ''} your acknowledgement
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

      {/* Filter tabs + topic search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1">
          {[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-1.5 rounded-lg text-sm transition ${filter === v ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-cortex-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            placeholder="Filter by topic…"
            className="w-full bg-cortex-surface border border-cortex-border rounded-xl pl-8 pr-3 py-1.5 text-sm text-cortex-text placeholder:text-cortex-muted focus:outline-none focus:border-cortex-accent"
          />
          {topicFilter && (
            <button onClick={() => setTopicFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-cortex-muted hover:text-cortex-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
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
            const st          = STATUS_STYLES[s.session_status] || STATUS_STYLES.scheduled;
            const past        = isPast(s);
            const needsAckNow = !past && needsAck(s);
            const isAcked     = !past && s.acknowledged_at && !needsAck(s);
            const chatOpen    = openChat === s.session_id;
            const sessionMsgs = messages[s.session_id] || [];
            const feedback    = myFeedback[s.session_id];
            const canRate     = past && s.attendance_status === 'present';

            return (
              <div key={s.session_id}>
                <div className={`bg-cortex-surface border rounded-2xl p-5 transition ${
                  past
                    ? 'border-cortex-border opacity-60'
                    : needsAckNow
                      ? 'border-cortex-accent ring-1 ring-cortex-accent/30'
                      : 'border-cortex-border'
                }`}
                  style={past ? { filter: 'blur(0.5px)' } : {}}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.pill}`}>{st.label}</span>
                        {/* Attendance badge for past sessions */}
                        {s.attendance_status !== 'enrolled' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ATTEND_STYLE[s.attendance_status] || 'bg-cortex-border text-cortex-muted'}`}>
                            {ATTEND_LABEL[s.attendance_status]}
                          </span>
                        )}
                        {/* Feedback star display */}
                        {canRate && feedback && (
                          <span className="text-xs flex items-center gap-1 text-amber-500 font-medium">
                            {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-cortex-text font-semibold text-base">{s.title}</h3>
                    </div>

                    {/* Acknowledge area — only for future sessions */}
                    {!past && (
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {needsAckNow && (
                          <button onClick={() => acknowledge(s.session_id)} disabled={!!acking[s.session_id]}
                            className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 disabled:opacity-50 transition font-medium animate-pulse">
                            {acking[s.session_id] === 'acking' ? '…' : '✓ Acknowledge'}
                          </button>
                        )}
                        {isAcked && (
                          <>
                            <span className="text-xs text-green-600 font-medium">✓ Acknowledged</span>
                            <button onClick={() => unacknowledge(s.session_id)} disabled={!!acking[s.session_id]}
                              className="text-[10px] text-cortex-muted hover:text-cortex-text underline transition">
                              {acking[s.session_id] === 'unacking' ? '…' : 'Undo'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`grid grid-cols-2 gap-x-6 gap-y-2 text-sm ${past ? 'pointer-events-none' : ''}`}>
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

                  {/* Inline feedback section — past attended sessions only */}
                  {canRate && (
                    <div className="mt-3 pt-3 border-t border-cortex-border space-y-2">
                      {!openFeedback.has(s.session_id) && (
                        <button onClick={() => toggleFeedback(s.session_id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                            feedback
                              ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                              : 'border-cortex-border text-cortex-muted hover:text-cortex-accent hover:border-cortex-accent hover:bg-cortex-bg'
                          }`}>
                          {feedback ? `★ Edit Rating (${feedback.rating}/5)` : '☆ Rate this session'}
                          <NewBadge description="New: Rate this session with stars, leave a comment, and submit requests for new videos or clarifications." />
                        </button>
                      )}
                      {openFeedback.has(s.session_id) && (
                        <InlineFeedbackPanel
                          session={s}
                          existing={feedback}
                          onSubmitted={handleFeedbackSubmitted}
                          onClose={() => toggleFeedback(s.session_id)}
                        />
                      )}
                    </div>
                  )}

                  {/* Google Meet + Calendar links — only for upcoming sessions */}
                  {!past && (s.google_meet_link || s.google_calendar_link) && (
                    <div className="mt-3 pt-3 border-t border-cortex-border flex gap-2 flex-wrap">
                      {s.google_meet_link && (
                        <a href={s.google_meet_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:opacity-80 transition font-medium">
                          📹 Join Meeting
                        </a>
                      )}
                      {s.google_calendar_link && (
                        <a href={s.google_calendar_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:bg-cortex-bg transition">
                          📅 Add to Calendar
                        </a>
                      )}
                    </div>
                  )}

                  {/* Chat button — only for upcoming sessions */}
                  {!past && (
                    <div className="mt-3 pt-3 border-t border-cortex-border">
                      <button onClick={() => toggleChat(s.session_id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition flex items-center gap-1.5">
                        💬 {chatOpen ? 'Hide Chat' : 'Session Chat'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Chat panel */}
                {chatOpen && !past && (
                  <div className="bg-cortex-surface border border-cortex-border border-t-0 rounded-b-2xl overflow-hidden flex flex-col" style={{ height: '320px' }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {sessionMsgs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-cortex-muted text-sm">No messages yet</div>
                      ) : (
                        sessionMsgs.map(m => {
                          const isMe = m.user_id === user?.id;
                          return (
                            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-cortex-accent text-white' : 'bg-cortex-bg border border-cortex-border text-cortex-text'}`}>
                                {!isMe && <div className="text-[11px] font-semibold mb-1 text-cortex-accent">{m.display_name || m.email}</div>}
                                <div className="text-sm">{m.message}</div>
                                <div className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-cortex-muted'}`}>
                                  {new Date(m.created_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
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
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
