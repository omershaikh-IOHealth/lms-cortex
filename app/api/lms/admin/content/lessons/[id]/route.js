import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/server-auth';
import { deleteVideoFile, uploadToSupabase } from '@/lib/supabase-storage';

export async function GET(request, { params }) {
  const { authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const pool = getPool();
    const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [params.id]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const contentType = request.headers.get('content-type') || '';
  let title, manual_markdown, sort_order, is_active, duration_seconds, video_url, newVideoFile;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    title            = formData.get('title');
    manual_markdown  = formData.get('manual_markdown');
    sort_order       = formData.get('sort_order');
    is_active        = formData.get('is_active');
    duration_seconds = formData.get('duration_seconds');
    newVideoFile     = formData.get('video');
  } else {
    const body = await request.json();
    ({ title, manual_markdown, sort_order, is_active, duration_seconds, video_url } = body);
  }

  try {
    const pool = getPool();
    let videoClause = '';
    const queryParams = [title?.trim(), manual_markdown, sort_order, is_active, duration_seconds, user.id, params.id];

    if (newVideoFile instanceof File && newVideoFile.size > 0) {
      try {
        const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
        deleteVideoFile(old.rows[0]?.video_url);
        video_url = await uploadToSupabase(newVideoFile);
      } catch (e) { return NextResponse.json({ error: `Upload failed: ${e.message}` }, { status: 500 }); }
    }

    if (video_url !== undefined) {
      if (!newVideoFile) {
        const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
        if (old.rows[0]?.video_url !== video_url) deleteVideoFile(old.rows[0]?.video_url);
      }
      videoClause = ', video_url = $8';
      queryParams.push(video_url);
    }
    const r = await pool.query(`
      UPDATE lms_lessons SET
        title            = COALESCE($1, title),
        manual_markdown  = $2,
        sort_order       = COALESCE($3, sort_order),
        is_active        = COALESCE($4, is_active),
        duration_seconds = COALESCE($5, duration_seconds),
        updated_by       = $6,
        updated_at       = NOW()
        ${videoClause}
      WHERE id = $7 RETURNING *
    `, queryParams);
    if (!r.rows[0]) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
    await client.query('DELETE FROM lms_event_logs WHERE lesson_id = $1', [params.id]);
    await client.query('DELETE FROM lms_learning_sessions WHERE lesson_id = $1', [params.id]);
    await client.query('DELETE FROM lms_lesson_assignments WHERE lesson_id = $1', [params.id]);
    await client.query('DELETE FROM lms_user_lesson_progress WHERE lesson_id = $1', [params.id]);
    await client.query('DELETE FROM lms_lessons WHERE id = $1', [params.id]);
    await client.query('COMMIT');
    deleteVideoFile(r.rows[0]?.video_url);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
