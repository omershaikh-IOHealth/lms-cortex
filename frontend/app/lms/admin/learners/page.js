// frontend/app/lms/admin/learners/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

export default function LearnersPage() {
  const [learners, setLearners] = useState([]);
  const [types, setTypes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ email: '', password: '', display_name: '', learner_type_id: '' });
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');

  const load = async () => {
    const [l, t] = await Promise.all([
      apiFetch('/api/lms/admin/learners').then(r => r?.json()),
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
    ]);
    if (l) setLearners(l);
    if (t) setTypes(t.filter(x => x.is_active));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = !!editId;
      const url  = isEdit ? `/api/lms/admin/learners/${editId}` : '/api/lms/admin/learners';
      const body = isEdit
        ? { display_name: form.display_name, learner_type_id: form.learner_type_id, is_active: form.is_active,
            ...(form.password ? { password: form.password } : {}) }
        : form;
      const res  = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false); setEditId(null);
      setForm({ email: '', password: '', display_name: '', learner_type_id: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const startEdit = (l) => {
    setEditId(l.id);
    setForm({ email: l.email, password: '', display_name: l.display_name || '', learner_type_id: l.learner_type_id || '', is_active: l.is_active });
    setShowForm(true);
  };

  const filtered = learners.filter(l =>
    !search || (l.email + (l.display_name || '') + (l.learner_type || '')).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">Learners</h1>
          <p className="text-cortex-muted text-sm mt-0.5">{learners.length} total learners</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ email: '', password: '', display_name: '', learner_type_id: '' }); }}
          className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
          + Add Learner
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or type…"
          className="w-full max-w-sm bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
      </div>

      {/* Table */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cortex-bg">
            <tr className="text-left text-xs text-cortex-muted">
              <th className="px-5 py-3 font-medium">Learner</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Completed</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cortex-border">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">No learners found</td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="hover:bg-cortex-bg transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {(l.display_name || l.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-cortex-text">{l.display_name || '—'}</div>
                      <div className="text-xs text-cortex-muted">{l.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-cortex-muted">{l.learner_type || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-500'}`}>
                    {l.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3 text-cortex-muted">
                  {l.completed_lessons ?? 0} lessons
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/lms/admin/learners/${l.id}`}
                      className="text-xs px-2.5 py-1 rounded-lg text-cortex-accent border border-cortex-accent/30 hover:bg-cortex-accent/10 transition">
                      Profile
                    </Link>
                    <button onClick={() => startEdit(l)}
                      className="text-xs px-2.5 py-1 rounded-lg text-cortex-muted border border-cortex-border hover:bg-cortex-bg transition">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">{editId ? 'Edit Learner' : 'Add Learner'}</h2>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              {!editId && (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Display Name</label>
                <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required={!editId}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                <select value={form.learner_type_id} onChange={e => setForm(p => ({ ...p, learner_type_id: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="">— None —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {editId && (
                <label className="flex items-center gap-2 text-sm text-cortex-text cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-cortex-accent" />
                  Active
                </label>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Learner'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
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