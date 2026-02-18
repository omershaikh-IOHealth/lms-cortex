// frontend/app/lms/admin/content/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch, apiUpload } from '@/lib/auth';

// ─── tiny icons ────────────────────────────────────────────────────────────
const Ic = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d === 'edit'   && <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}
    {d === 'trash'  && <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>}
    {d === 'video'  && <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>}
    {d === 'plus'   && <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
    {d === 'eye'    && <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
    {d === 'eyeoff' && <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
    {d === 'folder' && <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>}
    {d === 'chevron'&& <polyline points="6 9 12 15 18 9"/>}
    {d === 'x'      && <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
    {d === 'upload' && <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>}
  </svg>
);

const EMPTY_COURSE  = { title: '', description: '' };
const EMPTY_SECTION = { title: '', parent_section_id: '' };
const EMPTY_LESSON  = { title: '', section_id: '', manual_markdown: '', sort_order: 0, is_active: true };

export default function ContentPage() {
  const [courses, setCourses]           = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [tree, setTree]                 = useState([]);   // sections with lessons
  const [loading, setLoading]           = useState(true);
  const [treeLoading, setTreeLoading]   = useState(false);

  // Right panel state — what's being edited
  const [panel, setPanel] = useState(null);
  // panel = { type: 'new_course'|'edit_course'|'new_section'|'edit_section'|'new_lesson'|'edit_lesson', data: {...} }

  const [form, setForm]         = useState({});
  const [videoFile, setVideoFile] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [deletingId, setDeletingId] = useState(null); // confirm delete id

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    const d = await apiFetch('/api/lms/admin/content/courses').then(r => r?.json());
    if (d) setCourses(d);
    setLoading(false);
  }, []);

  const loadTree = useCallback(async (courseId) => {
    setTreeLoading(true);
    const d = await apiFetch(`/api/lms/admin/content/courses/${courseId}/tree`).then(r => r?.json());
    if (d) setTree(d);
    setTreeLoading(false);
  }, []);

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (selectedCourse) loadTree(selectedCourse.id); }, [selectedCourse?.id]);

  const openPanel = (type, data = {}) => {
    setForm(data);
    setVideoFile(null);
    setError('');
    setPanel({ type, data });
  };
  const closePanel = () => { setPanel(null); setError(''); setVideoFile(null); };

  // ── save handlers ──────────────────────────────────────────────────────────

  const saveCourse = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = panel?.type === 'edit_course';
      const url    = isEdit ? `/api/lms/admin/content/courses/${panel.data.id}` : '/api/lms/admin/content/courses';
      const r      = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(form) });
      const data   = await r.json();
      if (!r.ok) throw new Error(data.error);
      await loadCourses();
      if (isEdit) setSelectedCourse(c => c?.id === data.id ? { ...c, ...data } : c);
      closePanel();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const saveSection = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = panel?.type === 'edit_section';
      const url    = isEdit ? `/api/lms/admin/content/sections/${panel.data.id}` : '/api/lms/admin/content/sections';
      const body   = isEdit ? { title: form.title, sort_order: form.sort_order }
                            : { course_id: selectedCourse.id, title: form.title, parent_section_id: form.parent_section_id || null, sort_order: form.sort_order || 0 };
      const r      = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const data   = await r.json();
      if (!r.ok) throw new Error(data.error);
      await loadTree(selectedCourse.id);
      closePanel();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const saveLesson = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = panel?.type === 'edit_lesson';
      const fd     = new FormData();
      fd.append('title',           form.title || '');
      fd.append('section_id',      form.section_id || '');
      fd.append('manual_markdown', form.manual_markdown || '');
      fd.append('sort_order',      form.sort_order || 0);
      fd.append('is_active',       form.is_active ? 'true' : 'false');
      if (videoFile) fd.append('video', videoFile);

      const url = isEdit ? `/api/lms/admin/content/lessons/${panel.data.id}` : '/api/lms/admin/content/lessons';
      const r   = await apiUpload(url, fd);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await loadTree(selectedCourse.id);
      closePanel();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // ── delete handlers ────────────────────────────────────────────────────────

  const deleteCourse = async (id) => {
    setDeletingId(null);
    await apiFetch(`/api/lms/admin/content/courses/${id}`, { method: 'DELETE' });
    await loadCourses();
    if (selectedCourse?.id === id) { setSelectedCourse(null); setTree([]); }
    closePanel();
  };

  const deleteSection = async (id) => {
    setDeletingId(null);
    await apiFetch(`/api/lms/admin/content/sections/${id}`, { method: 'DELETE' });
    await loadTree(selectedCourse.id);
    closePanel();
  };

  const deleteLesson = async (id) => {
    setDeletingId(null);
    await apiFetch(`/api/lms/admin/content/lessons/${id}`, { method: 'DELETE' });
    await loadTree(selectedCourse.id);
    closePanel();
  };

  const removeVideo = async (lessonId) => {
    setSaving(true);
    const r = await apiFetch(`/api/lms/admin/content/lessons/${lessonId}/remove-video`, { method: 'PATCH', body: '{}' });
    if (r.ok) {
      await loadTree(selectedCourse.id);
      setForm(p => ({ ...p, video_url: null }));
    }
    setSaving(false);
  };

  const toggleLessonActive = async (lesson) => {
    await apiFetch(`/api/lms/admin/content/lessons/${lesson.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !lesson.is_active })
    }).then(r => r?.json());
    await loadTree(selectedCourse.id);
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const rootSections  = tree.filter(s => !s.parent_section_id);
  const childSections = (pid) => tree.filter(s => s.parent_section_id === pid);
  const allSectionsFlat = tree; // for dropdown

  const isPanelLesson  = panel?.type === 'new_lesson'   || panel?.type === 'edit_lesson';
  const isPanelSection = panel?.type === 'new_section'  || panel?.type === 'edit_section';
  const isPanelCourse  = panel?.type === 'new_course'   || panel?.type === 'edit_course';

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">

      {/* ── Column 1: course list ─────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-cortex-surface border-r border-cortex-border flex flex-col">
        <div className="px-4 py-3 border-b border-cortex-border flex items-center justify-between">
          <span className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">Courses</span>
          <button onClick={() => openPanel('new_course', EMPTY_COURSE)}
            className="text-cortex-accent hover:opacity-70 transition" title="New course">
            <Ic d="plus" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading
            ? <div className="text-cortex-muted text-sm px-2 py-6 text-center">Loading…</div>
            : courses.length === 0
              ? <div className="text-cortex-muted text-sm px-2 py-6 text-center">No courses</div>
              : courses.map(c => (
                <button key={c.id} onClick={() => setSelectedCourse(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition group ${
                    selectedCourse?.id === c.id
                      ? 'bg-cortex-accent text-white'
                      : 'text-cortex-text hover:bg-cortex-bg'
                  }`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{c.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openPanel('edit_course', { ...c }); }}
                      className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition ${selectedCourse?.id === c.id ? 'text-white/70 hover:text-white' : 'text-cortex-muted hover:text-cortex-text'}`}>
                      <Ic d="edit" size={12} />
                    </button>
                  </div>
                  <div className={`text-xs mt-0.5 ${selectedCourse?.id === c.id ? 'text-white/70' : 'text-cortex-muted'}`}>
                    {c.lesson_count} lessons
                  </div>
                </button>
              ))
          }
        </div>
      </div>

      {/* ── Column 2: tree ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col border-r border-cortex-border overflow-hidden">
        {!selectedCourse ? (
          <div className="flex-1 flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-4xl mb-2">📚</div>
              <div className="text-sm">Select a course to manage content</div>
            </div>
          </div>
        ) : (
          <>
            {/* Course toolbar */}
            <div className="flex-shrink-0 px-5 py-3 border-b border-cortex-border bg-cortex-surface flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-cortex-text truncate">{selectedCourse.title}</div>
                {selectedCourse.description && <div className="text-xs text-cortex-muted truncate">{selectedCourse.description}</div>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openPanel('new_section', { ...EMPTY_SECTION })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-cortex-border text-cortex-text hover:bg-cortex-bg transition flex items-center gap-1.5">
                  <Ic d="folder" size={12} /> Section
                </button>
                <button onClick={() => openPanel('new_lesson', { ...EMPTY_LESSON, section_id: rootSections[0]?.id || '' })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-cortex-accent text-white hover:opacity-90 transition flex items-center gap-1.5">
                  <Ic d="plus" size={12} /> Lesson
                </button>
              </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto">
              {treeLoading ? (
                <div className="p-8 text-center text-cortex-muted text-sm">Loading…</div>
              ) : rootSections.length === 0 ? (
                <div className="p-12 text-center text-cortex-muted">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-sm">No sections yet — add one above.</div>
                </div>
              ) : (
                rootSections.map(section => (
                  <SectionBlock key={section.id} section={section}
                    childSections={childSections(section.id)}
                    onEditSection={(s) => openPanel('edit_section', { ...s })}
                    onDeleteSection={(id) => setDeletingId({ type: 'section', id })}
                    onEditLesson={(l) => openPanel('edit_lesson', { ...l, section_id: l.section_id ?? section.id })}
                    onDeleteLesson={(id) => setDeletingId({ type: 'lesson', id })}
                    onToggleActive={toggleLessonActive}
                    onAddLesson={(sid) => openPanel('new_lesson', { ...EMPTY_LESSON, section_id: sid })}
                    activePanel={panel}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Column 3: edit panel ──────────────────────────────────────────────── */}
      {panel && (
        <div className="w-96 flex-shrink-0 bg-cortex-surface border-l border-cortex-border flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-cortex-border flex-shrink-0">
            <h3 className="font-semibold text-cortex-text text-sm">
              {panel.type === 'new_course'   && 'New Course'}
              {panel.type === 'edit_course'  && 'Edit Course'}
              {panel.type === 'new_section'  && 'New Section'}
              {panel.type === 'edit_section' && 'Edit Section'}
              {panel.type === 'new_lesson'   && 'New Lesson'}
              {panel.type === 'edit_lesson'  && 'Edit Lesson'}
            </h3>
            <button onClick={closePanel} className="text-cortex-muted hover:text-cortex-text transition">
              <Ic d="x" size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* ── Course form ── */}
            {isPanelCourse && (
              <form onSubmit={saveCourse} className="space-y-4">
                <Field label="Title *">
                  <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                    className={INPUT} placeholder="e.g. RCM Fundamentals" />
                </Field>
                <Field label="Description">
                  <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3} className={`${INPUT} resize-none`} placeholder="Optional overview…" />
                </Field>
                {error && <ErrMsg msg={error} />}
                <SaveBar saving={saving} label={panel.type === 'new_course' ? 'Create Course' : 'Save'}
                  onCancel={closePanel}
                  onDelete={panel.type === 'edit_course' ? () => setDeletingId({ type: 'course', id: panel.data.id }) : null}
                />
              </form>
            )}

            {/* ── Section form ── */}
            {isPanelSection && (
              <form onSubmit={saveSection} className="space-y-4">
                <Field label="Section Title *">
                  <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                    className={INPUT} placeholder="e.g. Module 1: Basics" />
                </Field>
                {panel.type === 'new_section' && (
                  <Field label="Parent Section (leave blank for root)">
                    <select value={form.parent_section_id || ''} onChange={e => setForm(p => ({ ...p, parent_section_id: e.target.value }))}
                      className={INPUT}>
                      <option value="">— Root section —</option>
                      {rootSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Sort Order">
                  <input type="number" value={form.sort_order ?? 0} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                    className={INPUT} min={0} />
                </Field>
                {error && <ErrMsg msg={error} />}
                <SaveBar saving={saving} label={panel.type === 'new_section' ? 'Create Section' : 'Save'}
                  onCancel={closePanel}
                  onDelete={panel.type === 'edit_section' ? () => setDeletingId({ type: 'section', id: panel.data.id }) : null}
                />
              </form>
            )}

            {/* ── Lesson form ── */}
            {isPanelLesson && (
              <form onSubmit={saveLesson} className="space-y-4">
                <Field label="Lesson Title *">
                  <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                    className={INPUT} placeholder="e.g. Introduction to Claims" />
                </Field>

                <Field label="Section *">
                  <select value={form.section_id || ''} onChange={e => setForm(p => ({ ...p, section_id: e.target.value }))} required
                    className={INPUT}>
                    <option value="">— Select section —</option>
                    {allSectionsFlat.map(s => <option key={s.id} value={s.id}>{s.parent_section_id ? `  ↳ ${s.title}` : s.title}</option>)}
                  </select>
                </Field>

                {/* Video */}
                <Field label="Video">
                  {form.video_url && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-cortex-bg rounded-lg border border-cortex-border">
                      <Ic d="video" size={14} />
                      <span className="text-xs text-cortex-muted flex-1 truncate">
                        {form.video_url.split('/').pop()}
                      </span>
                      <button type="button" onClick={() => removeVideo(form.id)}
                        disabled={saving}
                        className="text-xs text-red-500 hover:text-red-400 transition disabled:opacity-50 flex items-center gap-1">
                        <Ic d="trash" size={11} /> Remove
                      </button>
                    </div>
                  )}
                  <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-cortex-border rounded-lg cursor-pointer hover:border-cortex-accent transition ${videoFile ? 'border-cortex-accent bg-cortex-accent/5' : ''}`}>
                    <Ic d="upload" size={14} />
                    <span className="text-xs text-cortex-muted">
                      {videoFile ? videoFile.name : form.video_url ? 'Replace video (mp4/webm/ogg, max 500 MB)' : 'Upload video (mp4/webm/ogg, max 500 MB)'}
                    </span>
                    <input type="file" accept="video/mp4,video/webm,video/ogg" className="hidden"
                      onChange={e => setVideoFile(e.target.files[0] || null)} />
                  </label>
                  {videoFile && (
                    <button type="button" onClick={() => setVideoFile(null)}
                      className="text-xs text-cortex-muted hover:text-red-500 mt-1 transition">
                      ✕ Clear selected file
                    </button>
                  )}
                </Field>

                <Field label="Manual (Markdown)">
                  <textarea value={form.manual_markdown || ''} rows={10}
                    onChange={e => setForm(p => ({ ...p, manual_markdown: e.target.value }))}
                    className={`${INPUT} resize-y font-mono text-xs`}
                    placeholder="# Lesson manual&#10;&#10;Write your content in Markdown…" />
                </Field>

                <Field label="Sort Order">
                  <input type="number" value={form.sort_order ?? 0} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                    className={INPUT} min={0} />
                </Field>

                {panel.type === 'edit_lesson' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                      className="accent-cortex-accent w-4 h-4" />
                    <span className="text-sm text-cortex-text">Active (visible to learners)</span>
                  </label>
                )}

                {error && <ErrMsg msg={error} />}
                <SaveBar saving={saving} label={panel.type === 'new_lesson' ? 'Create Lesson' : 'Save'}
                  onCancel={closePanel}
                  onDelete={panel.type === 'edit_lesson' ? () => setDeletingId({ type: 'lesson', id: panel.data.id }) : null}
                />
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirm overlay ─────────────────────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑</div>
              <h2 className="font-semibold text-cortex-text">
                Delete {deletingId.type === 'course' ? 'course' : deletingId.type === 'section' ? 'section' : 'lesson'}?
              </h2>
              <p className="text-sm text-cortex-muted mt-2">
                {deletingId.type === 'course'  && 'This will permanently delete the course and all its sections, lessons, and video files.'}
                {deletingId.type === 'section' && 'This will permanently delete the section and all its lessons and video files.'}
                {deletingId.type === 'lesson'  && 'This will permanently delete the lesson and its video file.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                if (deletingId.type === 'course')  deleteCourse(deletingId.id);
                if (deletingId.type === 'section') deleteSection(deletingId.id);
                if (deletingId.type === 'lesson')  deleteLesson(deletingId.id);
              }}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
                Delete
              </button>
              <button onClick={() => setDeletingId(null)}
                className="flex-1 border border-cortex-border text-cortex-text py-2 rounded-lg text-sm hover:bg-cortex-bg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── sub-components ────────────────────────────────────────────────────────

