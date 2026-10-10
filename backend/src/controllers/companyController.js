import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Membership from '../models/Membership.js';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/companies
// Authenticated agents can create a new company workspace.
// Creator automatically becomes the first company_admin member.
// ─────────────────────────────────────────────────────────────────────────────
export const createCompany = async (req, res, next) => {
  if (req.user.role !== 'agent') {
    return next(new AppError('Only agents can create a company workspace.', 403));
  }

  const session = await mongoose.startSession();
  try {
    let company, membership;

    await session.withTransaction(async () => {
      const { name, slug } = req.body;

      [company] = await Company.create([{ name, slug, createdBy: req.user._id }], { session });

      [membership] = await Membership.create(
        [{ user: req.user._id, company: company._id, role: 'company_admin' }],
        { session }
      );
    });

    return res.status(201).json({
      success: true,
      data: { company, membership },
      message: 'Company created successfully. You are the first admin.',
    });
  } catch (error) {
    // Duplicate slug
    if (error.code === 11000 && error.keyPattern?.slug) {
      return next(new AppError('A company with that slug already exists.', 409));
    }
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/companies/my
// List all companies the authenticated user is an active member of.
// ─────────────────────────────────────────────────────────────────────────────
export const getMyCompanies = async (req, res, next) => {
  try {
    const memberships = await Membership.find({
      user: req.user._id,
      active: true,
    })
      .sort({ createdAt: 1, _id: 1 })
      .populate('company', 'name slug createdAt')
      .lean();

    return res.json({
      success: true,
      data: {
        memberships: memberships.map(m => ({
          membershipId: m._id,
          company: m.company,
          role: m.role,
          joinedAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/companies/:id
// Retrieve company details (members only).
// Requires requireMembership middleware.
// ─────────────────────────────────────────────────────────────────────────────
export const getCompany = async (req, res, next) => {
  try {
    // req.company populated by requireMembership
    return res.json({
      success: true,
      data: { company: req.company, membership: req.membership },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/companies/:id
// Company admins may update their own company's workspace name.
// ─────────────────────────────────────────────────────────────────────────────
export const updateCompanySettings = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id);
    if (!company) {
      return next(new AppError('Company not found.', 404));
    }

    company.name = req.body.name;
    await company.save();

    return res.json({
      success: true,
      data: { company },
      message: 'Workspace settings updated.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/companies/:id/members
// List all active members of the company (agents and admins can see all;
// customers may only see agents and admins).
// Requires requireMembership middleware.
// ─────────────────────────────────────────────────────────────────────────────
export const getCompanyMembers = async (req, res, next) => {
  try {
    const companyId = req.company._id;
    const requesterRole = req.membership.role;

    // Customers see only agents and admins (not other customers)
    const roleFilter = requesterRole === 'customer'
      ? { role: { $in: ['agent', 'company_admin'] } }
      : {};

    const members = await Membership.find({
      company: companyId,
      active: true,
      ...roleFilter,
    })
      .populate('user', 'name email')
      .lean();

    return res.json({
      success: true,
      data: {
        members: members.map(m => ({
          membershipId: m._id,
          user: m.user,
          role: m.role,
          joinedAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/companies/:id/members
// Company admin directly adds a user to the company by email.
// This is a privileged operation — only company_admin may perform it.
// The target user must already have an account in the system.
// Requires requireMembership + authorizeCompanyRole('company_admin').
// ─────────────────────────────────────────────────────────────────────────────
export const addMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const companyId = req.company._id;

    // Find the target user by email
    const targetUser = await User.findOne({ email: email.toLowerCase().trim() })
      .select('_id name email role');
    if (!targetUser) {
      return next(new AppError(
        `No account found for ${email}. The user must register before being added.`,
        404
      ));
    }

    // Check the target user's membership directly; populating a single
    // arbitrary membership can miss a duplicate when the company has many users.
    const existing = await Membership.findOne({
      user: targetUser._id,
      company: companyId,
    });
    if (existing) {
      if (existing.active) {
        return next(new AppError(
          `${targetUser.name} (${targetUser.email}) is already an active member of this company.`,
          409
        ));
      }
      // Reactivate a previously deactivated membership
      existing.active = true;
      existing.role   = role;
      await existing.save();
      return res.status(200).json({
        success: true,
        data: {
          membership: {
            membershipId: existing._id,
            user: { _id: targetUser._id, name: targetUser.name, email: targetUser.email },
            role: existing.role,
            joinedAt: existing.createdAt,
          },
        },
        message: `${targetUser.name} has been re-added to the company as ${role}.`,
      });
    }

    // Create new membership
    const membership = await Membership.create({
      user: targetUser._id,
      company: companyId,
      role,
    });

    return res.status(201).json({
      success: true,
      data: {
        membership: {
          membershipId: membership._id,
          user: { _id: targetUser._id, name: targetUser.name, email: targetUser.email },
          role: membership.role,
          joinedAt: membership.createdAt,
        },
      },
      message: `${targetUser.name} has been added to the company as ${role}.`,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('This user is already a member of this company.', 409));
    }
    next(error);
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/companies/:id/invitations
// Company admin creates an invitation for a specific email + role.
// Requires requireMembership + authorizeCompanyRole('company_admin').
// ─────────────────────────────────────────────────────────────────────────────
export const createInvitation = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { email, role } = req.body;
    const companyId = req.company._id;
    const normalizedEmail = email.toLowerCase().trim();

    const invitedUser = await User.findOne({ email: normalizedEmail }).select('_id');
    const existingMembership = invitedUser
      ? await Membership.findOne({
        company: companyId,
        user: invitedUser._id,
        active: true,
      })
      : null;

    if (existingMembership) {
      return next(new AppError('This user is already an active member of this company.', 409));
    }

    const { plaintext, hash } = Invitation.generateToken();
    const expiresAt = new Date(Date.now() + Invitation.ttlHours * 60 * 60 * 1000);

    await session.withTransaction(async () => {
      // Reissuing an invite invalidates any earlier unused invite for this
      // address, and persists the replacement atomically.
      await Invitation.updateMany(
        {
          company: companyId,
          email: normalizedEmail,
          usedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { expiresAt: new Date(0) } },
        { session }
      );

      await Invitation.create([{
        company: companyId,
        email: normalizedEmail,
        role,
        tokenHash: hash,
        expiresAt,
        invitedBy: req.user._id,
      }], { session });
    });

    return res.status(201).json({
      success: true,
      data: {
        invitation: {
          company: companyId,
          email: normalizedEmail,
          role,
          expiresAt,
          token: plaintext,
        },
      },
      message: `Invitation created for ${normalizedEmail}. Share the token with the invitee; email delivery is not configured.`,
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/companies/:id/join
// Consume a valid invitation token to join the company.
// Requires `protect` only (no existing membership needed).
// ─────────────────────────────────────────────────────────────────────────────
export const joinCompany = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { token } = req.body;
    const companyId = req.params.id;

    if (!token) {
      return next(new AppError('Invitation token is required.', 400));
    }

    const tokenHash = Invitation.hashToken(token);

    // Find and lock the invitation inside the transaction
    let membership;
    let alreadyMember = false;
    await session.withTransaction(async () => {
      const invitation = await Invitation.findOne({
        tokenHash,
        company: companyId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (!invitation) {
        throw new AppError('Invitation is invalid, expired, or already used.', 400);
      }

      // Email must match the authenticated user
      if (invitation.email !== req.user.email.toLowerCase()) {
        throw new AppError(
          'This invitation was issued to a different email address.',
          403
        );
      }

      const existingMembership = await Membership.findOne({
        user: req.user._id,
        company: companyId,
      }).session(session);

      if (existingMembership?.active) {
        invitation.usedAt = new Date();
        await invitation.save({ session });
        alreadyMember = true;
        return;
      }

      if (existingMembership) {
        existingMembership.active = true;
        existingMembership.role = invitation.role;
        await existingMembership.save({ session });
        membership = existingMembership;
      } else {
        const [created] = await Membership.create(
          [{ user: req.user._id, company: companyId, role: invitation.role }],
          { session }
        );
        membership = created;
      }

      invitation.usedAt = new Date();
      await invitation.save({ session });
    });

    if (alreadyMember) {
      return next(new AppError('You are already an active member of this company.', 409));
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return next(new AppError('Company not found.', 404));
    }

    return res.status(201).json({
      success: true,
      data: {
        company,
        membership: {
          membershipId: membership._id,
          role: membership.role,
          joinedAt: membership.createdAt,
        },
      },
      message: `You have joined ${company.name} as ${membership.role}.`,
    });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    // Duplicate membership (race condition)
    if (error.code === 11000 && error.keyPattern?.user) {
      return next(new AppError('You are already a member of this company.', 409));
    }
    next(error);
  } finally {
    session.endSession();
  }
};
