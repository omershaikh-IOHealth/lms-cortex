// frontend/app/lms/learn/lesson/page.js
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const HEARTBEAT_INTERVAL = 5000; // 5s
const IDLE_TIMEOUT = 60000; // 60s
const COMPLETION_THRESHOLD = 80;
const BATCH_FLUSH_INTERVAL = 10000; // flush events every 10s

// Simple markdown renderer (no external dep)
function SimpleMarkdown({ content }) {
  if (!content) return <div className="text-gray-500 italic p-4">No manual for this lesson.</div>;
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-blue-300 text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-300 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-gray-300 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-gray-300 mb-3">')
    .replace(/\n/g, '<br/>');
  return (
    <div className="p-6 text-gray-300 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="text-gray-300 mb-3">${html}</p>` }} />
  );
}

export default function LessonPage() {
  const params = useSearchParams();
  const router = useRouter();
  const lessonId = params.get('id');

  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splitPct, setSplitPct] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const eventQueueRef = useRef([]);
  const maxWatchedPctRef = useRef(0);
  const idleTimerRef = useRef(null);
  const isIdleRef = useRef(false);
  const heartbeatRef = useRef(null);
  const batchFlushRef = useRef(null);
  const sessionStartRef = useRef(Date.now());
  const totalWatchSecondsRef = useRef(0);

  // ---- Load lesson ----
  useEffect(() => {
    if (!lessonId) return;
    apiFetch(`/api/lms/me/lessons/${lessonId}`).then(r => r?.json()).then(d => {
      if (d) { setLesson(d.lesson); setProgress(d.progress); }
    }).finally(() => setLoading(false));
  }, [lessonId]);

  // ---- Start session ----
  useEffect(() => {
    if (!lessonId) return;
    apiFetch('/api/lms/me/sessions', { method: 'POST', body: JSON.stringify({ lesson_id: Number(lessonId) }) })
      .then(r => r?.json()).then(d => { if (d?.session_id) sessionIdRef.current = d.session_id; });

    // Start batch flush
    batchFlushRef.current = setInterval(flushEvents, BATCH_FLUSH_INTERVAL);
    return () => {
      clearInterval(batchFlushRef.current);
      flushEvents();
      endSession();
    };
  }, [lessonId]);

  const pushEvent = useCallback((type, payload = {}) => {
    eventQueueRef.current.push({ event_type: type, payload: { ...payload, ts: new Date().toISOString() } });
  }, []);

  const flushEvents = useCallback(async () => {
    if (!eventQueueRef.current.length || !sessionIdRef.current) return;
    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];
    await apiFetch('/api/lms/me/events/batch', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionIdRef.current, lesson_id: Number(lessonId), events })
    });
  }, [lessonId]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    const totalMs = Date.now() - sessionStartRef.current;
    await apiFetch(`/api/lms/me/sessions/${sessionIdRef.current}/end`, {
      method: 'PATCH',
      body: JSON.stringify({ total_active_seconds: totalWatchSecondsRef.current, total_idle_seconds: Math.round(totalMs / 1000) - totalWatchSecondsRef.current })
    });
  }, []);

  // ---- Idle detection ----
  const resetIdle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    if (isIdleRef.current) { pushEvent('idle_end'); isIdleRef.current = false; }
    idleTimerRef.current = setTimeout(() => {
      pushEvent('idle_start');
      isIdleRef.current = true;
    }, IDLE_TIMEOUT);
  }, [pushEvent]);

  useEffect(() => {
    pushEvent('page_view');
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimerRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [resetIdle, pushEvent]);

  // ---- Video event handlers ----
  const onVideoPlay = () => {
    pushEvent('video_play', { time: videoRef.current?.currentTime });
    heartbeatRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      const pct = v.duration ? Math.round(v.currentTime / v.duration * 100) : 0;
      maxWatchedPctRef.current = Math.max(maxWatchedPctRef.current, pct);
      totalWatchSecondsRef.current += 5;
      pushEvent('video_progress_heartbeat', { time: v.currentTime, pct });
      // Save progress
      apiFetch('/api/lms/me/progress', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: Number(lessonId),
          percent_watched: maxWatchedPctRef.current,
          last_position_seconds: Math.round(v.currentTime),
          total_watch_seconds_delta: 5
        })
      });
    }, HEARTBEAT_INTERVAL);
  };

  const onVideoPause = () => {
    pushEvent('video_pause', { time: videoRef.current?.currentTime });
    clearInterval(heartbeatRef.current);
  };

  const onVideoSeeked = () => {
    pushEvent('video_seek', { time: videoRef.current?.currentTime });
  };

  const onVideoEnded = () => {
    clearInterval(heartbeatRef.current);
    const v = videoRef.current;
    const pct = v?.duration ? Math.round(v.currentTime / v.duration * 100) : 100;
    maxWatchedPctRef.current = Math.max(maxWatchedPctRef.current, pct);
    pushEvent('lesson_complete', { pct });
    apiFetch('/api/lms/me/progress', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: Number(lessonId), percent_watched: 100, last_position_seconds: Math.round(v?.currentTime || 0) })
    });
  };

  // Resume position
  useEffect(() => {
    if (progress?.last_position_seconds && videoRef.current) {
      videoRef.current.currentTime = progress.last_position_seconds;
    }
  }, [lesson, progress]);

  // ---- Drag to resize ----
  const onDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(80, Math.max(20, (x / rect.width) * 100));
      setSplitPct(pct);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  if (loading) return <div className="p-8 text-gray-500">Loading lesson...</div>;
  if (!lesson) return <div className="p-8 text-red-400">Lesson not found or access denied.</div>;

  const completed = progress?.completed || maxWatchedPctRef.current >= COMPLETION_THRESHOLD;
  const videoUrl = lesson.video_url || null;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/lms/learn')} className="text-gray-400 hover:text-white text-sm transition">← Back</button>
          <span className="text-gray-700">|</span>
          <h1 className="text-white font-medium text-sm">{lesson.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <span className="text-green-400 text-xs bg-green-900/30 px-2.5 py-1 rounded-full">✓ Completed</span>
          )}
          {progress?.percent_watched > 0 && !completed && (
            <span className="text-blue-400 text-xs">{progress.percent_watched}% watched</span>
          )}
        </div>
      </div>

      {/* Split view */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden" style={{ cursor: isDragging ? 'col-resize' : 'default' }}>
        {/* Video pane */}
        <div className="flex-shrink-0 bg-black flex items-center justify-center" style={{ width: `${splitPct}%` }}>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              onPlay={onVideoPlay}
              onPause={onVideoPause}
              onSeeked={onVideoSeeked}
              onEnded={onVideoEnded}
              onClick={() => { pushEvent('click', { target: 'video' }); resetIdle(); }}
            />
          ) : (
            <div className="text-gray-600 text-center p-8">
              <div className="text-4xl mb-3">🎬</div>
              <div className="text-sm">No video uploaded for this lesson</div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          onMouseDown={onDividerMouseDown}
          className="w-1.5 flex-shrink-0 bg-gray-800 hover:bg-blue-600 transition cursor-col-resize flex items-center justify-center"
          style={{ cursor: 'col-resize' }}
        >
          <div className="w-0.5 h-8 bg-gray-600 rounded" />
        </div>

        {/* Manual pane */}
        <div
          className="flex-1 overflow-y-auto bg-gray-950"
          onScroll={(e) => {
            const el = e.target;
            const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
            pushEvent('scroll', { depth_pct: pct });
            resetIdle();
          }}
          onMouseEnter={() => pushEvent('manual_view_heartbeat')}
        >
          <div className="max-w-3xl">
            <SimpleMarkdown content={lesson.manual_markdown} />
          </div>
        </div>
      </div>
    </div>
  );
}
