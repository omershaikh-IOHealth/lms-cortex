// app/lms/trainer/messages/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const isPast = (s) => new Date(s.scheduled_date) < new Date(new Date().toDateString());

export default function TrainerMessagesPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);
  const pollRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/lms/trainer/sessions').then(r => r?.json());
    if (d) setSessions(d);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (id) => {
    const d = await apiFetch(`/api/lms/sessions/${id}/messages`).then(r => r?.json());
    if (Array.isArray(d)) {
      setMessages(d);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!selected) return;
    setChatLoading(true);
    loadMessages(selected.id).finally(() => setChatLoading(false));
    pollRef.current = setInterval(() => loadMessages(selected.id), 10_000);
    return () => clearInterval(pollRef.current);
  }, [selected?.id]);

  const sendMessage = async () => {
    if (!chatInput.trim() || chatSending || !selected) return;
    setChatSending(true);
    await apiFetch(`/api/lms/sessions/${selected.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: chatInput.trim() })
    });
    setChatInput('');
    await loadMessages(selected.id);
    setChatSending(false);
  };

  if (loading) return (
    <div className="p-8 text-cortex-muted flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
      Loading…
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Session list */}
      <div className="w-72 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="p-4 border-b border-cortex-border">
          <h1 className="font-semibold text-cortex-text text-sm">Session Messages</h1>
          <p className="text-xs text-cortex-muted mt-0.5">Chat with session participants</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 && (
            <div className="text-cortex-muted text-sm text-center py-12">No sessions yet</div>
          )}
          {sessions.map(s => {
            const past = isPast(s);
            return (
              <button key={s.id} onClick={() => { setSelected(s); setChatInput(''); }}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected?.id === s.id ? 'border-cortex-accent bg-cortex-accent/5' : 'border-cortex-border bg-cortex-bg hover:border-cortex-muted/50'
                } ${past ? 'opacity-60' : ''}`}>
                <div className="text-cortex-text text-sm font-medium line-clamp-2">{s.title}</div>
                <div className="text-cortex-muted text-xs mt-0.5">{fmt(s.scheduled_date)}</div>
                <div className="text-cortex-muted text-xs">{s.start_time} – {s.end_time}</div>
                {past && <span className="text-[10px] text-cortex-muted mt-1 block">Past session</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <div className="text-sm">Select a session to open chat</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 px-6 py-4 border-b border-cortex-border bg-cortex-surface">
              <h2 className="font-semibold text-cortex-text">{selected.title}</h2>
              <div className="text-xs text-cortex-muted">{fmt(selected.scheduled_date)} · {selected.start_time} – {selected.end_time}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {chatLoading ? (
                <div className="flex items-center justify-center h-full text-cortex-muted text-sm">
                  <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin mr-2" />
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-cortex-muted text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-cortex-accent text-white' : 'bg-cortex-surface border border-cortex-border text-cortex-text'}`}>
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

            <div className="flex-shrink-0 px-6 py-4 border-t border-cortex-border bg-cortex-surface flex gap-3">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              <button onClick={sendMessage} disabled={!chatInput.trim() || chatSending}
                className="px-5 py-2 bg-cortex-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                {chatSending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
