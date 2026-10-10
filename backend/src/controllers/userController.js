import Membership from '../models/Membership.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/users/agents
// Returns the list of agents in the authenticated user's active company.
// Used by the frontend assignment dropdown.
// Requires: protect + requireMembership + authorizeCompanyRole('agent','company_admin')
// ─────────────────────────────────────────────────────────────────────────────
export const getAgents = async (req, res, next) => {
  try {
    // req.membership.company is already verified server-side by requireMembership
    const agentMemberships = await Membership.find({
      company: req.membership.company,
      role: { $in: ['agent', 'company_admin'] },
      active: true,
    })
      .populate('user', '_id name email')
      .sort({ 'user.name': 1 })
      .lean();

    const agents = agentMemberships
      .filter(m => m.user) // guard against orphaned memberships
      .map(m => ({ _id: m.user._id, name: m.user.name, email: m.user.email }));

    return res.json({
      success: true,
      data: { agents },
    });
  } catch (error) {
    next(error);
  }
};
