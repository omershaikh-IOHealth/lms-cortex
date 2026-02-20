import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pool = getPool();
    const sections = await pool.query(`
      SELECT s.*,
        json_agg(
          json_build_object(
            'id', l.id, 'title', l.title, 'video_url', l.video_url,
            'duration_seconds', l.duration_seconds, 'sort_order', l.sort_order,
            'is_active', l.is_active, 'manual_markdown', l.manual_markdown
          ) ORDER BY l.sort_order
        ) FILTER (WHERE l.id IS NOT NULL) AS lessons
      FROM lms_sections s
      LEFT JOIN lms_lessons l ON l.section_id = s.id
      WHERE s.course_id = $1
      GROUP BY s.id ORDER BY s.sort_order, s.parent_section_id NULLS FIRST
    `, [params.id]);
    return NextResponse.json(sections.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
