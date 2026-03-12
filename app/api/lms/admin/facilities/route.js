import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/facilities?company_id=X
export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get('company_id');

  const pool = getPool();
  try {
    let query = `
      SELECT f.*, c.company_name
      FROM lms_facilities f
      LEFT JOIN companies c ON c.id = f.company_id
      WHERE f.is_active = true
    `;
    const params = [];
    if (company_id) {
      params.push(company_id);
      query += ` AND f.company_id = $${params.length}`;
    }
    query += ' ORDER BY f.name';
    const r = await pool.query(query, params);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/lms/admin/facilities
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { company_id, name, location, facility_type, facility_code } = await request.json();
  if (!company_id || !name?.trim()) {
    return NextResponse.json({ error: 'company_id and name are required' }, { status: 400 });
  }

  const pool = getPool();
  try {
    const r = await pool.query(`
      INSERT INTO lms_facilities (company_id, name, location, facility_type, facility_code)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [company_id, name.trim(), location || null, facility_type || null, facility_code || null]);
    return NextResponse.json(r.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
