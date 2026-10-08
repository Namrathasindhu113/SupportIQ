import AppError from '../utils/AppError.js';

/**
 * Translate known Mongoose/JWT errors into clean AppErrors
 * before the final response is sent.
 */
const normalizeError = (err) => {
  // Mongoose — CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
  }

  // Mongoose — duplicate key (unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new AppError(`${field} already exists.`, 409);
  }

  // Mongoose — ValidationError (schema-level)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return new AppError(messages.join(' '), 400);
  }

  return err;
};

/**
 * errorHandler — centralized Express error-handling middleware.
 *
 * Must be registered as the LAST middleware in app.js.
 * Catches every error passed via next(err) and returns a
 * consistent JSON response shape:
 *
 *   { success: false, message: string, errors: [] }
 *
 * Stack traces are included only in development.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = normalizeError(err);

  const statusCode = error.statusCode || 500;
  const message =
    error.isOperational
      ? error.message
      : 'Something went wrong. Please try again later.';

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    errors: [],
  });
};

export default errorHandler;
