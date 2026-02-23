// app/lms/admin/users/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

const ROLE_STYLES = {
  admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  training: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  trainer:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  learner:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  support:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const STATUS_STYLES = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  rejected: 'bg-red-100 text-red-500',
};

const EMPTY_FORM = { email: '', display_name: '', password: '', role: 'learner' };
const EMPTY_APPROVE = { role: 'learner', learner_type_id: '' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [learnerTypes, setLearnerTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // 'pending' | 'all'
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState(null); // 'add' | 'approve' | 'role'
  const [targetUser, setTargetUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [approveForm, setApproveForm] = useState(EMPTY_APPROVE);
  const [roleForm, setRoleForm] = useState({ role: '', is_active: true, can_upload_content: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [usersData, typesData] = await Promise.all([
      apiFetch('/api/lms/admin/users').then(r => r?.json()),
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
    ]);
    if (usersData) setUsers(usersData);
    if (typesData) setLearnerTypes(typesData.filter(t => t.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingUsers = users.filter(u => u.registration_status === 'pending');
  const filteredAll = users
    .filter(u => u.registration_status !== 'pending')
    .filter(u => {
      const q = search.toLowerCase();
      return !q || (u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
    });

  const openApprove = (u) => {
    setTargetUser(u);
    setApproveForm({ role: 'learner', learner_type_id: '' });
    setError('');
    setModal('approve');
  };

  const openRole = (u) => {
    setTargetUser(u);
    setRoleForm({ role: u.role, is_active: u.is_active, can_upload_content: u.can_upload_content || false });
    setError('');
    setModal('role');
  };

  const handleApprove = async () => {
    setSaving(true); setError('');
    try {
      const r = await apiFetch(`/api/lms/admin/users/${targetUser.id}/approve`, {
        method: 'PUT', body: JSON.stringify(approveForm)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleReject = async (userId) => {
    if (!confirm('Reject this user request?')) return;
    await apiFetch(`/api/lms/admin/users/${userId}/reject`, { method: 'PUT', body: '{}' });
    await load();
  };

  const handleRole = async () => {
    setSaving(true); setError('');
    try {
      const r = await apiFetch(`/api/lms/admin/users/${targetUser.id}/role`, {
        method: 'PUT', body: JSON.stringify(roleForm)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const r = await apiFetch('/api/lms/admin/users', { method: 'POST', body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); setForm(EMPTY_FORM); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">User Management</h1>
          <p className="text-cortex-muted text-sm mt-0.5">Manage user accounts and registration requests</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setError(''); setModal('add'); }}
          className="bg-cortex-accent text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition font-medium">
          + Add User
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 mb-5 w-fit">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 ${tab === 'pending' ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
          Pending Requests
          {pendingUsers.length > 0 && (
            <span className="bg-yellow-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === 'all' ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
          All Users
        </button>
      </div>

      {loading ? (
        <div className="text-cortex-muted text-sm flex items-center gap-2 py-8">
          <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : tab === 'pending' ? (
        /* ── Pending Requests ── */
        pendingUsers.length === 0 ? (
          <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-sm">No pending registration requests</div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map(u => (
              <div key={u.id} className="bg-cortex-surface border border-cortex-border rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(u.display_name || u.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-cortex-text text-sm">{u.display_name || '—'}</div>
                  <div className="text-xs text-cortex-muted">{u.email}</div>
                  <div className="text-xs text-cortex-muted mt-0.5">Requested {fmt(u.created_at)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openApprove(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 transition font-medium">
                    Approve & Assign
                  </button>
                  <button onClick={() => handleReject(u.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── All Users ── */
        <>
          <div className="mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="w-full max-w-sm bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
          </div>
          <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cortex-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {filteredAll.map(u => (
                    <tr key={u.id} className="hover:bg-cortex-bg transition">
                      <td className="px-5 py-3">
                        <div className="font-medium text-cortex-text">{u.display_name || '—'}</div>
                        <div className="text-xs text-cortex-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${ROLE_STYLES[u.role] || 'bg-cortex-border text-cortex-muted'}`}>
                            {u.role}
                          </span>
                          {u.role === 'trainer' && u.can_upload_content && (
                            <span className="text-[10px] text-cortex-accent">↑ Can upload</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${u.is_active ? STATUS_STYLES.active : STATUS_STYLES.rejected}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-cortex-muted">{fmt(u.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openRole(u)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAll.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-cortex-muted text-sm">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Approve Modal ── */}
      {modal === 'approve' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Approve & Assign Role</h2>
              <p className="text-xs text-cortex-muted mt-0.5">{targetUser?.email}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role *</label>
                <select value={approveForm.role} onChange={e => setApproveForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="learner">Learner</option>
                  <option value="trainer">Trainer</option>
                  <option value="training">Training Staff</option>
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                </select>
              </div>
              {approveForm.role === 'learner' && (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                  <select value={approveForm.learner_type_id} onChange={e => setApproveForm(p => ({ ...p, learner_type_id: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— None —</option>
                    {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleApprove} disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Approving…' : '✓ Approve User'}
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

      {/* ── Role / Manage Modal ── */}
      {modal === 'role' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Manage User</h2>
              <p className="text-xs text-cortex-muted mt-0.5">{targetUser?.display_name || targetUser?.email}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role</label>
                <select value={roleForm.role} onChange={e => setRoleForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="learner">Learner</option>
                  <option value="trainer">Trainer</option>
                  <option value="training">Training Staff</option>
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2 border border-cortex-border rounded-lg px-4">
                <span className="text-sm text-cortex-text">Active Account</span>
                <button onClick={() => setRoleForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative w-10 h-5 rounded-full transition ${roleForm.is_active ? 'bg-cortex-accent' : 'bg-cortex-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${roleForm.is_active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {(roleForm.role === 'trainer') && (
                <div className="flex items-center justify-between py-2 border border-cortex-border rounded-lg px-4">
                  <div>
                    <span className="text-sm text-cortex-text">Allow Content Upload</span>
                    <p className="text-xs text-cortex-muted mt-0.5">Trainer can upload lessons and videos</p>
                  </div>
                  <button onClick={() => setRoleForm(p => ({ ...p, can_upload_content: !p.can_upload_content }))}
                    className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${roleForm.can_upload_content ? 'bg-cortex-accent' : 'bg-cortex-border'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${roleForm.can_upload_content ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleRole} disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : 'Save Changes'}
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

      {/* ── Add User Modal ── */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Add New User</h2>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Display Name</label>
                <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="Min. 6 characters" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role *</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="learner">Learner</option>
                  <option value="trainer">Trainer</option>
                  <option value="training">Training Staff</option>
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                </select>
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Creating…' : 'Create User'}
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
    </div>
  );
}
