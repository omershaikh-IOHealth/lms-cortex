// backend/lms/routes/learnerTypes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

export default function learnerTypeRoutes(pool) {
  const router = Router();
  router.use(requireAuth, requireRole('admin', 'training', 'trainer'));

  // GET /api/lms/admin/learner-types
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT lt.*, u.display_name as created_by_name,
          COUNT(lp.id)::int as learner_count
        FROM lms_learner_types lt
        LEFT JOIN auth_users u ON lt.created_by = u.id
        LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
        GROUP BY lt.id, u.display_name
        ORDER BY lt.name
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /api/lms/admin/learner-types
  router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
      const result = await pool.query(`
        INSERT INTO lms_learner_types (name, description, created_by)
        VALUES ($1, $2, $3) RETURNING *
      `, [name.trim(), description, req.user.id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Learner type name already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/lms/admin/learner-types/:id
  router.put('/:id', async (req, res) => {
    const { name, description, is_active } = req.body;
    try {
      const result = await pool.query(`
        UPDATE lms_learner_types
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            is_active = COALESCE($3, is_active),
            updated_at = NOW()
        WHERE id = $4 RETURNING *
      `, [name?.trim(), description, is_active, req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Name already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
