import { Router } from 'express';
import { body, param } from 'express-validator';
import protect from '../middleware/protect.js';
import requireMembership from '../middleware/requireMembership.js';
import authorizeCompanyRole from '../middleware/authorizeCompanyRole.js';
import validate from '../middleware/validate.js';
import { COMPANY_ROLES } from '../models/Membership.js';
import {
  createCompany,
  getMyCompanies,
  getCompany,
  getCompanyMembers,
  createInvitation,
  joinCompany,
  addMember,
  updateCompanySettings,
} from '../controllers/companyController.js';

const router = Router();

// All company routes require authentication
router.use(protect);

// ── POST /api/v1/companies ────────────────────────────────────────────────────
// An agent creates a new workspace and becomes its first company_admin.
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Company name is required.')
      .isLength({ max: 120 }).withMessage('Company name cannot exceed 120 characters.'),
    body('slug')
      .trim()
      .notEmpty().withMessage('Company slug is required.')
      .toLowerCase()
      .matches(/^[a-z0-9-]{2,60}$/)
      .withMessage('Slug must be 2-60 lowercase letters, numbers, or hyphens.'),
  ],
  validate,
  createCompany
);

// ── GET /api/v1/companies/my ──────────────────────────────────────────────────
// List all companies the current user has an active membership in.
router.get('/my', getMyCompanies);

// ── POST /api/v1/companies/:id/join ──────────────────────────────────────────
// Consume an invitation token to join a company.
// Does NOT require requireMembership (the user doesn't have one yet).
router.post(
  '/:id/join',
  [
    param('id').isMongoId().withMessage('Company ID is invalid.'),
    body('token')
      .trim()
      .notEmpty().withMessage('Invitation token is required.'),
  ],
  validate,
  joinCompany
);

// ── Routes that require an existing membership ────────────────────────────────
router.use('/:id', param('id').isMongoId().withMessage('Company ID is invalid.'), validate, (req, _res, next) => {
  // Inject the company ID into the header so requireMembership can find it.
  // For these nested routes the :id param IS the company id.
  req.headers['x-company-id'] = req.params.id;
  next();
}, requireMembership);

// ── GET /api/v1/companies/:id ─────────────────────────────────────────────────
router.get('/:id', getCompany);

// ── PATCH /api/v1/companies/:id ──────────────────────────────────────────────
// Only company admins may update their own workspace settings.
router.patch(
  '/:id',
  authorizeCompanyRole('company_admin'),
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Company name is required.')
      .isLength({ max: 120 }).withMessage('Company name cannot exceed 120 characters.'),
  ],
  validate,
  updateCompanySettings
);

// ── GET /api/v1/companies/:id/members ────────────────────────────────────────
router.get('/:id/members', getCompanyMembers);

// ── POST /api/v1/companies/:id/invitations ───────────────────────────────────
// Only company admins may invite.
router.post(
  '/:id/invitations',
  authorizeCompanyRole('company_admin'),
  [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('role')
      .notEmpty().withMessage('Role is required.')
      .isIn(COMPANY_ROLES).withMessage(`Role must be one of: ${COMPANY_ROLES.join(', ')}.`),
  ],
  validate,
  createInvitation
);

// ── POST /api/v1/companies/:id/members ───────────────────────────────────────
// Company admin directly adds an existing user to the company.
// The user must already have an account.
router.post(
  '/:id/members',
  authorizeCompanyRole('company_admin'),
  [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('role')
      .notEmpty().withMessage('Role is required.')
      .isIn(COMPANY_ROLES).withMessage(`Role must be one of: ${COMPANY_ROLES.join(', ')}.`),
  ],
  validate,
  addMember
);

export default router;
