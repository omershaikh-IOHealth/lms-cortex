import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        pe.*,
        u.email, u.display_name,
        lt.name AS learner_type_name
      FROM lms_physical_enrollments pe
      JOIN auth_users u ON pe.user_id = u.id
      LEFT JOIN lms_learner_types lt ON pe.learner_type_id = lt.id
      WHERE pe.session_id = $1
      ORDER BY u.display_name
    `, [id]);
    return Response.json(result.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
