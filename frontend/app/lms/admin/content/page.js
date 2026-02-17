// frontend/app/lms/admin/content/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/auth';

export default function ContentPage() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [sectionForm, setSectionForm] = useState({ title: '', course_id: '', parent_section_id: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', section_id: '', manual_markdown: '', sort_order: 0 });
  const [lessonFile, setLessonFile] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCourses = () => {
    apiFetch('/api/lms/admin/content/courses').then(r => r?.json()).then(d => {
      if (d) setCourses(d);
    }).finally(() => setLoading(false));
  };

  const loadTree = (courseId) => {
    apiFetch(`/api/lms/admin/content/courses/${courseId}/tree`).then(r => r?.json()).then(d => {
      if (d) setTree(d);
    });
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (selectedCourse) loadTree(selectedCourse.id); }, [selectedCourse]);

  const saveCourse = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const res = await apiFetch('/api/lms/admin/content/courses', { method: 'POST', body: JSON.stringify(courseForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveModal(null); setCourseForm({ title: '', description: '' });
      loadCourses();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const saveSection = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const res = await apiFetch('/api/lms/admin/content/sections', {
        method: 'POST',
        body: JSON.stringify({ ...sectionForm, course_id: selectedCourse?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveModal(null); loadTree(selectedCourse.id);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const saveLesson = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', lessonForm.title);
      fd.append('section_id', lessonForm.section_id);
      fd.append('manual_markdown', lessonForm.manual_markdown);
      fd.append('sort_order', lessonForm.sort_order);
      if (lessonFile) fd.append('video', lessonFile);
      const res = await apiUpload('/api/lms/admin/content/lessons', fd);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveModal(null); setLessonFile(null);
      setLessonForm({ title: '', section_id: '', manual_markdown: '', sort_order: 0 });
      loadTree(selectedCourse.id);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  // Group tree into parent sections
  const rootSections = tree.filter(s => !s.parent_section_id);
  const childSections = (parentId) => tree.filter(s => s.parent_section_id === parentId);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Content Manager</h1>
        <button onClick={() => { setActiveModal('course'); setError(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          + New Course
        </button>
      </div>

      <div className="flex gap-6">
        {/* Course list */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 px-2 mb-2 font-medium uppercase tracking-wider">Courses</div>
            {loading ? <div className="text-gray-500 text-sm px-2 py-4">Loading...</div> : (
              courses.map(c => (
                <button key={c.id} onClick={() => setSelectedCourse(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition mb-0.5 ${selectedCourse?.id === c.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs opacity-60 mt-0.5">{c.lesson_count} lessons</div>
                </button>
              ))
            )}
            {!loading && !courses.length && (
              <div className="text-gray-500 text-sm px-2 py-4">No courses yet</div>
            )}
          </div>
        </div>

        {/* Course tree */}
        <div className="flex-1">
          {!selectedCourse ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
              Select a course to manage its content
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-white font-semibold">{selectedCourse.title}</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setSectionForm({ title: '', parent_section_id: '' }); setActiveModal('section'); setError(''); }}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs transition">
                    + Section
                  </button>
                  <button onClick={() => { setLessonForm({ title: '', section_id: tree[0]?.id || '', manual_markdown: '', sort_order: 0 }); setActiveModal('lesson'); setError(''); }}
                    className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs transition">
                    + Lesson
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {rootSections.map(section => (
                  <div key={section.id} className="border border-gray-800 rounded-lg">
                    <div className="px-4 py-2.5 bg-gray-800/50 rounded-t-lg">
                      <span className="text-white font-medium text-sm">📁 {section.title}</span>
                    </div>
                    {/* Lessons in this section */}
                    {(section.lessons || []).map(lesson => (
                      <div key={lesson.id} className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">🎬</span>
                          <span className="text-gray-300 text-sm">{lesson.title}</span>
                          {lesson.video_url && <span className="text-green-500 text-xs">● video</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${lesson.is_active ? 'bg-green-900/30 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                          {lesson.is_active ? 'active' : 'inactive'}
                        </span>
                      </div>
                    ))}
                    {/* Child sections */}
                    {childSections(section.id).map(child => (
                      <div key={child.id} className="border-t border-gray-800">
                        <div className="px-8 py-2 bg-gray-800/30">
                          <span className="text-gray-400 text-sm">📂 {child.title}</span>
                        </div>
                        {(child.lessons || []).map(lesson => (
                          <div key={lesson.id} className="px-8 py-2 border-t border-gray-800/50 flex items-center gap-2">
                            <span className="text-gray-500 text-xs">🎬</span>
                            <span className="text-gray-300 text-sm">{lesson.title}</span>
                            {lesson.video_url && <span className="text-green-500 text-xs">● video</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                {!rootSections.length && (
                  <div className="text-center text-gray-500 py-8">No sections yet. Add a section to get started.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-6">

            {/* Course modal */}
            {activeModal === 'course' && (
              <>
                <h2 className="text-white font-semibold mb-4">New Course</h2>
                <form onSubmit={saveCourse} className="space-y-3">
                  <input value={courseForm.title} onChange={e=>setCourseForm(p=>({...p,title:e.target.value}))} required placeholder="Course title *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  <textarea value={courseForm.description} onChange={e=>setCourseForm(p=>({...p,description:e.target.value}))} placeholder="Description (optional)"
                    rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  {error && <div className="text-red-400 text-sm">{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition">{saving ? 'Saving...' : 'Create'}</button>
                    <button type="button" onClick={() => setActiveModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition">Cancel</button>
                  </div>
                </form>
              </>
            )}

            {/* Section modal */}
            {activeModal === 'section' && (
              <>
                <h2 className="text-white font-semibold mb-4">New Section in "{selectedCourse?.title}"</h2>
                <form onSubmit={saveSection} className="space-y-3">
                  <input value={sectionForm.title} onChange={e=>setSectionForm(p=>({...p,title:e.target.value}))} required placeholder="Section title *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Parent Section (optional — for nested)</label>
                    <select value={sectionForm.parent_section_id} onChange={e=>setSectionForm(p=>({...p,parent_section_id:e.target.value}))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                      <option value="">None (root section)</option>
                      {rootSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  {error && <div className="text-red-400 text-sm">{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition">{saving ? 'Saving...' : 'Create'}</button>
                    <button type="button" onClick={() => setActiveModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition">Cancel</button>
                  </div>
                </form>
              </>
            )}

            {/* Lesson modal */}
            {activeModal === 'lesson' && (
              <>
                <h2 className="text-white font-semibold mb-4">New Lesson</h2>
                <form onSubmit={saveLesson} className="space-y-3">
                  <input value={lessonForm.title} onChange={e=>setLessonForm(p=>({...p,title:e.target.value}))} required placeholder="Lesson title *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Section *</label>
                    <select value={lessonForm.section_id} onChange={e=>setLessonForm(p=>({...p,section_id:e.target.value}))} required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Select section...</option>
                      {tree.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Video File (mp4/webm/ogg, max 500MB)</label>
                    <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={e=>setLessonFile(e.target.files[0])}
                      className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Manual (Markdown)</label>
                    <textarea value={lessonForm.manual_markdown} onChange={e=>setLessonForm(p=>({...p,manual_markdown:e.target.value}))}
                      placeholder="# Lesson content in markdown..." rows={6}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono" />
                  </div>
                  {error && <div className="text-red-400 text-sm">{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition">{saving ? 'Uploading...' : 'Create Lesson'}</button>
                    <button type="button" onClick={() => setActiveModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition">Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
