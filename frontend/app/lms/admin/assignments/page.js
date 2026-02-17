// frontend/app/lms/admin/assignments/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function AssignmentsPage() {
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    Promise.all([
      apiFetch('/api/lms/admin/learner-types').then(r => r?.json()),
      apiFetch('/api/lms/admin/content/courses').then(r => r?.json()),
    ]).then(([t, c]) => {
      if (t) setTypes(t.filter(x => x.is_active));
      if (c) setCourses(c);
    });
  }, []);

  const loadAssignments = async (typeId) => {
    setLoading(true);
    const [a, ...treeParts] = await Promise.all([
      apiFetch(`/api/lms/admin/assignments?learner_type_id=${typeId}`).then(r => r?.json()),
      ...courses.map(c => apiFetch(`/api/lms/admin/content/courses/${c.id}/tree`).then(r => r?.json()))
    ]);
    if (a) setAssignments(a);
    const allSections = treeParts.flatMap((t, i) =>
      (t || []).map(s => ({ ...s, course: courses[i] }))
    );
    setTree(allSections);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedType && courses.length) loadAssignments(selectedType.id);
  }, [selectedType, courses.length]);

  const assignedLessonIds = new Set(assignments.map(a => a.lesson_id));

  const toggleAssignment = async (lessonId, isAssigned) => {
    setSaving(p => ({ ...p, [lessonId]: true }));
    try {
      if (isAssigned) {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'DELETE',
          body: JSON.stringify({ learner_type_id: selectedType.id, lesson_id: lessonId })
        });
      } else {
        await apiFetch('/api/lms/admin/assignments', {
          method: 'POST',
          body: JSON.stringify({ learner_type_id: selectedType.id, lesson_id: lessonId })
        });
      }
      await loadAssignments(selectedType.id);
    } finally {
      setSaving(p => ({ ...p, [lessonId]: false }));
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Assignment Manager</h1>
      <p className="text-gray-400 text-sm mb-6">Map lessons to learner types. Learners will only see lessons assigned to their type.</p>

      <div className="flex gap-6">
        {/* Type selector */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 px-2 mb-2 font-medium uppercase tracking-wider">Learner Types</div>
            {types.map(t => (
              <button key={t.id} onClick={() => setSelectedType(t)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition mb-0.5 ${selectedType?.id === t.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
                {t.name}
              </button>
            ))}
            {!types.length && <div className="text-gray-500 text-sm px-2 py-4">No active types</div>}
          </div>
        </div>

        {/* Lesson assignment panel */}
        <div className="flex-1">
          {!selectedType ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
              Select a learner type to manage lesson assignments
            </div>
          ) : loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
              Loading...
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-white font-semibold">Lessons for: <span className="text-blue-400">{selectedType.name}</span></h2>
                <p className="text-gray-500 text-xs mt-1">{assignedLessonIds.size} lessons assigned</p>
              </div>
              <div className="p-4 space-y-4">
                {courses.map(course => {
                  const courseSections = tree.filter(s => s.course?.id === course.id && !s.parent_section_id);
                  if (!courseSections.length) return null;
                  return (
                    <div key={course.id}>
                      <div className="text-white font-medium text-sm mb-2">📘 {course.title}</div>
                      {courseSections.map(section => (
                        <div key={section.id} className="ml-4 mb-3">
                          <div className="text-gray-400 text-xs mb-1.5">📁 {section.title}</div>
                          {(section.lessons || []).map(lesson => {
                            const assigned = assignedLessonIds.has(lesson.id);
                            const busy = saving[lesson.id];
                            return (
                              <div key={lesson.id} className="ml-4 flex items-center justify-between py-1.5 border-b border-gray-800/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300 text-sm">{lesson.title}</span>
                                  {lesson.video_url && <span className="text-xs text-green-500">🎬</span>}
                                </div>
                                <button onClick={() => toggleAssignment(lesson.id, assigned)} disabled={busy}
                                  className={`text-xs px-3 py-1 rounded-full transition ${
                                    assigned
                                      ? 'bg-green-900/50 text-green-400 hover:bg-red-900/50 hover:text-red-400'
                                      : 'bg-gray-800 text-gray-400 hover:bg-green-900/50 hover:text-green-400'
                                  } disabled:opacity-50`}>
                                  {busy ? '...' : assigned ? '✓ Assigned' : '+ Assign'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {!tree.length && <div className="text-center text-gray-500 py-8">No lessons available. Create courses and lessons first.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
