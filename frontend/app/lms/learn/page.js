// frontend/app/lms/learn/page.js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

export default function LearnPage() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState({ courses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/lms/me/curriculum').then(r => r?.json()).then(d => {
      if (d) setCurriculum(d);
    }).finally(() => setLoading(false));
  }, []);

  const allLessons = curriculum.courses.flatMap(c =>
    c.sections.flatMap(s => s.lessons)
  );
  const completedCount = allLessons.filter(l => l.completed).length;
  const inProgressCount = allLessons.filter(l => !l.completed && l.percent_watched > 0).length;

  if (loading) return <div className="p-8 text-gray-500">Loading your curriculum...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Learning</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back, {user?.name || user?.email}</p>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Total Lessons</div>
          <div className="text-3xl font-bold text-white mt-1">{allLessons.length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Completed</div>
          <div className="text-3xl font-bold text-green-400 mt-1">{completedCount}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-gray-400 text-sm">In Progress</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">{inProgressCount}</div>
        </div>
      </div>

      {/* Curriculum tree */}
      {!curriculum.courses.length ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          No training assigned yet. Contact your training team.
        </div>
      ) : (
        <div className="space-y-6">
          {curriculum.courses.map(course => (
            <div key={course.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-gray-800 bg-gray-800/50">
                <h2 className="text-white font-semibold text-lg">📘 {course.title}</h2>
              </div>
              <div className="p-4 space-y-3">
                {course.sections.sort((a,b) => a.sort_order - b.sort_order).map(section => (
                  <div key={section.id}>
                    <div className="text-gray-400 text-sm font-medium mb-2 flex items-center gap-1.5">
                      <span>📁</span> {section.title}
                    </div>
                    <div className="ml-5 space-y-1.5">
                      {section.lessons.sort((a,b) => a.sort_order - b.sort_order).map(lesson => (
                        <Link key={lesson.id} href={`/lms/learn/lesson?id=${lesson.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition group">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-700 group-hover:bg-gray-600">
                            {lesson.completed
                              ? <span className="text-green-400 text-sm">✓</span>
                              : lesson.percent_watched > 0
                              ? <span className="text-blue-400 text-sm">▶</span>
                              : <span className="text-gray-500 text-sm">○</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{lesson.title}</div>
                            {lesson.duration_seconds && (
                              <div className="text-gray-500 text-xs">{Math.round(lesson.duration_seconds / 60)} min</div>
                            )}
                          </div>
                          {lesson.percent_watched > 0 && !lesson.completed && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${lesson.percent_watched}%` }} />
                              </div>
                              <span className="text-gray-500 text-xs">{lesson.percent_watched}%</span>
                            </div>
                          )}
                          {lesson.completed && (
                            <span className="text-green-500 text-xs bg-green-900/30 px-2 py-0.5 rounded-full">Complete</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
