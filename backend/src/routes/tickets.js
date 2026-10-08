import { Router } from 'express';
import { body, query } from 'express-validator';
import protect from '../middleware/protect.js';
import authorize from '../middleware/authorize.js';
import ownerOrAgent from '../middleware/ownerOrAgent.js';
import validate from '../middleware/validate.js';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateStatus,
  updatePriority,
  updateCategory,
  assignTicket,
} from '../controllers/ticketController.js';
import {
  getMessages,
  createMessage,
  getActivity,
} from '../controllers/messageController.js';

const router = Router();

// All ticket routes require authentication
router.use(protect);

// ── POST /api/v1/tickets ─────────────────────────────────────────────────────
router.post(
  '/',
  authorize('customer'),
  [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required.')
      .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters.'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required.')
      .isLength({ max: 3000 }).withMessage('Description cannot exceed 3000 characters.'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent.'),
    body('category')
      .optional()
      .isIn(['billing', 'technical', 'general', 'other'])
      .withMessage('Category must be one of: billing, technical, general, other.'),
    // Prevent client from injecting a customer or assignedTo field
    body('customer').not().exists().withMessage('customer field is not allowed.'),
    body('status').not().exists().withMessage('status field is not allowed.'),
    body('assignedTo').not().exists().withMessage('assignedTo field is not allowed.'),
  ],
  validate,
  createTicket
);

// ── GET /api/v1/tickets ──────────────────────────────────────────────────────
// Customers see only their own; agents see all — logic lives in controller
router.get(
  '/',
  [
    query('status')
      .optional()
      .isIn(['open', 'in_progress', 'resolved', 'closed'])
      .withMessage('status must be one of: open, in_progress, resolved, closed.'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('priority must be one of: low, medium, high, urgent.'),
    query('category')
      .optional()
      .isIn(['billing', 'technical', 'general', 'other'])
      .withMessage('category must be one of: billing, technical, general, other.'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('page must be a positive integer.'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50.'),
  ],
  validate,
  getTickets
);

// ── GET /api/v1/tickets/:id ───────────────────────────────────────────────────
router.get('/:id', ownerOrAgent, getTicketById);

// ── PATCH /api/v1/tickets/:id/status ─────────────────────────────────────────
router.patch(
  '/:id/status',
  authorize('agent'),
  ownerOrAgent,
  [
    body('status')
      .notEmpty().withMessage('status is required.')
      .isIn(['open', 'in_progress', 'resolved', 'closed'])
      .withMessage('status must be one of: open, in_progress, resolved, closed.'),
  ],
  validate,
  updateStatus
);

// ── PATCH /api/v1/tickets/:id/priority ───────────────────────────────────────
router.patch(
  '/:id/priority',
  authorize('agent'),
  ownerOrAgent,
  [
    body('priority')
      .notEmpty().withMessage('priority is required.')
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('priority must be one of: low, medium, high, urgent.'),
  ],
  validate,
  updatePriority
);

// ── PATCH /api/v1/tickets/:id/category ───────────────────────────────────────
router.patch(
  '/:id/category',
  authorize('agent'),
  ownerOrAgent,
  [
    body('category')
      .notEmpty().withMessage('category is required.')
      .isIn(['billing', 'technical', 'general', 'other'])
      .withMessage('category must be one of: billing, technical, general, other.'),
  ],
  validate,
  updateCategory
);

// ── PATCH /api/v1/tickets/:id/assign ─────────────────────────────────────────
router.patch(
  '/:id/assign',
  authorize('agent'),
  ownerOrAgent,
  [
    body('assignedTo')
      .exists({ checkNull: true })
      .withMessage('assignedTo is required (use null to unassign).')
      .custom((value) => {
        // Allow explicit null
        if (value === null) return true;
        // Otherwise must be a non-empty string (Mongoose will validate ObjectId format)
        if (typeof value === 'string' && value.trim().length > 0) return true;
        throw new Error('assignedTo must be a valid user ID or null.');
      }),
  ],
  validate,
  assignTicket
);

// ── GET /api/v1/tickets/:id/messages ─────────────────────────────────────────
router.get('/:id/messages', ownerOrAgent, getMessages);

// ── POST /api/v1/tickets/:id/messages ────────────────────────────────────────
router.post(
  '/:id/messages',
  ownerOrAgent,
  [
    body('body')
      .trim()
      .notEmpty().withMessage('Message body is required.')
      .isLength({ max: 5000 }).withMessage('Message cannot exceed 5000 characters.'),
    // Prevent client from specifying sender
    body('sender').not().exists().withMessage('sender field is not allowed.'),
  ],
  validate,
  createMessage
);

// ── GET /api/v1/tickets/:id/activity ─────────────────────────────────────────
router.get('/:id/activity', ownerOrAgent, getActivity);

export default router;
