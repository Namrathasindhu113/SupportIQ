import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

/**
 * protect — authentication middleware.
 *
 * Reads the JWT from the `token` httpOnly cookie, verifies it,
 * then attaches the resolved user to `req.user`.
 *
 * Returns 401 if the cookie is missing, the token is invalid/expired,
 * or the user no longer exists in the database.
 */
const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return next(new AppError('Not authenticated. Please log in.', 401));
    }

    // Verify signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Confirm the user still exists (handles deleted accounts)
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    req.user = user; // { _id, name, email, role }
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please log in again.', 401));
    }
    next(error);
  }
};

export default protect;
