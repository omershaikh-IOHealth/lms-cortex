// frontend/app/lms/admin/learners/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

const EMPTY_LEARNER = { email: '', password: '', display_name: '', learner_type_id: '' };
const EMPTY_TRAINER = { email: '', password: '', display_name: '' };

export default function LearnersPage() {
  const [tab, setTab]           = useState('learners'); // 'learners' | 'trainers'

  // learners state
  const [learners, setLearners] = useState([]);
  const [types, setTypes]       = useState([]);

  // trainers state
  const [trainers, setTrainers] = useState([]);

  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // modal state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(EMPTY_LEARNER);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = async () => {
    setLoading(true);
    const [l, t, tr] = await Promise.all([
      apiFetch('/api/lms/admin/learners').then(r => r?.json()).catch(() => []),
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()).catch(() => []),
      apiFetch('/api/lms/admin/learners/trainers').then(r => r?.json()).catch(() => []),
    ]);
    if (Array.isArray(l))  setLearners(l);
    if (Array.isArray(t))  setTypes(t.filter(x => x.is_active));
    if (Array.isArray(tr)) setTrainers(tr);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(tab === 'trainers' ? EMPTY_TRAINER : EMPTY_LEARNER);
    setError('');
    setShowForm(true);
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setForm(tab === 'trainers'
      ? { email: u.email, password: '', display_name: u.display_name || '', is_active: u.is_active }
      : { email: u.email, password: '', display_name: u.display_name || '', learner_type_id: u.learner_type_id || '', is_active: u.is_active }
    );
    setError('');
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isTrainer = tab === 'trainers';
      const isEdit    = !!editId;

      let url, body;
      if (isTrainer) {
        url  = isEdit ? `/api/lms/admin/learners/trainers/${editId}` : '/api/lms/admin/learners/trainers';
        body = isEdit
          ? { display_name: form.display_name, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) }
          : { email: form.email, password: form.password, display_name: form.display_name };
      } else {
        url  = isEdit ? `/api/lms/admin/learners/${editId}` : '/api/lms/admin/learners';
        body = isEdit
          ? { display_name: form.display_name, learner_type_id: form.learner_type_id, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) }
          : { email: form.email, password: form.password, display_name: form.display_name, learner_type_id: form.learner_type_id };
      }

      const res  = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const filtered = (tab === 'trainers' ? trainers : learners).filter(u =>
    !search || (u.email + (u.display_name || '') + (u.learner_type || '')).toLowerCase().includes(search.toLowerCase())
  );

  const isTrainerTab = tab === 'trainers';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">Users</h1>
          <p className="text-cortex-muted text-sm mt-0.5">
            {tab === 'learners' ? `${learners.length} learners` : `${trainers.length} trainers`}
          </p>
        </div>
        <button onClick={openCreate}
          className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
          + Add {isTrainerTab ? 'Trainer' : 'Learner'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-cortex-surface border border-cortex-border rounded-lg p-1 w-fit">
        {[
          { key: 'learners', label: 'Learners' },
          { key: 'trainers', label: 'Trainers' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? 'bg-cortex-accent text-white shadow-sm' : 'text-cortex-muted hover:text-cortex-text'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${isTrainerTab ? 'trainers' : 'learners'}…`}
          className="w-full max-w-sm bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
      </div>

      {/* Table */}
      <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cortex-bg">
            <tr className="text-left text-xs text-cortex-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              {!isTrainerTab && <th className="px-5 py-3 font-medium">Type</th>}
              {isTrainerTab  && <th className="px-5 py-3 font-medium">Sessions</th>}
              <th className="px-5 py-3 font-medium">Status</th>
              {!isTrainerTab && <th className="px-5 py-3 font-medium">Completed</th>}
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cortex-border">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-cortex-muted">No {isTrainerTab ? 'trainers' : 'learners'} found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="hover:bg-cortex-bg transition">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cortex-accent/20 text-cortex-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {(u.display_name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-cortex-text">{u.display_name || '—'}</div>
                      <div className="text-xs text-cortex-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                {!isTrainerTab && <td className="px-5 py-3 text-cortex-muted">{u.learner_type || '—'}</td>}
                {isTrainerTab  && <td className="px-5 py-3 text-cortex-muted">{u.session_count ?? 0} sessions</td>}
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-500'
                  }`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {!isTrainerTab && (
                  <td className="px-5 py-3 text-cortex-muted">{u.completed_lessons ?? 0} lessons</td>
                )}
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!isTrainerTab && (
                      <Link href={`/lms/admin/learners/${u.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg text-cortex-accent border border-cortex-accent/30 hover:bg-cortex-accent/10 transition">
                        Profile
                      </Link>
                    )}
                    <button onClick={() => startEdit(u)}
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
              <h2 className="font-semibold text-cortex-text">
                {editId ? `Edit ${isTrainerTab ? 'Trainer' : 'Learner'}` : `Add ${isTrainerTab ? 'Trainer' : 'Learner'}`}
              </h2>
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
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">
                  {editId ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required={!editId}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              {!isTrainerTab && (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type {!editId && '*'}</label>
                  <select value={form.learner_type_id} onChange={e => setForm(p => ({ ...p, learner_type_id: e.target.value }))}
                    required={!editId}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— None —</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {editId && (
                <label className="flex items-center gap-2 text-sm text-cortex-text cursor-pointer">
                  <input type="checkbox" checked={!!form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="accent-cortex-accent" />
                  Active
                </label>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : editId ? 'Save Changes' : `Create ${isTrainerTab ? 'Trainer' : 'Learner'}`}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
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