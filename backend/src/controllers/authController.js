import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
});

/**
 * JWT payload shape.
 *
 * @typedef {object} JwtPayload
 * @property {string} userId
 * @property {string} role
 * @property {string} name
 */

/**
 * Create and set JWT as an httpOnly cookie.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @param {string} name - User name
 */
const setTokenCookie = (res, userId, role, name) => {
  const payload = { userId, role, name };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

  const cookieOptions = {
    ...authCookieOptions(),
    maxAge: expiresIn.includes('d')
      ? parseInt(expiresIn) * 24 * 60 * 60 * 1000
      : parseInt(expiresIn) * 1000,
  };

  res.cookie('token', token, cookieOptions);
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new customer account
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check for duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return next(new AppError('Email already registered.', 409));
    }

    // Create customer account (role defaults to 'customer')
    const user = await User.create({ name, email, password });

    // JWT payload excludes password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Set token cookie
    setTokenCookie(res, user._id.toString(), user.role, user.name);

    return res.status(201).json({
      success: true,
      data: { user: userResponse },
      message: 'Registration successful.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login a user (customer or agent)
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user WITH password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new AppError('Invalid credentials.', 401));
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return next(new AppError('Invalid credentials.', 401));
    }

    // JWT payload excludes password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Set token cookie
    setTokenCookie(res, user._id.toString(), user.role, user.name);

    return res.json({
      success: true,
      data: { user: userResponse },
      message: 'Login successful.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Clear authentication cookie and log out
 * @access  Public
 */
export const logout = (req, res) => {
  res.clearCookie('token', authCookieOptions());

  return res.json({
    success: true,
    data: {},
    message: 'Logged out successfully.',
  });
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private (requires authentication)
 */
export const getMe = (req, res) => {
  const userResponse = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  };

  return res.json({
    success: true,
    data: { user: userResponse },
  });
};
