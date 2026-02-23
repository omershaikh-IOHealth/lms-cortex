import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    await pool.query(`
      UPDATE auth_users SET registration_status = 'rejected', is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
