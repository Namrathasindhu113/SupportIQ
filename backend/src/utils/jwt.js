import jwt from 'jsonwebtoken';

/**
 * Create a JWT token for testing purposes
 * @param {object} user - User object with id and role
 * @returns {string} JWT token
 */
export const createToken = (user) => {
  const payload = {
    userId: user._id.toString(),
    role: user.role,
    name: user.name
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { 
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
  });
};