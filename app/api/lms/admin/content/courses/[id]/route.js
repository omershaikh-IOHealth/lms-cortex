import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { title, description, is_active, difficulty, category } = await request.json();
  try {
    const pool = getPool();
    const r = await pool.query(`
      UPDATE lms_courses SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        is_active   = COALESCE($3, is_active),
        difficulty  = $4,
        category    = $5,
        updated_at  = NOW()
      WHERE id = $6 RETURNING *
    `, [title?.trim(), description, is_active, difficulty || null, category || null, params.id]);
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect all lessons in this course
    const lessonsRes = await client.query(`
      SELECT l.id, l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.course_id = $1
    `, [params.id]);
    const lessonIds = lessonsRes.rows.map(r => r.id);
    const videoUrls = lessonsRes.rows.map(r => r.video_url).filter(Boolean);

    if (lessonIds.length > 0) {
      await client.query('DELETE FROM lms_event_logs WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_learning_sessions WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_lesson_assignments WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_user_lesson_progress WHERE lesson_id = ANY($1::int[])', [lessonIds]);
      await client.query('DELETE FROM lms_lessons WHERE id = ANY($1::int[])', [lessonIds]);
    }

    // Delete child sections before parent sections (self-referencing FK)
    await client.query('DELETE FROM lms_sections WHERE course_id = $1 AND parent_section_id IS NOT NULL', [params.id]);
    await client.query('DELETE FROM lms_sections WHERE course_id = $1', [params.id]);
    await client.query('DELETE FROM lms_courses WHERE id = $1', [params.id]);

    await client.query('COMMIT');
    videoUrls.forEach(url => deleteVideoFile(url));
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
