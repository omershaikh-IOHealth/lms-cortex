import { getPool } from '@/lib/db';
import { requireRole, hashPassword } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { display_name, role, staff_id, departments, specialties, is_active, password } = await request.json();
  try {
    const pool = getPool();
    let hashClause = '';
    const p = [display_name, role, staff_id, departments, specialties, is_active, id];
    if (password) {
      const hash = await hashPassword(password);
      hashClause = ', password_hash = $8';
      p.push(hash);
    }
    await pool.query(`
      UPDATE auth_users SET
        display_name = COALESCE($1, display_name),
        role         = COALESCE($2, role),
        staff_id     = COALESCE($3, staff_id),
        departments  = COALESCE($4, departments),
        specialties  = COALESCE($5, specialties),
        is_active    = COALESCE($6, is_active),
        updated_at   = NOW()
        ${hashClause}
      WHERE id = $7
    `, p);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
