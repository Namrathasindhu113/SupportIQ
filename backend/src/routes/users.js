import { Router } from 'express';
import protect from '../middleware/protect.js';
import requireMembership from '../middleware/requireMembership.js';
import authorizeCompanyRole from '../middleware/authorizeCompanyRole.js';
import { getAgents } from '../controllers/userController.js';

const router = Router();

// ── GET /api/v1/users/agents ─────────────────────────────────────────────────
// Returns agents scoped to the authenticated user's active company.
// Requires an active membership; agents and admins only.
router.get(
  '/agents',
  protect,
  requireMembership,
  authorizeCompanyRole('agent', 'company_admin'),
  getAgents
);

export default router;
