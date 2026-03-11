// frontend/app/lms/admin/content/page.js
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

// ─── Refined Icons ────────────────────────────────────────────────────────────
const Ic = ({ d, size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {d === 'edit'    && <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}
    {d === 'trash'   && <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>}
    {d === 'video'   && <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>}
    {d === 'plus'    && <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
    {d === 'eye'     && <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
    {d === 'eyeoff'  && <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
    {d === 'folder'  && <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>}
    {d === 'chevron' && <polyline points="6 9 12 15 18 9"/>}
    {d === 'x'       && <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
    {d === 'upload'  && <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>}
    {d === 'doc'     && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>}
    {d === 'check'   && <polyline points="20 6 9 17 4 12"/>}
    {d === 'arrow-left' && <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>}
    {d === 'search' && <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}
    {d === 'quiz' && <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>}
    {d === 'assign' && <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></>}
  </svg>
);

const EMPTY_COURSE  = { title: '', description: '', difficulty: '', category: '' };
const INPUT = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all';

export default function ContentPage() {
  const [courses, setCourses]           = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [view, setView]                 = useState('grid'); // 'grid' | 'edit'
  const [search, setSearch]             = useState('');
  const [tree, setTree]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [treeLoading, setTreeLoading]   = useState(false);

  const [panel, setPanel]           = useState(null);
  const [form, setForm]             = useState({});
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const [videoEnabled, setVideoEnabled]   = useState(false);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError]     = useState('');
  const [pendingVideoUrl, setPendingVideoUrl] = useState(null);
  const videoInputRef = useRef(null);

  const [inlineAdd, setInlineAdd] = useState(null);

  const [assignTypes,  setAssignTypes]  = useState([]);
  const [assignTypeId, setAssignTypeId] = useState('');
  const [assignedIds,  setAssignedIds]  = useState(new Set());
  const [assignSaving, setAssignSaving] = useState({});

  const [quizData,    setQuizData]    = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizForm,    setQuizForm]    = useState({ title: 'Course Quiz', pass_threshold: 70, max_attempts: 3, is_active: true, questions: [] });
  const [quizSaving,  setQuizSaving]  = useState(false);
  const [quizError,   setQuizError]   = useState('');

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

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { if (selectedCourse) loadTree(selectedCourse.id); }, [selectedCourse?.id, loadTree]);

  const openPanel = (type, data = {}) => {
    setForm(data);
    setError('');
    setUploadError('');
    setUploadProgress(null);
    setPendingVideoUrl(null);
    setVideoEnabled(!!(data.video_url));
    setManualEnabled(!!(data.manual_markdown));
    setPanel({ type, data });
    setInlineAdd(null);
    if (type === 'quiz_course') {
      setQuizLoading(true);
      setQuizError('');
      apiFetch(`/api/lms/admin/content/courses/${data.id}/quiz`).then(r => r?.json()).then(d => {
        setQuizData(d);
        if (d) {
          setQuizForm({
            title: d.title,
            pass_threshold: d.pass_threshold,
            max_attempts: d.max_attempts,
            is_active: d.is_active,
            questions: d.questions.map(q => ({
              id: q.id,
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options.map(o => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct })),
            })),
          });
        } else {
          setQuizForm({ title: 'Course Quiz', pass_threshold: 70, max_attempts: 3, is_active: true, questions: [] });
        }
        setQuizLoading(false);
      });
    }
    if (type === 'assign_course') {
      setAssignTypeId('');
      setAssignedIds(new Set());
      if (assignTypes.length === 0) {
        apiFetch('/api/lms/admin/learner-types').then(r => r?.json()).then(d => {
          if (d) setAssignTypes(d.filter(t => t.is_active));
        });
      }
    }
  };

  const closePanel = () => {
    setPanel(null); setError(''); setUploadError(''); setUploadProgress(null); setPendingVideoUrl(null);
  };

  const handleVideoFile = async (file) => {
    if (!file) return;
    setUploadError('');
    const MAX_BYTES = 500 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setUploadError('File too large. Maximum 500 MB.');
      return;
    }
    setUploadProgress(0);
    try {
      const r = await apiFetch('/api/lms/admin/content/upload-url', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', d.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          setPendingVideoUrl(d.publicUrl);
          setForm(p => ({ ...p, video_url: d.publicUrl }));
          setTimeout(() => setUploadProgress(null), 1500);
        } else {
          setUploadError(`Upload failed: HTTP ${xhr.status}`);
          setUploadProgress(null);
        }
      };
      xhr.onerror = () => {
        setUploadError('Network error during upload');
        setUploadProgress(null);
      };
      xhr.send(file);
    } catch (e) {
      setUploadError('Failed to start upload: ' + e.message);
      setUploadProgress(null);
    }
  };

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
      const body   = isEdit
        ? { title: form.title, sort_order: form.sort_order }
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
      const body = {
        title:           form.title || '',
        section_id:      form.section_id || '',
        manual_markdown: manualEnabled ? (form.manual_markdown || '') : null,
        video_url:       videoEnabled ? (form.video_url || null) : null,
        sort_order:      form.sort_order || 0,
        is_active:       form.is_active !== false,
      };
      const url = isEdit ? `/api/lms/admin/content/lessons/${panel.data.id}` : '/api/lms/admin/content/lessons';
      const r   = await apiFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await loadTree(selectedCourse.id);
      closePanel();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteCourse = async (id) => {
    setDeletingId(null);
    await apiFetch(`/api/lms/admin/content/courses/${id}`, { method: 'DELETE' });
    await loadCourses();
    if (selectedCourse?.id === id) { setSelectedCourse(null); setView('grid'); }
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

  const saveQuiz = async () => {
    setQuizError(''); setQuizSaving(true);
    try {
      const r = await apiFetch(`/api/lms/admin/content/courses/${panel.data.id}/quiz`, {
        method: 'POST', body: JSON.stringify(quizForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQuizData({ ...quizForm, id: d.quiz_id });
      alert('Quiz saved successfully!');
    } catch (e) { setQuizError(e.message); }
    finally { setQuizSaving(false); }
  };

  const deleteQuiz = async () => {
    if (!confirm('Delete this quiz?')) return;
    await apiFetch(`/api/lms/admin/content/courses/${panel.data.id}/quiz`, { method: 'DELETE' });
    setQuizData(null);
    setQuizForm({ title: 'Course Quiz', pass_threshold: 70, max_attempts: 3, is_active: true, questions: [] });
  };

  const toggleLessonActive = async (lesson) => {
    await apiFetch(`/api/lms/admin/content/lessons/${lesson.id}`, {
      method: 'PUT', body: JSON.stringify({ is_active: !lesson.is_active })
    });
    await loadTree(selectedCourse.id);
  };

  const commitInlineAdd = async () => {
    if (!inlineAdd?.value?.trim()) { setInlineAdd(null); return; }
    if (inlineAdd.type === 'lesson') {
      const r = await apiFetch('/api/lms/admin/content/lessons', {
        method: 'POST',
        body: JSON.stringify({ title: inlineAdd.value.trim(), section_id: inlineAdd.parentId, sort_order: 0, is_active: true })
      });
      const data = await r.json();
      if (r.ok) {
        await loadTree(selectedCourse.id);
        setInlineAdd(null);
        openPanel('edit_lesson', { ...data, section_id: inlineAdd.parentId });
      }
    } else {
      const body = {
        course_id: selectedCourse.id,
        title: inlineAdd.value.trim(),
        parent_section_id: inlineAdd.type === 'subsection' ? inlineAdd.parentId : null,
        sort_order: 0
      };
      await apiFetch('/api/lms/admin/content/sections', { method: 'POST', body: JSON.stringify(body) });
      await loadTree(selectedCourse.id);
      setInlineAdd(null);
    }
  };

  const loadAssignments = useCallback(async (typeId) => {
    const d = await apiFetch(`/api/lms/admin/assignments?learner_type_id=${typeId}`).then(r => r?.json());
    if (d) setAssignedIds(new Set(d.map(a => a.lesson_id)));
  }, []);

  useEffect(() => {
    if (panel?.type === 'assign_course' && assignTypeId) loadAssignments(assignTypeId);
  }, [assignTypeId, panel?.type, loadAssignments]);

  const toggleAssign = async (lessonId, isAssigned) => {
    setAssignSaving(p => ({ ...p, [lessonId]: true }));
    try {
      if (isAssigned) {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'DELETE', body: JSON.stringify({ learner_type_id: Number(assignTypeId), lesson_id: lessonId })
        });
        setAssignedIds(prev => { const n = new Set(prev); n.delete(lessonId); return n; });
      } else {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'POST', body: JSON.stringify({ learner_type_id: Number(assignTypeId), lesson_id: lessonId })
        });
        setAssignedIds(prev => new Set([...prev, lessonId]));
      }
    } finally {
      setAssignSaving(p => ({ ...p, [lessonId]: false }));
    }
  };

  const rootSections    = tree.filter(s => !s.parent_section_id);
  const childSections   = (pid) => tree.filter(s => s.parent_section_id === pid);
  const allSectionsFlat = tree;

  const isPanelLesson   = panel?.type === 'new_lesson'   || panel?.type === 'edit_lesson';
  const isPanelSection  = panel?.type === 'new_section'  || panel?.type === 'edit_section';
  const isPanelCourse   = panel?.type === 'new_course'   || panel?.type === 'edit_course';
  const isPanelPreview  = panel?.type === 'preview_lesson';
  const isPanelAssign   = panel?.type === 'assign_course';
  const isPanelQuiz     = panel?.type === 'quiz_course';

  const COURSE_TABS = [
    { id: 'details',     label: 'Details',     panelType: 'edit_course',   icon: 'edit' },
    { id: 'quiz',        label: 'Quiz',        panelType: 'quiz_course',   icon: 'quiz' },
    { id: 'assignments', label: 'Assignments', panelType: 'assign_course', icon: 'assign' },
  ];
  const activeCourseTab = (panel?.type === 'edit_course' || panel?.type === 'new_course') ? 'details' : isPanelQuiz ? 'quiz' : isPanelAssign ? 'assignments' : null;
  const isCoursePanel   = activeCourseTab !== null;

  const filteredCourses = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.category?.toLowerCase().includes(search.toLowerCase()));

  // ── Render ─────────────────────────────────────────────────────────────────
  
  if (view === 'grid') {
    return (
      <div className="max-w-7xl mx-auto pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Content Studio</h1>
            <p className="text-slate-500 mt-1 font-medium">Manage your curriculum, quizzes, and assignments.</p>
          </div>
          <button onClick={() => openPanel('new_course', EMPTY_COURSE)}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2">
            <Ic d="plus" size={18} />
            Create Course
          </button>
        </header>

        <div className="relative mb-8 max-w-xl">
          <Ic d="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or category..."
            className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-12 pr-4 py-4 text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all shadow-sm"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-[2.5rem] border-dashed">
            <div className="text-5xl mb-4 opacity-20">📂</div>
            <h3 className="text-lg font-bold text-slate-900">No courses found</h3>
            <p className="text-slate-400 text-sm mt-1">Try a different search or create a new course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(c => (
              <div key={c.id} onClick={() => { setSelectedCourse(c); setView('edit'); }}
                className="group bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-600/50 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2.5 py-1 bg-slate-50 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {c.category || 'Core'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                       <Ic d="folder" size={10} /> {c.lesson_count} lessons
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors truncate">{c.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] leading-relaxed">{c.description || 'No description provided.'}</p>
                  
                  <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          {c.title[0]}
                       </div>
                       <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md ${
                          c.difficulty === 'advanced' ? 'bg-red-50 text-red-600' :
                          c.difficulty === 'intermediate' ? 'bg-amber-50 text-amber-600' :
                          'bg-emerald-50 text-emerald-600'
                       }`}>
                          {c.difficulty || 'standard'}
                       </span>
                    </div>
                    <Ic d="arrow-left" className="rotate-180 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create course panel (always available on grid) */}
        {panel?.type === 'new_course' && (
           <PanelOverlay onClose={closePanel}>
              <CourseForm 
                form={form} setForm={setForm} saving={saving} error={error} 
                onSubmit={saveCourse} onCancel={closePanel} label="Create Course"
              />
           </PanelOverlay>
        )}
      </div>
    );
  }

  // ── Editor View ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in h-[calc(100vh-12rem)] flex gap-8">
      
      {/* Sidebar: Tree */}
      <div className="w-[450px] flex flex-col bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/30">
        <header className="p-8 border-b border-slate-100 bg-slate-50/20">
          <button onClick={() => setView('grid')} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-all mb-6">
            <Ic d="arrow-left" size={14} /> Back to Courses
          </button>
          <div className="flex items-start justify-between gap-4">
             <div className="min-w-0">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight truncate leading-tight">{selectedCourse.title}</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{selectedCourse.category || 'General'}</p>
             </div>
             <button onClick={() => openPanel('edit_course', { ...selectedCourse })} className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <Ic d="edit" size={16} />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
           <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Content Structure</h2>
              <button onClick={() => setInlineAdd({ type: 'section', parentId: null, value: '' })} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                + Section
              </button>
           </div>
           
           {treeLoading ? (
             <div className="py-10 text-center">
                <div className="w-6 h-6 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto" />
             </div>
           ) : (
             <div className="space-y-1">
               {inlineAdd?.type === 'section' && inlineAdd.parentId === null && (
                 <InlineInput
                   placeholder="New section title..."
                   value={inlineAdd.value}
                   onChange={v => setInlineAdd(p => ({ ...p, value: v }))}
                   onConfirm={commitInlineAdd}
                   onCancel={() => setInlineAdd(null)}
                 />
               )}
               {rootSections.length === 0 && !inlineAdd ? (
                 <div className="py-10 text-center px-6">
                    <p className="text-sm text-slate-400 font-medium">Structure is empty. Create your first section to begin.</p>
                 </div>
               ) : (
                 rootSections.map(section => (
                   <SectionBlock key={section.id} section={section}
                     childSections={childSections(section.id)}
                     inlineAdd={inlineAdd}
                     setInlineAdd={setInlineAdd}
                     commitInlineAdd={commitInlineAdd}
                     onEditSection={(s) => openPanel('edit_section', { ...s })}
                     onDeleteSection={(id) => setDeletingId({ type: 'section', id })}
                     onEditLesson={(l) => openPanel('edit_lesson', { ...l, section_id: l.section_id ?? section.id })}
                     onPreviewLesson={(l) => openPanel('preview_lesson', { ...l })}
                     onDeleteLesson={(id) => setDeletingId({ type: 'lesson', id })}
                     onToggleActive={toggleLessonActive}
                     activePanel={panel}
                   />
                 ))
               )}
             </div>
           )}
        </div>
      </div>

      {/* Main Panel: Editor/Preview/Assignment */}
      <div className="flex-1 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex flex-col overflow-hidden relative">
        {!panel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="text-6xl mb-6 grayscale opacity-20">✏️</div>
            <p className="font-bold uppercase tracking-widest text-xs">Select content to begin editing</p>
          </div>
        ) : (
          <>
            <header className="px-10 py-8 border-b border-slate-100 bg-slate-50/20 relative overflow-hidden flex-shrink-0">
               <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
               
               <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {isCoursePanel && COURSE_TABS.map(tab => (
                       <button key={tab.id} onClick={() => openPanel(tab.panelType, { ...selectedCourse })}
                        className={`text-xs font-black uppercase tracking-[0.2em] pb-2 transition-all relative ${activeCourseTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                          {tab.label}
                          {activeCourseTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full animate-scale-in" />}
                       </button>
                    ))}
                    {!isCoursePanel && (
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {panel.type === 'new_section'    && 'Create Section'}
                        {panel.type === 'edit_section'   && 'Edit Section'}
                        {panel.type === 'edit_lesson'    && 'Edit Lesson'}
                        {panel.type === 'preview_lesson' && 'Lesson Preview'}
                      </h2>
                    )}
                  </div>
                  <button onClick={closePanel} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <Ic d="x" size={20} />
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {/* Preview Lesson */}
              {isPanelPreview && (
                <div className="animate-fade-in">
                  {panel.data.video_url ? (
                    <div className="aspect-video bg-black overflow-hidden relative">
                       <video src={panel.data.video_url} controls className="w-full h-full" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                       <Ic d="video" size={48} className="opacity-20 mb-4" />
                       <span className="text-sm font-bold uppercase tracking-widest">No video asset available</span>
                    </div>
                  )}

                  <div className="p-10 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-10">
                       <div>
                         <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">{panel.data.title}</h1>
                         <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${panel.data.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${panel.data.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                           {panel.data.is_active ? 'Visible to learners' : 'Hidden from learners'}
                         </div>
                       </div>
                       <button onClick={() => openPanel('edit_lesson', { ...panel.data })} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all">Edit Content</button>
                    </div>

                    {panel.data.manual_markdown ? (
                      <div className="prose prose-slate max-w-none">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 pb-2 border-b border-slate-100">User Manual</h3>
                        <SimpleMarkdownPreview content={panel.data.manual_markdown} />
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                         <p className="text-sm font-medium text-slate-400">No written manual for this lesson.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Course Forms */}
              {isPanelCourse && (
                <form onSubmit={saveCourse} className="p-10 max-w-2xl mx-auto space-y-8 animate-fade-in">
                   <Field label="Course Title">
                      <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className={INPUT} placeholder="e.g. Hospital Ethics 101" />
                   </Field>
                   <Field label="Strategic Description">
                      <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} className={`${INPUT} resize-none`} placeholder="Vision and goals for this course..." />
                   </Field>
                   <div className="grid grid-cols-2 gap-6">
                      <Field label="Category">
                         <input value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={INPUT} placeholder="e.g. Compliance" />
                      </Field>
                      <Field label="Difficulty Level">
                         <select value={form.difficulty || ''} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} className={INPUT}>
                           <option value="">Standard</option>
                           <option value="beginner">Beginner</option>
                           <option value="intermediate">Intermediate</option>
                           <option value="advanced">Advanced</option>
                         </select>
                      </Field>
                   </div>
                   <label className="flex items-center gap-3 cursor-pointer p-4 bg-violet-50 rounded-2xl border border-violet-100 group">
                      <input type="checkbox" checked={!!form.is_coming_soon} onChange={e => setForm(p => ({ ...p, is_coming_soon: e.target.checked }))} className="accent-violet-600 w-5 h-5" />
                      <div className="flex-1">
                         <span className="text-sm font-bold text-slate-900 block">Coming Soon</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Show this course as "Coming Soon" to learners before it launches</span>
                      </div>
                   </label>
                   {error && <ErrMsg msg={error} />}
                   <div className="pt-6">
                      <SaveBar saving={saving} label={panel.type === 'new_course' ? 'Initiate Course' : 'Commit Changes'} onCancel={closePanel} onDelete={panel.type === 'edit_course' ? () => setDeletingId({ type: 'course', id: panel.data.id }) : null} />
                   </div>
                </form>
              )}

              {/* Section Form */}
              {isPanelSection && (
                <form onSubmit={saveSection} className="p-10 max-w-xl mx-auto space-y-8 animate-fade-in">
                   <Field label="Section Nomenclature">
                      <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className={INPUT} placeholder="e.g. Module A: Patient Intake" />
                   </Field>
                   <Field label="Ordering Position">
                      <input type="number" value={form.sort_order ?? 0} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className={INPUT} min={0} />
                   </Field>
                   {error && <ErrMsg msg={error} />}
                   <div className="pt-6">
                     <SaveBar saving={saving} label={panel.type === 'new_section' ? 'Create Section' : 'Commit Section'} onCancel={closePanel} onDelete={panel.type === 'edit_section' ? () => setDeletingId({ type: 'section', id: panel.data.id }) : null} />
                   </div>
                </form>
              )}

              {/* Lesson Form */}
              {isPanelLesson && (
                <form onSubmit={saveLesson} className="p-10 max-w-3xl mx-auto space-y-10 animate-fade-in">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-8">
                        <Field label="Lesson Nomenclature">
                          <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className={INPUT} placeholder="e.g. Patient Privacy Protocols" />
                        </Field>
                        <Field label="Parent Structural Section">
                          <select value={form.section_id || ''} onChange={e => setForm(p => ({ ...p, section_id: e.target.value }))} required className={INPUT}>
                            <option value="">— Choose parent —</option>
                            {allSectionsFlat.map(s => <option key={s.id} value={s.id}>{s.parent_section_id ? `  ↳ ${s.title}` : s.title}</option>)}
                          </select>
                        </Field>
                        <Field label="Ordering Index">
                           <input type="number" value={form.sort_order ?? 0} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className={INPUT} min={0} />
                        </Field>
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                           <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-blue-600 w-5 h-5" />
                           <div className="flex-1">
                              <span className="text-sm font-bold text-slate-900 block">Lesson Visibility</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Make this lesson visible to all learners</span>
                           </div>
                        </label>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Content Configuration</h3>
                        
                        {/* Video Asset */}
                        <div className={`p-6 rounded-[2rem] border-2 transition-all ${videoEnabled ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 bg-white'}`}>
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                 <Ic d="video" className={videoEnabled ? 'text-blue-600' : 'text-slate-300'} />
                                 <span className={`text-sm font-bold ${videoEnabled ? 'text-slate-900' : 'text-slate-400'}`}>Video Asset</span>
                              </div>
                              <button type="button" onClick={() => setVideoEnabled(!videoEnabled)} className={`w-10 h-6 rounded-full transition-all relative ${videoEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${videoEnabled ? 'left-5' : 'left-1'}`} />
                              </button>
                           </div>
                           
                           {videoEnabled && (
                             <div className="space-y-4 animate-slide-up">
                               {form.video_url ? (
                                 <div className="rounded-xl overflow-hidden bg-black aspect-video relative group">
                                    <video src={form.video_url} className="w-full h-full" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                       <button type="button" onClick={() => setForm(p => ({ ...p, video_url: null }))} className="text-white bg-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700">Remove</button>
                                    </div>
                                 </div>
                               ) : (
                                 <label className="flex flex-col items-center gap-3 py-10 border-2 border-dashed border-blue-200 bg-white rounded-[1.5rem] cursor-pointer hover:bg-blue-50/50 transition-all">
                                    <Ic d="upload" size={32} className="text-blue-400" />
                                    <div className="text-center">
                                       <span className="text-xs font-bold text-slate-900 block">Upload MP4 Master</span>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Max 500MB</span>
                                    </div>
                                    <input type="file" accept="video/*" className="hidden" onChange={e => handleVideoFile(e.target.files[0])} />
                                 </label>
                               )}
                               {uploadProgress !== null && (
                                 <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                 </div>
                               )}
                             </div>
                           )}
                        </div>

                        {/* Manual Asset */}
                        <div className={`p-6 rounded-[2rem] border-2 transition-all ${manualEnabled ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 bg-white'}`}>
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                 <Ic d="doc" className={manualEnabled ? 'text-blue-600' : 'text-slate-300'} />
                                 <span className={`text-sm font-bold ${manualEnabled ? 'text-slate-900' : 'text-slate-400'}`}>User Manual</span>
                              </div>
                              <button type="button" onClick={() => setManualEnabled(!manualEnabled)} className={`w-10 h-6 rounded-full transition-all relative ${manualEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${manualEnabled ? 'left-5' : 'left-1'}`} />
                              </button>
                           </div>
                           {manualEnabled && (
                             <textarea value={form.manual_markdown || ''} onChange={e => setForm(p => ({ ...p, manual_markdown: e.target.value }))} className="w-full bg-white border border-slate-100 rounded-[1.5rem] p-4 text-xs font-mono min-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-600/5 animate-slide-up" placeholder="# Lesson Guide&#10;&#10;Use markdown for formatting..." />
                           )}
                        </div>
                      </div>
                   </div>

                   {error && <ErrMsg msg={error} />}
                   <div className="pt-10 border-t border-slate-100">
                     <SaveBar saving={saving || uploadProgress !== null} label={panel.type === 'new_lesson' ? 'Initialize Lesson' : 'Commit Lesson'} onCancel={closePanel} onDelete={panel.type === 'edit_lesson' ? () => setDeletingId({ type: 'lesson', id: panel.data.id }) : null} />
                   </div>
                </form>
              )}

              {/* Quiz Panel */}
              {isPanelQuiz && (
                <div className="p-10 max-w-4xl mx-auto animate-fade-in space-y-10">
                   {quizLoading ? (
                     <div className="py-20 text-center"><div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                   ) : (
                     <>
                        <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                           <div className="relative">
                             <h2 className="text-3xl font-black tracking-tight mb-2">Compulsory Assessment</h2>
                             <p className="text-blue-100 font-medium opacity-80">Design the final verification for this course.</p>
                             
                             <div className="grid grid-cols-3 gap-8 mt-10">
                                <div className="space-y-1">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Pass Mark</span>
                                   <input type="number" value={quizForm.pass_threshold} onChange={e => setQuizForm(p => ({ ...p, pass_threshold: Number(e.target.value) }))} className="w-full bg-white/10 border-none rounded-xl px-4 py-2 text-white font-black text-xl focus:ring-2 focus:ring-white/20" />
                                </div>
                                <div className="space-y-1">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Max Attempts</span>
                                   <input type="number" value={quizForm.max_attempts} onChange={e => setQuizForm(p => ({ ...p, max_attempts: Number(e.target.value) }))} className="w-full bg-white/10 border-none rounded-xl px-4 py-2 text-white font-black text-xl focus:ring-2 focus:ring-white/20" />
                                </div>
                                <div className="flex items-end">
                                   <button onClick={saveQuiz} className="w-full bg-white text-blue-600 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-lg active:scale-95">
                                      {quizSaving ? 'Syncing...' : 'Update Config'}
                                   </button>
                                </div>
                             </div>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <div className="flex items-center justify-between gap-3 flex-wrap">
                              <h3 className="text-xl font-black text-slate-900 tracking-tight">Question Catalog</h3>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const csv = [
                                      'Question,A,B,C,D,Answer',
                                      '"What is the primary purpose of hand hygiene?","Prevent infection spread","Save time","Reduce paperwork","Improve communication","A"',
                                      '"How often should patient records be updated?","Daily","Weekly","Monthly","Annually","A"',
                                      '"Which PPE item protects the eyes?","Goggles","Gloves","Gown","Mask","A"',
                                    ].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; a.download = 'quiz_template.csv'; a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-2xl font-bold text-xs hover:bg-slate-100 transition-all shadow-sm"
                                  title="Download a sample CSV template"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Template
                                </button>
                                <label className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-2xl font-bold text-xs hover:bg-green-100 transition-all cursor-pointer shadow-sm active:scale-95" title="Import questions from Excel/CSV. Required columns: Question, A, B, C, D, Answer (letter A–D)">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  Import Excel
                                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    e.target.value = '';
                                    try {
                                      const xlsxMod = await import('xlsx');
                                      const XLSX = xlsxMod.default ?? xlsxMod;
                                      const buf = await file.arrayBuffer();
                                      const wb = XLSX.read(buf, { type: 'array' });
                                      const ws = wb.Sheets[wb.SheetNames[0]];
                                      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                                      const parsed = [];
                                      for (const row of rows) {
                                        const q = String(row['Question'] || row['question'] || row['Q'] || '').trim();
                                        if (!q) continue;
                                        const a = String(row['A'] || row['option_a'] || row['Option A'] || '').trim();
                                        const b = String(row['B'] || row['option_b'] || row['Option B'] || '').trim();
                                        const c = String(row['C'] || row['option_c'] || row['Option C'] || '').trim();
                                        const d = String(row['D'] || row['option_d'] || row['Option D'] || '').trim();
                                        const ans = String(row['Answer'] || row['answer'] || row['Correct'] || row['correct'] || 'A').trim().toUpperCase();
                                        const opts = [a, b, c, d].filter(Boolean).map((text, i) => ({
                                          option_text: text,
                                          is_correct: ['A','B','C','D'][i] === ans,
                                        }));
                                        if (opts.length >= 2) parsed.push({ question_text: q, question_type: 'single', options: opts });
                                      }
                                      if (parsed.length === 0) { alert('No valid questions found. Ensure columns: Question, A, B, C, D, Answer'); return; }
                                      setQuizForm(p => ({ ...p, questions: [...p.questions, ...parsed] }));
                                      alert(`Imported ${parsed.length} question${parsed.length !== 1 ? 's' : ''}`);
                                    } catch (err) {
                                      alert('Failed to parse file: ' + err.message);
                                    }
                                  }} />
                                </label>
                                <button onClick={() => setQuizForm(p => ({ ...p, questions: [...p.questions, { question_text: '', question_type: 'single', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }] }))}
                                  className="bg-slate-900 text-white px-6 py-2 rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                                  + Add Question
                                </button>
                              </div>
                           </div>

                           {quizForm.questions.length === 0 ? (
                             <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No questions defined for this assessment</p>
                             </div>
                           ) : (
                             <div className="space-y-6 pb-20">
                                {quizForm.questions.map((q, qi) => (
                                  <div key={qi} className="group bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all relative">
                                     <button onClick={() => setQuizForm(p => ({ ...p, questions: p.questions.filter((_, i) => i !== qi) }))} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                        <Ic d="trash" size={16} />
                                     </button>
                                     <div className="flex gap-6">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0">{qi + 1}</div>
                                        <div className="flex-1 space-y-6">
                                           <textarea value={q.question_text} onChange={e => {
                                              const qs = [...quizForm.questions]; qs[qi].question_text = e.target.value; setQuizForm(p => ({ ...p, questions: qs }));
                                           }} rows={2} className={`${INPUT} text-lg font-bold !bg-transparent !border-none !px-0 !ring-0`} placeholder="Write your question here..." />
                                           
                                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {q.options.map((opt, oi) => (
                                                <div key={oi} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-blue-200 group/opt">
                                                   <button onClick={() => {
                                                      const qs = [...quizForm.questions];
                                                      const opts = [...qs[qi].options];
                                                      if (q.question_type === 'single') opts.forEach((o, i) => o.is_correct = (i === oi));
                                                      else opts[oi].is_correct = !opts[oi].is_correct;
                                                      qs[qi].options = opts; setQuizForm(p => ({ ...p, questions: qs }));
                                                   }} className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${opt.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 group-hover/opt:border-emerald-300'}`}>
                                                      {opt.is_correct && <Ic d="check" size={12} />}
                                                   </button>
                                                   <input value={opt.option_text} onChange={e => {
                                                      const qs = [...quizForm.questions]; qs[qi].options[oi].option_text = e.target.value; setQuizForm(p => ({ ...p, questions: qs }));
                                                   }} className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0" placeholder={`Option ${oi + 1}...`} />
                                                   {q.options.length > 2 && (
                                                      <button onClick={() => {
                                                        const qs = [...quizForm.questions]; qs[qi].options = qs[qi].options.filter((_, i) => i !== oi); setQuizForm(p => ({ ...p, questions: qs }));
                                                      }} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/opt:opacity-100"><Ic d="x" size={14} /></button>
                                                   )}
                                                </div>
                                              ))}
                                              <button onClick={() => {
                                                 const qs = [...quizForm.questions]; qs[qi].options.push({ option_text: '', is_correct: false }); setQuizForm(p => ({ ...p, questions: qs }));
                                              }} className="flex items-center justify-center p-3 rounded-2xl border-2 border-dashed border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400 hover:border-blue-200 hover:text-blue-600 transition-all">+ Add Option</button>
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                                ))}
                             </div>
                           )}

                           {/* Sticky Save Quiz button */}
                           <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6">
                             {quizError && <p className="text-red-500 text-sm mb-3 px-1">{quizError}</p>}
                             <button onClick={saveQuiz} disabled={quizSaving}
                               className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50">
                               {quizSaving ? 'Saving Quiz…' : `Save Quiz${quizForm.questions.length > 0 ? ` (${quizForm.questions.length} question${quizForm.questions.length !== 1 ? 's' : ''})` : ''}`}
                             </button>
                           </div>
                        </div>
                     </>
                   )}
                </div>
              )}

              {/* Assignment Panel */}
              {isPanelAssign && (
                <div className="flex flex-col h-full animate-fade-in">
                   <header className="px-10 py-8 border-b border-slate-100 bg-blue-50/10">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Select Staff Type</h2>
                      <div className="flex flex-wrap gap-2">
                         {assignTypes.map(t => (
                           <button key={t.id} onClick={() => setAssignTypeId(t.id)}
                            className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-tight transition-all border-2 ${
                              assignTypeId === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-600'
                            }`}>
                              {t.name}
                           </button>
                         ))}
                      </div>
                   </header>

                   <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                      {!assignTypeId ? (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <Ic d="assign" size={48} className="opacity-20 mb-4" />
                            <p className="font-bold uppercase tracking-widest text-xs">Choose a learner group to manage access</p>
                         </div>
                      ) : (
                        <div className="space-y-10 pb-20 animate-slide-up">
                           {rootSections.map(section => {
                             const sLessons = section.lessons || [];
                             const assignedCount = sLessons.filter(l => assignedIds.has(l.id)).length;
                             const allAssigned = sLessons.length > 0 && assignedCount === sLessons.length;
                             
                             return (
                               <div key={section.id} className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                                  <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                     <div>
                                        <h3 className="text-sm font-black text-slate-900 tracking-tight">{section.title}</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{assignedCount} / {sLessons.length} lessons assigned</span>
                                     </div>
                                     {sLessons.length > 0 && (
                                       <button onClick={() => sLessons.forEach(l => toggleAssign(l.id, allAssigned))}
                                        className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                                          allAssigned ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}>
                                          {allAssigned ? 'Unassign All' : 'Assign All'}
                                       </button>
                                     )}
                                  </div>
                                  <div className="divide-y divide-slate-50">
                                     {sLessons.map(lesson => (
                                       <div key={lesson.id} className="px-8 py-4 flex items-center justify-between group hover:bg-slate-50/30 transition-all">
                                          <div className="flex items-center gap-4">
                                             <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${assignedIds.has(lesson.id) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                                                <Ic d="video" size={14} />
                                             </div>
                                             <div className="text-sm font-bold text-slate-700">{lesson.title}</div>
                                          </div>
                                          <button onClick={() => toggleAssign(lesson.id, assignedIds.has(lesson.id))} disabled={assignSaving[lesson.id]}
                                            className={`w-10 h-6 rounded-full transition-all relative ${assignedIds.has(lesson.id) ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                             {assignSaving[lesson.id] ? (
                                                <div className="absolute inset-1 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                             ) : (
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${assignedIds.has(lesson.id) ? 'left-5' : 'left-1'}`} />
                                             )}
                                          </button>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Overlay */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-scale-in text-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Confirm Delete</h2>
            <p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed">
               This action is permanent and will destroy all associated data for this {deletingId.type}.
            </p>
            <div className="flex flex-col gap-3">
               <button onClick={() => {
                 if (deletingId.type === 'course')  deleteCourse(deletingId.id);
                 if (deletingId.type === 'section') deleteSection(deletingId.id);
                 if (deletingId.type === 'lesson')  deleteLesson(deletingId.id);
               }} className="bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 shadow-xl shadow-red-100 active:scale-95 transition-all">
                 Proceed with Deletion
               </button>
               <button onClick={() => setDeletingId(null)} className="py-4 text-slate-400 font-bold hover:text-slate-900 transition-colors">
                 Cancel and Return
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionBlock({ section, childSections, inlineAdd, setInlineAdd, commitInlineAdd, onEditSection, onDeleteSection, onEditLesson, onPreviewLesson, onDeleteLesson, onToggleActive, activePanel }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-2xl overflow-hidden mb-1">
      <div className={`flex items-center gap-3 px-4 py-3 group transition-all duration-300 ${open ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
        <button onClick={() => setOpen(!open)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${open ? 'bg-white text-slate-900 shadow-sm rotate-90' : 'text-slate-300'}`}>
           <Ic d="chevron" size={12} className="rotate-[-90deg]" />
        </button>
        <Ic d="folder" className={open ? 'text-blue-600' : 'text-slate-300'} size={14} />
        <div className="flex-1 min-w-0" onClick={() => setOpen(!open)}>
           <span className="text-xs font-bold text-slate-900 truncate block">{section.title}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
           <button onClick={() => setInlineAdd({ type: 'lesson', parentId: section.id, value: '' })} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition-all"><Ic d="plus" size={14} /></button>
           <button onClick={() => onEditSection(section)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white transition-all"><Ic d="edit" size={14} /></button>
           <button onClick={() => onDeleteSection(section.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-all"><Ic d="trash" size={14} /></button>
        </div>
      </div>

      {open && (
        <div className="pb-2 animate-fade-in">
          <div className="space-y-0.5">
            {section.lessons?.map(lesson => (
              <LessonRow key={lesson.id} lesson={lesson}
                isActive={activePanel?.data?.id === lesson.id}
                onPreview={() => onPreviewLesson(lesson)}
                onEdit={() => onEditLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson.id)}
                onToggleActive={() => onToggleActive(lesson)} />
            ))}
            
            {inlineAdd?.parentId === section.id && (
              <div className="px-12 py-1">
                <InlineInput placeholder={inlineAdd.type === 'lesson' ? 'New lesson title...' : 'New sub-section title...'} value={inlineAdd.value} onChange={v => setInlineAdd(p => ({ ...p, value: v }))} onConfirm={commitInlineAdd} onCancel={() => setInlineAdd(null)} />
              </div>
            )}
            
            {childSections.map(child => (
               <div key={child.id} className="ml-6 pl-2 border-l-2 border-slate-100">
                  <SectionBlock section={child} childSections={[]} inlineAdd={inlineAdd} setInlineAdd={setInlineAdd} commitInlineAdd={commitInlineAdd} onEditSection={onEditSection} onDeleteSection={onDeleteSection} onEditLesson={onEditLesson} onPreviewLesson={onPreviewLesson} onDeleteLesson={onDeleteLesson} onToggleActive={onToggleActive} activePanel={activePanel} />
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LessonRow({ lesson, onPreview, onEdit, onDelete, onToggleActive, isActive }) {
  return (
    <div onClick={onPreview} className={`flex items-center gap-3 px-12 py-3 transition-all cursor-pointer group relative ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-blue-50/50'}`}>
       <div className={`w-1.5 h-1.5 rounded-full ${lesson.is_active ? 'bg-emerald-500' : 'bg-slate-300'} ${isActive ? '!bg-white' : ''}`} />
       <div className="flex-1 min-w-0">
          <span className={`text-xs font-medium truncate block ${isActive ? 'text-white' : 'text-slate-600'}`}>{lesson.title}</span>
          <div className={`flex gap-2 text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
             {lesson.video_url && <span>Video</span>}
             {lesson.manual_markdown && <span>Manual</span>}
          </div>
       </div>
       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
          <button onClick={onToggleActive} className={`p-1.5 rounded-lg transition-all ${isActive ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-blue-600 hover:bg-white'}`}><Ic d={lesson.is_active ? 'eye' : 'eyeoff'} size={12} /></button>
          <button onClick={onEdit} className={`p-1.5 rounded-lg transition-all ${isActive ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-white'}`}><Ic d="edit" size={12} /></button>
          <button onClick={onDelete} className={`p-1.5 rounded-lg transition-all ${isActive ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-red-500 hover:bg-white'}`}><Ic d="trash" size={12} /></button>
       </div>
    </div>
  );
}

function InlineInput({ placeholder, value, onChange, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex items-center gap-2 animate-fade-in">
       <input ref={ref} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }} placeholder={placeholder} className="flex-1 bg-white border border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 shadow-lg shadow-blue-600/5" />
       <button onClick={onConfirm} className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-blue-600/20 active:scale-90 transition-all">✓</button>
    </div>
  );
}

function SimpleMarkdownPreview({ content }) {
  if (!content) return null;
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-slate-900 text-base mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-slate-900 text-lg mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-slate-900 text-2xl mt-10 mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-slate-600 list-disc mb-2">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-slate-600 mb-4 leading-relaxed">')
    .replace(/\n/g, '<br/>');
  return (
    <div className="font-serif text-slate-600 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-4 leading-relaxed">${html}</p>` }} />
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block px-1">{label}</label>
      {children}
    </div>
  );
}

function ErrMsg({ msg }) {
  return <div className="text-red-500 text-xs font-bold bg-red-50 rounded-2xl px-4 py-3 border border-red-100 animate-slide-up">{msg}</div>;
}

function SaveBar({ saving, label, onCancel, onDelete }) {
  return (
    <div className="flex gap-3">
      <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 active:scale-95 transition-all">
        {saving ? 'Synchronizing...' : label}
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="px-6 py-4 border border-red-200 text-red-500 rounded-2xl font-black text-sm hover:bg-red-50 transition-all">
          <Ic d="trash" size={18} />
        </button>
      )}
    </div>
  );
}

function PanelOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
       <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-2 shadow-2xl animate-scale-in relative overflow-hidden">
          <div className="max-h-[85vh] overflow-y-auto p-8 scrollbar-hide">
             {children}
          </div>
       </div>
    </div>
  );
}

function CourseForm({ form, setForm, saving, error, onSubmit, onCancel, label, onDelete }) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
       <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{label}</h2>
          <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><Ic d="x" size={20} /></button>
       </div>
       <Field label="Course Nomenclature">
          <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className={INPUT} placeholder="e.g. Clinical Safety V2" />
       </Field>
       <Field label="Strategic Description">
          <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} className={`${INPUT} resize-none`} placeholder="What should the learner achieve?" />
       </Field>
       <div className="grid grid-cols-2 gap-6">
          <Field label="Category">
             <input value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={INPUT} placeholder="Compliance" />
          </Field>
          <Field label="Difficulty Level">
             <select value={form.difficulty || ''} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} className={INPUT}>
               <option value="">Standard</option>
               <option value="beginner">Beginner</option>
               <option value="intermediate">Intermediate</option>
               <option value="advanced">Advanced</option>
             </select>
          </Field>
       </div>
       <label className="flex items-center gap-3 cursor-pointer p-4 bg-violet-50 rounded-2xl border border-violet-100">
          <input type="checkbox" checked={!!form.is_coming_soon} onChange={e => setForm(p => ({ ...p, is_coming_soon: e.target.checked }))} className="accent-violet-600 w-5 h-5" />
          <div className="flex-1">
             <span className="text-sm font-bold text-slate-900 block">Coming Soon</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase">Show this course as "Coming Soon" before it launches</span>
          </div>
       </label>
       {error && <ErrMsg msg={error} />}
       <div className="pt-6">
          <SaveBar saving={saving} label={label} onCancel={onCancel} onDelete={onDelete} />
       </div>
    </form>
  );
}
