// frontend/app/lms/trainer/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

const STATUS_STYLES = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ongoing:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const ATTEND_STYLES = {
  enrolled: 'bg-cortex-border text-cortex-muted',
  present:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  absent:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  : '';

const EMPTY_FORM = { title: '', description: '', location: '', scheduled_date: '', start_time: '', end_time: '', max_capacity: '' };

export default function TrainerPage() {
  const [sessions, setSessions]         = useState([]);
  const [selected, setSelected]         = useState(null);
  const [enrollments, setEnrollments]   = useState([]);
  const [learnerTypes, setLearnerTypes] = useState([]);
  const [allLearners, setAllLearners]   = useState([]);

  const [modal, setModal]               = useState(null); // 'create'|'edit'|'enroll'
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [enrollMode, setEnrollMode]     = useState('type');
  const [enrollTypeId, setEnrollTypeId] = useState('');
  const [enrollUserIds, setEnrollUserIds] = useState([]);
  const [saving, setSaving]             = useState(false);
  const [attendSaving, setAttendSaving] = useState({});
  const [error, setError]               = useState('');

  // ── loaders ───────────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    const d = await apiFetch('/api/trainer/sessions').then(r => r?.json()).catch(() => []);
    const list = Array.isArray(d) ? d : [];
    setSessions(list);
    setSelected(prev => prev ? (list.find(s => s.id === prev.id) || prev) : null);
  }, []);

  const loadEnrollments = useCallback(async (id) => {
    const d = await apiFetch(`/api/trainer/sessions/${id}/enrollments`).then(r => r?.json()).catch(() => []);
    setEnrollments(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => {
    loadSessions();
    apiFetch('/api/trainer/learner-types').then(r => r?.json()).then(d => { if (Array.isArray(d)) setLearnerTypes(d); }).catch(() => {});
    apiFetch('/api/trainer/learners').then(r => r?.json()).then(d => { if (Array.isArray(d)) setAllLearners(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) loadEnrollments(selected.id);
    else setEnrollments([]);
  }, [selected?.id]);

  // ── session CRUD ──────────────────────────────────────────────────────────

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal('create'); };
  const openEdit   = () => {
    if (!selected) return;
    setForm({
      title:          selected.title,
      description:    selected.description || '',
      location:       selected.location || '',
      scheduled_date: selected.scheduled_date?.slice(0, 10) || '',
      start_time:     selected.start_time || '',
      end_time:       selected.end_time || '',
      max_capacity:   selected.max_capacity || '',
    });
    setError(''); setModal('edit');
  };

  const saveSession = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = modal === 'edit';
      const url    = isEdit ? `/api/trainer/sessions/${selected.id}` : '/api/trainer/sessions';
      const r      = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to save');
      if (!isEdit) setSelected(data);
      setModal(null);
      await loadSessions();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // ── enrollment ────────────────────────────────────────────────────────────

  const doEnroll = async () => {
    setError(''); setSaving(true);
    try {
      const body = enrollMode === 'type'
        ? { learner_type_id: Number(enrollTypeId) }
        : { user_ids: enrollUserIds };
      const r = await apiFetch(`/api/trainer/sessions/${selected.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Enrollment failed');
      setModal(null); setEnrollTypeId(''); setEnrollUserIds([]);
      await Promise.all([loadSessions(), loadEnrollments(selected.id)]);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const removeEnrollment = async (userId) => {
    await apiFetch(`/api/trainer/sessions/${selected.id}/enrollments/${userId}`, { method: 'DELETE' });
    await Promise.all([loadSessions(), loadEnrollments(selected.id)]);
  };

  // ── attendance ────────────────────────────────────────────────────────────

  const markAttendance = async (userId, status) => {
    setAttendSaving(p => ({ ...p, [userId]: true }));
    await apiFetch(`/api/trainer/sessions/${selected.id}/attendance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendances: [{ user_id: userId, status }] }),
    });
    await Promise.all([loadEnrollments(selected.id), loadSessions()]);
    setAttendSaving(p => ({ ...p, [userId]: false }));
  };

  const markAll = async (status) => {
    const attendances = enrollments.map(e => ({ user_id: e.user_id, status }));
    await apiFetch(`/api/trainer/sessions/${selected.id}/attendance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendances }),
    });
    await Promise.all([loadEnrollments(selected.id), loadSessions()]);
  };

  // ── render ────────────────────────────────────────────────────────────────

  const canEdit = selected && selected.status !== 'cancelled' && selected.status !== 'completed';
  const canMark = selected && (selected.status === 'ongoing' || selected.status === 'completed');

  return (
    <div className="flex h-full">

      {/* ── Session list ──────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
        <div className="p-4 border-b border-cortex-border flex items-center justify-between">
          <h1 className="font-semibold text-cortex-text text-sm">My Sessions</h1>
          <button onClick={openCreate}
            className="bg-cortex-accent text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition font-medium">
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 && (
            <div className="text-cortex-muted text-sm text-center py-12">No sessions yet</div>
          )}
          {sessions.map(s => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                selected?.id === s.id
                  ? 'border-cortex-accent bg-cortex-accent/5'
                  : 'border-cortex-border bg-cortex-bg hover:border-cortex-muted/50'
              }`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-cortex-text text-sm font-medium leading-tight line-clamp-2">{s.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[s.status]}`}>
                  {s.status}
                </span>
              </div>
              <div className="text-cortex-muted text-xs">{fmt(s.scheduled_date)}</div>
              <div className="text-cortex-muted text-xs">{s.start_time} – {s.end_time}</div>
              {s.location && <div className="text-cortex-muted text-xs truncate">📍 {s.location}</div>}
              <div className="flex gap-3 mt-2 text-xs text-cortex-muted">
                <span>👥 {s.enrolled_count}</span>
                {(s.present_count > 0 || s.absent_count > 0) && <>
                  <span className="text-green-600">✓ {s.present_count}</span>
                  <span className="text-red-500">✗ {s.absent_count}</span>
                </>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-5xl mb-3">📅</div>
              <div className="text-sm">Select a session or create a new one</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-cortex-text">{selected.title}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="text-cortex-muted text-sm">
                  {fmt(selected.scheduled_date)} · {selected.start_time} – {selected.end_time}
                  {selected.location && <> · 📍 {selected.location}</>}
                </div>
                {selected.description && <div className="text-cortex-muted text-sm mt-2">{selected.description}</div>}
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                {canEdit && (
                  <>
                    <button onClick={openEdit}
                      className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-text hover:bg-cortex-bg transition">
                      Edit
                    </button>
                    <button onClick={() => { setEnrollMode('type'); setEnrollTypeId(''); setEnrollUserIds([]); setError(''); setModal('enroll'); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 transition">
                      + Add Learners
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Enrolled', value: selected.enrolled_count || 0, color: 'text-cortex-text' },
                { label: 'Present',  value: selected.present_count  || 0, color: 'text-green-600' },
                { label: 'Absent',   value: selected.absent_count   || 0, color: 'text-red-500' },
              ].map(m => (
                <div key={m.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-xs text-cortex-muted mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Attendance table */}
            <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-cortex-border flex items-center justify-between">
                <h3 className="font-semibold text-cortex-text text-sm">Attendance ({enrollments.length})</h3>
                {enrollments.length > 0 && canMark && (
                  <div className="flex gap-2">
                    <button onClick={() => markAll('present')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:opacity-80 transition">
                      All Present
                    </button>
                    <button onClick={() => markAll('absent')}
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
                  {enrollments.map(e => (
                    <div key={e.user_id} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {(e.display_name || e.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-cortex-text truncate">{e.display_name || e.email}</div>
                        <div className="text-xs text-cortex-muted flex gap-2 flex-wrap">
                          <span>{e.email}</span>
                          {e.learner_type_name && <span>· {e.learner_type_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ATTEND_STYLES[e.attendance_status] || ATTEND_STYLES.enrolled}`}>
                          {e.attendance_status || 'enrolled'}
                        </span>
                        {canMark && (
                          <>
                            <button disabled={attendSaving[e.user_id] || e.attendance_status === 'present'}
                              onClick={() => markAttendance(e.user_id, 'present')}
                              className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 disabled:opacity-40 hover:opacity-80 transition">
                              ✓
                            </button>
                            <button disabled={attendSaving[e.user_id] || e.attendance_status === 'absent'}
                              onClick={() => markAttendance(e.user_id, 'absent')}
                              className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 disabled:opacity-40 hover:opacity-80 transition">
                              ✗
                            </button>
                          </>
                        )}
                        {canEdit && (
                          <button onClick={() => removeEnrollment(e.user_id)}
                            className="text-xs px-2 py-1 rounded-lg text-cortex-muted hover:text-red-500 transition">
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════ MODALS ════════════════════════════════════════════════════════ */}

      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">
                {modal === 'create' ? 'New Training Session' : 'Edit Session'}
              </h2>
            </div>
            <form onSubmit={saveSession} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="e.g. RCM Module – Doctors Batch A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Date *</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Max Capacity</label>
                  <input type="number" value={form.max_capacity} onChange={e => setForm(p => ({ ...p, max_capacity: e.target.value }))} min="1"
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Start Time *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">End Time *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Location</label>
                <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="e.g. Training Room 3, Building B" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Description / Notes</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none"
                  placeholder="Additional details for attendees…" />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : modal === 'create' ? 'Create Session' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'enroll' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Add Learners</h2>
              <p className="text-xs text-cortex-muted mt-0.5">{selected?.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                {['type', 'individual'].map(m => (
                  <button key={m} onClick={() => setEnrollMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm transition ${
                      enrollMode === m ? 'bg-cortex-accent text-white' : 'border border-cortex-border text-cortex-muted hover:bg-cortex-bg'
                    }`}>
                    {m === 'type' ? 'By Learner Type' : 'Individual'}
                  </button>
                ))}
              </div>
              {enrollMode === 'type' ? (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                  <select value={enrollTypeId} onChange={e => setEnrollTypeId(e.target.value)}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— Select type —</option>
                    {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.learner_count} learners)</option>)}
                  </select>
                  <p className="text-xs text-cortex-muted mt-1.5">All active learners of this type will be enrolled.</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">
                    Select Learners ({enrollUserIds.length} selected)
                  </label>
                  <div className="max-h-52 overflow-y-auto border border-cortex-border rounded-lg divide-y divide-cortex-border">
                    {allLearners.map(l => (
                      <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-cortex-bg cursor-pointer">
                        <input type="checkbox" checked={enrollUserIds.includes(l.id)}
                          onChange={e => {
                            if (e.target.checked) setEnrollUserIds(p => [...p, l.id]);
                            else setEnrollUserIds(p => p.filter(id => id !== l.id));
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
                  disabled={saving || (enrollMode === 'type' ? !enrollTypeId : enrollUserIds.length === 0)}
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