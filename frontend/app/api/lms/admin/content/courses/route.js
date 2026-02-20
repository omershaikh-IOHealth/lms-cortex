import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*,
        COUNT(DISTINCT l.id)::int AS lesson_count
      FROM lms_courses c
      LEFT JOIN lms_sections s ON s.course_id = c.id
      LEFT JOIN lms_lessons l  ON l.section_id = s.id
      GROUP BY c.id ORDER BY c.title
    `);
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_courses (title, description, created_by) VALUES ($1,$2,$3) RETURNING *',
      [title.trim(), description || null, user.id]
    );
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
