import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import protect from '../middleware/protect.js';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/authController.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new customer account
 * @access  Public
 */
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required.')
      .isLength({ max: 80 })
      .withMessage('Name cannot exceed 80 characters.'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required.')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.'),
  ],
  validate,
  register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login a user (customer or agent)
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required.')
      .isEmail()
      .withMessage('Please provide a valid email address.')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Clear authentication cookie
 * @access  Public (doesn't require token)
 */
router.post('/logout', logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private (requires authentication)
 */
router.get('/me', protect, getMe);

export default router;
