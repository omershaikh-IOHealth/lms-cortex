// frontend/app/lms/admin/assignments/page.js
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

export default function AssignmentsPage() {
  const [types,        setTypes]        = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [courses,      setCourses]      = useState([]);
  const [tree,         setTree]         = useState([]);
  const [assignedIds,  setAssignedIds]  = useState(new Set());
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState({});   // lessonId → bool
  const [search,       setSearch]       = useState('');

  // Initial load: types + courses
  useEffect(() => {
    Promise.all([
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
      apiFetch('/api/lms/admin/content/courses').then(r => r?.json()),
    ]).then(([t, c]) => {
      if (t) setTypes(t.filter(x => x.is_active));
      if (c) setCourses(c);
    });
  }, []);

  const loadAssignmentsAndTree = useCallback(async (typeId) => {
    if (!courses.length) return;
    setLoading(true);
    setSearch('');
    const [assignments, ...treeParts] = await Promise.all([
      apiFetch(`/api/lms/admin/assignments?learner_type_id=${typeId}`).then(r => r?.json()),
      ...courses.map(c => apiFetch(`/api/lms/admin/content/courses/${c.id}/tree`).then(r => r?.json()))
    ]);
    if (assignments) setAssignedIds(new Set(assignments.map(a => a.lesson_id)));
    const combined = treeParts.flatMap((t, i) => (t || []).map(s => ({ ...s, _course: courses[i] })));
    setTree(combined);
    setLoading(false);
  }, [courses]);

  useEffect(() => {
    if (selectedType && courses.length) loadAssignmentsAndTree(selectedType.id);
  }, [selectedType?.id, courses.length]);

  const toggle = async (lessonId, isAssigned) => {
    setSaving(p => ({ ...p, [lessonId]: true }));
    try {
      if (isAssigned) {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'DELETE', body: JSON.stringify({ learner_type_id: selectedType.id, lesson_id: lessonId })
        });
        setAssignedIds(prev => { const n = new Set(prev); n.delete(lessonId); return n; });
      } else {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'POST', body: JSON.stringify({ learner_type_id: selectedType.id, lesson_id: lessonId })
        });
        setAssignedIds(prev => new Set([...prev, lessonId]));
      }
    } finally {
      setSaving(p => ({ ...p, [lessonId]: false }));
    }
  };

  // Assign/unassign all lessons in a section
  const toggleSection = async (lessons, shouldAssign) => {
    const toChange = lessons.filter(l => shouldAssign ? !assignedIds.has(l.id) : assignedIds.has(l.id));
    await Promise.all(toChange.map(l => toggle(l.id, !shouldAssign)));
  };

  // Flatten for search
  const allLessons = tree.flatMap(s => (s.lessons || []).map(l => ({ ...l, _section: s.title, _course: s._course?.title })));
  const searchFiltered = search.trim()
    ? allLessons.filter(l => (l.title + l._section + l._course).toLowerCase().includes(search.toLowerCase()))
    : null;

  const totalAssigned = assignedIds.size;
  const totalLessons  = allLessons.length;

  // Group tree by course
  const byCourse = courses.reduce((acc, c) => {
    acc[c.id] = { course: c, sections: tree.filter(s => s._course?.id === c.id && !s.parent_section_id) };
    return acc;
  }, {});

  return (
    <div className="flex h-full">

      {/* ── Left: type selector ──────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 bg-cortex-surface border-r border-cortex-border flex flex-col">
        <div className="px-4 py-3 border-b border-cortex-border">
          <div className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">Learner Types</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {types.length === 0 && <div className="text-cortex-muted text-sm px-2 py-6 text-center">No active types</div>}
          {types.map(t => (
            <button key={t.id} onClick={() => setSelectedType(t)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                selectedType?.id === t.id ? 'bg-cortex-accent text-white' : 'text-cortex-text hover:bg-cortex-bg'
              }`}>
              <div className="font-medium">{t.name}</div>
              {selectedType?.id === t.id && (
                <div className="text-white/70 text-xs mt-0.5">{totalAssigned} assigned</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: lesson tree with toggles ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedType ? (
          <div className="h-full flex items-center justify-center text-cortex-muted">
            <div className="text-center">
              <div className="text-4xl mb-2">🔗</div>
              <div className="text-sm">Select a learner type to manage assignments</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header bar */}
            <div className="sticky top-0 bg-cortex-surface border-b border-cortex-border z-10 px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-cortex-text">{selectedType.name}</span>
                <span className="text-cortex-muted text-sm ml-2">— {totalAssigned}/{totalLessons} lessons assigned</span>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search lessons…"
                className="w-52 bg-cortex-bg border border-cortex-border rounded-lg px-3 py-1.5 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
            </div>

            {loading ? (
              <div className="p-12 text-center text-cortex-muted text-sm">Loading…</div>
            ) : searchFiltered ? (
              /* Search results flat list */
              <div className="p-4 space-y-1">
                {searchFiltered.length === 0 && (
                  <div className="text-center text-cortex-muted text-sm py-8">No lessons match "{search}"</div>
                )}
                {searchFiltered.map(l => (
                  <LessonToggleRow key={l.id} lesson={l} assigned={assignedIds.has(l.id)}
                    saving={!!saving[l.id]} onToggle={() => toggle(l.id, assignedIds.has(l.id))}
                    subtitle={`${l._course} › ${l._section}`} />
                ))}
              </div>
            ) : (
              /* Grouped by course / section */
              <div>
                {Object.values(byCourse).filter(g => g.sections.length > 0).map(({ course, sections }) => (
                  <div key={course.id} className="border-b border-cortex-border last:border-0">
                    {/* Course label */}
                    <div className="px-5 py-3 bg-cortex-bg flex items-center gap-2">
                      <span className="text-xs font-bold text-cortex-text uppercase tracking-wider">{course.title}</span>
                    </div>

                    {sections.map(section => {
                      const lessons      = section.lessons || [];
                      const assignedHere = lessons.filter(l => assignedIds.has(l.id)).length;
                      const allAssigned  = lessons.length > 0 && assignedHere === lessons.length;
                      const childSects   = tree.filter(s => s.parent_section_id === section.id);

                      return (
                        <div key={section.id}>
                          {/* Section row */}
                          <div className="flex items-center gap-3 px-5 py-2.5 border-t border-cortex-border bg-cortex-surface/50">
                            <div className="flex-1 text-sm font-medium text-cortex-text">{section.title}</div>
                            <span className="text-xs text-cortex-muted">{assignedHere}/{lessons.length}</span>
                            {lessons.length > 1 && (
                              <button onClick={() => toggleSection(lessons, !allAssigned)}
                                className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${
                                  allAssigned
                                    ? 'bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20'
                                    : 'bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-text'
                                }`}>
                                {allAssigned ? 'Unassign all' : 'Assign all'}
                              </button>
                            )}
                          </div>

                          {/* Lessons */}
                          {lessons.map(lesson => (
                            <LessonToggleRow key={lesson.id} lesson={lesson}
                              assigned={assignedIds.has(lesson.id)} saving={!!saving[lesson.id]}
                              onToggle={() => toggle(lesson.id, assignedIds.has(lesson.id))} />
                          ))}

                          {lessons.length === 0 && (
                            <div className="px-10 py-2 text-xs text-cortex-muted italic border-t border-cortex-border">
                              No lessons in this section
                            </div>
                          )}

                          {/* Child sections */}
                          {childSects.map(child => (
                            <div key={child.id} className="ml-6 border-l-2 border-cortex-border">
                              <div className="flex items-center gap-3 px-4 py-2 border-t border-cortex-border">
                                <div className="flex-1 text-xs font-medium text-cortex-muted">{child.title}</div>
                              </div>
                              {(child.lessons || []).map(lesson => (
                                <LessonToggleRow key={lesson.id} lesson={lesson}
                                  assigned={assignedIds.has(lesson.id)} saving={!!saving[lesson.id]}
                                  onToggle={() => toggle(lesson.id, assignedIds.has(lesson.id))} />
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {Object.values(byCourse).every(g => g.sections.length === 0) && (
                  <div className="p-12 text-center text-cortex-muted text-sm">
                    No courses with sections yet. Add content first.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LessonToggleRow({ lesson, assigned, saving, onToggle, subtitle }) {
  return (
    <div className="flex items-center gap-4 px-6 py-2.5 border-t border-cortex-border hover:bg-cortex-bg transition group">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-cortex-text truncate">{lesson.title}</div>
        {subtitle && <div className="text-xs text-cortex-muted mt-0.5 truncate">{subtitle}</div>}
        {!subtitle && lesson.video_url && <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">● video</div>}
      </div>

      <button onClick={onToggle} disabled={saving}
        className={`flex-shrink-0 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
          assigned
            ? 'bg-cortex-accent text-white hover:bg-cortex-accent/80'
            : 'bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:border-cortex-accent'
        }`}>
        {saving
          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          : assigned ? '✓ Assigned' : '+ Assign'
        }
      </button>
    </div>
  );
}