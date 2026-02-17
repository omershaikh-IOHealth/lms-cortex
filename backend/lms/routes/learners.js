// backend/lms/routes/learners.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function learnerRoutes(pool) {
  const router = Router();
  router.use(requireAuth, requireRole('admin', 'training'));

  // GET /api/lms/admin/learners
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
               lp.id as profile_id, lp.learner_type_id,
               lt.name as learner_type_name,
               COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int as completed_lessons,
               COUNT(DISTINCT ulp.lesson_id)::int as started_lessons
        FROM auth_users u
        LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
        LEFT JOIN lms_learner_types lt ON lp.learner_type_id = lt.id
        LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = u.id
        WHERE u.role = 'learner'
        GROUP BY u.id, lp.id, lp.learner_type_id, lt.name
        ORDER BY u.display_name
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/learners
  router.post('/', async (req, res) => {
    const { email, password, display_name, learner_type_id } = req.body;
    if (!email || !password || !learner_type_id) {
      return res.status(400).json({ error: 'email, password, learner_type_id are required' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const hash = await bcrypt.hash(password, 12);
      const userRes = await client.query(`
        INSERT INTO auth_users (email, password_hash, role, display_name)
        VALUES ($1, $2, 'learner', $3) RETURNING id, email, display_name, role, is_active
      `, [email.toLowerCase().trim(), hash, display_name]);
      const user = userRes.rows[0];
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id, display_name)
        VALUES ($1, $2, $3)
      `, [user.id, learner_type_id, display_name]);
      await client.query('COMMIT');
      res.status(201).json(user);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  });

  // PUT /api/lms/admin/learners/:id
  router.put('/:id', async (req, res) => {
    const { display_name, is_active, learner_type_id, password } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let hashClause = '';
      const params = [display_name, is_active, req.params.id];
      if (password) {
        const hash = await bcrypt.hash(password, 12);
        hashClause = ', password_hash = $4';
        params.push(hash);
      }
      await client.query(`
        UPDATE auth_users
        SET display_name = COALESCE($1, display_name),
            is_active = COALESCE($2, is_active),
            updated_at = NOW()
            ${hashClause}
        WHERE id = $3 AND role = 'learner'
      `, params);
      if (learner_type_id) {
        await client.query(`
          UPDATE lms_learner_profiles SET learner_type_id = $1, updated_at = NOW() WHERE user_id = $2
        `, [learner_type_id, req.params.id]);
      }
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally { client.release(); }
  });

  return router;
}
