// frontend/app/lms/admin/learner-types/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function LearnerTypesPage() {
  const [types, setTypes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ name: '', description: '' });
  const [editId, setEditId]   = useState(null);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const load = () =>
    apiFetch('/api/lms/admin/learner-types')
      .then(r => r?.json()).then(d => { if (d) setTypes(d); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const url    = editId ? `/api/lms/admin/learner-types/${editId}` : '/api/lms/admin/learner-types';
      const res    = await apiFetch(url, { method, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ name: '', description: '' }); setEditId(null);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const startEdit = (t) => {
    setEditId(t.id); setForm({ name: t.name, description: t.description || '' });
  };

  const toggleActive = async (t) => {
    await apiFetch(`/api/lms/admin/learner-types/${t.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !t.is_active })
    });
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-cortex-text mb-6">Learner Types</h1>

      {/* Form */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl p-5 mb-6">
        <h2 className="text-cortex-text font-semibold text-sm mb-4">{editId ? 'Edit Type' : 'Add New Type'}</h2>
        <form onSubmit={save} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="e.g. Doctors" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              placeholder="Optional description" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
              {saving ? 'Saving…' : editId ? 'Save' : 'Create'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ name: '', description: '' }); }}
                className="border border-cortex-border text-cortex-text px-4 py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                Cancel
              </button>
            )}
          </div>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* List */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cortex-bg">
            <tr className="text-left text-xs text-cortex-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 font-medium text-right">Learners</th>
              <th className="px-5 py-3 font-medium text-right">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cortex-border">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">Loading…</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">No learner types yet</td></tr>
            ) : types.map(t => (
              <tr key={t.id} className="hover:bg-cortex-bg transition">
                <td className="px-5 py-3 font-medium text-cortex-text">{t.name}</td>
                <td className="px-5 py-3 text-cortex-muted">{t.description || '—'}</td>
                <td className="px-5 py-3 text-cortex-muted text-right">{t.learner_count}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-500'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(t)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:bg-cortex-bg transition">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg transition ${t.is_active ? 'border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'border border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}