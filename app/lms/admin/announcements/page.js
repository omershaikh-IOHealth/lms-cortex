'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const EMPTY = { title: '', body: '', target_roles: [], target_org_id: '', is_active: true };
const ALL_ROLES = ['learner', 'trainer', 'support'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnnouncementsPage() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'new' | { ...row }
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const load = async () => {
    const d = await apiFetch('/api/lms/admin/announcements').then(r => r?.json());
    if (d) setItems(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setError(''); setModal('new'); };
  const openEdit = (row) => { setForm({ ...row, target_roles: row.target_roles || [], target_org_id: row.target_org_id || '' }); setError(''); setModal(row); };

  const save = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = modal !== 'new';
      const url    = isEdit ? `/api/lms/admin/announcements/${modal.id}` : '/api/lms/admin/announcements';
      const method = isEdit ? 'PATCH' : 'POST';
      const body   = { ...form, target_org_id: form.target_org_id || null };
      const r      = await apiFetch(url, { method, body: JSON.stringify(body) });
      const d      = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      setModal(null);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await apiFetch(`/api/lms/admin/announcements/${id}`, { method: 'DELETE' });
    await load();
  };

  const toggleRole = (role) => {
    setForm(p => ({
      ...p,
      target_roles: p.target_roles.includes(role)
        ? p.target_roles.filter(r => r !== role)
        : [...p.target_roles, role]
    }));
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">Announcements</h1>
          <p className="text-cortex-muted text-sm mt-0.5">Broadcast messages to learners, trainers, or all users</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cortex-accent text-white text-sm font-medium hover:opacity-90 transition">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Announcement
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-cortex-muted text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-cortex-muted opacity-40">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <div className="text-cortex-muted text-sm">No announcements yet.</div>
          <button onClick={openNew} className="mt-3 text-cortex-accent text-sm hover:underline">Create your first →</button>
        </div>
      ) : (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Audience</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {items.map(a => (
                <tr key={a.id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3">
                    <div className="font-medium text-cortex-text">{a.title}</div>
                    {a.body && <div className="text-xs text-cortex-muted truncate max-w-xs mt-0.5">{a.body}</div>}
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">
                    {!a.target_roles ? 'All roles' : a.target_roles.join(', ')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-green-500/10 text-green-500' : 'bg-cortex-border text-cortex-muted'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{fmtDate(a.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(a)} className="text-xs text-cortex-accent hover:underline">Edit</button>
                      <button onClick={() => del(a.id)} className="text-xs text-cortex-danger hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-cortex-surface border border-cortex-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">{modal === 'new' ? 'New Announcement' : 'Edit Announcement'}</h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text text-xl leading-none">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-cortex-muted mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent transition"
                  placeholder="e.g. New compliance training available" />
              </div>
              <div>
                <label className="block text-xs font-medium text-cortex-muted mb-1">Body</label>
                <textarea value={form.body || ''} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  rows={3} className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm resize-none focus:outline-none focus:border-cortex-accent transition"
                  placeholder="Optional longer message…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-cortex-muted mb-2">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, target_roles: [] }))}
                    className={`text-xs px-3 py-1 rounded-full border transition ${form.target_roles.length === 0 ? 'border-cortex-accent bg-cortex-accent/10 text-cortex-accent' : 'border-cortex-border text-cortex-muted hover:border-cortex-muted'}`}>
                    All users
                  </button>
                  {ALL_ROLES.map(role => (
                    <button key={role} type="button"
                      onClick={() => toggleRole(role)}
                      className={`text-xs px-3 py-1 rounded-full border transition capitalize ${form.target_roles.includes(role) ? 'border-cortex-accent bg-cortex-accent/10 text-cortex-accent' : 'border-cortex-border text-cortex-muted hover:border-cortex-muted'}`}>
                      {role}s
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="rounded accent-cortex-accent" />
                  <span className="text-sm text-cortex-text">Active (visible to users)</span>
                </label>
              </div>
              {error && <div className="text-cortex-danger text-xs bg-cortex-danger/10 border border-cortex-danger rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-cortex-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition">
                  {saving ? 'Saving…' : modal === 'new' ? 'Create' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border border-cortex-border text-cortex-muted text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
