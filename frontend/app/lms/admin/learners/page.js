// frontend/app/lms/admin/learners/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function LearnersPage() {
  const [learners, setLearners] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', learner_type_id: '' });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const isEdit = !!editId;
      const url = isEdit ? `/api/lms/admin/learners/${editId}` : '/api/lms/admin/learners';
      const body = isEdit
        ? { display_name: form.display_name, learner_type_id: form.learner_type_id, is_active: form.is_active,
            ...(form.password ? { password: form.password } : {}) }
        : form;
      const res = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
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

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Learners</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ email: '', password: '', display_name: '', learner_type_id: '' }); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          + Add Learner
        </button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-white font-semibold mb-4">{editId ? 'Edit Learner' : 'Add Learner'}</h2>
            <form onSubmit={save} className="space-y-3">
              {!editId && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Display Name</label>
                <input value={form.display_name} onChange={e => setForm(p=>({...p,display_name:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} {...(!editId && { required: true })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Learner Type *</label>
                <select value={form.learner_type_id} onChange={e => setForm(p=>({...p,learner_type_id:e.target.value}))} required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select type...</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-right px-5 py-3">Completed</th>
                <th className="text-right px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {learners.map(l => (
                <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white">{l.display_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-400">{l.email}</td>
                  <td className="px-5 py-3 text-gray-300">{l.learner_type_name || '—'}</td>
                  <td className="px-5 py-3 text-right text-green-400">{l.completed_lessons}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => startEdit(l)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                  </td>
                </tr>
              ))}
              {!learners.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No learners yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
