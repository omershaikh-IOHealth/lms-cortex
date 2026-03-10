// frontend/app/lms/learn/lesson/page.js
'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

// ── Inline lesson feedback panel ─────────────────────────────────────────────
function LessonFeedback({ lessonId }) {
  const [open,    setOpen]    = useState(false);
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState('');
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    apiFetch(`/api/lms/feedback?reference_type=lesson&reference_id=${lessonId}`)
      .then(r => r?.json()).then(d => {
        if (d) { setExisting(d); setRating(d.rating); setComment(d.comment || ''); }
      });
  }, [lessonId]);

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    await apiFetch('/api/lms/feedback', {
      method: 'POST',
      body: JSON.stringify({ reference_type: 'lesson', reference_id: Number(lessonId), rating, comment }),
    });
    setSaved(true); setSaving(false);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-2.5 py-1 rounded-lg border border-cortex-border text-cortex-muted hover:text-yellow-400 hover:border-yellow-500 transition flex items-center gap-1"
      >
        {existing ? `★ ${existing.rating}/5` : '☆ Rate'}
      </button>
      {open && (
        <div className="fixed top-14 right-4 z-50 bg-cortex-surface border border-cortex-border rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <span className="text-cortex-text text-sm font-semibold">Rate this lesson</span>
            <button onClick={() => setOpen(false)} className="text-cortex-muted hover:text-cortex-text text-lg leading-none">×</button>
          </div>
          {/* Stars */}
          <div className="flex gap-1 mb-3">
            {[1,2,3,4,5].map(s => (
              <button key={s}
                onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                className="text-2xl transition"
                style={{ color: s <= (hover || rating) ? '#f59e0b' : 'var(--cortex-border, #4b5563)' }}
              >★</button>
            ))}
          </div>
          <textarea
            value={comment} onChange={e => setComment(e.target.value)}
            rows={2} maxLength={500}
            placeholder="Optional comment…"
            className="w-full bg-cortex-bg border border-cortex-border rounded-lg px-3 py-2 text-cortex-text text-sm resize-none focus:outline-none focus:border-cortex-accent mb-3"
          />
          <button onClick={submit} disabled={!rating || saving}
            className="w-full py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm font-semibold disabled:opacity-50 transition">
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}

const HEARTBEAT_INTERVAL = 5000; // 5s
const IDLE_TIMEOUT = 60000; // 60s
const COMPLETION_THRESHOLD = 80;
const BATCH_FLUSH_INTERVAL = 10000; // flush events every 10s

// Strip dangerous HTML patterns before rendering to prevent XSS
function sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    .replace(/src\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'src=""');
}

// Simple markdown renderer (no external dep)
function SimpleMarkdown({ content }) {
  if (!content) return <div className="text-cortex-muted italic p-4">No manual for this lesson.</div>;
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-cortex-text mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-cortex-text mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-cortex-text mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-cortex-text">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-cortex-bg px-1 py-0.5 rounded text-cortex-accent text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-cortex-text list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-cortex-text list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-cortex-text mb-3">')
    .replace(/\n/g, '<br/>');
  return (
    <div className="p-6 text-cortex-text leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(`<p class="text-cortex-text mb-3">${html}</p>`) }} />
  );
}

function LessonPageInner() {
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

  if (loading) return <div className="p-8 text-cortex-muted">Loading lesson...</div>;
  if (!lesson) return <div className="p-8 text-cortex-danger">Lesson not found or access denied.</div>;

  const completed = progress?.completed || maxWatchedPctRef.current >= COMPLETION_THRESHOLD;
  const videoUrl = lesson.video_url || null;
  const hasVideo = !!videoUrl;
  const hasManual = !!lesson.manual_markdown;

  return (
    <div className="flex flex-col h-screen bg-cortex-bg">
      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-3 bg-cortex-surface border-b border-cortex-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/lms/learn')} className="text-cortex-muted hover:text-cortex-text text-sm transition">← Back</button>
          <span className="text-cortex-border">|</span>
          <h1 className="text-cortex-text font-medium text-sm">{lesson.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <span className="text-green-400 text-xs bg-green-900/30 px-2.5 py-1 rounded-full">✓ Completed</span>
          )}
          {progress?.percent_watched > 0 && !completed && (
            <span className="text-cortex-accent text-xs">{progress.percent_watched}% watched</span>
          )}
          <LessonFeedback lessonId={lessonId} />
        </div>
      </div>

      {/* Content area */}
      {!hasVideo && !hasManual ? (
        /* No content at all */
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-5xl mb-4">📭</div>
            <div className="text-cortex-muted text-base font-medium">No content available yet</div>
            <div className="text-cortex-muted text-sm mt-1 opacity-70">Check back later or contact your training team.</div>
          </div>
        </div>
      ) : hasVideo && hasManual ? (
        /* Both: split view */
        <div ref={containerRef} className="flex flex-1 overflow-hidden" style={{ cursor: isDragging ? 'col-resize' : 'default' }}>
          {/* Video pane */}
          <div className="flex-shrink-0 bg-black flex items-center justify-center" style={{ width: `${splitPct}%` }}>
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
          </div>
          {/* Divider */}
          <div
            onMouseDown={onDividerMouseDown}
            className="w-1.5 flex-shrink-0 bg-cortex-border hover:bg-cortex-accent transition cursor-col-resize flex items-center justify-center"
            style={{ cursor: 'col-resize' }}
          >
            <div className="w-0.5 h-8 bg-cortex-muted rounded" />
          </div>
          {/* Manual pane */}
          <div
            className="flex-1 overflow-y-auto bg-cortex-bg"
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
      ) : hasVideo ? (
        /* Video only: full width */
        <div className="flex-1 bg-black flex items-center justify-center">
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
        </div>
      ) : (
        /* Manual only: full width */
        <div
          className="flex-1 overflow-y-auto bg-cortex-bg"
          onScroll={(e) => {
            const el = e.target;
            const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
            pushEvent('scroll', { depth_pct: pct });
            resetIdle();
          }}
          onMouseEnter={() => pushEvent('manual_view_heartbeat')}
        >
          <div className="max-w-3xl mx-auto">
            <SimpleMarkdown content={lesson.manual_markdown} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={<div className="p-8 text-cortex-muted">Loading lesson…</div>}>
      <LessonPageInner />
    </Suspense>
  );
}
