import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { generateStaffId } from '@/lib/generateStaffId';
import { sendInvitationEmail } from '@/lib/email';

// Generate password: SGH!{BRANCH_CODE}{NUMBERS_FROM_STAFF_ID}
function generatePassword(companyCode, staffId) {
  const branch  = (companyCode || '').toUpperCase();
  const numbers = (staffId || '').replace(/\D/g, '');
  return `SGH!${branch}${numbers}`;
}

// POST /api/lms/admin/users/bulk
// Body: { rows: [{email, display_name, role, staff_id,
//                 organization, department, sub_department, learner_type}] }
export async function POST(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { rows = [] } = await request.json();
  if (!rows.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 });

  const pool = getPool();

  // Pre-load lookup tables
  const [companies, departments, learnerTypes] = await Promise.all([
    pool.query('SELECT id, company_name, company_code FROM companies').then(r => r.rows),
    pool.query('SELECT id, name, parent_id, company_id FROM lms_departments').then(r => r.rows),
    pool.query('SELECT id, name FROM lms_learner_types WHERE is_active = true').then(r => r.rows),
  ]);

  const findCompany = (name) => companies.find(c => c.company_name.toLowerCase().trim() === name?.toLowerCase().trim());
  const findDept    = (name, companyId) => departments.find(d =>
    d.name.toLowerCase().trim() === name?.toLowerCase().trim() &&
    (!companyId || String(d.company_id) === String(companyId)) &&
    !d.parent_id
  );
  const findSubDept = (name, parentId) => departments.find(d =>
    d.name.toLowerCase().trim() === name?.toLowerCase().trim() &&
    String(d.parent_id) === String(parentId)
  );
  const findType = (name) => learnerTypes.find(t => t.name.toLowerCase().trim() === name?.toLowerCase().trim());

  const validRoles = ['admin', 'trainer', 'learner', 'support'];
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const email = row.email?.toString().toLowerCase().trim();
    const role  = (row.role?.toString().toLowerCase().trim()) || 'learner';

    // Validate required fields
    if (!email) { results.push({ row: rowNum, email: '—', success: false, error: 'Email is required' }); continue; }
    if (!validRoles.includes(role)) { results.push({ row: rowNum, email, success: false, error: `Invalid role "${role}"` }); continue; }

    // Resolve org/dept
    let company_id = null, company_code = null, department_id = null, sub_department_id = null, learner_type_id = null;

    if (row.organization?.toString().trim()) {
      const co = findCompany(row.organization);
      if (!co) { results.push({ row: rowNum, email, success: false, error: `Organisation "${row.organization}" not found` }); continue; }
      company_id   = co.id;
      company_code = co.company_code;
    }

    if (row.department?.toString().trim()) {
      const dept = findDept(row.department, company_id);
      if (!dept) { results.push({ row: rowNum, email, success: false, error: `Department "${row.department}" not found${company_id ? ' in that organisation' : ''}` }); continue; }
      department_id = dept.id;
    }

    if (row.sub_department?.toString().trim()) {
      if (!department_id) { results.push({ row: rowNum, email, success: false, error: 'Sub-department requires a parent department' }); continue; }
      const sub = findSubDept(row.sub_department, department_id);
      if (!sub) { results.push({ row: rowNum, email, success: false, error: `Sub-department "${row.sub_department}" not found under that department` }); continue; }
      sub_department_id = sub.id;
    }

    if (row.learner_type?.toString().trim() && role === 'learner') {
      const lt = findType(row.learner_type);
      if (!lt) { results.push({ row: rowNum, email, success: false, error: `Learner type "${row.learner_type}" not found` }); continue; }
      learner_type_id = lt.id;
    }

    // Resolve staff_id: use provided value unless blank or equals email (invalid)
    let resolvedStaffId = row.staff_id?.toString().trim() || null;

    // Insert user
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-generate staff_id if blank or if it was incorrectly set to the email
      if (!resolvedStaffId || resolvedStaffId.toLowerCase() === email) {
        resolvedStaffId = await generateStaffId(client, email, row.display_name?.toString().trim());
      }

      // Auto-generate password: SGH!{BRANCH}{DIGITS_FROM_STAFF_ID}
      const pwd = generatePassword(company_code, resolvedStaffId);

      const hash = await bcrypt.hash(pwd, 10); // salt 10 for speed in bulk ops
      const r = await client.query(`
        INSERT INTO auth_users
          (email, password_hash, role, display_name, staff_id,
           company_id, department_id, sub_department_id,
           registration_status, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',true)
        RETURNING id
      `, [
        email, hash, role,
        row.display_name?.toString().trim() || null,
        resolvedStaffId,
        company_id, department_id, sub_department_id,
      ]);

      const userId = r.rows[0].id;
      if (role === 'learner' && learner_type_id) {
        await client.query(`
          INSERT INTO lms_learner_profiles (user_id, learner_type_id)
          VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
        `, [userId, learner_type_id]);
      }
      await client.query('COMMIT');

      // Send invitation email (non-blocking)
      const { sent: emailSent, error: emailError } = await sendInvitationEmail(
        email,
        row.display_name?.toString().trim(),
        pwd,
        resolvedStaffId
      );

      results.push({ row: rowNum, email, success: true, generated_password: pwd, emailSent, emailError: emailError || null });
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err.code === '23505' ? 'Email already exists' : err.message;
      results.push({ row: rowNum, email, success: false, error: msg });
    } finally {
      client.release();
    }
  }

  const succeeded    = results.filter(r => r.success).length;
  const emailsSent   = results.filter(r => r.success && r.emailSent).length;
  const emailsFailed = results.filter(r => r.success && !r.emailSent).length;
  return NextResponse.json({ results, succeeded, total: rows.length, emailsSent, emailsFailed });
}
