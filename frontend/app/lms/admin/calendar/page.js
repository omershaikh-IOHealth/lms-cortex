// frontend/app/lms/admin/calendar/page.js
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const EVENT_TYPE_COLORS = {
  training: 'bg-green-500/20 text-green-400 border-green-500/30',
  meeting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  workshop: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  assessment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [filterDept, setFilterDept] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Current month
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const [form, setForm] = useState({
    title: '', description: '', event_date: '', start_time: '09:00', end_time: '10:00',
    location: '', event_type: 'training', department: '', specialty: '',
    google_calendar_link: '', attendee_user_ids: [],
  });

  const load = async () => {
    const params = new URLSearchParams();
    if (filterDept) params.set('department', filterDept);
    params.set('month', month + 1);
    params.set('year', year);
    const qs = params.toString() ? `?${params}` : '';
    const [e, d, l] = await Promise.all([
      apiFetch(`/api/lms/admin/calendar${qs}`).then(r => r?.json()),
      apiFetch('/api/lms/admin/departments').then(r => r?.json()),
      apiFetch('/api/lms/admin/learners').then(r => r?.json()),
    ]);
    if (e) setEvents(e);
    if (d) setDepartments(d);
    if (l) setLearners(l);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDept, month, year]);

  // Calendar grid helpers
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date?.startsWith(dateStr));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openCreate = (day) => {
    const dateStr = day
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : '';
    setForm({
      title: '', description: '', event_date: dateStr, start_time: '09:00', end_time: '10:00',
      location: '', event_type: 'training', department: '', specialty: '',
      google_calendar_link: '', attendee_user_ids: [],
    });
    setEditEvent(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (evt) => {
    setForm({
      title: evt.title, description: evt.description || '', event_date: evt.event_date?.split('T')[0] || '',
      start_time: evt.start_time || '09:00', end_time: evt.end_time || '10:00',
      location: evt.location || '', event_type: evt.event_type || 'training',
      department: evt.department || '', specialty: evt.specialty || '',
      google_calendar_link: evt.google_calendar_link || '', attendee_user_ids: [],
    });
    setEditEvent(evt);
    setShowForm(true);
    setError('');
  };

  const save = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const isEdit = !!editEvent;
      const url = isEdit ? `/api/lms/admin/calendar/${editEvent.id}` : '/api/lms/admin/calendar';
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    await apiFetch(`/api/lms/admin/calendar/${id}`, { method: 'DELETE' });
    load();
  };

  const buildGoogleCalLink = () => {
    const d = form.event_date.replace(/-/g, '');
    const st = form.start_time.replace(/:/g, '');
    const et = form.end_time.replace(/:/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(form.title)}&dates=${d}T${st}00/${d}T${et}00&details=${encodeURIComponent(form.description || '')}&location=${encodeURIComponent(form.location || '')}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cortex-text">Calendar</h1>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-cortex-surface border border-cortex-border rounded-lg p-1">
            <button onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'calendar' ? 'bg-cortex-accent text-white' : 'text-cortex-muted'}`}>
              Calendar
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'list' ? 'bg-cortex-accent text-white' : 'text-cortex-muted'}`}>
              List
            </button>
          </div>
          <button onClick={() => openCreate(null)}
            className="bg-cortex-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
            + New Event
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={prevMonth} className="text-cortex-muted hover:text-cortex-text px-2 py-1 text-sm">&lt;</button>
          <span className="text-cortex-text font-medium text-sm min-w-[140px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} className="text-cortex-muted hover:text-cortex-text px-2 py-1 text-sm">&gt;</button>
        </div>
      </div>

      {loading ? (
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-12 text-center text-cortex-muted">Loading...</div>
      ) : viewMode === 'calendar' ? (
        /* Calendar Grid */
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-cortex-muted border-b border-cortex-border bg-cortex-bg">
                {d}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isToday = day && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
              return (
                <div key={i} onClick={() => day && openCreate(day)}
                  className={`min-h-[100px] p-1 border-b border-r border-cortex-border cursor-pointer hover:bg-cortex-bg/50 transition ${
                    !day ? 'bg-cortex-bg/30' : ''
                  }`}>
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-cortex-accent text-white' : 'text-cortex-muted'
                      }`}>
                        {day}
                      </div>
                      {dayEvents.map(evt => (
                        <div key={evt.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                          className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate border ${
                            EVENT_TYPE_COLORS[evt.event_type] || EVENT_TYPE_COLORS.other
                          }`}>
                          {evt.start_time?.slice(0,5)} {evt.title}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-cortex-surface border border-cortex-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cortex-bg">
              <tr className="text-left text-xs text-cortex-muted">
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Date & Time</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-cortex-muted">No events this month</td></tr>
              ) : events.map(evt => (
                <tr key={evt.id} className="hover:bg-cortex-bg transition">
                  <td className="px-5 py-3">
                    <div className="font-medium text-cortex-text">{evt.title}</div>
                    {evt.description && <div className="text-xs text-cortex-muted truncate max-w-xs">{evt.description}</div>}
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">
                    {new Date(evt.event_date).toLocaleDateString()}<br />
                    {evt.start_time} - {evt.end_time}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${EVENT_TYPE_COLORS[evt.event_type] || EVENT_TYPE_COLORS.other}`}>
                      {evt.event_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{evt.department || '—'}</td>
                  <td className="px-5 py-3 text-cortex-muted text-xs">{evt.location || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {evt.google_calendar_link && (
                        <a href={evt.google_calendar_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-cortex-accent hover:underline">G-Cal</a>
                      )}
                      <button onClick={() => openEdit(evt)} className="text-xs text-cortex-muted hover:text-cortex-text">Edit</button>
                      <button onClick={() => deleteEvent(evt.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-cortex-border flex items-center justify-between">
              <h2 className="font-semibold text-cortex-text">{editEvent ? 'Edit Event' : 'New Event'}</h2>
              {form.title && form.event_date && (
                <a href={buildGoogleCalLink()} target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition">
                  Add to Google Calendar
                </a>
              )}
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Date *</label>
                  <input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Start *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">End *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} required
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Location</label>
                <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Event Type</label>
                  <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="training">Training</option>
                    <option value="meeting">Meeting</option>
                    <option value="workshop">Workshop</option>
                    <option value="assessment">Assessment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-cortex-muted block mb-1.5">Department</label>
                  <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent">
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-cortex-muted block mb-1.5">Google Calendar Link</label>
                <input value={form.google_calendar_link} onChange={e => setForm(p => ({ ...p, google_calendar_link: e.target.value }))}
                  placeholder="Paste Google Calendar event link"
                  className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm focus:outline-none focus:border-cortex-accent" />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-cortex-accent text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
                  {saving ? 'Saving...' : editEvent ? 'Update Event' : 'Create Event'}
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
