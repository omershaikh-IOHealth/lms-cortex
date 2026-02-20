import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { course_id, parent_section_id, title, sort_order } = await request.json();
  if (!course_id || !title?.trim())
    return NextResponse.json({ error: 'course_id and title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_sections (course_id, parent_section_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [course_id, parent_section_id || null, title.trim(), sort_order || 0]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
