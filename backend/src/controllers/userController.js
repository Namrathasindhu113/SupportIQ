import User from '../models/User.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/users/agents   (agent only)
// Used by the frontend assignment dropdown to list available agents.
// ─────────────────────────────────────────────────────────────────────────────
export const getAgents = async (req, res, next) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('_id name email')
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      data: { agents },
    });
  } catch (error) {
    next(error);
  }
};
