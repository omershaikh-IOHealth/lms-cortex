// frontend/components/NotificationBell.js
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

const TYPE_ICON = {
  physical_training_scheduled: '📅',
  training_reminder:           '⏰',
  lesson_assigned:             '📚',
};

export default function NotificationBell() {
  const [open, setOpen]    = useState(false);
  const [data, setData]    = useState({ notifications: [], unread: 0 });
  const dropdownRef        = useRef(null);
  const pollRef            = useRef(null);

  const fetchNotifs = useCallback(async () => {
    const r = await apiFetch('/api/lms/me/notifications');
    if (r?.ok) {
      const d = await r.json();
      setData(d);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    pollRef.current = setInterval(fetchNotifs, 30_000); // poll every 30s
    return () => clearInterval(pollRef.current);
  }, [fetchNotifs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAll = async () => {
    await apiFetch('/api/lms/me/notifications/read', { method: 'PATCH', body: JSON.stringify({}) });
    setData(d => ({ ...d, unread: 0, notifications: d.notifications.map(n => ({ ...n, is_read: true })) }));
  };

  const markOne = async (id) => {
    await apiFetch('/api/lms/me/notifications/read', { method: 'PATCH', body: JSON.stringify({ ids: [id] }) });
    setData(d => ({
      ...d,
      unread: Math.max(0, d.unread - 1),
      notifications: d.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
    }));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-cortex-border/50 text-cortex-muted hover:text-cortex-text transition"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-cortex-accent text-white text-[10px] font-bold rounded-full">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-cortex-surface border border-cortex-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cortex-border">
            <span className="text-sm font-semibold text-cortex-text">Notifications</span>
            {data.unread > 0 && (
              <button onClick={markAll} className="text-xs text-cortex-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {data.notifications.length === 0 ? (
              <div className="p-6 text-center text-cortex-muted text-sm">No notifications yet</div>
            ) : (
              data.notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-cortex-border last:border-0 flex gap-3 cursor-pointer hover:bg-cortex-bg transition ${!n.is_read ? 'bg-cortex-accent/5' : ''}`}
                  onClick={() => !n.is_read && markOne(n.id)}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${!n.is_read ? 'text-cortex-text' : 'text-cortex-muted'}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-cortex-muted mt-0.5 leading-snug line-clamp-2">{n.body}</div>
                    <div className="text-[10px] text-cortex-muted mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-cortex-accent flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}