import { getPool } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*, COUNT(DISTINCT l.id)::int AS lesson_count
      FROM lms_courses c
      LEFT JOIN lms_sections s ON s.course_id = c.id
      LEFT JOIN lms_lessons l  ON l.section_id = s.id
      GROUP BY c.id ORDER BY c.title
    `);
    return Response.json(result.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { title, description } = await request.json();
  if (!title?.trim()) return Response.json({ error: 'Title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_courses (title, description, created_by) VALUES ($1,$2,$3) RETURNING *',
      [title.trim(), description || null, auth.user.id]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
