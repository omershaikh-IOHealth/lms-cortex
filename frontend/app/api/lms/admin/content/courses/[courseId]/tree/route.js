import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.response;
  const { courseId } = await params;
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
    `, [courseId]);
    return Response.json(sections.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
