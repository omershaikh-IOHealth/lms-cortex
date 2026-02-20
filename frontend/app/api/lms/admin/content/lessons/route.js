import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { section_id, title, manual_markdown, sort_order, duration_seconds, video_url } = await request.json();
  if (!section_id || !title?.trim())
    return NextResponse.json({ error: 'section_id and title required' }, { status: 400 });

  try {
    const pool = getPool();
    const r = await pool.query(`
      INSERT INTO lms_lessons (section_id, title, video_url, manual_markdown, sort_order, duration_seconds, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
    `, [section_id, title.trim(), video_url || null, manual_markdown || null, sort_order || 0, duration_seconds || null, user.id]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
