// app/lms/admin/users/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth';
import BulkImportModal from '@/components/BulkImportModal';
import NewBadge from '@/components/NewBadge';

const ROLE_STYLES = {
  admin:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  trainer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  learner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  support: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const USER_BULK_COLUMNS = [
  { key: 'email',          label: 'Email',            required: true, placeholder: 'user@example.com',          minWidth: 180 },
  { key: 'display_name',   label: 'Display Name',     placeholder: 'Full name',                                 minWidth: 140 },
  { key: 'staff_id',       label: 'Staff ID',         placeholder: 'Optional',                                  minWidth: 100 },
  { key: 'role',           label: 'Role',             type: 'select', defaultValue: 'learner',
    options: ['admin','trainer','learner','support'],                                                  minWidth: 110 },
  { key: 'organization',   label: 'Organization',     placeholder: 'Exact org name',                            minWidth: 150 },
  { key: 'department',     label: 'Department',       placeholder: 'Exact dept name',                           minWidth: 140 },
  { key: 'sub_department', label: 'Sub-department',   placeholder: 'Exact sub-dept name',                       minWidth: 150 },
  { key: 'learner_type',   label: 'Learner Type',     placeholder: 'Learner role only',                         minWidth: 130 },
];

const USER_BULK_EXTRAS = [
  { key: 'default_password', label: 'Default Password:', type: 'password',
    placeholder: 'Used when password column is blank',
    hint: '(applies to rows without a password)' },
];

const USER_BULK_SAMPLE = ['jane@example.com', 'Jane Smith', 'EMP001', 'learner', 'General Hospital', 'Paediatrics', '', 'Nurse'];

const EMPTY_ADD = {
  email: '', display_name: '', password: '', role: 'learner', staff_id: '',
  company_id: '', department_id: '', sub_department_id: '', learner_type_id: '',
};
const EMPTY_APPROVE = { role: 'learner', learner_type_id: '' };

// ─── Reusable Toggle ──────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${value ? 'bg-cortex-accent' : 'bg-cortex-border'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users,        setUsers]        = useState([]);
  const [companies,    setCompanies]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [learnerTypes, setLearnerTypes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('pending');
  const [search,       setSearch]       = useState('');
  const [filterOrg,    setFilterOrg]    = useState('');
  const [filterRole,   setFilterRole]   = useState('');

  const [showBulk,        setShowBulk]        = useState(false);
  const [backfilling,     setBackfilling]     = useState(false);
  const [backfillResult,  setBackfillResult]  = useState(null);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showAddPw,     setShowAddPw]     = useState(false);
  const [showEditPw,    setShowEditPw]    = useState(false);
  const addPwTimer  = useRef(null);
  const editPwTimer = useRef(null);

  const togglePw = (get, set, timerRef) => {
    const next = !get;
    set(next);
    clearTimeout(timerRef.current);
    if (next) timerRef.current = setTimeout(() => set(false), 7000);
  };

  const [modal,      setModal]      = useState(null); // 'add' | 'approve' | 'edit'
  const [targetUser, setTargetUser] = useState(null);
  const [addForm,    setAddForm]    = useState(EMPTY_ADD);
  const [editForm,   setEditForm]   = useState({});
  const [approveForm,setApproveForm]= useState(EMPTY_APPROVE);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ud, cd, dd, td] = await Promise.all([
      apiFetch('/api/lms/admin/users').then(r => r?.json()),
      apiFetch('/api/lms/admin/companies').then(r => r?.json()),
      apiFetch('/api/lms/admin/departments').then(r => r?.json()),
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
    ]);
    if (ud) setUsers(ud);
    if (cd) setCompanies(cd);
    if (dd) setDepartments(dd);
    if (td) setLearnerTypes(td.filter(t => t.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sync filterOrg with the sidebar org switcher
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lms_selectedOrg') || '' : '';
    setFilterOrg(saved);
    const handler = (e) => setFilterOrg(e.detail);
    window.addEventListener('lms-org-change', handler);
    return () => window.removeEventListener('lms-org-change', handler);
  }, []);

  // Filtered dept options based on selected company
  const deptOptions = (companyId) =>
    departments.filter(d => !d.parent_id && (!companyId || String(d.company_id) === String(companyId)));
  const subDeptOptions = (deptId) =>
    departments.filter(d => String(d.parent_id) === String(deptId));

  // ── Derived lists ─────────────────────────────────────────────────────────
  const pendingUsers = users.filter(u => u.registration_status === 'pending');
  const filteredAll  = users
    .filter(u => u.registration_status !== 'pending')
    .filter(u => {
      const q = search.toLowerCase();
      if (q && !(u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.staff_id?.toLowerCase().includes(q))) return false;
      if (filterOrg  && String(u.company_id) !== filterOrg)  return false;
      if (filterRole && u.role !== filterRole)                return false;
      return true;
    });

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // ── Open modals ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setAddForm(EMPTY_ADD);
    setError('');
    setModal('add');
  };

  const openApprove = (u) => {
    setTargetUser(u);
    setApproveForm({ role: 'learner', learner_type_id: '', company_id: '', department_id: '', sub_department_id: '' });
    setError('');
    setModal('approve');
  };

  const openEdit = (u) => {
    setTargetUser(u);
    setDeleteConfirm(false);
    setEditForm({
      display_name:     u.display_name || '',
      staff_id:         u.staff_id || '',
      role:             u.role,
      is_active:        u.is_active,
      can_upload_content: u.can_upload_content || false,
      company_id:       u.company_id ? String(u.company_id) : '',
      department_id:    u.department_id ? String(u.department_id) : '',
      sub_department_id:u.sub_department_id ? String(u.sub_department_id) : '',
      learner_type_id:  u.learner_type_id ? String(u.learner_type_id) : '',
      password:         '',
    });
    setError('');
    setModal('edit');
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...addForm,
        company_id:       addForm.company_id || null,
        department_id:    addForm.department_id || null,
        sub_department_id:addForm.sub_department_id || null,
        learner_type_id:  addForm.learner_type_id || null,
        staff_id:         addForm.staff_id || null,
      };
      const r = await apiFetch('/api/lms/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async () => {
    setSaving(true); setError('');
    try {
      // Approve with role
      const r = await apiFetch(`/api/lms/admin/users/${targetUser.id}/approve`, {
        method: 'PUT', body: JSON.stringify(approveForm)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      // Also set org/dept if provided
      if (approveForm.company_id || approveForm.department_id) {
        await apiFetch(`/api/lms/admin/users/${targetUser.id}`, {
          method: 'PUT', body: JSON.stringify({
            company_id:        approveForm.company_id || null,
            department_id:     approveForm.department_id || null,
            sub_department_id: approveForm.sub_department_id || null,
          })
        });
      }
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleReject = async (userId) => {
    if (!confirm('Reject this registration request?')) return;
    try {
      await apiFetch(`/api/lms/admin/users/${userId}/reject`, { method: 'PUT', body: '{}' });
      await load();
    } catch { /* ignore */ }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...editForm,
        company_id:        editForm.company_id || null,
        department_id:     editForm.department_id || null,
        sub_department_id: editForm.sub_department_id || null,
        learner_type_id:   editForm.learner_type_id || null,
        staff_id:          editForm.staff_id || null,
        password:          editForm.password || undefined,
      };
      const r = await apiFetch(`/api/lms/admin/users/${targetUser.id}`, {
        method: 'PUT', body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true); setError('');
    try {
      const r = await apiFetch(`/api/lms/admin/users/${targetUser.id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setModal(null); await load();
    } catch (err) { setError(err.message); setSaving(false); }
  };

  // ── Select all helpers ────────────────────────────────────────────────────
  const toggleSelectUser = (id) => setSelectedUsers(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const isAllSelected = filteredAll.length > 0 && filteredAll.every(u => selectedUsers.has(u.id));
  const toggleSelectAll = () => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (isAllSelected) filteredAll.forEach(u => next.delete(u.id));
      else filteredAll.forEach(u => next.add(u.id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedUsers.size} user${selectedUsers.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of selectedUsers) {
      await apiFetch(`/api/lms/admin/users/${id}`, { method: 'DELETE' });
    }
    setSelectedUsers(new Set());
    await load();
  };

  const handleBackfillStaffIds = async () => {
    setBackfilling(true); setBackfillResult(null);
    try {
      const r = await apiFetch('/api/lms/admin/users/backfill-staff-ids', { method: 'POST', body: '{}' });
      const d = await r.json();
      setBackfillResult(d);
      if (d.updated > 0) await load();
    } catch (err) { setBackfillResult({ error: err.message }); }
    finally { setBackfilling(false); }
  };

  const handleBulkImportUsers = async (rows, extraVals) => {
    const r = await apiFetch('/api/lms/admin/users/bulk', {
      method: 'POST',
      body: JSON.stringify({ rows, default_password: extraVals.default_password || undefined }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    load(); // refresh list in background
    return data;
  };

  // ── Shared field components ────────────────────────────────────────────────
  const OrgDeptFields = ({ form, setForm }) => {
    const depts    = deptOptions(form.company_id);
    const subDepts = subDeptOptions(form.department_id);
    return (
      <>
        <div>
          <label className="text-xs font-medium text-cortex-muted block mb-1.5">Organization</label>
          <select value={form.company_id || ''} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, department_id: '', sub_department_id: '' }))}
            className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
            <option value="">— None —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Department</label>
            <select value={form.department_id || ''} onChange={e => setForm(p => ({ ...p, department_id: e.target.value, sub_department_id: '' }))}
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              disabled={!form.company_id && depts.length === 0}>
              <option value="">— None —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-cortex-muted block mb-1.5">Sub-department</label>
            <select value={form.sub_department_id || ''} onChange={e => setForm(p => ({ ...p, sub_department_id: e.target.value }))}
              className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
              disabled={!form.department_id || subDepts.length === 0}>
              <option value="">— None —</option>
              {subDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">User Management</h1>
          <p className="text-cortex-muted text-sm mt-0.5">Manage accounts, roles, and organisation assignments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative inline-block">
            <button onClick={handleBackfillStaffIds} disabled={backfilling}
              title="Generate proper Staff IDs for users who have none or who have their email as Staff ID"
              className="border border-cortex-border text-cortex-muted text-sm px-4 py-2 rounded-lg hover:text-cortex-text hover:bg-cortex-bg transition font-medium disabled:opacity-50">
              {backfilling ? '⟳ Fixing…' : '⚙ Fix Staff IDs'}
            </button>
            <NewBadge description="New: Auto-generates Staff IDs in IOH-JS-0001 format for users with missing or invalid IDs." />
          </div>
          <button onClick={() => setShowBulk(true)}
            className="border border-cortex-border text-cortex-muted text-sm px-4 py-2 rounded-lg hover:text-cortex-text hover:bg-cortex-bg transition font-medium">
            ↑ Bulk Import
          </button>
          <button onClick={openAdd}
            className="bg-cortex-accent text-white text-sm px-4 py-2 rounded-lg hover:opacity-90 transition font-medium">
            + Add User
          </button>
        </div>
      </div>

      {/* Backfill result toast */}
      {backfillResult && (
        <div className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border text-sm ${
          backfillResult.error
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
        }`}>
          <span className="flex-1">{backfillResult.error || backfillResult.message}</span>
          <button onClick={() => setBackfillResult(null)} className="text-cortex-muted hover:text-cortex-text">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-cortex-bg border border-cortex-border rounded-xl p-1 mb-5 w-fit">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 ${tab === 'pending' ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
          Pending
          {pendingUsers.length > 0 && (
            <span className="bg-yellow-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === 'all' ? 'bg-cortex-surface text-cortex-text font-medium shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}>
          All Users {tab === 'all' && filteredAll.length > 0 && <span className="ml-1 text-cortex-muted">({filteredAll.length})</span>}
        </button>
      </div>

      {loading ? (
        <div className="text-cortex-muted text-sm flex items-center gap-2 py-8">
          <div className="w-4 h-4 border-2 border-cortex-accent border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : tab === 'pending' ? (

        /* ── Pending Requests ─────────────────────────────────────────────── */
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

        /* ── All Users ────────────────────────────────────────────────────── */
        <>
          {/* Bulk action bar */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">{selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected</span>
              <button onClick={handleBulkDelete}
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:opacity-80 transition font-medium">
                Delete Selected
              </button>
              <button onClick={() => setSelectedUsers(new Set())}
                className="text-xs text-cortex-muted hover:text-cortex-text transition">
                Clear
              </button>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, staff ID…"
              className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent w-64" />
            <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}
              className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Organizations</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Roles</option>
              {['admin','trainer','learner','support'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cortex-border bg-cortex-bg/50">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll}
                        className="rounded border-cortex-border cursor-pointer accent-cortex-accent" />
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">
                      <span className="relative inline-block">Staff ID<NewBadge description="New: Staff IDs are now auto-generated in ORG-INITIALS-NNNN format (e.g. IOH-JS-0001)." /></span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Organisation</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {filteredAll.map(u => (
                    <tr key={u.id} className={`hover:bg-cortex-bg/50 transition ${selectedUsers.has(u.id) ? 'bg-cortex-accent/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-cortex-border cursor-pointer accent-cortex-accent" />
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-cortex-text">{u.display_name || '—'}</div>
                        <div className="text-xs text-cortex-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-cortex-muted font-mono">{u.staff_id || <span className="text-cortex-border">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${ROLE_STYLES[u.role] || 'bg-cortex-border text-cortex-muted'}`}>
                            {u.role}
                          </span>
                          {u.learner_type_name && (
                            <span className="text-[10px] text-cortex-muted">{u.learner_type_name}</span>
                          )}
                          {u.can_upload_content && (
                            <span className="text-[10px] text-cortex-accent">↑ Can upload</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-cortex-muted">{u.company_name || <span className="text-cortex-border">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-cortex-muted">
                        {u.department_name ? (
                          <div>
                            <div>{u.department_name}</div>
                            {u.sub_department_name && <div className="text-[10px] text-cortex-muted">↳ {u.sub_department_name}</div>}
                          </div>
                        ) : <span className="text-cortex-border">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-cortex-border text-cortex-muted'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-cortex-muted whitespace-nowrap">{fmt(u.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(u)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAll.length === 0 && (
                    <tr><td colSpan={9} className="px-5 py-10 text-center text-cortex-muted text-sm">No users match the current filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Add User Modal ──────────────────────────────────────────────────── */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">Add New User</h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Email *</label>
                  <input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="user@example.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Display Name</label>
                  <input value={addForm.display_name} onChange={e => setAddForm(p => ({ ...p, display_name: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Staff ID</label>
                  <input value={addForm.staff_id} onChange={e => setAddForm(p => ({ ...p, staff_id: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="e.g. IOH-JS-0001 (auto-generated if blank)" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Password *</label>
                  <div className="relative">
                    <input type={showAddPw ? 'text' : 'password'} value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} required
                      className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 pr-10 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                      placeholder="Min. 6 characters" />
                    <button type="button" onClick={() => togglePw(showAddPw, setShowAddPw, addPwTimer)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cortex-muted hover:text-cortex-text transition">
                      {showAddPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role *</label>
                  <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value, learner_type_id: '' }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="learner">Learner</option>
                    <option value="trainer">Trainer</option>
                    
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              </div>

              {addForm.role === 'learner' && learnerTypes.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                  <select value={addForm.learner_type_id} onChange={e => setAddForm(p => ({ ...p, learner_type_id: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— None —</option>
                    {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div className="border-t border-cortex-border pt-3">
                <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">Organisation Assignment</p>
                <OrgDeptFields form={addForm} setForm={setAddForm} />
              </div>

              {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 text-sm">{error}</div>}
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

      {/* ── Approve Modal ───────────────────────────────────────────────────── */}
      {modal === 'approve' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="px-6 py-4 border-b border-cortex-border">
              <h2 className="font-semibold text-cortex-text">Approve & Assign Role</h2>
              <p className="text-xs text-cortex-muted mt-0.5">{targetUser?.display_name ? `${targetUser.display_name} · ` : ''}{targetUser?.email}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role *</label>
                  <select value={approveForm.role} onChange={e => setApproveForm(p => ({ ...p, role: e.target.value, learner_type_id: '' }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="learner">Learner</option>
                    <option value="trainer">Trainer</option>
                    
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                {approveForm.role === 'learner' && learnerTypes.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                    <select value={approveForm.learner_type_id} onChange={e => setApproveForm(p => ({ ...p, learner_type_id: e.target.value }))}
                      className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                      <option value="">— None —</option>
                      {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-cortex-border pt-3">
                <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">Organisation Assignment</p>
                <OrgDeptFields form={approveForm} setForm={setApproveForm} />
              </div>

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

      {/* ── Bulk Import Modal ───────────────────────────────────────────────── */}
      {showBulk && (
        <BulkImportModal
          title="Bulk Import Users"
          columns={USER_BULK_COLUMNS}
          extras={USER_BULK_EXTRAS}
          templateFilename="users_import_template.csv"
          templateSample={USER_BULK_SAMPLE}
          onImport={handleBulkImportUsers}
          onClose={() => setShowBulk(false)}
        />
      )}

      {/* ── Edit User Modal ─────────────────────────────────────────────────── */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-cortex-text">Edit User</h2>
                <p className="text-xs text-cortex-muted mt-0.5">{targetUser?.email}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Display Name</label>
                  <input value={editForm.display_name} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Staff ID</label>
                  <input value={editForm.staff_id} onChange={e => setEditForm(p => ({ ...p, staff_id: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="learner">Learner</option>
                    <option value="trainer">Trainer</option>
                    
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showEditPw ? 'text' : 'password'} value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 pr-10 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                      placeholder="Leave blank to keep" />
                    <button type="button" onClick={() => togglePw(showEditPw, setShowEditPw, editPwTimer)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cortex-muted hover:text-cortex-text transition">
                      {showEditPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {editForm.role === 'learner' && learnerTypes.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Learner Type</label>
                  <select value={editForm.learner_type_id} onChange={e => setEditForm(p => ({ ...p, learner_type_id: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— None —</option>
                    {learnerTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border border-cortex-border rounded-lg px-4">
                  <span className="text-sm text-cortex-text">Active Account</span>
                  <Toggle value={editForm.is_active} onChange={v => setEditForm(p => ({ ...p, is_active: v }))} />
                </div>
              </div>

              {/* Org/Dept */}
              <div className="border-t border-cortex-border pt-3">
                <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">Organisation Assignment</p>
                <OrgDeptFields form={editForm} setForm={setEditForm} />
              </div>

              {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 text-sm">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>

              {/* Danger zone */}
              <div className="border-t border-cortex-border pt-3">
                {!deleteConfirm ? (
                  <button type="button" onClick={() => setDeleteConfirm(true)}
                    className="text-xs text-cortex-danger hover:underline">
                    Delete this user account
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">Delete {targetUser?.display_name || targetUser?.email}?</p>
                    <p className="text-xs text-red-500 mb-3">This is permanent and cannot be undone.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleDelete} disabled={saving}
                        className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                        {saving ? '…' : 'Yes, Delete'}
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(false)}
                        className="flex-1 border border-cortex-border text-cortex-muted py-1.5 rounded-lg text-xs hover:bg-cortex-bg">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
