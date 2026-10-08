import { Router } from 'express';
import protect from '../middleware/protect.js';
import authorize from '../middleware/authorize.js';
import { getAgents } from '../controllers/userController.js';

const router = Router();

// ── GET /api/v1/users/agents ─────────────────────────────────────────────────
// Agent-only: returns the list of agents for use in assignment dropdowns.
router.get('/agents', protect, authorize('agent'), getAgents);

export default router;
