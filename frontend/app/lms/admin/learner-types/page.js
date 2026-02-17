// frontend/app/lms/admin/learner-types/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function LearnerTypesPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch('/api/lms/admin/learner-types')
      .then(r => r?.json()).then(d => { if (d) setTypes(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const url = editId ? `/api/lms/admin/learner-types/${editId}` : '/api/lms/admin/learner-types';
      const res = await apiFetch(url, { method, body: JSON.stringify(form) });
      const data = await res.json();
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
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">Learner Types</h1>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">{editId ? 'Edit Type' : 'Add New Type'}</h2>
        <form onSubmit={save} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. Doctor" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Optional description" />
          </div>
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm({ name: '', description: '' }); }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
              Cancel
            </button>
          )}
        </form>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      </div>

      {/* List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-right px-5 py-3">Learners</th>
                <th className="text-right px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50">
                  <td className="px-5 py-3 text-white font-medium">{t.name}</td>
                  <td className="px-5 py-3 text-gray-400">{t.description || '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{t.learner_count}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => startEdit(t)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                    <button onClick={() => toggleActive(t)} className="text-gray-400 hover:text-gray-300 text-xs">
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {!types.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No learner types yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
