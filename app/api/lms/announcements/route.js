import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError, user } = await requireRole(request, 'learner', 'trainer', 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    // Return announcements targeted to this user's role and org (or all-audience ones)
    const r = await pool.query(`
      SELECT id, title, body, created_at
      FROM lms_announcements
      WHERE is_active = true
        AND (target_roles IS NULL OR $1 = ANY(target_roles))
        AND (target_org_id IS NULL OR target_org_id = (
          SELECT company_id FROM auth_users WHERE id = $2
        ))
      ORDER BY created_at DESC
      LIMIT 10
    `, [user.role, user.id]);
    return NextResponse.json(r.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
