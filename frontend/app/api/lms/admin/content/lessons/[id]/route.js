import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function deleteVideoFile(video_url) {
  if (!video_url || video_url.startsWith('/uploads/')) return;
  try {
    const filename = video_url.split('/').pop();
    await getSupabase().storage.from(BUCKET).remove([filename]);
  } catch {}
}

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pool = getPool();
    const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [params.id]);
    if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, manual_markdown, sort_order, is_active, duration_seconds, video_url } = await request.json();
  try {
    const pool = getPool();
    let videoClause = '';
    const queryParams = [title?.trim(), manual_markdown, sort_order, is_active, duration_seconds, user.id, params.id];
    if (video_url !== undefined) {
      // New video URL provided — clean up old one
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
      if (old.rows[0]?.video_url !== video_url) {
        await deleteVideoFile(old.rows[0]?.video_url);
      }
      videoClause = ', video_url = $8';
      queryParams.push(video_url);
    }
    const r = await pool.query(`
      UPDATE lms_lessons SET
        title            = COALESCE($1, title),
        manual_markdown  = COALESCE($2, manual_markdown),
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
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const r = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
    deleteVideoFile(r.rows[0]?.video_url);
    await pool.query('DELETE FROM lms_lessons WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
