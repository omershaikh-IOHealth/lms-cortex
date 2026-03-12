// app/lms/admin/departments/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';
import BulkImportModal from '@/components/BulkImportModal';

const DEPT_BULK_COLUMNS = [
  { key: 'name',              label: 'Name',             required: true, placeholder: 'e.g. Paediatrics',        minWidth: 160 },
  { key: 'organization',      label: 'Organization',     placeholder: 'Exact org name (optional)',               minWidth: 170 },
  { key: 'parent_department', label: 'Parent Department', placeholder: 'Leave blank for top-level dept',         minWidth: 190 },
  { key: 'description',       label: 'Description',      placeholder: 'Optional',                                minWidth: 220 },
];

const DEPT_BULK_SAMPLE = ['Paediatrics', 'General Hospital', '', 'Paediatric care department'];

const EMPTY_FORM = { name: '', description: '', parent_id: '', company_id: '' };
const EMPTY_FAC  = { name: '', location: '', facility_type: '', facility_code: '', company_id: '' };
const FAC_TYPES  = ['clinic', 'hospital', 'pharmacy', 'daycare', 'other'];

export default function DepartmentsPage() {
  const [pageTab,     setPageTab]     = useState('departments'); // 'departments' | 'facilities'
  const [departments, setDepartments] = useState([]);
  const [companies,   setCompanies]   = useState([]);
  const [showBulk,    setShowBulk]    = useState(false);
  const [modal,       setModal]       = useState(null); // 'add-dept' | 'add-sub' | 'edit' | 'add-fac' | 'edit-fac'
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [facForm,     setFacForm]     = useState(EMPTY_FAC);
  const [editTarget,  setEditTarget]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [filterOrg,   setFilterOrg]   = useState('');
  const [expandedDepts, setExpandedDepts] = useState(new Set());

  // Facilities state
  const [facilities,   setFacilities]  = useState([]);
  const [facFilterOrg, setFacFilterOrg] = useState('');

  const loadAll = useCallback(async () => {
    const [depts, comps, facs] = await Promise.all([
      apiFetch('/api/lms/admin/departments').then(r => r?.json()),
      apiFetch('/api/lms/admin/companies').then(r => r?.json()),
      apiFetch('/api/lms/admin/facilities').then(r => r?.json()),
    ]);
    if (depts) setDepartments(depts);
    if (comps) setCompanies(comps);
    if (facs)  setFacilities(facs);
  }, []);

  useEffect(() => { loadAll(); }, []);

  // Sync filterOrg with the sidebar org switcher
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lms_selectedOrg') || '' : '';
    setFilterOrg(saved);
    const handler = (e) => setFilterOrg(e.detail);
    window.addEventListener('lms-org-change', handler);
    return () => window.removeEventListener('lms-org-change', handler);
  }, []);

  // Build tree: top-level = parent_id IS NULL
  const topLevel = departments.filter(d => !d.parent_id && (!filterOrg || String(d.company_id) === filterOrg));
  const childrenOf = (id) => departments.filter(d => String(d.parent_id) === String(id));

  const toggleExpand = (id) => setExpandedDepts(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const openAdd = (parentId = null, companyId = null) => {
    setForm({ ...EMPTY_FORM, parent_id: parentId ? String(parentId) : '', company_id: companyId ? String(companyId) : '' });
    setEditTarget(null); setError('');
    setModal(parentId ? 'add-sub' : 'add-dept');
  };

  const openEdit = (dept) => {
    setForm({
      name: dept.name, description: dept.description || '',
      parent_id: dept.parent_id ? String(dept.parent_id) : '',
      company_id: dept.company_id ? String(dept.company_id) : '',
    });
    setEditTarget(dept); setError(''); setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        company_id: form.company_id ? Number(form.company_id) : null,
      };
      let r;
      if (editTarget) {
        r = await apiFetch(`/api/lms/admin/departments/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        r = await apiFetch('/api/lms/admin/departments', { method: 'POST', body: JSON.stringify(body) });
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setModal(null); await loadAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (dept) => {
    if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
    const r = await apiFetch(`/api/lms/admin/departments/${dept.id}`, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) { alert(data.error); return; }
    await loadAll();
  };

  const toggleActive = async (dept) => {
    await apiFetch(`/api/lms/admin/departments/${dept.id}`,
      { method: 'PUT', body: JSON.stringify({ is_active: !dept.is_active }) });
    await loadAll();
  };

  const handleBulkImportDepts = async (rows) => {
    const r = await apiFetch('/api/lms/admin/departments/bulk', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Import failed');
    loadAll(); // refresh list in background
    return data;
  };

  // ── Facility handlers ──────────────────────────────────────────────────────
  const openAddFac = () => { setFacForm({ ...EMPTY_FAC, company_id: facFilterOrg || '' }); setEditTarget(null); setError(''); setModal('add-fac'); };
  const openEditFac = (fac) => {
    setFacForm({ name: fac.name, location: fac.location || '', facility_type: fac.facility_type || '', facility_code: fac.facility_code || '', company_id: String(fac.company_id) });
    setEditTarget(fac); setError(''); setModal('edit-fac');
  };

  const handleSaveFac = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const body = { ...facForm, company_id: Number(facForm.company_id) || undefined };
      let r;
      if (editTarget) {
        r = await apiFetch(`/api/lms/admin/facilities/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        r = await apiFetch('/api/lms/admin/facilities', { method: 'POST', body: JSON.stringify(body) });
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setModal(null); await loadAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDeactivateFac = async (fac) => {
    if (!confirm(`Deactivate facility "${fac.name}"?`)) return;
    await apiFetch(`/api/lms/admin/facilities/${fac.id}`, { method: 'DELETE' });
    await loadAll();
  };

  const filteredFacilities = facilities.filter(f => !facFilterOrg || String(f.company_id) === facFilterOrg);

  const modalTitle = modal === 'edit' ? 'Edit Department' : modal === 'add-sub' ? 'Add Sub-department' : modal === 'add-fac' ? 'Add Facility' : modal === 'edit-fac' ? 'Edit Facility' : 'Add Department';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-cortex-text">
            {pageTab === 'departments' ? 'Departments' : 'Facilities'}
          </h1>
          <p className="text-sm text-cortex-muted mt-0.5">
            {pageTab === 'departments'
              ? 'Manage the 3-tier hierarchy: Organization → Department → Sub-department'
              : 'Manage clinic, hospital, pharmacy and other facility locations'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Tab switcher */}
          <div className="flex border border-cortex-border rounded-lg overflow-hidden text-sm">
            {[['departments','Departments'],['facilities','Facilities']].map(([v,l]) => (
              <button key={v} onClick={() => setPageTab(v)}
                className={`px-4 py-1.5 transition ${pageTab===v ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:bg-cortex-bg'}`}>
                {l}
              </button>
            ))}
          </div>

          {pageTab === 'departments' && companies.length > 0 && (
            <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Organizations</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          )}
          {pageTab === 'facilities' && companies.length > 0 && (
            <select value={facFilterOrg} onChange={e => setFacFilterOrg(e.target.value)}
              className="bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
              <option value="">All Organizations</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          )}
          {pageTab === 'departments' && (
            <>
              <button onClick={() => setShowBulk(true)}
                className="border border-cortex-border text-cortex-muted px-4 py-2 rounded-lg text-sm font-medium hover:text-cortex-text hover:bg-cortex-bg transition">
                ↑ Bulk Import
              </button>
              <button onClick={() => openAdd()}
                className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                + Add Department
              </button>
            </>
          )}
          {pageTab === 'facilities' && (
            <button onClick={openAddFac}
              className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
              + Add Facility
            </button>
          )}
        </div>
      </div>

      {/* ── Departments view ────────────────────────────────────────────────── */}
      {pageTab === 'departments' && (<>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Departments',     value: departments.filter(d => !d.parent_id).length, color: 'text-cortex-accent' },
          { label: 'Sub-departments', value: departments.filter(d => !!d.parent_id).length, color: 'text-blue-500' },
          { label: 'Total Users',     value: departments.reduce((s, d) => s + (d.user_count || 0), 0), color: 'text-green-500' },
        ].map(s => (
          <div key={s.label} className="bg-cortex-surface border border-cortex-border rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-cortex-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Department tree */}
      {topLevel.length === 0 ? (
        <div className="text-center py-16 text-cortex-muted">
          <div className="text-5xl mb-4">🏢</div>
          <div className="text-sm">No departments yet. Add your first department to get started.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map(dept => {
            const children = childrenOf(dept.id);
            const expanded = expandedDepts.has(dept.id);
            return (
              <div key={dept.id} className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
                {/* Department row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  {children.length > 0 && (
                    <button onClick={() => toggleExpand(dept.id)}
                      className="text-cortex-muted hover:text-cortex-text transition flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  )}
                  {children.length === 0 && <div className="w-4 flex-shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cortex-text">{dept.name}</span>
                      {!dept.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cortex-border text-cortex-muted font-medium">Inactive</span>
                      )}
                      {dept.company_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cortex-accent/10 text-cortex-accent font-medium">
                          🏥 {dept.company_name}
                        </span>
                      )}
                    </div>
                    {dept.description && <div className="text-xs text-cortex-muted mt-0.5">{dept.description}</div>}
                    <div className="text-xs text-cortex-muted mt-0.5">
                      {dept.user_count || 0} user{dept.user_count !== 1 ? 's' : ''} · {children.length} sub-department{children.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openAdd(dept.id, dept.company_id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-accent hover:border-cortex-accent/50 transition">
                      + Sub-dept
                    </button>
                    <button onClick={() => openEdit(dept)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-text transition">
                      Edit
                    </button>
                    <button onClick={() => toggleActive(dept)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${dept.is_active
                        ? 'border-cortex-border text-cortex-muted hover:text-yellow-600 hover:border-yellow-400'
                        : 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                      {dept.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(dept)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:text-red-500 hover:border-red-300 transition">
                      🗑
                    </button>
                  </div>
                </div>

                {/* Sub-department rows */}
                {expanded && children.length > 0 && (
                  <div className="border-t border-cortex-border divide-y divide-cortex-border/50 bg-cortex-bg/30">
                    {children.map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 pl-12 pr-5 py-3">
                        <div className="flex-shrink-0 text-cortex-muted/40">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 3 12 9 6"/><line x1="3" y1="12" x2="21" y2="12"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-cortex-text">{sub.name}</span>
                            {!sub.is_active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cortex-border text-cortex-muted">Inactive</span>
                            )}
                          </div>
                          {sub.description && <div className="text-xs text-cortex-muted">{sub.description}</div>}
                          <div className="text-xs text-cortex-muted">{sub.user_count || 0} user{sub.user_count !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => openEdit(sub)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-cortex-surface border border-cortex-border text-cortex-muted hover:text-cortex-text transition">
                            Edit
                          </button>
                          <button onClick={() => toggleActive(sub)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition ${sub.is_active
                              ? 'border-cortex-border text-cortex-muted hover:text-yellow-600'
                              : 'border-green-400 text-green-600'}`}>
                            {sub.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => handleDelete(sub)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:text-red-500 transition">
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add sub-dept inline */}
                    <div className="pl-12 pr-5 py-3">
                      <button onClick={() => openAdd(dept.id, dept.company_id)}
                        className="text-xs text-cortex-muted hover:text-cortex-accent transition flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add sub-department
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* ── Facilities view ─────────────────────────────────────────────────── */}
      {pageTab === 'facilities' && (
        filteredFacilities.length === 0 ? (
          <div className="text-center py-16 text-cortex-muted">
            <div className="text-5xl mb-4">🏥</div>
            <div className="text-sm">No facilities yet. Add your first facility to get started.</div>
          </div>
        ) : (
          <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cortex-border bg-cortex-bg/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Facility Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-cortex-muted uppercase tracking-wider">Organization</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {filteredFacilities.map(fac => (
                    <tr key={fac.id} className="hover:bg-cortex-bg/50 transition">
                      <td className="px-5 py-3 font-medium text-cortex-text">{fac.name}</td>
                      <td className="px-4 py-3 text-cortex-muted">{fac.location || <span className="text-cortex-border">—</span>}</td>
                      <td className="px-4 py-3">
                        {fac.facility_type ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-cortex-accent/10 text-cortex-accent font-medium capitalize">
                            {fac.facility_type}
                          </span>
                        ) : <span className="text-cortex-border">—</span>}
                      </td>
                      <td className="px-4 py-3 text-cortex-muted font-mono text-xs">{fac.facility_code || <span className="text-cortex-border">—</span>}</td>
                      <td className="px-4 py-3 text-cortex-muted">{fac.company_name || <span className="text-cortex-border">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => openEditFac(fac)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
                            Edit
                          </button>
                          <button onClick={() => handleDeactivateFac(fac)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:text-red-500 hover:border-red-300 transition">
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Bulk Import Modal */}
      {showBulk && (
        <BulkImportModal
          title="Bulk Import Departments"
          columns={DEPT_BULK_COLUMNS}
          templateFilename="departments_import_template.csv"
          templateSample={DEPT_BULK_SAMPLE}
          onImport={handleBulkImportDepts}
          onClose={() => setShowBulk(false)}
        />
      )}

      {/* Department Modal */}
      {modal && !modal.includes('fac') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">{modalTitle}</h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Name *</label>
                <input value={form.name} onChange={e => setForm(p=>({...p, name:e.target.value}))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder={modal === 'add-sub' ? 'e.g. Paediatric Oncology' : 'e.g. Paediatrics'} />
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p, description:e.target.value}))} rows={2}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent resize-none" />
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Organization</label>
                <select value={form.company_id} onChange={e => setForm(p=>({...p, company_id:e.target.value}))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="">— None / Global —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              {modal !== 'add-sub' && (
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Parent Department (for sub-dept)</label>
                  <select value={form.parent_id} onChange={e => setForm(p=>({...p, parent_id:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— Top-level department —</option>
                    {departments.filter(d => !d.parent_id).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {modal === 'add-sub' && (
                <div className="text-xs text-cortex-muted bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2">
                  Will be added under: <strong className="text-cortex-text">
                    {departments.find(d => String(d.id) === form.parent_id)?.name || '—'}
                  </strong>
                </div>
              )}

              {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-xl text-sm hover:bg-cortex-bg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Facility Modal */}
      {(modal === 'add-fac' || modal === 'edit-fac') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">{modalTitle}</h2>
              <button onClick={() => setModal(null)} className="text-cortex-muted hover:text-cortex-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveFac} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Facility Name *</label>
                <input value={facForm.name} onChange={e => setFacForm(p=>({...p, name:e.target.value}))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                  placeholder="e.g. Main Clinic — Dubai" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Location</label>
                  <input value={facForm.location} onChange={e => setFacForm(p=>({...p, location:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="City / address" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Facility Code</label>
                  <input value={facForm.facility_code} onChange={e => setFacForm(p=>({...p, facility_code:e.target.value}))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent"
                    placeholder="e.g. DXB-CLN-01" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Facility Type</label>
                <select value={facForm.facility_type} onChange={e => setFacForm(p=>({...p, facility_type:e.target.value}))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="">— Select type —</option>
                  {FAC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-cortex-muted block mb-1.5">Organization *</label>
                <select value={facForm.company_id} onChange={e => setFacForm(p=>({...p, company_id:e.target.value}))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                  <option value="">— Select organization —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Facility'}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-xl text-sm hover:bg-cortex-bg transition">
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