function SectionBlock({ section, childSections, onEditSection, onDeleteSection, onEditLesson, onDeleteLesson, onToggleActive, onAddLesson }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-cortex-border last:border-0">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-cortex-bg group hover:bg-cortex-border/20 transition">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <span className={`text-cortex-muted transition-transform flex-shrink-0 ${open ? 'rotate-0' : '-rotate-90'}`}>
            <Ic d="chevron" size={13} />
          </span>
          <Ic d="folder" size={13} />
          <span className="text-xs font-semibold text-cortex-text truncate">{section.title}</span>
          <span className="text-xs text-cortex-muted ml-1">({(section.lessons || []).length})</span>
        </button>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
          <button onClick={() => onAddLesson(section.id)} title="Add lesson"
            className="p-1 rounded text-cortex-muted hover:text-cortex-accent hover:bg-cortex-surface transition">
            <Ic d="plus" size={13} />
          </button>
          <button onClick={() => onEditSection(section)} title="Edit section"
            className="p-1 rounded text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface transition">
            <Ic d="edit" size={13} />
          </button>
          <button onClick={() => onDeleteSection(section.id)} title="Delete section"
            className="p-1 rounded text-cortex-muted hover:text-red-500 hover:bg-cortex-surface transition">
            <Ic d="trash" size={13} />
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Lessons */}
          {(section.lessons || []).map(lesson => (
            <LessonRow key={lesson.id} lesson={lesson}
              onEdit={() => onEditLesson({ ...lesson, section_id: section.id })}
              onDelete={() => onDeleteLesson(lesson.id)}
              onToggleActive={() => onToggleActive(lesson)} />
          ))}

          {/* Child sections */}
          {childSections.map(child => (
            <div key={child.id} className="ml-6 border-l-2 border-cortex-border">
              <SectionBlock section={child} childSections={[]}
                onEditSection={onEditSection} onDeleteSection={onDeleteSection}
                onEditLesson={onEditLesson} onDeleteLesson={onDeleteLesson}
                onToggleActive={onToggleActive} onAddLesson={onAddLesson} />
            </div>
          ))}

          {(section.lessons || []).length === 0 && childSections.length === 0 && (
            <div className="px-10 py-3 text-xs text-cortex-muted italic">
              Empty section —{' '}
              <button onClick={() => onAddLesson(section.id)} className="text-cortex-accent hover:underline">add a lesson</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LessonRow({ lesson, onEdit, onDelete, onToggleActive }) {
  return (
    <div className={`flex items-center gap-3 px-6 py-2.5 border-t border-cortex-border group transition ${lesson.is_active ? '' : 'opacity-50'}`}>
      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0">
        <Ic d="video" size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-cortex-text truncate block">{lesson.title}</span>
        <div className="flex gap-2 mt-0.5 text-xs text-cortex-muted">
          {lesson.video_url && <span className="text-green-600 dark:text-green-400">● video</span>}
          {lesson.manual_markdown && <span>● manual</span>}
          {!lesson.is_active && <span className="text-cortex-warning">hidden</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <button onClick={onToggleActive} title={lesson.is_active ? 'Hide from learners' : 'Make visible'}
          className="p-1 rounded text-cortex-muted hover:text-cortex-accent hover:bg-cortex-bg transition">
          <Ic d={lesson.is_active ? 'eye' : 'eyeoff'} size={13} />
        </button>
        <button onClick={onEdit} title="Edit lesson"
          className="p-1 rounded text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg transition">
          <Ic d="edit" size={13} />
        </button>
        <button onClick={onDelete} title="Delete lesson"
          className="p-1 rounded text-cortex-muted hover:text-red-500 hover:bg-cortex-bg transition">
          <Ic d="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────
const INPUT = 'w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent transition';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-cortex-muted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ErrMsg({ msg }) {
  return <div className="text-red-500 text-sm px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">{msg}</div>;
}

function SaveBar({ saving, label, onCancel, onDelete }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" disabled={saving}
        className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
        {saving ? 'Saving…' : label}
      </button>
      <button type="button" onClick={onCancel}
        className="px-4 py-2 border border-cortex-border rounded-lg text-sm text-cortex-text hover:bg-cortex-bg transition">
        Cancel
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete}
          className="px-3 py-2 border border-red-300 dark:border-red-800 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
          <Ic d="trash" size={14} />
        </button>
      )}
    </div>
  );
}